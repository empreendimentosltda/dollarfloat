/**
 * paymentProvider.js
 * ---------------------------------------------------------------------
 * Camada de abstração de pagamento.
 *
 * Todo o resto da aplicação (rotas de checkout, webhook) fala apenas com
 * a interface abaixo — nunca diretamente com o SDK de um gateway.
 *
 * Para trocar de gateway:
 *   1. Crie um novo arquivo em server/services/providers/<nome>.js
 *      implementando os mesmos métodos que server/services/providers/abacatepay.js
 *   2. Troque PAYMENT_PROVIDER no .env para o nome do novo arquivo
 *      (sem extensão .js)
 *   3. Preencha as credenciais correspondentes no .env
 *
 * Nenhuma rota ou lógica de negócio precisa mudar.
 * ---------------------------------------------------------------------
 */

const providerName = process.env.PAYMENT_PROVIDER || 'disabled';
if (!['disabled', 'abacatepay'].includes(providerName)) throw new Error('Gateway nao permitido. Use abacatepay ou disabled.');

let provider;
try {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  provider = require(`./providers/${providerName}`);
} catch (err) {
  throw new Error(
    `[paymentProvider] Gateway "${providerName}" não encontrado em server/services/providers/. ` +
    `Detalhe: ${err.message}`
  );
}

/**
 * Interface esperada de um provider (todos os métodos são async):
 *
 * createCheckoutSession({ order, product, successUrl, cancelUrl })
 *    -> { checkoutUrl, providerSessionId }
 *
 * verifyWebhookSignature(rawBody, signatureHeader)
 *    -> event (objeto normalizado do gateway) | lança erro se inválida
 *
 * parseWebhookEvent(event)
 *    -> { type: 'payment_approved' | 'payment_refused' | 'other',
 *         orderId, providerPaymentId, amount }
 *
 * refund(providerPaymentId)
 *    -> { success, providerRefundId }
 */
module.exports = provider;
