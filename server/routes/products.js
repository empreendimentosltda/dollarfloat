const express = require('express');
const { collections } = require('../config/firebase');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const { validProduct, publicProduct, stock } = require('../utils/catalog');
const PRODUCT_DOC_ID = 'current';

/** GET /api/product — dados públicos do produto ativo (para a landing page) */
router.get('/', async (req, res) => {
  try {
    const doc = await collections.product.doc(PRODUCT_DOC_ID).get();
    if (!doc.exists) return res.status(404).json({ error: 'Nenhum produto configurado ainda.' });
    return res.json({ id: doc.id, ...publicProduct(doc.data()), checkoutEnabled: process.env.PAYMENT_PROVIDER === 'abacatepay' && process.env.ABACATEPAY_ENV === 'production', testMode: process.env.ABACATEPAY_ENV === 'sandbox', testCheckoutEnabled: process.env.PAYMENT_PROVIDER === 'abacatepay' && process.env.ABACATEPAY_ENV === 'sandbox' });
  } catch (err) {
    console.error('[GET /api/product]', err.name);
    return res.status(500).json({ error: 'Erro ao carregar o produto.' });
  }
});

/** PUT /api/product — atualiza o produto ativo (painel admin) */
router.put('/', requireAdmin, async (req, res) => {
  try {
    if (!validProduct(req.body)) return res.status(400).json({ error: 'Dados do produto invalidos.' });
    const data = { ...req.body, updatedAt: new Date().toISOString() };
    await collections.product.doc(PRODUCT_DOC_ID).set(data, { merge: true });
    return res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/product]', err.name);
    return res.status(500).json({ error: 'Erro ao salvar o produto.' });
  }
});

/** PATCH /api/product/stock — ajuste rápido de estoque */
router.patch('/stock', requireAdmin, async (req, res) => {
  try {
    const { available, sold } = req.body;
    if ((available !== undefined && !stock(available)) || (sold !== undefined && !stock(sold))) return res.status(400).json({ error: 'Estoque invalido.' });
    const update = {};
    if (available !== undefined) update.stockAvailable = Number(available);
    if (sold !== undefined) update.stockSold = Number(sold);
    await collections.product.doc(PRODUCT_DOC_ID).set(update, { merge: true });
    return res.json({ success: true });
  } catch (err) {
    console.error('[PATCH /api/product/stock]', err.name);
    return res.status(500).json({ error: 'Erro ao atualizar estoque.' });
  }
});

module.exports = router;
