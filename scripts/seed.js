require('dotenv').config();
require('../server/config/runtime');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');
const { db, collections } = require('../server/config/firebase');

async function seed() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const stock = Number(process.env.INITIAL_STOCK || 0);
  if (!validator.isEmail(email)) throw new Error('ADMIN_EMAIL invalido.');
  if (password.length < 16 || Buffer.byteLength(password) > 72) throw new Error('ADMIN_PASSWORD deve ter pelo menos 16 caracteres e no maximo 72 bytes.');
  if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('INITIAL_STOCK invalido.');
  const admins = await collections.admins.where('email', '==', email).limit(1).get();
  const adminRef = collections.admins.doc(admins.empty ? crypto.createHash('sha256').update(email).digest('hex') : admins.docs[0].id);
  const productRef = collections.product.doc('current');
  const settingsRef = collections.settings.doc('store');
  const passwordHash = await bcrypt.hash(password, 12);
  await db.runTransaction(async tx => {
    const admin = await tx.get(adminRef);
    const product = await tx.get(productRef);
    const settings = await tx.get(settingsRef);
    if (!admin.exists) tx.set(adminRef, { email, passwordHash, name: 'Administrador', disabled: false, sessionId: null });
    if (admin.exists && process.argv.includes('--reset-password')) tx.update(adminRef, { passwordHash, sessionId: null, disabled: false });
    if (!product.exists) tx.set(productRef, {
      name: 'Dollar Float Lamp', subtitle: 'Luminaria decorativa com efeito flutuante.',
      price: 199.9, pricePromo: 119.9,
      description: 'Luminaria com efeito de levitacao magnetica para decorar seu ambiente.',
      gallery: [], video: '/media/dollar-float-lamp.mp4', benefits: [], specs: [], faq: [],
      warranty: '', delivery: 'Frete gratis para todo o Brasil. Entrega em ate 7 dias apos a confirmacao do pagamento.',
      stockAvailable: stock, stockSold: 0,
      seo: { title: 'Dollar Float Lamp', metaDescription: 'Luminaria decorativa com efeito flutuante.', slug: 'dollar-float-lamp', ogImage: '' }
    });
    if (!settings.exists) tx.set(settingsRef, { storeName: 'Dollar Float', logo: '', favicon: '', colors: { primary: '#8ee65d', background: '#08110c' }, whatsapp: '', instagram: '', facebook: '', email: 'transacoesltdsa532@gmail.com', phone: '', pixels: {} });
  });
  console.log('Cadastro inicial concluido. Dados existentes preservados; credenciais omitidas.');
}
seed().catch(() => { console.error('Falha no cadastro inicial. Confira configuracao e acesso ao Firebase.'); process.exitCode = 1; }).finally(async () => { if (db.terminate) await db.terminate(); });
