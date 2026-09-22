const crypto = require('crypto');
const { db, collections, admin } = require('../config/firebase');
const stamp = () => admin.firestore.FieldValue.serverTimestamp();
function problem(message, status = 409) { return Object.assign(new Error(message), { status }); }

async function reserveOrder(input, key) {
  const id = crypto.createHash('sha256').update(key).digest('hex');
  const fingerprint = crypto.createHmac('sha256', process.env.JWT_SECRET).update(JSON.stringify(input)).digest('hex');
  const ref = collections.orders.doc(id), productRef = collections.product.doc('current');
  return db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const data = existing.data();
      if (data.fingerprint !== fingerprint) throw problem('Tentativa de compra diferente. Atualize a pagina.');
      return { order: data, reused: true };
    }
    const snapshot = await tx.get(productRef);
    if (!snapshot.exists) throw problem('Produto indisponivel.');
    const product = snapshot.data();
    const unitPriceCents = Math.round((product.pricePromo ?? product.price) * 100);
    if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 100 || unitPriceCents > 10000000) throw problem('Preco indisponivel.');
    if (!Number.isSafeInteger(product.stockAvailable) || product.stockAvailable < input.quantity) throw problem('Estoque insuficiente.');
    const order = { id, fingerprint, customer: { name: input.name, email: input.email, phone: input.phone },
      shipping: { zipCode: input.zipCode, address: input.address, costCents: 0, deliveryDays: 7 }, quantity: input.quantity,
      unitPriceCents, totalCents: unitPriceCents * input.quantity, unitPrice: unitPriceCents / 100,
      total: unitPriceCents * input.quantity / 100, status: 'creating', reserved: true,
      provider: process.env.PAYMENT_PROVIDER, devMode: process.env.ABACATEPAY_ENV !== 'production', createdAt: stamp() };
    tx.set(ref, order);
    tx.update(productRef, { stockAvailable: product.stockAvailable - input.quantity });
    return { order, reused: false };
  });
}

async function applyPayment(event) {
  const eventRef = collections.paymentEvents.doc(crypto.createHash('sha256').update(event.eventId).digest('hex'));
  const ref = collections.orders.doc(event.orderId), productRef = collections.product.doc('current');
  return db.runTransaction(async tx => {
    const seen = await tx.get(eventRef);
    if (seen.exists) return;
    const snap = await tx.get(ref);
    if (!snap.exists) throw problem('ORDER_NOT_FOUND');
    const order = snap.data();
    const product = await tx.get(productRef);
    if (order.provider !== 'abacatepay' || order.devMode !== event.devMode || order.providerSessionId !== event.providerSessionId || order.totalCents !== event.amountCents) throw problem('PAYMENT_MISMATCH');
    if (event.type === 'paid' && event.paidAmountCents !== order.totalCents) throw problem('PAYMENT_AMOUNT_MISMATCH');
    if (event.type === 'paid' && ['pending', 'creating', 'review'].includes(order.status)) {
      if (!order.reserved || !product.exists) throw problem('RESERVATION_MISSING');
      tx.update(ref, { status: 'paid', reserved: false, paidAt: stamp() });
      tx.update(productRef, { stockSold: (product.data().stockSold || 0) + order.quantity });
      tx.set(collections.events.doc(`paid_${order.id}`), { type: 'payment_approved', orderId: order.id, amount: order.total, createdAt: stamp() });
    } else if (event.type === 'refunded' || event.type === 'disputed') {
      // Never restore physical stock automatically after refunds/disputes.
      tx.update(ref, { status: event.type, reviewRequired: true, updatedAt: stamp() });
    }
    tx.set(eventRef, { orderId: order.id, type: event.type, createdAt: stamp() });
  });
}
async function releaseReservation(id, status = 'refused') {
  const ref = collections.orders.doc(id), productRef = collections.product.doc('current');
  await db.runTransaction(async tx => {
    const orderSnap = await tx.get(ref), productSnap = await tx.get(productRef);
    if (!orderSnap.exists || !productSnap.exists) return;
    const order = orderSnap.data();
    if (!order.reserved || !['creating', 'pending', 'review'].includes(order.status)) return;
    tx.update(productRef, { stockAvailable: productSnap.data().stockAvailable + order.quantity });
    tx.update(ref, { status, reserved: false });
  });
}
module.exports = { reserveOrder, applyPayment, releaseReservation };
