const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-security-'));
Object.assign(process.env, {
  NODE_ENV: 'test', VERCEL: '', DATA_PROVIDER: 'local', LOCAL_DATA_DIR: testDir,
  APP_URL: 'http://localhost:3000', JWT_SECRET: crypto.randomBytes(48).toString('hex'),
  ADMIN_EMAIL: 'security@example.com', ADMIN_PASSWORD: 'test-only-strong-password-123',
  PAYMENT_PROVIDER: 'abacatepay', ABACATEPAY_ENV: 'sandbox',
  ABACATEPAY_API_KEY: 'test-key-not-a-real-credential', ABACATEPAY_PRODUCT_ID: 'prod_test',
  ABACATEPAY_WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex'),
});
const app = require('../server');
const { collections } = require('../server/config/firebase');
const { reserveOrder, applyPayment, releaseReservation } = require('../server/services/orderService');
const { validateCheckoutInput } = require('../server/utils/validators');
const { validProduct, validSettings } = require('../server/utils/catalog');
const provider = require('../server/services/providers/abacatepay');
const realFetch = global.fetch;
const checkouts = new Map();
let server, base, creationCount = 0, remotePrice = 11990;
global.fetch = async (url, options = {}) => {
  const u = new URL(url);
  assert.equal(u.origin, 'https://api.abacatepay.com', 'Tests must never contact live services');
  let data;
  if (u.pathname.endsWith('/products/get')) data = { id: 'prod_test', price: remotePrice, currency: 'BRL', status: 'ACTIVE', cycle: null, devMode: true };
  else if (u.pathname.endsWith('/checkouts/create')) {
    creationCount++;
    const body = JSON.parse(options.body), id = `bill_${creationCount}`;
    data = { id, externalId: body.externalId, url: `https://app.abacatepay.com/pay/${id}`, amount: 11990 * body.items[0].quantity, paidAmount: null, status: 'PENDING', devMode: true };
    checkouts.set(id, data);
  } else if (u.pathname.endsWith('/checkouts/get')) data = checkouts.get(u.searchParams.get('id'));
  else throw new Error('Unexpected endpoint');
  return new Response(JSON.stringify({ data, success: true, error: null }), { status: 200 });
};
const input = { name: 'Cliente Teste', email: 'buyer@example.com', phone: '11999999999', zipCode: '01001000', address: 'Rua de teste, 123', quantity: 1 };
const request = (route, options = {}) => realFetch(base + route, options);
const post = (route, body, headers = {}) => request(route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
function signedEvent(event, secret = process.env.ABACATEPAY_WEBHOOK_SECRET) {
  const raw = JSON.stringify(event);
  const signature = crypto.createHmac('sha256', provider.PUBLIC_HMAC_KEY).update(raw).digest('base64');
  return request(`/webhook/payment?webhookSecret=${secret}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature }, body: raw });
}
before(async () => {
  await collections.product.doc('current').get();
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  global.fetch = realFetch;
  await new Promise(resolve => server.close(resolve));
  // Only the directory created by this test is removed.
  assert.equal(path.dirname(testDir), os.tmpdir());
  assert.ok(path.basename(testDir).startsWith('store-security-'));
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('production refuses default secrets, local storage and real payments on local storage', () => {
  for (const overrides of [
    { NODE_ENV: 'production', JWT_SECRET: '' },
    { NODE_ENV: 'production', APP_URL: 'https://example.com', DATA_PROVIDER: 'local' },
    { NODE_ENV: 'test', ABACATEPAY_ENV: 'production', DATA_PROVIDER: 'local' },
  ]) {
    const child = spawnSync(process.execPath, ['-e', "require('./server/config/runtime')"], { env: { ...process.env, ...overrides }, encoding: 'utf8' });
    assert.notEqual(child.status, 0);
  }
});

test('private files and order details are inaccessible; CSP blocks inline scripts', async () => {
  for (const file of ['/.env', '/server/index.js', '/server/data/local-db.json', '/package.json', '/.git/config']) assert.equal((await request(file)).status, 404);
  assert.equal((await request('/api/checkout/some-id')).status, 401);
  assert.equal((await request('/api/analytics/recent-orders')).status, 401);
  const res = await request('/');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.ok(!res.headers.get('content-security-policy').match(/script-src[^;]*unsafe-inline/));
});

test('rejects malicious input, fractional quantities, unsafe URLs and arbitrary settings', async () => {
  for (const body of [{ ...input, name: {} }, { ...input, quantity: 1.5 }, { ...input, quantity: Infinity }, { ...input, couponCode: '../admins' }, { ...input, email: ['a@b.c'] }]) assert.equal(validateCheckoutInput(body).valid, false);
  assert.equal(validProduct({ video: 'javascript:alert(1)' }), false);
  assert.equal(validProduct({ price: -2 }), false);
  assert.equal(validSettings({ apiKey: 'private' }), false);
  const res = await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"__proto__":{"polluted":true}}' });
  assert.equal(res.status, 400);
  assert.equal({}.polluted, undefined);
  assert.equal((await post('/api/admin/login', {}, { Origin: 'https://attacker.example' })).status, 403);
});

test('admin uses HttpOnly cookie, denies weak default password and revokes logout', async () => {
  assert.equal((await post('/api/admin/login', { email: 'admin@halolamp.com', password: 'admin123' })).status, 400);
  const login = await post('/api/admin/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.equal((await login.json()).token, undefined);
  const headers = { Cookie: cookie.split(';')[0] };
  assert.equal((await request('/api/admin/me', { headers })).status, 200);
  assert.equal((await post('/api/admin/logout', {}, headers)).status, 200);
  assert.equal((await request('/api/admin/me', { headers })).status, 401);
});

test('checkout ignores client price, reuses the same charge and protects status lookup', async () => {
  const key = crypto.randomUUID();
  const first = await post('/api/checkout', { ...input, total: 0.01 }, { 'Idempotency-Key': key });
  assert.equal(first.status, 200);
  const result = await first.json();
  const second = await post('/api/checkout', { ...input, total: 0.01 }, { 'Idempotency-Key': key });
  assert.deepEqual(await second.json(), result);
  assert.equal(creationCount, 1);
  const order = (await collections.orders.doc(result.orderId).get()).data();
  assert.equal(order.totalCents, 11990);
  assert.equal((await request(`/api/checkout/${result.orderId}/status`)).status, 404);
  const status = await request(`/api/checkout/${result.orderId}/status`, { headers: { 'X-Order-Token': result.statusToken } });
  assert.deepEqual(await status.json(), { status: 'pending', testMode: true });
});

test('webhook rejects forged signature, wrong secret, wrong environment and unpaid charge', async () => {
  const bill = checkouts.get('bill_1');
  const event = { id: 'log_test', event: 'checkout.completed', apiVersion: 2, devMode: true, data: { checkout: { id: bill.id } } };
  assert.equal((await signedEvent(event, 'wrong')).status, 401);
  assert.equal((await post('/webhook/payment', event)).status, 401);
  assert.equal((await signedEvent({ ...event, devMode: false })).status, 401);
  assert.equal((await signedEvent(event)).status, 503);
  assert.equal((await collections.orders.doc(bill.externalId).get()).data().status, 'pending');
});

test('payment validates amount and handles simultaneous duplicate events exactly once', async () => {
  const bill = checkouts.get('bill_1');
  bill.status = 'PAID'; bill.paidAmount = 1;
  const event = { id: 'log_paid', event: 'checkout.completed', apiVersion: 2, devMode: true, data: { checkout: { id: bill.id } } };
  assert.equal((await signedEvent(event)).status, 503);
  bill.paidAmount = 11990;
  const beforeStock = (await collections.product.doc('current').get()).data();
  const responses = await Promise.all([signedEvent(event), signedEvent(event), signedEvent({ ...event, id: 'log_second_delivery' })]);
  assert.deepEqual(responses.map(r => r.status), [200, 200, 200]);
  const afterStock = (await collections.product.doc('current').get()).data();
  assert.equal(afterStock.stockSold, beforeStock.stockSold + 1);
  assert.equal(afterStock.stockAvailable, beforeStock.stockAvailable);
  assert.equal((await collections.orders.doc(bill.externalId).get()).data().status, 'paid');
});

test('parallel reservations cannot oversell; release is idempotent', async () => {
  await collections.product.doc('current').update({ stockAvailable: 1 });
  const results = await Promise.allSettled([reserveOrder(input, crypto.randomUUID()), reserveOrder(input, crypto.randomUUID())]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await collections.product.doc('current').get()).data().stockAvailable, 0);
  const id = results.find(r => r.status === 'fulfilled').value.order.id;
  await Promise.all([releaseReservation(id), releaseReservation(id)]);
  assert.equal((await collections.product.doc('current').get()).data().stockAvailable, 1);
});

test('gateway price mismatch blocks payment and releases the reservation', async () => {
  remotePrice = 999;
  const beforeCount = creationCount;
  const res = await post('/api/checkout', input, { 'Idempotency-Key': crypto.randomUUID() });
  assert.equal(res.status, 502);
  assert.equal(creationCount, beforeCount);
  assert.equal((await collections.product.doc('current').get()).data().stockAvailable, 1);
  remotePrice = 11990;
});

test('hosted sandbox checkout requires an administrator and stays closed to visitors', async () => {
  process.env.VERCEL = '1';
  try {
    const res = await post('/api/checkout', input, { 'Idempotency-Key': crypto.randomUUID() });
    assert.equal(res.status, 401);
    const product = await (await request('/api/product')).json();
    assert.equal(product.checkoutEnabled, false);
    assert.equal(product.testMode, true);
  } finally { process.env.VERCEL = ''; }
});
