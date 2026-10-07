// =============================================================
// exemplo.js — Módulo 5: a tríade CIA em um pedido da checkout-api
//
// Uso:  node exemplo.js
//  ou:  docker run --rm -v "$PWD":/app -w /app node:22-alpine node exemplo.js
// =============================================================

const crypto = require('crypto');
const {
  maskEmail,
  maskCreditCard,
  maskCustomerId,
  maskPhone,
  maskIPAddress,
  pseudonymize,
  maskSensitiveFields,
} = require('./data-masking');

// Um evento como o que a checkout-api registraria ao receber um pedido
const evento = {
  timestamp: '2026-10-03T15:30:00Z',
  trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
  level: 'INFO',
  message: 'pedido recebido',
  order_id: 'ORD-6d0bb578',
  customer_id: 'CUST-295',
  customer_email: 'john.doe@company.com',
  customer_phone: '+55 (11) 98765-1234',
  client_ip: '192.168.10.25',
  payment: { payment_method: 'credit_card', credit_card: '4532-1234-5678-9999', amount: 250 },
};

function titulo(texto) {
  console.log(`\n=== ${texto} ===`);
}

// ---------- CONFIDENCIALIDADE ----------
titulo('1. Cada função, isolada');
console.log('maskEmail      ', evento.customer_email, '->', maskEmail(evento.customer_email));
console.log('maskCreditCard ', evento.payment.credit_card, '->', maskCreditCard(evento.payment.credit_card));
console.log('maskCustomerId ', evento.customer_id, '->', maskCustomerId(evento.customer_id));
console.log('maskPhone      ', evento.customer_phone, '->', maskPhone(evento.customer_phone));
console.log('maskIPAddress  ', evento.client_ip, '->', maskIPAddress(evento.client_ip));

titulo('2. ANTES: o log como sairia sem tratamento');
console.log(JSON.stringify(evento));

titulo('3. DEPOIS: o mesmo log, mascarado antes de sair da aplicação');
console.log(JSON.stringify(maskSensitiveFields(evento)));

titulo('4. Mascarar ou pseudonimizar o customer_id?');
const SEGREDO = 'troque-por-um-segredo-fora-do-codigo';
console.log('Mascarado:      ', maskCustomerId('CUST-295'), '| outro cliente:', maskCustomerId('CUST-871'), '(iguais: não dá mais para correlacionar)');
console.log('Pseudonimizado: ', pseudonymize('CUST-295', SEGREDO), '| outro cliente:', pseudonymize('CUST-871', SEGREDO));
console.log('Mesmo cliente de novo:', pseudonymize('CUST-295', SEGREDO), '(código estável: a correlação continua)');

// ---------- INTEGRIDADE ----------
// O hash é uma "impressão digital" do conteúdo: qualquer alteração muda o resultado.
function hashPayload(dados) {
  return crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
}

titulo('5. INTEGRIDADE: hash do payload');
const pedido = { order_id: 'ORD-6d0bb578', customer_id: 'CUST-295', amount: 250 };
const adulterado = { ...pedido, amount: 2.5 };
console.log('Pedido original:        ', hashPayload(pedido).slice(0, 16));
console.log('Mesmo pedido, de novo:  ', hashPayload({ ...pedido }).slice(0, 16), '(igual)');
console.log('amount alterado p/ 2.5: ', hashPayload(adulterado).slice(0, 16), '(diferente: houve alteração)');
