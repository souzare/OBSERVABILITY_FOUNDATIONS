// =============================================================
// checkout-api — Módulo 4: dois serviços, um trace
//
// A API do Módulo 3, que agora chama o payment-service para cobrar o pedido.
// O contexto do trace viaja na chamada HTTP (cabeçalhos W3C), então os spans
// dos dois serviços aparecem no MESMO trace no Jaeger.
// =============================================================

// PRECISA ser a primeira linha: liga o OpenTelemetry antes de carregar o Express
const config = require('./tracing');

const crypto = require('crypto');
const express = require('express');
const pino = require('pino');
const prom = require('prom-client');
const { trace, context, propagation, SpanStatusCode } = require('@opentelemetry/api');

const PORT = process.env.PORT || 3000;
const DB_ERROR_RATE = Number(process.env.DB_ERROR_RATE || 0);
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001';

const tracer = trace.getTracer(config.SERVICE_NAME, config.SERVICE_VERSION);

// =============================================================
// LOGS: Pino + correlação com o trace
// =============================================================
const logger = pino({
  base: { service: config.SERVICE_NAME },
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: { level: (label) => ({ level: label.toUpperCase() }) },
  // LOG CORRELATION: toda linha de log ganha o trace_id e o span_id do span ativo,
  // além dos itens da baggage (customer_id, order_id, correlation_id).
  mixin() {
    const span = trace.getActiveSpan();
    if (!span) return {};
    const campos = { trace_id: span.spanContext().traceId, span_id: span.spanContext().spanId };
    const bagagem = propagation.getActiveBaggage();
    if (bagagem) {
      for (const [chave, item] of bagagem.getAllEntries()) campos[chave] = item.value;
    }
    return campos;
  },
});

// =============================================================
// MÉTRICAS (iguais às do Módulo 2)
// =============================================================
const httpRequestsTotal = new prom.Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP recebidas',
  labelNames: ['method', 'endpoint', 'status'],
});

const httpRequestDuration = new prom.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
});

const tracesTotal = new prom.Counter({
  name: 'traces_total',
  help: 'Traces iniciados, separados entre amostrados (enviados ao Jaeger) e descartados',
  labelNames: ['sampled'],
});

const ordersPending = new prom.Gauge({
  name: 'orders_pending',
  help: 'Pedidos criados que ainda aguardam confirmação',
});

// =============================================================
// APLICAÇÃO
// =============================================================
const app = express();
app.use(express.json());

const orders = new Map(); // nosso "banco de dados" em memória

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Cria um span filho do span ativo, roda a função dentro dele e SEMPRE o encerra.
// Se a função lançar erro, o span fica marcado com erro (ERROR HANDLING).
function emSpan(nome, funcao) {
  return tracer.startActiveSpan(nome, async (span) => {
    try {
      return await funcao(span);
    } catch (erro) {
      span.recordException(erro);
      span.setStatus({ code: SpanStatusCode.ERROR, message: erro.message });
      throw erro;
    } finally {
      span.end();
    }
  });
}

// ---------- Middleware: métricas e log de cada requisição ----------
// Repare: não criamos mais o span aqui. Ele já existe (auto-instrumentação).
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  const inicio = Date.now();
  const contexto = context.active();
  res.locals.correlation_id = req.get('x-correlation-id') || crypto.randomUUID();

  tracesTotal.inc({ sampled: trace.getActiveSpan()?.isRecording() ?? false });
  logger.info({ method: req.method, endpoint: req.path, correlation_id: res.locals.correlation_id }, 'requisição recebida');

  res.on('finish', () => {
    const duracaoMs = Date.now() - inicio;
    const status = res.statusCode;
    const endpoint = req.route ? req.route.path : 'desconhecido';

    const labels = { method: req.method, endpoint, status };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duracaoMs / 1000);

    // context.with garante que este log saia com o trace_id da requisição
    context.with(contexto, () => {
      const nivel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      logger[nivel](
        {
          method: req.method,
          endpoint: req.path,
          status,
          duration_ms: duracaoMs,
          correlation_id: res.locals.correlation_id,
          customer_id: res.locals.customer_id,
          order_id: res.locals.order_id,
        },
        'requisição finalizada'
      );
    });
  });

  next();
});

// =============================================================
// POST /orders — hierarquia de spans
//
//   POST /orders                (auto-instrumentação HTTP)
//   └─ process_order            (nosso span "de negócio")
//      ├─ validate_order
//      ├─ save_to_database
//      └─ call_payment_service  (chamada HTTP ao outro serviço)
//         └─ POST /process-payment   <- daqui para baixo, spans do payment-service
//            └─ process_payment
// =============================================================
app.post('/orders', async (req, res) => {
  const { customer_id, amount, payment_method = 'credit_card' } = req.body || {};
  const order = {
    order_id: `ORD-${crypto.randomUUID().slice(0, 8)}`,
    customer_id,
    amount,
    payment_method,
    status: 'pending',
    timestamp: new Date().toISOString(),
  };
  res.locals.customer_id = customer_id;
  res.locals.order_id = order.order_id;

  // BAGGAGE: dados que acompanham a requisição por todos os spans (e logs) a partir daqui
  const bagagem = propagation.createBaggage({
    customer_id: { value: String(customer_id ?? 'desconhecido') },
    order_id: { value: order.order_id },
    correlation_id: { value: res.locals.correlation_id },
  });
  const contextoComBagagem = propagation.setBaggage(context.active(), bagagem);

  try {
    await context.with(contextoComBagagem, () =>
      emSpan('process_order', async (span) => {
        // ATRIBUTOS: descrevem ESTE span e servem de filtro na busca do Jaeger
        span.setAttributes({
          payment_method,
          customer_tier: req.get('x-customer-tier') || 'standard',
        });

        await validarPedido(order);
        await salvarNoBanco(order);
        await chamarPagamento(order);
        logger.info('pedido processado');
      })
    );
    res.status(201).json({ order_id: order.order_id, status: order.status, timestamp: order.timestamp });
  } catch (erro) {
    // O span já foi marcado com erro pelo emSpan; aqui registramos o log e respondemos
    context.with(contextoComBagagem, () => logger.error({ err: erro }, 'falha ao processar pedido'));
    res.status(erro.status || 500).json({ error: erro.message });
  }
});

