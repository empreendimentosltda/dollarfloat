const { collections, admin } = require('../config/firebase');
const crypto = require('crypto');

/**
 * Registra um evento bruto de analytics no Firestore.
 * type: 'page_view' | 'buy_click' | 'checkout_started' | 'payment_approved' | 'payment_refused'
 */
async function recordEvent({ type, req, extra = {} }) {
  const doc = {
    type,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ip: crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${new Date().toISOString().slice(0, 10)}:${req.ip}`).digest('hex'),
    referer: (() => { try { return new URL(req.headers.referer).origin; } catch { return null; } })(),
    utm: extra.utm || null,
    device: extra.device || null,
    os: extra.os || null,
    browser: extra.browser || null,
    city: extra.city || null,
    orderId: extra.orderId || null,
    amount: extra.amount || null,
  };
  await collections.events.add(doc);
  return doc;
}

/**
 * Agrega eventos dos últimos N dias em métricas prontas para o dashboard.
 */
async function getDashboardSummary(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snapshot = await collections.events
    .where('createdAt', '>=', since)
    .limit(10000)
    .get();

  const events = snapshot.docs.map((d) => d.data());

  const counts = {
    visits: 0,
    uniqueVisitors: new Set(),
    buyClicks: 0,
    checkoutStarted: 0,
    paymentApproved: 0,
    paymentRefused: 0,
    revenue: 0,
  };

  const byDay = Object.create(null);
  const browsers = Object.create(null);
  const devices = Object.create(null);
  const cities = Object.create(null);
  const referrers = Object.create(null);

  for (const e of events) {
    const day = e.createdAt?.toDate
      ? e.createdAt.toDate().toISOString().slice(0, 10)
      : e.createdAt
        ? new Date(e.createdAt).toISOString().slice(0, 10)
        : 'unknown';
    byDay[day] = byDay[day] || { visits: 0, sales: 0, revenue: 0 };

    if (e.type === 'page_view') {
      counts.visits += 1;
      byDay[day].visits += 1;
      if (e.ip) counts.uniqueVisitors.add(e.ip);
    }
    if (e.type === 'buy_click') counts.buyClicks += 1;
    if (e.type === 'checkout_started') counts.checkoutStarted += 1;
    if (e.type === 'payment_approved') {
      counts.paymentApproved += 1;
      counts.revenue += e.amount || 0;
      byDay[day].sales += 1;
      byDay[day].revenue += e.amount || 0;
    }
    if (e.type === 'payment_refused') counts.paymentRefused += 1;

    if (e.browser) browsers[e.browser] = (browsers[e.browser] || 0) + 1;
    if (e.device) devices[e.device] = (devices[e.device] || 0) + 1;
    if (e.city) cities[e.city] = (cities[e.city] || 0) + 1;
    if (e.referer) referrers[e.referer] = (referrers[e.referer] || 0) + 1;
  }

  const conversionRate = counts.visits > 0
    ? (counts.paymentApproved / counts.visits) * 100
    : 0;
  const averageTicket = counts.paymentApproved > 0
    ? counts.revenue / counts.paymentApproved
    : 0;

  return {
    totals: {
      visits: counts.visits,
      uniqueVisitors: counts.uniqueVisitors.size,
      buyClicks: counts.buyClicks,
      checkoutStarted: counts.checkoutStarted,
      paymentApproved: counts.paymentApproved,
      paymentRefused: counts.paymentRefused,
      revenue: Number(counts.revenue.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(2)),
      averageTicket: Number(averageTicket.toFixed(2)),
    },
    byDay,
    browsers,
    devices,
    cities,
    referrers,
  };
}

module.exports = { recordEvent, getDashboardSummary };
