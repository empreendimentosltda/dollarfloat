const crypto = require('crypto');

const production = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
process.env.PORT ||= '3000';
if (production) {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 48 || /troque|change|secret|secreta/i.test(secret)) throw new Error('Configure JWT_SECRET aleatorio com pelo menos 48 caracteres.');
  const url = new URL(process.env.APP_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('APP_URL deve ser a origem HTTPS da loja.');
  if (process.env.DATA_PROVIDER !== 'firebase') throw new Error('Producao exige DATA_PROVIDER=firebase.');
  if (process.env.PAYMENT_PROVIDER === 'mock') throw new Error('Pagamento simulado proibido em producao.');
} else {
  process.env.APP_URL ||= `http://localhost:${process.env.PORT}`;
  process.env.JWT_SECRET ||= crypto.randomBytes(48).toString('hex');
  process.env.DATA_PROVIDER ||= 'local';
}
process.env.PAYMENT_PROVIDER ||= 'disabled';
if (!['disabled', 'abacatepay'].includes(process.env.PAYMENT_PROVIDER)) throw new Error('PAYMENT_PROVIDER deve ser disabled ou abacatepay.');
if (process.env.PAYMENT_PROVIDER === 'abacatepay') {
  if (!process.env.ABACATEPAY_API_KEY || !process.env.ABACATEPAY_PRODUCT_ID || (process.env.ABACATEPAY_WEBHOOK_SECRET || '').length < 32) throw new Error('Configure as credenciais AbacatePay no servidor.');
  if (!['sandbox', 'production'].includes(process.env.ABACATEPAY_ENV)) throw new Error('ABACATEPAY_ENV deve ser sandbox ou production.');
  if (process.env.ABACATEPAY_ENV === 'production' && process.env.DATA_PROVIDER !== 'firebase') throw new Error('Pagamentos reais exigem Firebase.');
}
process.env.APP_URL = new URL(process.env.APP_URL).origin;
module.exports = { production };
