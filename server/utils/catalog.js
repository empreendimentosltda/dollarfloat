const { text } = require('./validators');
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const optionalText = v => text(v, 0, 5000);
const money = v => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 100000 && Math.abs(v * 100 - Math.round(v * 100)) < 0.00001;
const stock = v => Number.isSafeInteger(v) && v >= 0 && v <= 1000000;
const url = v => v === '' || v === null || (typeof v === 'string' && v.length < 2048 && (/^\/(?!\/)[\w/.-]+$/.test(v) || (() => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } })()));
const shape = fields => v => object(v) && Object.keys(v).every(k => Object.hasOwn(fields, k) && fields[k](v[k]));
const list = fields => v => Array.isArray(v) && v.length <= 30 && v.every(shape(fields));
const productSchema = {
  name: v => text(v, 1, 120), subtitle: optionalText, price: money, pricePromo: v => v === null || money(v),
  description: optionalText, warranty: optionalText, delivery: optionalText, video: url,
  gallery: v => Array.isArray(v) && v.length <= 20 && v.every(url),
  benefits: list({ title: optionalText, text: optionalText }), specs: list({ label: optionalText, value: optionalText }), faq: list({ q: optionalText, a: optionalText }),
  seo: shape({ title: optionalText, metaDescription: optionalText, slug: optionalText, ogImage: url }),
};
const settingsSchema = {
  storeName: optionalText, logo: url, favicon: url, whatsapp: optionalText, instagram: optionalText,
  facebook: optionalText, email: optionalText, phone: optionalText,
  colors: shape({ primary: v => /^#[\da-f]{6}$/i.test(v), background: v => /^#[\da-f]{6}$/i.test(v) }),
  pixels: shape({ metaPixelId: optionalText, googleAnalyticsId: optionalText, googleTagManagerId: optionalText, tiktokPixelId: optionalText }),
};
const pick = (data, keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(data, k)).map(k => [k, data[k]]));
module.exports = { stock, money, validProduct: shape(productSchema), validSettings: shape(settingsSchema),
  publicProduct: data => pick(data, [...Object.keys(productSchema), 'stockAvailable', 'stockSold']),
  publicSettings: data => pick(data, Object.keys(settingsSchema)) };
