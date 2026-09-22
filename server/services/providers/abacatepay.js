const crypto = require('crypto');

// Public integrity key published by AbacatePay. This is NOT our webhook secret.
const PUBLIC_HMAC_KEY = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';
const validId = id => typeof id === 'string' && /^[\w-]{1,128}$/.test(id);
const expectedDevMode = () => process.env.ABACATEPAY_ENV !== 'production';
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function assertMode(data) {
  if (data.devMode !== expectedDevMode()) throw new Error('GATEWAY_ENVIRONMENT_MISMATCH');
}
async function request(endpoint, body) {
  if (!process.env.ABACATEPAY_API_KEY) throw new Error('GATEWAY_NOT_CONFIGURED');
  const response = await fetch(`https://api.abacatepay.com/v2/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000), redirect: 'error',
  });
  const result = await response.json();
  if (!response.ok || !result.success || !result.data || result.error) throw new Error('GATEWAY_REQUEST_FAILED');
  return result.data;
}
async function validateProduct(unitPriceCents) {
  const id = process.env.ABACATEPAY_PRODUCT_ID;
  if (!validId(id)) throw new Error('GATEWAY_PRODUCT_NOT_CONFIGURED');
  const product = await request(`products/get?id=${encodeURIComponent(id)}`);
  assertMode(product);
  if (product.id !== id || product.price !== unitPriceCents || product.currency !== 'BRL' || product.status !== 'ACTIVE' || product.cycle) throw new Error('GATEWAY_PRODUCT_MISMATCH');
  return id;
}
async function createCheckoutSession({ order, successUrl, cancelUrl }) {
  let productId;
  try { productId = await validateProduct(order.unitPriceCents); }
  catch (err) { err.safeToRelease = true; throw err; }
  const checkout = await request('checkouts/create', {
    items: [{ id: productId, quantity: order.quantity }],
    methods: ['PIX', 'CARD'], externalId: order.id,
    returnUrl: cancelUrl, completionUrl: `${successUrl}?orderId=${encodeURIComponent(order.id)}`,
    coupons: [], metadata: { orderId: order.id },
  });
  assertMode(checkout);
  if (!validId(checkout.id) || checkout.externalId !== order.id || checkout.amount !== order.totalCents) throw new Error('GATEWAY_AMOUNT_MISMATCH');
  const url = new URL(checkout.url);
  if (url.protocol !== 'https:' || url.hostname !== 'app.abacatepay.com' || url.username || url.password || url.port) throw new Error('GATEWAY_URL_INVALID');
  return { checkoutUrl: url.href, providerSessionId: checkout.id };
}
function verifyWebhookSignature(rawBody, signature, secret) {
  const configured = process.env.ABACATEPAY_WEBHOOK_SECRET || '';
  if (configured.length < 32 || !equal(secret, configured) || !Buffer.isBuffer(rawBody)) throw new Error('INVALID_WEBHOOK');
  const expected = crypto.createHmac('sha256', PUBLIC_HMAC_KEY).update(rawBody).digest('base64');
  if (!equal(signature, expected)) throw new Error('INVALID_WEBHOOK');
  const event = JSON.parse(rawBody.toString('utf8'));
  assertMode(event);
  if (event.apiVersion !== 2 || !validId(event.id)) throw new Error('INVALID_WEBHOOK');
  return event;
}
async function parseWebhookEvent(event) {
  const types = { 'checkout.completed': 'paid', 'checkout.refunded': 'refunded', 'checkout.disputed': 'disputed' };
  if (!types[event.event]) return { type: 'other' };
  const payload = event.data?.checkout;
  if (!validId(payload?.id)) throw new Error('INVALID_CHECKOUT');
  // The public HMAC key alone cannot prove origin. Always query our own account.
  const checkout = await request(`checkouts/get?id=${encodeURIComponent(payload.id)}`);
  assertMode(checkout);
  if (checkout.id !== payload.id || !validId(checkout.externalId)) throw new Error('INVALID_CHECKOUT');
  const type = types[event.event];
  if (type === 'paid' && checkout.status !== 'PAID') throw new Error('PAYMENT_NOT_CONFIRMED');
  if (type === 'refunded' && checkout.status !== 'REFUNDED') throw new Error('REFUND_NOT_CONFIRMED');
  return { type, eventId: event.id, orderId: checkout.externalId, providerSessionId: checkout.id,
    amountCents: checkout.amount, paidAmountCents: checkout.paidAmount, devMode: checkout.devMode };
}
async function getCheckout(id) {
  if (!validId(id)) throw new Error('INVALID_CHECKOUT');
  const checkout = await request(`checkouts/get?id=${encodeURIComponent(id)}`);
  assertMode(checkout);
  return checkout;
}
async function findCheckout(orderId) {
  if (!validId(orderId)) throw new Error('INVALID_ORDER');
  const checkout = await request(`checkouts/get?externalId=${encodeURIComponent(orderId)}`);
  assertMode(checkout);
  return checkout;
}
module.exports = { createCheckoutSession, verifyWebhookSignature, parseWebhookEvent, getCheckout, findCheckout, PUBLIC_HMAC_KEY };
