const express = require('express');
const { collections } = require('../config/firebase');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const { code: validCode } = require('../utils/validators');

/** GET /api/coupons — lista todos (admin) */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const snapshot = await collections.coupons.get();
    const coupons = snapshot.docs.map((d) => ({ code: d.id, ...d.data() }));
    return res.json(coupons);
  } catch (err) {
    console.error('[GET /api/coupons]', err.name);
    return res.status(500).json({ error: 'Erro ao carregar cupons.' });
  }
});

/** POST /api/coupons — cria/atualiza um cupom */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { code, type, value, maxUses, expiresAt, active = true } = req.body;
    if (!validCode(code) || !['percent', 'fixed'].includes(type) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > (type === 'percent' ? 100 : 100000) || (maxUses != null && (!Number.isSafeInteger(maxUses) || maxUses < 1)) || (expiresAt && (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)))) || typeof active !== 'boolean') return res.status(400).json({ error: 'Cupom invalido.' });
    if (!code || !type || value == null) {
      return res.status(400).json({ error: 'Preencha código, tipo e valor do cupom.' });
    }
    const docId = code.toUpperCase();
    await collections.coupons.doc(docId).set({
      type,          // 'percent' | 'fixed'
      value: Number(value),
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt || null,
      active: Boolean(active),
    }, { merge: true });
    return res.json({ success: true, code: docId });
  } catch (err) {
    console.error('[POST /api/coupons]', err.name);
    return res.status(500).json({ error: 'Erro ao salvar cupom.' });
  }
});

/** DELETE /api/coupons/:code */
router.delete('/:code', requireAdmin, async (req, res) => {
  try {
    if (!validCode(req.params.code)) return res.status(400).json({ error: 'Cupom invalido.' });
    await collections.coupons.doc(req.params.code.toUpperCase()).delete();
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/coupons/:code]', err.name);
    return res.status(500).json({ error: 'Erro ao excluir cupom.' });
  }
});

module.exports = router;
