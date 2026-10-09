// =============================================================
// payment-service — Módulo 7 (Datadog)
//
// Um segundo serviço, independente, chamado pela checkout-api.
// Ele NÃO cria um trace novo: continua o trace que chega no cabeçalho
// "traceparent" da requisição.
//
// Novidade do Módulo 6: o endpoint /chaos, que injeta lentidão ou erros
// de propósito para simularmos uma anomalia.
// =============================================================

// PRECISA ser a primeira linha: liga o OpenTelemetry antes de carregar o Express
const config = require('./tracing');

const crypto = require('crypto');
const express = require('express');
const pino = require('pino');
const prom = require('prom-client');
const { trace, propagation, SpanStatusCode } = require('@opentelemetry/api');

const PORT = process.env.PORT || 3001;
const PAYMENT_ERROR_RATE = Number(process.env.PAYMENT_ERROR_RATE || 0.05);
const PAYMENT_ERROR_DELAY_MS = Number(process.env.PAYMENT_ERROR_DELAY_MS || 300);

// ANOMALIA: estado alterado pelo endpoint /chaos (veja o fim do arquivo)
const chaos = { latency_ms: 0, error_rate: null };

const tracer = trace.getTracer(config.SERVICE_NAME, config.SERVICE_VERSION);

// ---------- LOGS: mesmo formato da checkout-api ----------
const logger = pino({
  base: { service: config.SERVICE_NAME },
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: { level: (label) => ({ level: label.toUpperCase() }) },
  // trace_id, span_id e baggage em toda linha. A baggage chegou pela rede,
  // no cabeçalho "baggage": ninguém precisou repassar customer_id ou order_id.
  mixin() {
    const span = trace.getActiveSpan();
    if (!span) return {};
    const { traceId, spanId } = span.spanContext();
    const campos = {
      trace_id: traceId,
      span_id: spanId,
      // DATADOG: para ligar o log ao trace, o Datadog espera os IDs em decimal de 64 bits.
      // O trace_id do OpenTelemetry tem 128 bits em hexadecimal; usamos a metade final.
      dd: {
        trace_id: BigInt(`0x${traceId.slice(16)}`).toString(),
        span_id: BigInt(`0x${spanId}`).toString(),
      },
    };
    const bagagem = propagation.getActiveBaggage();
    if (bagagem) {
      for (const [chave, item] of bagagem.getAllEntries()) campos[chave] = item.value;
    }
    return campos;
  },
});

// ---------- MÉTRICAS: mesmos nomes da checkout-api ----------
const httpRequestsTotal = new prom.Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP recebidas',
  labelNames: ['method', 'endpoint', 'status'],
});

const httpRequestDuration = new prom.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5],
});

const app = express();
app.use(express.json());

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const aleatorio = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ---------- Middleware: métricas de cada requisição ----------
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();
  const inicio = Date.now();
  res.on('finish', () => {
    const labels = { method: req.method, endpoint: req.route ? req.route.path : 'desconhecido', status: res.statusCode };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, (Date.now() - inicio) / 1000);
  });
  next();
});

// =============================================================
// POST /process-payment
//
//   POST /process-payment   (auto-instrumentação HTTP: lê o traceparent e continua o trace)
//   └─ process_payment      (nosso span de negócio)
// =============================================================
app.post('/process-payment', async (req, res) => {
  const { order_id, amount, customer_id } = req.body || {};

  // Mostra no log o que chegou pela rede: é a prova da propagação de contexto
  logger.info({ traceparent: req.get('traceparent'), baggage: req.get('baggage') }, 'pagamento recebido');

  await tracer.startActiveSpan('process_payment', async (span) => {
    span.setAttributes({ amount, payment_gateway: 'simulado' });

    try {
      // Falha simulada: 5% das vezes o "gateway" recusa (ou a taxa definida pelo /chaos)
      const taxaDeErro = chaos.error_rate ?? PAYMENT_ERROR_RATE;
      if (Math.random() < taxaDeErro) {
        await esperar(PAYMENT_ERROR_DELAY_MS);
        span.addEvent('payment.gateway.error');
        throw new Error('gateway_unavailable');
      }

      // Caminho normal: 200 a 400 ms, mais a lentidão injetada pelo /chaos
      span.setAttribute('chaos.latency_ms', chaos.latency_ms);
      await esperar(aleatorio(200, 400) + chaos.latency_ms);
      const transaction_id = `TXN-${crypto.randomUUID().slice(0, 8)}`;
      span.setAttribute('transaction_id', transaction_id);
      span.addEvent('payment.authorized');
      logger.info({ transaction_id, amount }, 'pagamento autorizado');

      res.json({ success: true, transaction_id, timestamp: new Date().toISOString() });
    } catch (erro) {
      // ERROR HANDLING: o span fica vermelho no Jaeger
      span.recordException(erro);
      span.setStatus({ code: SpanStatusCode.ERROR, message: erro.message });
      logger.error({ err: erro, order_id, customer_id }, 'falha ao processar pagamento');

      res.status(503).json({ success: false, error: erro.message, timestamp: new Date().toISOString() });
    } finally {
      span.end();
    }
  });
});

// =============================================================
// /chaos — injeção de anomalia (só para a demo)
//
//   POST /chaos {"latency_ms": 2000}   deixa todo pagamento 2 s mais lento
//   POST /chaos {"error_rate": 0.3}    faz 30% dos pagamentos falharem
//   POST /chaos {}                     volta ao normal
// =============================================================
app.post('/chaos', (req, res) => {
  chaos.latency_ms = Number(req.body?.latency_ms || 0);
  chaos.error_rate = req.body?.error_rate ?? null;
  logger.warn({ chaos }, 'configuração de anomalia alterada');
  res.json(chaos);
});

app.get('/chaos', (req, res) => res.json(chaos));

// ---------- GET /metrics: o Prometheus vem buscar aqui ----------
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prom.register.contentType);
  res.send(await prom.register.metrics());
});

app.listen(PORT, () => {
  logger.info({ port: PORT, otlp_endpoint: config.OTLP_ENDPOINT }, `${config.SERVICE_NAME} no ar`);
});
