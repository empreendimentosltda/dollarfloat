const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { collections } = require('../config/firebase');
const { signAdminToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/** POST /api/admin/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length < 16 || Buffer.byteLength(password) > 72 || /^(defina-uma-senha-forte-aqui|mude-esta-senha)$/i.test(password)) return res.status(400).json({ error: 'Informe e-mail e senha validos.' });

    const snapshot = await collections.admins.where('email', '==', email.toLowerCase()).limit(1).get();
    if (snapshot.empty) return res.status(401).json({ error: 'Credenciais inválidas.' });

    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();

    const matches = await bcrypt.compare(password, adminData.passwordHash);
    if (!matches) return res.status(401).json({ error: 'Credenciais inválidas.' });

    if (adminData.disabled) return res.status(401).json({ error: 'Credenciais invalidas.' });
    const sessionId = crypto.randomUUID();
    await collections.admins.doc(adminDoc.id).update({ sessionId });
    const token = signAdminToken({ id: adminDoc.id, email: adminData.email, sessionId });
    res.cookie('admin_session', token, { httpOnly: true, secure: process.env.APP_URL.startsWith('https:'), sameSite: 'strict', path: '/api', maxAge: 3600000 });
    return res.json({ admin: { email: adminData.email, name: adminData.name || null } });
  } catch (err) {
    console.error('[POST /api/admin/login]', err.name);
    return res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

/** GET /api/admin/me — valida sessão atual */
router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

router.post('/logout', requireAdmin, async (req, res) => {
  try { await collections.admins.doc(req.admin.id).update({ sessionId: null }); }
  catch { return res.status(503).json({ error: 'Nao foi possivel encerrar a sessao.' }); }
  res.clearCookie('admin_session', { httpOnly: true, secure: process.env.APP_URL.startsWith('https:'), sameSite: 'strict', path: '/api' });
  res.json({ success: true });
});
module.exports = router;
