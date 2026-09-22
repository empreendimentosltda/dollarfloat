const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/firebase');
const provider = require('../services/paymentProvider');
const { reserveOrder, releaseReservation } = require('../services/orderService');
const { validateCheckoutInput } = require('../utils/validators');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();
const statusToken = id => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`order-status:${id}`).digest('hex');

router.post('/', (req, res, next) => {
  if (process.env.ABACATEPAY_ENV === 'sandbox' && (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1')) return requireAdmin(req, res, next);
  next();
}, async (req, res) => {
  if (process.env.PAYMENT_PROVIDER !== 'abacatepay') return res.status(503).json({ error: 'Vendas ainda nao disponiveis.' });
  const body = req.body || {};
  const { valid, errors } = validateCheckoutInput(body);
  if (!valid) return res.status(400).json({ error: errors.join(' ') });
  // Local coupons are not linked to the gateway catalog. Never silently change the total.
  if (body.couponCode) return res.status(400).json({ error: 'Cupons indisponiveis nesta oferta.' });
  const key = req.get('Idempotency-Key');
  if (!key || !/^[a-f0-9-]{36,64}$/i.test(key)) return res.status(400).json({ error: 'Identificador de compra invalido.' });
  const input = { name: body.name.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim(),
    zipCode: body.zipCode.replace(/\D/g, ''), address: body.address.trim(), quantity: body.quantity };
  let order;
  try {
    const result = await reserveOrder(input, key);
    order = result.order;
    if (result.reused) {
      if (order.status !== 'pending' || !order.checkoutUrl) return res.status(409).json({ error: 'Compra ja iniciada. Aguarde ou entre em contato com a loja.' });
      return res.json({ checkoutUrl: order.checkoutUrl, orderId: order.id, statusToken: statusToken(order.id) });
    }
    const session = await provider.createCheckoutSession({ order,
      successUrl: `${process.env.APP_URL}/sucesso.html`, cancelUrl: `${process.env.APP_URL}/cancelado.html` });
    await collections.orders.doc(order.id).update({ ...session, status: 'pending' });
    return res.json({ checkoutUrl: session.checkoutUrl, orderId: order.id, statusToken: statusToken(order.id) });
  } catch (err) {
    let retryable = false;
    if (order && err.safeToRelease) {
      try { await releaseReservation(order.id); retryable = true; } catch { /* Reconcile before releasing stock. */ }
    }
    // A timeout can happen after the gateway created the charge. Keep the reservation;
    // never retry charge creation automatically or allow unverified stock release.
    console.error('[checkout]', err.status ? 'ORDER_REJECTED' : 'CHECKOUT_FAILED');
    return res.status(err.status || 502).json({ error: err.status ? err.message : 'Não foi possível abrir o pagamento. Aguarde alguns instantes antes de tentar novamente.', retryable });
  }
});

router.get('/:orderId/status', async (req, res) => {
  const id = req.params.orderId, token = req.get('X-Order-Token') || '';
  if (!/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{64}$/.test(token) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(statusToken(id)))) return res.status(404).json({ error: 'Pedido nao encontrado.' });
  try {
    const doc = await collections.orders.doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Pedido nao encontrado.' });
    const order = doc.data();
    return res.json({ status: order.status, testMode: order.devMode });
  } catch { return res.status(503).json({ error: 'Consulta indisponivel.' }); }
});

router.get('/:orderId', requireAdmin, async (req, res) => {
  try {
    if (!/^[\w-]{1,128}$/.test(req.params.orderId)) return res.sendStatus(400);
    const doc = await collections.orders.doc(req.params.orderId).get();
    if (!doc.exists) return res.sendStatus(404);
    const { fingerprint, checkoutUrl, ...order } = doc.data();
    return res.json(order);
  } catch { return res.status(500).json({ error: 'Erro ao consultar pedido.' }); }
});
module.exports = router;
