require('dotenv').config();
const { production } = require('./config/runtime');
const express = require('express');
const cors = require('cors');
const path = require('path');


const { helmetConfig, generalLimiter, strictLimiter, sanitizeBody } = require('./middleware/security');

const productsRoutes = require('./routes/products');
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const couponsRoutes = require('./routes/coupons');
const settingsRoutes = require('./routes/settings');
const { persistentLimit } = require('./middleware/persistentLimit');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', process.env.VERCEL === '1' ? 1 : false);
app.use(helmetConfig());
app.use(cors({ origin: process.env.APP_URL || true, credentials: true }));
app.use('/api', generalLimiter, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.headers.origin && req.headers.origin !== process.env.APP_URL) return res.status(403).json({ error: 'Origem nao permitida.' });
    if (!req.is('application/json')) return res.status(415).json({ error: 'Envie application/json.' });
  }
  next();
});

// O webhook precisa do corpo RAW para validar a assinatura do gateway,
// então ele é registrado ANTES do express.json() global.
app.use('/webhook', express.raw({ type: 'application/json', limit: '256kb' }), webhookRoutes);

app.use(express.json({ limit: '32kb' }));
app.use(sanitizeBody);

// Rotas da API
app.use('/api/product', productsRoutes);
app.use('/api/checkout', persistentLimit('checkout', 10), checkoutRoutes);
app.use('/api/admin', persistentLimit('admin', 10), adminRoutes);
app.use('/api/analytics', persistentLimit('analytics', 60), analyticsRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/settings', settingsRoutes);

// Arquivos estáticos (landing page + painel admin)
app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny', index: 'index.html' }));

// Health check simples (útil para monitoramento em produção)
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// Handler de erro genérico — nunca vaza stack trace para o cliente
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err.name);
  const status = [400, 413, 415].includes(err.status) ? err.status : 500;
  res.status(status).json({ error: status === 500 ? 'Erro interno do servidor.' : 'Requisicao invalida.' });
});

const PORT = process.env.PORT || 3000;

// Em desenvolvimento o Express abre sua própria porta. Na Vercel ele é
// exportado como função serverless e a plataforma cuida do servidor.
if (require.main === module) {
  app.listen(PORT, production ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`Halo Lamp Store rodando em http://localhost:${PORT}`);
    if (process.env.DATA_PROVIDER === 'local') {
      console.log('Modo local ativo: dados em server/data/local-db.json e checkout simulado.');
    }
  });
}

module.exports = app;
