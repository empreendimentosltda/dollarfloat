const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const dataDir = process.env.LOCAL_DATA_DIR || path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'local-db.json');

const FieldValue = {
  serverTimestamp: () => ({ __op: 'serverTimestamp' }),
  increment: (value) => ({ __op: 'increment', value: Number(value) || 0 }),
};

function defaultData() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@halolamp.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(32).toString('hex');

  return {
    product: {
      current: {
        name: 'Dollar Float Lamp',
        subtitle: 'Um dollar flutuando no seu setup.',
        price: 199.9,
        pricePromo: 119.9,
        description: 'Luminaria decorativa com dollar flutuante, luz verde cinematica e efeito de levitacao magnetica. Uma peca de impacto para setup gamer, quarto, estudio ou vitrine.',
        benefits: [
          { title: 'Dollar flutuante', text: 'Efeito magnetico que cria a sensacao de um item raro suspenso no ar.' },
          { title: 'Glow verde cinematico', text: 'Iluminacao ambiente com identidade gamer, forte o bastante para aparecer sem cansar.' },
          { title: 'Setup instantaneo', text: 'Base compacta para mesa, estante, quarto, estudio ou cenario de conteudo.' },
          { title: 'Presente de impacto', text: 'Produto memoravel para fas de games urbanos, colecionaveis e decoracao premium.' },
        ],
        specs: [
          { label: 'Efeito visual', value: 'Dollar flutuante por levitacao magnetica' },
          { label: 'Iluminacao', value: 'LED verde ambiente' },
          { label: 'Uso indicado', value: 'Setup gamer, quarto, estudio e vitrine' },
          { label: 'Alimentacao', value: 'USB 5V' },
          { label: 'Instalacao', value: 'Mesa ou prateleira, sem fixacao' },
          { label: 'Conteudo', value: 'Base luminosa, dollar decorativo e cabo USB' },
        ],
        gallery: [],
        video: '/media/luminaria-dollar-flutuante.mp4',
        faq: [
          { q: 'O dollar realmente fica flutuando?', a: 'Sim. O efeito visual usa levitacao magnetica quando posicionado corretamente sobre a base.' },
          { q: 'E um produto oficial de alguma marca de jogo?', a: 'Nao. E uma luminaria autoral inspirada em estetica urbana e gamer, sem uso de marca ou logo oficial.' },
          { q: 'Qual o prazo de entrega?', a: 'Entre 3 e 7 dias uteis, conforme sua regiao.' },
        ],
        warranty: '12 meses de garantia contra defeitos de fabricacao, com suporte para ajuste correto da levitacao.',
        delivery: 'Envio em ate 2 dias uteis apos a confirmacao do pagamento, com embalagem reforcada para proteger a base e o dollar decorativo.',
        stockAvailable: 80,
        stockSold: 0,
        seo: {
          title: 'Dollar Float Lamp - luminaria gamer com dollar flutuante',
          metaDescription: 'Luminaria gamer com dollar flutuante, glow verde e visual premium para setup, quarto ou estudio.',
          slug: 'dollar-float-lamp',
          ogImage: '',
        },
      },
    },
    orders: {},
    coupons: {},
    analytics_events: {},
    settings: {
      store: {
        storeName: process.env.STORE_NAME || 'Halo Lamp',
        logo: '',
        favicon: '',
        colors: { primary: '#E8A94A', background: '#0F1115' },
        whatsapp: process.env.STORE_WHATSAPP || '',
        instagram: '',
        facebook: '',
        email: '',
        phone: '',
        pixels: {},
      },
    },
    admins: {
      local_admin: {
        email: adminEmail,
        passwordHash: bcrypt.hashSync(adminPassword, 12),
        name: 'Administrador',
      },
    },
  };
}

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultData(), null, 2));
  }
}

