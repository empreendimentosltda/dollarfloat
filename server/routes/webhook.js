const express = require('express');
const provider = require('../services/paymentProvider');
const { applyPayment } = require('../services/orderService');
const router = express.Router();
router.post('/payment', async (req, res) => {
  if (process.env.PAYMENT_PROVIDER !== 'abacatepay') return res.sendStatus(404);
  let event;
  try {
    event = provider.verifyWebhookSignature(req.body, req.get('X-Webhook-Signature'), req.query.webhookSecret);
  } catch { return res.status(401).json({ error: 'Webhook invalido.' }); }
  try {
    const parsed = await provider.parseWebhookEvent(event);
    if (parsed.type !== 'other') await applyPayment(parsed);
    return res.json({ received: true });
  } catch {
    // Generic response/log: do not leak the secret in query parameters or customer data.
    console.error('[webhook] PAYMENT_VERIFICATION_FAILED');
    return res.status(503).json({ error: 'Confirmacao pendente. Reenviar evento.' });
  }
});
module.exports = router;
