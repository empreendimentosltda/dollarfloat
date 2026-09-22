const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = { firestore: { FieldValue } };

const wantsLocalStore = process.env.DATA_PROVIDER === 'local';
const hasFirebaseCredentials = process.env.FIREBASE_PROJECT_ID
  && process.env.FIREBASE_CLIENT_EMAIL
  && process.env.FIREBASE_PRIVATE_KEY
  && !process.env.FIREBASE_PROJECT_ID.includes('seu-projeto');

if (wantsLocalStore) {
  module.exports = require('./localStore');
  return;
}
if (!hasFirebaseCredentials) throw new Error('Credenciais Firebase obrigatorias; fallback local desativado.');

/**
 * Inicializa o Firebase Admin usando credenciais de uma conta de serviço.
 * As credenciais vêm de variáveis de ambiente para nunca precisarem
 * de um arquivo de chave commitado no repositório.
 */
function initFirebase() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      '[firebase] Variáveis de ambiente do Firebase ausentes. ' +
      'Preencha FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const app = initFirebase();
const db = getFirestore(app);
const prefix = process.env.ABACATEPAY_ENV === 'sandbox' ? 'sandbox_' : '';
const collection = name => db.collection(prefix + name);

// Coleções usadas pela aplicação — centralizadas aqui para evitar strings soltas.
const collections = {
  product: collection('product'),       // documento único "current"
  orders: collection('orders'),
  coupons: collection('coupons'),
  events: collection('analytics_events'),
  settings: collection('settings'),      // documento único "store"
  admins: collection('admins'),
  paymentEvents: collection('payment_events'),
  rateLimits: collection('rate_limits'),
};

module.exports = { admin, db, collections };
