const express = require('express');
const { collections } = require('../config/firebase');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const { validSettings, publicSettings } = require('../utils/catalog');
const SETTINGS_DOC_ID = 'store';

/** GET /api/settings — público (nome da loja, cores, redes sociais, pixels) */
router.get('/', async (req, res) => {
  try {
    const doc = await collections.settings.doc(SETTINGS_DOC_ID).get();
    return res.json(doc.exists ? publicSettings(doc.data()) : {});
  } catch (err) {
    console.error('[GET /api/settings]', err.name);
    return res.status(500).json({ error: 'Erro ao carregar configurações.' });
  }
});

/** PUT /api/settings — admin */
router.put('/', requireAdmin, async (req, res) => {
  try {
    if (!validSettings(req.body)) return res.status(400).json({ error: 'Configuracoes invalidas.' });
    await collections.settings.doc(SETTINGS_DOC_ID).set(req.body, { merge: true });
    return res.json({ success: true });
  } catch (err) {
    console.error('[PUT /api/settings]', err.name);
    return res.status(500).json({ error: 'Erro ao salvar configurações.' });
  }
});

module.exports = router;
