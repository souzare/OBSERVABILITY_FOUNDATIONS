// =============================================================
// tracing.js — configuração do OpenTelemetry (Módulo 6, igual nos dois serviços)
//
// Este arquivo precisa ser carregado ANTES do Express (veja a 1ª linha
// do app.js): é assim que a auto-instrumentação consegue "envolver"
// os módulos http e express e criar spans sozinha.
// =============================================================

const { NodeSDK, tracing } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { propagation } = require('@opentelemetry/api');

const SERVICE_NAME = process.env.SERVICE_NAME || 'checkout-api';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const TRACE_SAMPLE_RATE = Number(process.env.TRACE_SAMPLE_RATE || 1); // 1 = 100% dos traces

// ---------- BAGGAGE -> ATRIBUTOS ----------
// A baggage viaja junto com o contexto, mas NÃO aparece nos spans sozinha.
// Este processador copia cada item da baggage para todo span que nasce,
// então customer_id, order_id e correlation_id aparecem em todos os spans filhos.
class BaggageParaAtributos {
  onStart(span, contextoPai) {
    const bagagem = propagation.getBaggage(contextoPai);
    if (!bagagem) return;
    for (const [chave, item] of bagagem.getAllEntries()) {
      span.setAttribute(chave, item.value);
    }
  }
  onEnd() {}
  shutdown() { return Promise.resolve(); }
  forceFlush() { return Promise.resolve(); }
}

const sdk = new NodeSDK({
  // Quem somos: aparece em todo span enviado
  resource: resourceFromAttributes({
    'service.name': SERVICE_NAME,
    'service.version': SERVICE_VERSION,
  }),

  // SAMPLING: mesma regra do Módulo 2 (decisão no início, filhos seguem o pai)
  sampler: new tracing.ParentBasedSampler({
    root: new tracing.TraceIdRatioBasedSampler(TRACE_SAMPLE_RATE),
  }),

  spanProcessors: [
    new BaggageParaAtributos(),
    // Envia os spans em lotes para o Jaeger (OTLP/HTTP, porta 4318)
    new tracing.BatchSpanProcessor(new OTLPTraceExporter({ url: `${OTLP_ENDPOINT}/v1/traces` })),
  ],

  // AUTO-INSTRUMENTAÇÃO: cria o span de cada requisição HTTP sem código nosso
  instrumentations: [
    new HttpInstrumentation({
      // não rastreamos o scrape do Prometheus nem o controle de anomalia
      ignoreIncomingRequestHook: (req) => req.url === '/metrics' || req.url === '/chaos',
    }),
    new ExpressInstrumentation({
      // Usamos o Express só para nomear o span com a rota (ex.: "GET /orders/:id").
      // Sem isto, cada middleware viraria um span e poluiria o trace.
      ignoreLayersType: ['middleware', 'router', 'request_handler'],
    }),
  ],
});

sdk.start();

// Envia os spans que ainda estão em memória antes de desligar
process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});

module.exports = { SERVICE_NAME, SERVICE_VERSION, OTLP_ENDPOINT, TRACE_SAMPLE_RATE };
