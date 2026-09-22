/**
 * _template.js
 * ---------------------------------------------------------------------
 * Copie este arquivo para criar um novo gateway (ex: mercadopago.js,
 * asaas.js, pagseguro.js, pagarme.js, abacatepay.js, openpix.js,
 * pushinpay.js, ou qualquer gateway REST).
 *
 * Depois de implementar os 4 métodos abaixo, defina no .env:
 *   PAYMENT_PROVIDER=nome-do-arquivo-sem-extensao
 * ---------------------------------------------------------------------
 */

async function createCheckoutSession({ order, product, successUrl, cancelUrl }) {
  // 1. Chame a API REST do gateway para criar uma cobrança/sessão de checkout
  // 2. Retorne a URL para onde o cliente deve ser redirecionado
  throw new Error('createCheckoutSession não implementado neste provider');
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  // Valide a assinatura/segredo enviado pelo gateway no header do webhook.
  // Deve lançar erro se a assinatura for inválida.
  throw new Error('verifyWebhookSignature não implementado neste provider');
}

function parseWebhookEvent(event) {
  // Normalize o payload do gateway para o formato interno:
  // { type: 'payment_approved' | 'payment_refused' | 'other', orderId, providerPaymentId, amount }
  throw new Error('parseWebhookEvent não implementado neste provider');
}

async function refund(providerPaymentId) {
  // Chame o endpoint de estorno do gateway.
  throw new Error('refund não implementado neste provider');
}

module.exports = { createCheckoutSession, verifyWebhookSignature, parseWebhookEvent, refund };
