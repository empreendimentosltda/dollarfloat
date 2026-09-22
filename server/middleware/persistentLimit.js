const crypto = require('crypto');
const { db, collections } = require('../config/firebase');
const { strictLimiter } = require('./security');
// Firestore-backed counters survive serverless cold starts and concurrent instances.
function persistentLimit(scope, limit = 20) {
  return async (req, res, next) => {
    if (req.method === 'GET') return next();
    if (process.env.DATA_PROVIDER === 'local') return strictLimiter(req, res, next);
    try {
      const windowMs = 15 * 60 * 1000, bucket = Math.floor(Date.now() / windowMs);
      const identity = `${scope}:${req.ip}:${bucket}`;
      const key = crypto.createHmac('sha256', process.env.JWT_SECRET).update(identity).digest('hex');
      const ref = collections.rateLimits.doc(key);
      const allowed = await db.runTransaction(async tx => {
        const snap = await tx.get(ref), count = snap.exists ? snap.data().count : 0;
        if (count >= limit) return false;
        tx.set(ref, { count: count + 1, expiresAt: new Date((bucket + 2) * windowMs) });
        return true;
      });
      if (!allowed) return res.status(429).set('Retry-After', '900').json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
      next();
    } catch { res.status(503).json({ error: 'Servico temporariamente indisponivel.' }); }
  };
}
module.exports = { persistentLimit };
