// =============================================================
// data-masking.js — Módulo 5: Confidencialidade
//
// Funções que mascaram dados sensíveis ANTES de eles saírem da aplicação
// em logs, atributos de span ou baggage. Depois que o dado chega ao
// Jaeger ou ao agregador de logs, já é tarde: ele foi copiado.
//
// Sem dependências: usa apenas o módulo crypto do Node.
// =============================================================

const crypto = require('crypto');

// "john.doe@company.com" -> "j***@*.com"
function maskEmail(email) {
  const texto = String(email ?? '');
  const arroba = texto.indexOf('@');
  if (arroba < 1) return '***';
  const dominio = texto.slice(arroba + 1);
  const final = dominio.includes('.') ? dominio.slice(dominio.lastIndexOf('.')) : '';
  return `${texto[0]}***@*${final}`;
}

// "4532-1234-5678-9999" -> "****-****-****-9999"
function maskCreditCard(cartao) {
  const digitos = String(cartao ?? '').replace(/\D/g, '');
  if (digitos.length < 12) return '****';
  return `****-****-****-${digitos.slice(-4)}`;
}

// "CUST-295" -> "CUST-****"
function maskCustomerId(id) {
  const texto = String(id ?? '');
  const traco = texto.indexOf('-');
  return traco > 0 ? `${texto.slice(0, traco)}-****` : '****';
}

// "+55 (11) 98765-1234" -> "***-****-1234"
function maskPhone(telefone) {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  if (digitos.length < 4) return '***';
  return `***-****-${digitos.slice(-4)}`;
}

// "192.168.10.25" -> "192.168.***.***"
function maskIPAddress(ip) {
  const partes = String(ip ?? '').split('.');
  if (partes.length !== 4) return '***';
  return `${partes[0]}.${partes[1]}.***.***`;
}

// Pseudonimização: troca o valor por um código estável.
// O mesmo valor gera sempre o mesmo código, então ainda dá para correlacionar
// logs e traces do mesmo cliente, sem revelar quem ele é.
// "CUST-295" -> "pseudo-3f9a1c0b7e22"
function pseudonymize(valor, segredo) {
  const codigo = crypto.createHmac('sha256', segredo).update(String(valor)).digest('hex');
  return `pseudo-${codigo.slice(0, 12)}`;
}

// Quais campos mascarar e com qual função.
// Centralizar aqui é mais seguro do que lembrar de mascarar em cada log.
const CAMPOS_SENSIVEIS = {
  customer_email: maskEmail,
  email: maskEmail,
  credit_card: maskCreditCard,
  card_number: maskCreditCard,
  customer_phone: maskPhone,
  phone: maskPhone,
  client_ip: maskIPAddress,
  ip: maskIPAddress,
};

// Devolve uma CÓPIA do objeto com os campos sensíveis mascarados
// (inclusive dentro de objetos aninhados). O original não é alterado.
function maskSensitiveFields(dados, campos = CAMPOS_SENSIVEIS) {
  if (Array.isArray(dados)) return dados.map((item) => maskSensitiveFields(item, campos));
  if (dados === null || typeof dados !== 'object') return dados;

  const copia = {};
  for (const [chave, valor] of Object.entries(dados)) {
    if (campos[chave] && valor !== undefined && valor !== null) {
      copia[chave] = campos[chave](valor);
    } else {
      copia[chave] = maskSensitiveFields(valor, campos);
    }
  }
  return copia;
}

module.exports = {
  maskEmail,
  maskCreditCard,
  maskCustomerId,
  maskPhone,
  maskIPAddress,
  pseudonymize,
  maskSensitiveFields,
  CAMPOS_SENSIVEIS,
};