// ---------- validate_order (50 ms) ----------
function validarPedido(order) {
  return emSpan('validate_order', async (span) => {
    // EVENTO: um momento marcante dentro do span, com horário exato
    span.addEvent('order.validation.started');
    await esperar(50);

    if (!order.customer_id || typeof order.amount !== 'number' || order.amount <= 0) {
      span.addEvent('order.validation.failed', { motivo: 'customer_id ou amount inválido' });
      const erro = new Error('customer_id e amount (número > 0) são obrigatórios');
      erro.status = 400;
      throw erro;
    }

    span.addEvent('order.validation.passed');
    logger.info('pedido validado');
  });
}

// ---------- save_to_database (200 ms por tentativa, até 3 tentativas) ----------
function salvarNoBanco(order) {
  return emSpan('save_to_database', async (span) => {
    const inicio = Date.now();
    let tentativas = 0;

    while (true) {
      tentativas++;
      await esperar(200);
      const falhou = Math.random() < DB_ERROR_RATE;
      if (!falhou) break;

      span.addEvent('database.insert.retry', { tentativa: tentativas });
      logger.warn({ tentativa: tentativas }, 'falha ao gravar no banco, tentando de novo');
      if (tentativas === 3) {
        span.setAttribute('tentativas', tentativas);
        throw new Error('Banco de pedidos indisponível após 3 tentativas');
      }
    }

    orders.set(order.order_id, order);
    if (orders.size > 10000) orders.delete(orders.keys().next().value); // evita crescer para sempre

    // O pedido fica pendente por alguns segundos e depois é confirmado
    ordersPending.inc();
    setTimeout(() => {
      order.status = 'confirmed';
      ordersPending.dec();
    }, 2000 + Math.random() * 8000);

    span.setAttributes({ tentativas, rows_affected: 1, db_latency_ms: Date.now() - inicio });
    span.addEvent('database.insert.completed');
    logger.info({ tentativas }, 'pedido gravado no banco');
  });
}

// ---------- call_payment_service: chama o outro serviço (com 1 nova tentativa) ----------
function chamarPagamento(order) {
  return emSpan('call_payment_service', async (span) => {
    span.setAttribute('peer.service', 'payment-service');
    let tentativas = 0;

    while (true) {
      tentativas++;
      span.setAttribute('tentativas', tentativas);

      // PROPAGAÇÃO DE CONTEXTO: grava o contexto atual nos cabeçalhos HTTP.
      // Entram dois cabeçalhos padrão W3C:
      //   traceparent: 00-<trace_id>-<span_id deste span>-01
      //   baggage:     customer_id=...,order_id=...,correlation_id=...
      // É por causa deles que o payment-service continua o MESMO trace.
      const headers = { 'Content-Type': 'application/json' };
      propagation.inject(context.active(), headers);

      let resultado;
      try {
        const resposta = await fetch(`${PAYMENT_SERVICE_URL}/process-payment`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ order_id: order.order_id, amount: order.amount, customer_id: order.customer_id }),
          signal: AbortSignal.timeout(3000),
        });
        resultado = await resposta.json();
      } catch (erro) {
        resultado = { success: false, error: erro.message };
      }

      if (resultado.success) {
        span.setAttribute('transaction_id', resultado.transaction_id);
        span.addEvent('payment.approved');
        logger.info(
          { transaction_id: resultado.transaction_id, tentativas, traceparent: headers.traceparent },
          'pagamento aprovado'
        );
        return;
      }

      span.addEvent('payment.failed', { tentativa: tentativas, erro: resultado.error });
      logger.warn({ tentativa: tentativas, erro: resultado.error }, 'pagamento falhou');
      if (tentativas === 2) {
        const erro = new Error(`Pagamento falhou após 2 tentativas: ${resultado.error}`);
        erro.status = 502;
        throw erro;
      }
    }
  });
}

// ---------- GET /orders/:id: busca um pedido ----------
app.get('/orders/:id', async (req, res) => {
  res.locals.order_id = req.params.id;

  const order = await emSpan('find_order', async (span) => {
    span.setAttribute('order_id', req.params.id);
    await esperar(50);
    return orders.get(req.params.id);
  });

  if (!order) return res.status(404).json({ error: 'pedido não encontrado' });

  res.locals.customer_id = order.customer_id;
  res.json(order);
});

// ---------- GET /metrics: o Prometheus vem buscar aqui ----------
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prom.register.contentType);
  res.send(await prom.register.metrics());
});

// ---------- Erros não tratados: log ERROR + erro no span da requisição ----------
app.use((err, req, res, next) => {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  }
  logger.error({ err }, 'erro ao processar requisição');
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => {
  logger.info(
    { port: PORT, otlp_endpoint: config.OTLP_ENDPOINT, trace_sample_rate: config.TRACE_SAMPLE_RATE },
    `${config.SERVICE_NAME} no ar`
  );
});
