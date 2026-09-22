const express = require('express');
const { recordEvent, getDashboardSummary } = require('../services/analyticsService');
const { requireAdmin } = require('../middleware/auth');
const { collections } = require('../config/firebase');

const router = express.Router();

/** POST /api/analytics/track — chamado pelo front-end público */
router.post('/track', async (req, res) => {
  try {
    const { type, utm, device, os, browser, city } = req.body;
    if ([utm, device, os, browser, city].some(v => v != null && (typeof v !== 'string' || v.length > 120))) return res.status(400).json({ error: 'Evento invalido.' });
    const allowed = ['page_view', 'buy_click'];
    if (!allowed.includes(type)) return res.status(400).json({ error: 'Tipo de evento inválido.' });

    await recordEvent({ type, req, extra: { utm, device, os, browser, city } });
    return res.json({ success: true });
  } catch (err) {
    console.error('[POST /api/analytics/track]', err.name);
    return res.status(500).json({ error: 'Erro ao registrar evento.' });
  }
});

/** GET /api/analytics/summary?days=30 — dados agregados para o dashboard */
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    if (!Number.isSafeInteger(days) || days < 1 || days > 90) return res.status(400).json({ error: 'Periodo invalido.' });
    const summary = await getDashboardSummary(days);
    return res.json(summary);
  } catch (err) {
    console.error('[GET /api/analytics/summary]', err.name);
    return res.status(500).json({ error: 'Erro ao carregar métricas.' });
  }
});

/** GET /api/analytics/recent-orders — últimas vendas para o dashboard */
router.get('/recent-orders', requireAdmin, async (req, res) => {
  try {
    const snapshot = await collections.orders
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    const orders = snapshot.docs.map((d) => { const o = d.data(); return { id: d.id, customer: { name: o.customer?.name || '' }, quantity: o.quantity, total: o.total, status: o.status, createdAt: o.createdAt }; });
    return res.json(orders);
  } catch (err) {
    console.error('[GET /api/analytics/recent-orders]', err.name);
    return res.status(500).json({ error: 'Erro ao carregar pedidos recentes.' });
  }
});

module.exports = router;
