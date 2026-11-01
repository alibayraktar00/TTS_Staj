require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const compress  = require('compression');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./db');
const { router: authRouter } = require('./authRoutes');
const { router: ticketRouter, getTalepTipi } = require('./ticketRoutes');
const { router: userRouter } = require('./userRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// Reverse proxy (nginx vb.) arkasında çalışıyorsa req.ip'nin gerçek istemci
// IP'sini yansıtması için TRUST_PROXY=true ayarlanmalı; aksi halde login
// rate-limit ve login_logs kayıtları proxy IP'sini kullanır.
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

// ── Güvenlik & Sıkıştırma ────────────────────────────────────────────────────
app.use(helmet());           // XSS, clickjacking vb. güvenlik başlıkları
app.use(compress());         // gzip — tüm JSON yanıtları ~%70 küçülür

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// ── Body Parser ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// Login: 15 dakikada 20 deneme
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Çok fazla giriş denemesi. Lütfen 15 dakika bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Genel API: 15 dakikada 500 istek
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: 'Çok fazla istek gönderildi.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Router ────────────────────────────────────────────────────────────────────
app.use('/api/auth/login', loginLimiter);   // sadece login'e sıkı limit
app.use('/api/auth', authRouter);
app.use('/api',     apiLimiter, ticketRouter);
app.use('/api',     apiLimiter, userRouter);

// ── Predict Endpoint ──────────────────────────────────────────────────────────
const categoryKeywords = {
  'AVS': ['avs'],
  'BİLGİSAYAR': ['bilgisayar', 'pc', 'laptop', 'monitor', 'ekran', 'kasa', 'ram', 'disk', 'cpu', 'klavye', 'mouse', 'mause', 'anakart', 'desktop'],
  'EL TERMİNALİ': ['el terminali', 'el terminal', 'terminal', 'barkod'],
  'FAX': ['fax', 'faks'],
  'İŞLETİM SİSTEMİ': ['isletim sistemi', 'windows', 'linux', 'ubuntu', 'macos', 'format', 'os'],
  'KAMERA SİSTEMİ': ['kamera', 'kamera sistemi', 'kameralar', 'dvr', 'nvr', 'goruntu'],
  'NETWORK (LAN-WAN)': ['network', 'internet', 'lan', 'wan', 'baglanti', 'modem', 'switch', 'router', 'wifi', 'kablo', 'port', 'ethernet', 'ip', 'dns'],
  'PDKS': ['pdks', 'kart okuyucu', 'turnike', 'parmak izi'],
  'UPS': ['ups', 'kesintisiz guc', 'guc kaynagı', 'aku', 'jenerator', 'elektrik'],
  'YAZICI': ['yazici', 'printer', 'kartus', 'toner', 'tarayici', 'scanner'],
  'ABYS': ['abys'],
  'CBS (EDABİS)': ['cbs', 'edabis', 'cografi bilgi', 'harita'],
  'CRM': ['crm', 'musteri iliskileri'],
  'EBYS': ['ebys', 'belge yonetim', 'imza'],
  'EDVARS': ['edvars'],
  'SAP': ['sap', 'sap log', 'sap gui'],
  'SAYAX': ['sayax'],
  'WEB SİTESİ': ['web sitesi', 'website', 'web', 'portal'],
  'WFM': ['wfm', 'is gucu']
};

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

app.post('/predict', apiLimiter, async (req, res) => {
  const { metin } = req.body;
  if (!metin || !metin.trim()) {
    return res.json({ talep_tipi: 'Diğer', kategori: 'DİĞER' });
  }

  try {
    const response = await fetch('http://127.0.0.1:5002/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metin }),
    });

    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    console.warn(`Python ML server returned status ${response.status}. Falling back to keywords.`);
  } catch (error) {
    console.warn('Python ML server error, falling back to keyword prediction:', error.message);
  }

  // Fallback keyword-based matching
  const normalizedMetin = normalizeText(metin);
  const paddedMetin = ` ${normalizedMetin} `;
  let bestCategory = 'DİĞER';
  let maxScore = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let score = 0;
    for (const keyword of keywords) {
      const normalizedKeyword = normalizeText(keyword);
      const paddedKeyword = ` ${normalizedKeyword} `;

      if (paddedMetin.includes(paddedKeyword)) {
        score += 10;
      } else if (normalizedMetin.includes(normalizedKeyword)) {
        score += 1;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  const talepTipi = getTalepTipi(bestCategory);
  res.json({ talep_tipi: talepTipi, kategori: bestCategory });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint bulunamadı.' });
});

// ── Global hata handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Beklenmeyen hata:', err);
  res.status(500).json({ message: 'Sunucu hatası.' });
});

// ── Başlat ────────────────────────────────────────────────────────────────────
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Sunucu: http://localhost:${PORT}`);
  });
}

start(); 
