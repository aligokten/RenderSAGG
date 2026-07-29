import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env varsa yükle (Node >=20.12). Yoksa yalnızca ortam değişkenleri kullanılır.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn('[config] .env okunamadı:', err.message);
  }
}

const num = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'evet', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const config = {
  port: num(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  provider: (process.env.RENDER_PROVIDER || 'mock').toLowerCase(),

  // Herkese açık bir adreste yayınlandığında paneli koruyan basit erişim şifresi.
  panelPassword: process.env.PANEL_PASSWORD || '',
  // Kullanıcının kendi API anahtarını tarayıcıdan girmesine izin ver (anahtar sunucuda saklanmaz).
  allowClientKey: bool(process.env.ALLOW_CLIENT_KEY, false),
  // IP başına saatlik üretim sınırı; 0 = sınırsız.
  rateLimitPerHour: Number.parseInt(process.env.RATE_LIMIT_PER_HOUR ?? '20', 10) || 0,
  trustProxy: bool(process.env.TRUST_PROXY, true),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-image'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-image-2',
    quality: process.env.OPENAI_QUALITY || 'high', // low | medium | high | auto
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  },

  outputLongEdge: num(process.env.OUTPUT_LONG_EDGE, 3840), // 4K
  // Modele gönderilen girdinin uzun kenarı. 4K üretebilen modellerde kaynaktaki mimari
  // detayın korunması için 2048 kullanılır; düşürmek maliyeti azaltır, sadakati düşürür.
  inputLongEdge: num(process.env.INPUT_LONG_EDGE, 2048),
  maxUploadBytes: num(process.env.MAX_UPLOAD_MB, 25) * 1024 * 1024,
  maxReferenceImages: 4,
  jobTtlMs: num(process.env.JOB_TTL_MINUTES, 60) * 60 * 1000,
  requestTimeoutMs: num(process.env.REQUEST_TIMEOUT_SECONDS, 240) * 1000
};

export const RASTER_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** Geometrisi güvenilir biçimde okunamayan CAD/BIM formatları. */
export const UNSUPPORTED_EXTENSIONS = [
  'skp', 'max', 'rvt', 'pln', 'dwg', 'dxf', '3dm', 'blend',
  'fbx', 'obj', 'ifc', 'c4d', 'ma', 'mb', 'sldprt'
];

export const UNSUPPORTED_MESSAGE =
  'Bu dosyanın geometrisini güvenilir biçimde okuyamıyorum, bu yüzden mimariyi tahmin etmem. ' +
  'Lütfen şunlardan uygun olanları yükleyin: PNG/JPG ham render, farklı kamera açıları, clay render, ' +
  'normal veya depth map, Material/Object ID pass, plan-kesit-görünüş PDF’leri, malzeme listesi.';
