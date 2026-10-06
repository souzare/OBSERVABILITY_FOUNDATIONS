// =============================================================
// checkout-api — Módulo 2: Pilares da Observabilidade
//
// Uma API de pedidos bem simples, instrumentada com os 3 pilares:
//   1. TRACES   (OpenTelemetry -> Jaeger)
//   2. LOGS     (Pino -> stdout, em JSON)
//   3. MÉTRICAS (prom-client -> Prometheus, via GET /metrics)
// =============================================================

const crypto = require('crypto');
const express = require('express');
const pino = require('pino');
const prom = require('prom-client');
const { NodeSDK, tracing } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { trace, context, SpanKind, SpanStatusCode } = require('@opentelemetry/api');

// ---------- Configuração (vem do .env) ----------
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'checkout-api';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const ERROR_RATE = Number(process.env.ERROR_RATE || 0.05);
const TRACE_SAMPLE_RATE = Number(process.env.TRACE_SAMPLE_RATE || 1); // 1 = 100% dos traces

// =============================================================
// PILAR 1: TRACES (OpenTelemetry)
// =============================================================
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': SERVICE_NAME,
    'service.version': SERVICE_VERSION,
  }),
  // O Jaeger recebe os spans pelo protocolo OTLP (HTTP, porta 4318)
  traceExporter: new OTLPTraceExporter({ url: `${OTLP_ENDPOINT}/v1/traces` }),
  // SAMPLING: a decisão é tomada no início da requisição (head sampling), a partir do trace_id.
  // Os spans filhos seguem a decisão do span raiz (ParentBased).
  sampler: new tracing.ParentBasedSampler({
    root: new tracing.TraceIdRatioBasedSampler(TRACE_SAMPLE_RATE),
  }),
});
sdk.start();

const tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

// =============================================================
// PILAR 2: LOGS (Pino, JSON estruturado no stdout)
// =============================================================
const logger = pino({
  base: { service: SERVICE_NAME },
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: { level: (label) => ({ level: label }) },
});

// =============================================================
// PILAR 3: MÉTRICAS (prom-client)
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
const aleatorio = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ---------- Middleware: instrumenta TODA requisição ----------
app.use((req, res, next) => {
  if (req.path === '/metrics') return next(); // não observamos o scrape do Prometheus

  const inicio = Date.now();

  // TRACE: 1 requisição = 1 root span
  const span = tracer.startSpan(`${req.method} ${req.path}`, { kind: SpanKind.SERVER });
  res.locals.span = span;

  // SAMPLING: se o trace não foi amostrado, o span existe mas não grava nem é enviado
  const sampled = span.isRecording();
  tracesTotal.inc({ sampled });

  // Campos comuns a todos os logs desta requisição.
  // O trace_id é a "cola" entre o log e o trace no Jaeger.
  const log = logger.child({
    trace_id: span.spanContext().traceId,
    sampled,
    correlation_id: req.get('x-correlation-id') || crypto.randomUUID(),
    method: req.method,
    endpoint: req.path,
  });
  res.locals.log = log;

  // LOG de entrada
  log.info({ customer_id: req.body?.customer_id }, 'requisição recebida');

  res.on('finish', () => {
    const duracaoMs = Date.now() - inicio;
    const status = res.statusCode;
    // Rota "genérica" (/orders/:id) para não criar uma série por pedido nas métricas
    const endpoint = req.route ? req.route.path : 'desconhecido';

    // LOG de saída
    const nivel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    log[nivel](
      { status, duration_ms: duracaoMs, customer_id: res.locals.customer_id, order_id: res.locals.order_id },
      'requisição finalizada'
    );

    // MÉTRICAS
    const labels = { method: req.method, endpoint, status };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duracaoMs / 1000);

    // TRACE: completa e encerra o root span
    span.updateName(`${req.method} ${endpoint}`);
    span.setAttributes({
      method: req.method,
      endpoint,
      'http.status_code': status,
      customer_id: res.locals.customer_id,
      order_id: res.locals.order_id,
    });
    if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
  });

  // Tudo que rodar daqui em diante vira "filho" do root span
  context.with(trace.setSpan(context.active(), span), next);
});

// ---------- POST /orders: cria um pedido ----------
app.post('/orders', async (req, res) => {
  const { customer_id, amount } = req.body || {};
  res.locals.customer_id = customer_id;

  if (!customer_id || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'customer_id e amount (número > 0) são obrigatórios' });
  }

  const order = {
    order_id: `ORD-${crypto.randomUUID().slice(0, 8)}`,
    customer_id,
    amount,
    status: 'pending',
    timestamp: new Date().toISOString(),
  };
  res.locals.order_id = order.order_id;

  // Simula a lógica de negócio (100 a 500 ms)
  await tracer.startActiveSpan('processar-pedido', async (span) => {
    span.setAttribute('amount', amount);
    await esperar(aleatorio(100, 500));
    span.end();
  });

  orders.set(order.order_id, order);
  if (orders.size > 10000) orders.delete(orders.keys().next().value); // evita crescer para sempre

  // O pedido fica pendente por alguns segundos e depois é confirmado
  ordersPending.inc();
  setTimeout(() => {
    order.status = 'confirmed';
    ordersPending.dec();
  }, aleatorio(2000, 10000));

  res.status(201).json({ order_id: order.order_id, status: order.status, timestamp: order.timestamp });
});

// ---------- GET /orders/:id: busca um pedido ----------
app.get('/orders/:id', async (req, res) => {
  res.locals.order_id = req.params.id;

  // Simula a consulta ao "banco" (50 ms)
  const order = await tracer.startActiveSpan('db.buscar-pedido', async (span) => {
    await esperar(50);
    span.end();
    return orders.get(req.params.id);
  });

  // Falha intermitente (5% das vezes)
  if (Math.random() < ERROR_RATE) {
    throw new Error('Falha intermitente ao consultar o banco de pedidos');
  }

  if (!order) return res.status(404).json({ error: 'pedido não encontrado' });

  res.locals.customer_id = order.customer_id;
  res.json(order);
});

// ---------- GET /metrics: o Prometheus vem buscar aqui ----------
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prom.register.contentType);
  res.send(await prom.register.metrics());
});

// ---------- Tratamento de erros: log com stack trace + erro no span ----------
app.use((err, req, res, next) => {
  const log = res.locals.log || logger;
  log.error({ err }, 'erro ao processar requisição');
  if (res.locals.span) res.locals.span.recordException(err);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => {
  logger.info({ port: PORT, otlp_endpoint: OTLP_ENDPOINT, trace_sample_rate: TRACE_SAMPLE_RATE }, `${SERVICE_NAME} no ar`);
});

// Envia os spans que ainda estão em memória antes de desligar
process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
