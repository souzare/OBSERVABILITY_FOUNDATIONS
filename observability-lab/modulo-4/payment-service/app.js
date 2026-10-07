// =============================================================
// payment-service — Módulo 4
//
// Um segundo serviço, independente, chamado pela checkout-api.
// Ele NÃO cria um trace novo: continua o trace que chega no cabeçalho
// "traceparent" da requisição.
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
    const campos = { trace_id: span.spanContext().traceId, span_id: span.spanContext().spanId };
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
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
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
      // Falha simulada: 5% das vezes o "gateway" não responde a tempo
      if (Math.random() < PAYMENT_ERROR_RATE) {
        await esperar(1000);
        span.addEvent('payment.gateway.timeout');
        throw new Error('timeout');
      }

      // Caminho normal: 200 a 400 ms
      await esperar(aleatorio(200, 400));
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

      res.status(504).json({ success: false, error: erro.message, timestamp: new Date().toISOString() });
    } finally {
      span.end();
    }
  });
});

// ---------- GET /metrics: o Prometheus vem buscar aqui ----------
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prom.register.contentType);
  res.send(await prom.register.metrics());
});

app.listen(PORT, () => {
  logger.info({ port: PORT, otlp_endpoint: config.OTLP_ENDPOINT }, `${config.SERVICE_NAME} no ar`);
});
