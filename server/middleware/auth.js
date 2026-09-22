const jwt = require('jsonwebtoken');

/**
 * Protege rotas do painel administrativo.
 * Espera um header: Authorization: Bearer <token>
 */
async function requireAdmin(req, res, next) {
  const token = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('admin_session='))?.slice('admin_session='.length);

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'halo-store', audience: 'halo-admin' });
    if (typeof payload.id !== 'string') throw new Error('Invalid identity');
    const doc = await require('../config/firebase').collections.admins.doc(payload.id).get();
    if (!doc.exists || doc.data().disabled || doc.data().email !== payload.email) throw new Error('Inactive admin');
    if (!payload.sessionId || doc.data().sessionId !== payload.sessionId) throw new Error('Revoked session');
    req.admin = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

function signAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, sessionId: admin.sessionId },
    process.env.JWT_SECRET,
    { expiresIn: '1h', algorithm: 'HS256', issuer: 'halo-store', audience: 'halo-admin' }
  );
}

module.exports = { requireAdmin, signAdminToken };
