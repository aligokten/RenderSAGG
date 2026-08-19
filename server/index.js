import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { ROOT, config } from './config.js';
import { activeProviderName, listProviders } from './providers/index.js';
import { MODES, PACKAGE_QC_CHECKLIST, QC_CHECKLIST } from './prompt.js';
import { catalog } from './materials.js';
import {
  InputError,
  decodeRegions,
  decodeUpload,
  getJob,
  publicJob,
  startJob,
  startPackageJob
} from './pipeline.js';

const app = express();

if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '96mb' }));

app.use((req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  next();
});

app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));

/* ---------------- Erişim koruması ---------------- */

const passwordMatches = (candidate) => {
  const expected = Buffer.from(config.panelPassword);
  const given = Buffer.from(String(candidate || ''));
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
};

const isAuthorized = (req) => !config.panelPassword || passwordMatches(req.get('x-panel-password'));

app.post('/api/session', (req, res) => {
  if (!config.panelPassword) return res.json({ ok: true, authRequired: false });
  if (!passwordMatches(req.body?.password)) {
    return res.status(401).json({ error: 'Şifre hatalı.' });
  }
  res.json({ ok: true, authRequired: true });
});

/* ---------------- Basit hız sınırı ---------------- */

const hits = new Map();

function rateLimited(req) {
  if (!config.rateLimitPerHour) return false;
  const key = req.ip || 'anonim';
  const now = Date.now();
  const window = now - 60 * 60 * 1000;
  const recent = (hits.get(key) || []).filter((timestamp) => timestamp > window);
  if (recent.length >= config.rateLimitPerHour) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const rateLimitError = () => ({
  error: `Saatlik üretim sınırına ulaşıldı (${config.rateLimitPerHour}). Lütfen daha sonra tekrar deneyin.`,
  code: 'RATE_LIMIT'
});

/* ---------------- Uçlar ---------------- */

app.get('/healthz', (req, res) => res.json({ ok: true, provider: activeProviderName() }));

app.get('/api/config', (req, res) => {
  const authRequired = Boolean(config.panelPassword);
  if (authRequired && !isAuthorized(req)) {
    return res.json({ authRequired: true, locked: true });
  }

  res.json({
    authRequired,
    locked: false,
    providers: listProviders(),
    activeProvider: activeProviderName(),
    allowClientKey: config.allowClientKey,
    modes: Object.values(MODES).map(({ id, label, hint }) => ({ id, label, hint })),
    outputLongEdge: config.outputLongEdge,
    maxUploadMB: Math.round(config.maxUploadBytes / (1024 * 1024)),
    maxReferenceImages: config.maxReferenceImages,
    rateLimitPerHour: config.rateLimitPerHour,
    checklist: QC_CHECKLIST,
    maxRegions: config.maxRegions,
    packageChecklist: PACKAGE_QC_CHECKLIST,
    ...catalog()
  });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/config' || req.path === '/session') return next();
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Panel şifresi gerekli.', code: 'AUTH' });
  next();
});

app.post('/api/render', (req, res) => {
  try {
    const body = req.body || {};
    const render = decodeUpload(body.render, { role: 'render' });
    const references = Array.isArray(body.references)
      ? body.references.slice(0, config.maxReferenceImages).map((file) => decodeUpload(file, { role: 'reference' }))
      : [];

    // Hatalı girdi kullanıcının saatlik üretim kotasını harcamaz: sınır doğrulamadan sonra bakılır.
    if (rateLimited(req)) return res.status(429).json(rateLimitError());

    // Panelden gelen API anahtarı yalnızca bu istek boyunca bellekte kalır; diske yazılmaz, loglanmaz.
    const clientKey = config.allowClientKey ? String(body.apiKey || '').trim() : '';

    const job = startJob({
      render,
      references,
      mode: body.mode,
      scene: body.scene,
      time: body.time,
      weather: body.weather,
      aspect: body.aspect,
      userPrompt: body.prompt,
      providerName: body.provider || activeProviderName(),
      clientKey,
      outputLongEdge: Number(body.outputLongEdge) || config.outputLongEdge
    });

    res.status(202).json({ id: job.id, status: job.status });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message, code: err.code || null });
  }
});

/**
 * Malzeme & renk alternatifi paketi: referans render + numaralı bölgeler + bölge başına
 * malzeme/renk/doku görseli. Bir istek = bir alternatif versiyon.
 */
app.post('/api/packages', (req, res) => {
  try {
    const body = req.body || {};
    const render = decodeUpload(body.render, { role: 'render' });
    const regions = decodeRegions(body.regions);

    if (rateLimited(req)) return res.status(429).json(rateLimitError());

    const clientKey = config.allowClientKey ? String(body.apiKey || '').trim() : '';

    const job = startPackageJob({
      render,
      regions,
      packageName: String(body.packageName || '').trim().slice(0, 80),
      scene: body.scene,
      time: body.time,
      weather: body.weather,
      aspect: body.aspect,
      userPrompt: body.prompt,
      providerName: body.provider || activeProviderName(),
      clientKey,
      outputLongEdge: Number(body.outputLongEdge) || config.outputLongEdge
    });

    res.status(202).json({ id: job.id, status: job.status });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message, code: err.code || null });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'İş bulunamadı veya süresi doldu.' });
  res.json(publicJob(job));
});

/**
 * Dosya adı Türkçe karakter içerebilir; HTTP başlıkları yalnızca ASCII taşır.
 * ASCII yedeği `filename`, tam ad RFC 5987 biçiminde `filename*` ile gönderilir.
 */
function contentDisposition(name) {
  const safe = String(name || 'render.png');
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

app.get('/api/jobs/:id/download', (req, res) => {
  const job = getJob(req.params.id);
  if (!job || !job.png) return res.status(404).json({ error: 'İndirilecek görsel bulunamadı.' });
  res.setHeader('content-type', 'image/png');
  res.setHeader('content-disposition', contentDisposition(job.downloadName));
  res.setHeader('content-length', job.png.length);
  res.end(job.png);
});

app.use((err, req, res, next) => {
  if (err instanceof InputError) return res.status(400).json({ error: err.message, code: err.code || null });
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: `Yükleme çok büyük. Tek dosya sınırı ${Math.round(config.maxUploadBytes / (1024 * 1024))} MB.` });
  }
  console.error('[server]', err);
  res.status(500).json({ error: err?.message || 'Sunucu hatası' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, config.host, () => {
    console.log(`Mimari render paneli: http://localhost:${config.port} (${config.host}:${config.port})`);
    console.log(`Sağlayıcı: ${activeProviderName()} | Çıktı uzun kenar: ${config.outputLongEdge}px`);
    console.log(
      `Erişim şifresi: ${config.panelPassword ? 'açık' : 'KAPALI'} | ` +
        `Kendi anahtarı: ${config.allowClientKey ? 'açık' : 'kapalı'} | ` +
        `Saatlik sınır: ${config.rateLimitPerHour || 'yok'}`
    );
    if (!config.panelPassword && activeProviderName() !== 'mock') {
      console.warn('[uyarı] Panel şifresiz yayınlanıyor ve sunucuda API anahtarı tanımlı. PANEL_PASSWORD ayarlamanız önerilir.');
    }
  });
}

export default app;
