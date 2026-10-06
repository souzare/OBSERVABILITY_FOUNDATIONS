// =============================================================
// load.js — gera tráfego para a demo do Módulo 3
//
// A cada 5 segundos envia 50 POST /orders e, para cada pedido
// criado, faz um GET /orders/:id. Roda até você apertar Ctrl+C.
//
// Uso:  node load.js            (Node 18+)
//  ou:  docker compose run --rm load
// =============================================================

const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REQUESTS_POR_LOTE = 50;
const INTERVALO_MS = 5000;
const TAXA_ERRO = 0.05; // 5% dos POST vão com payload inválido (resposta 400)
const PAGAMENTOS = ['credit_card', 'pix', 'boleto'];

const aleatorio = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function imprimir(metodo, caminho, status) {
  console.log(`[${new Date().toISOString()}] ${metodo} ${caminho} - Status ${status}`);
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

    // Busca o pedido recém-criado
    const { order_id } = await resposta.json();
    const busca = await fetch(`${BASE_URL}/orders/${order_id}`, { headers });
    imprimir('GET', `/orders/${order_id}`, busca.status);
  } catch (erro) {
    console.error(`[${new Date().toISOString()}] Sem conexão com ${BASE_URL} (${erro.message}). A app está no ar?`);
  }
}

function enviarLote() {
  for (let i = 0; i < REQUESTS_POR_LOTE; i++) criarEBuscarPedido();
}

console.log(`Enviando ${REQUESTS_POR_LOTE} pedidos a cada ${INTERVALO_MS / 1000}s para ${BASE_URL}. Ctrl+C para parar.`);
enviarLote();
setInterval(enviarLote, INTERVALO_MS);

process.on('SIGINT', () => {
  console.log('\nTráfego encerrado.');
  process.exit(0);
});
