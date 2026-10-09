// =============================================================
// load.js — gera tráfego e, opcionalmente, injeta uma anomalia (Módulo 7, igual ao do Módulo 6)
//
//   node load.js                  modo normal: 50 pedidos a cada 5 s
//   node load.js --mode anomaly   aos 2 min o payment-service fica 2 s mais lento; aos 4 min volta
//   node load.js --mode erros     aos 2 min 30% dos pagamentos falham; aos 4 min volta
//   node load.js --mode pico      aos 2 min o volume triplica; aos 4 min volta
//
// Pelo Docker:  docker compose run --rm load --mode anomaly
// Roda até você apertar Ctrl+C (e desfaz a anomalia ao sair).
// =============================================================

const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PAYMENT_ADMIN_URL = process.env.PAYMENT_ADMIN_URL || 'http://localhost:3002';
const INTERVALO_MS = 5000;
const TAXA_ERRO = 0.05; // 5% dos POST vão com payload inválido (resposta 400)
const PAGAMENTOS = ['credit_card', 'pix', 'boleto'];

// Quando a anomalia começa e termina, em segundos desde o início
const INICIO_S = Number(process.env.ANOMALY_START_S || 120);
const FIM_S = Number(process.env.ANOMALY_END_S || 240);

// O que cada modo faz durante a anomalia
const MODOS = {
  normal: null,
  anomaly: { descricao: 'payment-service 2000 ms mais lento', chaos: { latency_ms: 2000 }, lote: 50 },
  erros: { descricao: '30% dos pagamentos falhando', chaos: { error_rate: 0.3 }, lote: 50 },
  pico: { descricao: 'volume de pedidos triplicado', chaos: {}, lote: 150 },
};

const posicao = process.argv.indexOf('--mode');
const modo = posicao > -1 ? process.argv[posicao + 1] : 'normal';
if (!(modo in MODOS)) {
  console.error(`Modo desconhecido: ${modo}. Use: ${Object.keys(MODOS).join(', ')}`);
  process.exit(1);
}

let requestsPorLote = 50;

const aleatorio = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const agora = () => new Date().toISOString();

function imprimir(metodo, caminho, status) {
  console.log(`[${agora()}] ${metodo} ${caminho} - Status ${status}`);
}

// Liga ou desliga a anomalia no payment-service
async function configurarChaos(config) {
  try {
    await fetch(`${PAYMENT_ADMIN_URL}/chaos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch (erro) {
    console.error(`[${agora()}] Não consegui falar com ${PAYMENT_ADMIN_URL}/chaos (${erro.message})`);
  }
}

async function criarEBuscarPedido() {
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': crypto.randomUUID(),
    'X-Customer-Tier': Math.random() < 0.3 ? 'premium' : 'standard',
  };

  // 5% das vezes mandamos um pedido sem customer_id para provocar um 400
  const payload =
    Math.random() < TAXA_ERRO
      ? { amount: aleatorio(100, 1000) }
      : {
          customer_id: `CUST-${aleatorio(1, 500)}`,
          amount: aleatorio(100, 1000),
          payment_method: PAGAMENTOS[aleatorio(0, PAGAMENTOS.length - 1)],
        };

  try {
    const resposta = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    imprimir('POST', '/orders', resposta.status);
    if (!resposta.ok) return;

    const { order_id } = await resposta.json();
    const busca = await fetch(`${BASE_URL}/orders/${order_id}`, { headers });
    imprimir('GET', `/orders/${order_id}`, busca.status);
  } catch (erro) {
    console.error(`[${agora()}] Sem conexão com ${BASE_URL} (${erro.message}). A app está no ar?`);
  }
}

function enviarLote() {
  for (let i = 0; i < requestsPorLote; i++) criarEBuscarPedido();
}

function aviso(texto) {
  console.log(`\n[${agora()}] >>>>>>>>>> ${texto} <<<<<<<<<<\n`);
}

async function sair() {
  if (MODOS[modo]) await configurarChaos({});
  console.log('\nTráfego encerrado.');
  process.exit(0);
}

async function iniciar() {
  const anomalia = MODOS[modo];
  console.log(`Modo ${modo}: ${requestsPorLote} pedidos a cada ${INTERVALO_MS / 1000}s para ${BASE_URL}. Ctrl+C para parar.`);

  if (anomalia) {
    await configurarChaos({}); // garante que começamos do estado normal
    console.log(`Linha do tempo: normal até ${INICIO_S}s, anomalia (${anomalia.descricao}) até ${FIM_S}s, depois normal.`);

    setTimeout(async () => {
      await configurarChaos(anomalia.chaos);
      requestsPorLote = anomalia.lote;
      aviso(`ANOMALIA INICIADA: ${anomalia.descricao}`);
    }, INICIO_S * 1000);

    setTimeout(async () => {
      await configurarChaos({});
      requestsPorLote = 50;
      aviso('ANOMALIA ENCERRADA: de volta ao normal');
    }, FIM_S * 1000);
  }

  enviarLote();
  setInterval(enviarLote, INTERVALO_MS);
}

process.on('SIGINT', sair);
process.on('SIGTERM', sair);
iniciar();
