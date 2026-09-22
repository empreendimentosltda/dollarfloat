const helmet = require('helmet');
const rateLimit = require('express-rate-limit');


/**
 * Helmet com uma política de CSP básica compatível com Stripe.js.
 */
function helmetConfig() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js'],
        objectSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' ? [] : null,
        frameSrc: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  });
}

/** Limite geral de requisições — protege contra abuso e scraping. */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

/** Limite mais rígido para rotas sensíveis (login, checkout). */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
});

/** Sanitiza recursivamente strings de um objeto (body/query) contra XSS. */
function sanitizeBody(req, res, next) {
  const clean = (value, depth = 0) => {
    if (depth > 12) throw new Error('Objeto profundo demais.');
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(item => clean(item, depth + 1));
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Chave invalida.');
        out[key] = clean(value[key], depth + 1);
      }
      return out;
    }
    return value;
  };

  try { if (req.body) req.body = clean(req.body); } catch { return res.status(400).json({ error: 'Corpo invalido.' }); }
  next();
}

module.exports = { helmetConfig, generalLimiter, strictLimiter, sanitizeBody };
