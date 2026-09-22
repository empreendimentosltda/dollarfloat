require('dotenv').config();
require('../server/config/runtime');
const { collections } = require('../server/config/firebase');
const provider = require('../server/services/paymentProvider');
const { applyPayment, releaseReservation } = require('../server/services/orderService');

// Explicit operator command. No new charges, refunds or automatic retries of creation.
async function main() {
  if (process.env.PAYMENT_PROVIDER !== 'abacatepay') throw new Error('Configure AbacatePay.');
  const apply = process.argv.includes('--apply');
  for (const status of ['creating', 'pending', 'review']) {
    const docs = await collections.orders.where('status', '==', status).limit(100).get();
    for (const doc of docs.docs) {
      const order = doc.data();
      try {
        const checkout = order.providerSessionId ? await provider.getCheckout(order.providerSessionId) : await provider.findCheckout(doc.id);
        if (checkout.externalId !== doc.id || checkout.amount !== order.totalCents || checkout.devMode !== order.devMode) throw new Error('Mismatch');
        console.log(doc.id, checkout.status, apply ? 'APPLY' : 'DRY_RUN');
        if (!apply) continue;
        if (!order.providerSessionId) await collections.orders.doc(doc.id).update({ providerSessionId: checkout.id });
        if (checkout.status === 'PAID') await applyPayment({ type: 'paid', eventId: `reconcile_${checkout.id}`, orderId: doc.id, providerSessionId: checkout.id, amountCents: checkout.amount, paidAmountCents: checkout.paidAmount, devMode: checkout.devMode });
        if (['EXPIRED', 'CANCELLED'].includes(checkout.status)) await releaseReservation(doc.id);
      } catch { console.error(doc.id, 'REVISAO_MANUAL_NECESSARIA; reserva mantida'); }
    }
  }
}
main().catch(() => { console.error('Reconciliacao indisponivel. Confira a configuracao.'); process.exitCode = 1; });