function readDb() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function applyTransforms(next, previous = {}) {
  const out = { ...previous };
  for (const [key, value] of Object.entries(next || {})) {
    if (value && value.__op === 'serverTimestamp') {
      out[key] = new Date().toISOString();
    } else if (value && value.__op === 'increment') {
      out[key] = Number(out[key] || 0) + value.value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

class LocalDocSnapshot {
  constructor(id, data) {
    this.id = id;
    this.exists = data !== undefined;
    this._data = clone(data);
  }

  data() {
    return clone(this._data);
  }
}

class LocalQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
  }
}

class LocalDocRef {
  constructor(collectionName, id) {
    this.collectionName = collectionName;
    this.id = id || crypto.randomUUID();
  }

  async get() {
    const db = readDb();
    return new LocalDocSnapshot(this.id, db[this.collectionName]?.[this.id]);
  }

  async set(data, options = {}) {
    const db = readDb();
    db[this.collectionName] = db[this.collectionName] || {};
    const previous = options.merge ? db[this.collectionName][this.id] || {} : {};
    db[this.collectionName][this.id] = applyTransforms(data, previous);
    writeDb(db);
  }

  async update(data) {
    await this.set(data, { merge: true });
  }

  async delete() {
    const db = readDb();
    if (db[this.collectionName]) delete db[this.collectionName][this.id];
    writeDb(db);
  }
}

class LocalQuery {
  constructor(collectionName, filters = [], sort = null, max = null) {
    this.collectionName = collectionName;
    this.filters = filters;
    this.sort = sort;
    this.max = max;
  }

  where(field, operator, value) {
    return new LocalQuery(this.collectionName, [...this.filters, { field, operator, value }], this.sort, this.max);
  }

  orderBy(field, direction = 'asc') {
    return new LocalQuery(this.collectionName, this.filters, { field, direction }, this.max);
  }

  limit(max) {
    return new LocalQuery(this.collectionName, this.filters, this.sort, Number(max));
  }

  async get() {
    const db = readDb();
    let rows = Object.entries(db[this.collectionName] || {}).map(([id, data]) => ({ id, data }));

    for (const filter of this.filters) {
      rows = rows.filter(({ data }) => compare(data[filter.field], filter.operator, filter.value));
    }

    if (this.sort) {
      rows.sort((a, b) => {
        const av = comparable(a.data[this.sort.field]);
        const bv = comparable(b.data[this.sort.field]);
        const result = av > bv ? 1 : av < bv ? -1 : 0;
        return this.sort.direction === 'desc' ? -result : result;
      });
    }

    if (this.max != null) rows = rows.slice(0, this.max);
    return new LocalQuerySnapshot(rows.map(({ id, data }) => new LocalDocSnapshot(id, data)));
  }
}

class LocalCollection extends LocalQuery {
  constructor(name) {
    super(name);
    this.name = name;
  }

  doc(id) {
    return new LocalDocRef(this.name, id);
  }

  async add(data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

function comparable(value) {
  const date = Date.parse(value);
  return Number.isNaN(date) ? value : date;
}

function compare(left, operator, right) {
  const l = comparable(left);
  const r = comparable(right);
  if (operator === '==') return left === right;
  if (operator === '>=') return l >= r;
  if (operator === '<=') return l <= r;
  if (operator === '>') return l > r;
  if (operator === '<') return l < r;
  return false;
}

const collections = {
  product: new LocalCollection('product'),
  orders: new LocalCollection('orders'),
  coupons: new LocalCollection('coupons'),
  events: new LocalCollection('analytics_events'),
  settings: new LocalCollection('settings'),
  admins: new LocalCollection('admins'),
  paymentEvents: new LocalCollection('payment_events'),
  rateLimits: new LocalCollection('rate_limits'),
};

const admin = { firestore: { FieldValue } };

// Development only, one process. Production always uses Firestore transactions.
let transactionQueue = Promise.resolve();
const db = {
  runTransaction(fn) {
    const work = transactionQueue.then(async () => {
      const state = readDb();
      const tx = {
        async get(ref) { return new LocalDocSnapshot(ref.id, state[ref.collectionName]?.[ref.id]); },
        set(ref, data, options = {}) {
          state[ref.collectionName] ||= {};
          state[ref.collectionName][ref.id] = applyTransforms(data, options.merge ? state[ref.collectionName][ref.id] : {});
        },
        update(ref, data) { this.set(ref, data, { merge: true }); },
      };
      const result = await fn(tx);
      writeDb(state);
      return result;
    });
    transactionQueue = work.catch(() => {});
    return work;
  },
};
module.exports = { admin, db, collections, dataFile };
