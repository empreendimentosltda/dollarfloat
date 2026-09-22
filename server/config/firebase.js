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

// Coleções usadas pela aplicação — centralizadas aqui para evitar strings soltas.
const collections = {
  product: db.collection('product'),       // documento único "current"
  orders: db.collection('orders'),
  coupons: db.collection('coupons'),
  events: db.collection('analytics_events'),
  settings: db.collection('settings'),      // documento único "store"
  admins: db.collection('admins'),
  paymentEvents: db.collection('payment_events'),
  rateLimits: db.collection('rate_limits'),
};

module.exports = { admin, db, collections };
