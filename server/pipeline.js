import { randomUUID } from 'node:crypto';
import { config, RASTER_MIME, UNSUPPORTED_EXTENSIONS, UNSUPPORTED_MESSAGE } from './config.js';
import { getProvider } from './providers/index.js';
import { buildPackagePrompt, buildPrompt, MODES, PACKAGE_QC_CHECKLIST, QC_CHECKLIST } from './prompt.js';
import { combinationLabel, resolveColor, resolveMaterial, resolveSurface } from './materials.js';
import { ASPECT_RATIOS, finalize, inspect, prepareInput, preview } from './image.js';

const jobs = new Map();

function sweep() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > config.jobTtlMs) jobs.delete(id);
  }
}
setInterval(sweep, 5 * 60 * 1000).unref();

export class InputError extends Error {
  constructor(message, extra = {}) {
    super(message);
    this.name = 'InputError';
    this.status = 400;
    Object.assign(this, extra);
  }
}

const extensionOf = (name = '') => String(name).split('.').pop()?.toLowerCase() || '';

/** Panelden gelen dosya tanımını doğrular ve Buffer'a çevirir. */
export function decodeUpload(file, { role = 'render' } = {}) {
  if (!file || typeof file.data !== 'string') {
    throw new InputError('Görsel verisi eksik.');
  }

  const ext = extensionOf(file.name);
  if (UNSUPPORTED_EXTENSIONS.includes(ext)) {
    throw new InputError(UNSUPPORTED_MESSAGE, { code: 'UNSUPPORTED_FORMAT', extension: ext });
  }

  const mime = String(file.type || '').toLowerCase();
  if (!RASTER_MIME.has(mime)) {
    throw new InputError(
      `Desteklenmeyen dosya türü (${file.type || ext || 'bilinmiyor'}). PNG, JPG veya WEBP yükleyin.`,
      { code: 'UNSUPPORTED_FORMAT' }
    );
  }

  const base64 = file.data.includes(',') ? file.data.slice(file.data.indexOf(',') + 1) : file.data;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    throw new InputError('Dosya boş görünüyor.');
  }
  if (buffer.length > config.maxUploadBytes) {
    const mb = Math.round(config.maxUploadBytes / (1024 * 1024));
    throw new InputError(`Dosya çok büyük (en fazla ${mb} MB). ${role === 'render' ? 'Ham renderı' : 'Referansı'} küçültüp tekrar deneyin.`);
  }

  return { buffer, mime, name: file.name || 'render.png' };
}

function newJob(meta) {
  const id = randomUUID();
  const job = {
    id,
    status: 'queued',
    createdAt: Date.now(),
    steps: [],
    meta,
    result: null,
    error: null
  };
  jobs.set(id, job);
  return job;
}

function step(job, key, label) {
  job.status = key;
  job.steps.push({ key, label, at: Date.now() });
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    steps: job.steps,
    error: job.error,
    result: job.result,
    createdAt: job.createdAt
  };
}

/**
 * Bir işi kuyruğa alır ve arka planda çalıştırır. İş kimliği hemen döner; panel /api/jobs/:id ile izler.
 */
export function startJob(options) {
  const job = newJob({
    mode: options.mode,
    scene: options.scene,
    provider: options.providerName,
    fileName: options.render.name
  });

  run(job, options).catch((err) => {
    job.status = 'error';
    job.error = err.message || 'Bilinmeyen hata';
  });

  return job;
}

async function run(job, options) {
  const {
    render,
    references = [],
    mode = 'strict',
    scene = 'auto',
    time = 'auto',
    weather = 'auto',
    aspect = 'source',
    userPrompt = '',
    providerName,
    clientKey = '',
    outputLongEdge = config.outputLongEdge
  } = options;

  step(job, 'analyzing', 'Kaynak render analiz ediliyor');
  const sourceMeta = await inspect(render.buffer);
  const provider = getProvider(providerName, clientKey);

  const prepared = await prepareInput(render.buffer, config.inputLongEdge);
  const preparedRefs = [];
  for (const ref of references.slice(0, config.maxReferenceImages)) {
    const out = await prepareInput(ref.buffer, config.inputLongEdge);
    preparedRefs.push({ buffer: out.buffer, mime: 'image/png' });
  }

  const { instruction } = buildPrompt({
    mode,
    scene,
    time,
    weather,
    aspect,
    userPrompt,
    referenceCount: preparedRefs.length,
    source: { width: sourceMeta.width, height: sourceMeta.height }
  });

  const aspectValue = aspect === 'source' ? sourceMeta.aspect : ASPECT_RATIOS[aspect] ?? sourceMeta.aspect;

  step(job, 'generating', `${provider.label} ile fotogerçekçileştiriliyor`);
  const generated = await provider.generate({
    image: { buffer: prepared.buffer, mime: 'image/png' },
    references: preparedRefs,
    instruction,
    aspect: aspect === 'source' ? null : aspect,
    aspectValue,
    scene,
    apiKey: clientKey
  });

  step(job, 'upscaling', `Çıktı ${outputLongEdge}px uzun kenara yükseltiliyor ve PNG olarak kodlanıyor`);
  const finalImage = await finalize(generated.buffer, {
    longEdge: outputLongEdge,
    targetAspect: aspectValue
  });

  job.png = finalImage.buffer;
  job.downloadName = buildFileName(render.name, finalImage.width, finalImage.height);

  // Sonuç, durum 'done' olmadan ÖNCE yazılır; aksi halde panel done görüp boş sonuç okuyabilir.
  job.result = {
    previewUrl: await preview(finalImage.buffer),
    sourcePreviewUrl: await preview(render.buffer),
    downloadUrl: `/api/jobs/${job.id}/download`,
    fileName: job.downloadName,
    width: finalImage.width,
    height: finalImage.height,
    bytes: finalImage.bytes,
    source: { width: sourceMeta.width, height: sourceMeta.height },
    modelNative: finalImage.native,
    upscaled: finalImage.upscaled,
    scaleFactor: finalImage.scaleFactor,
    aspectMismatch: finalImage.aspectMismatch,
    provider: { id: provider.id, label: provider.label },
    mode: MODES[mode]?.label || mode,
    providerText: generated.providerText,
    resolutionNote: resolutionNote(finalImage),
    checklist: QC_CHECKLIST,
    instruction
  };

  step(job, 'done', 'Tamamlandı');
}

function resolutionNote(finalImage) {
  const target = `${finalImage.width}×${finalImage.height}`;
  if (!finalImage.upscaled) {
    return `Çıktı ${target} PNG. Model bu çözünürlüğü doğrudan üretti.`;
  }
  return (
    `Çıktı ${target} PNG. Modelin ürettiği gerçek çözünürlük ${finalImage.native.width}×${finalImage.native.height}; ` +
    `görsel ${finalImage.scaleFactor}× Lanczos ile bu boyuta yükseltildi. Yükseltme detay üretmez, ölçek büyütür.`
  );
}

function buildFileName(sourceName, width, height) {
  const base = String(sourceName || 'render')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .slice(0, 60) || 'render';
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}_fotogercek_${width}x${height}_${stamp}.png`;
}

/* ==================================================================================
 * MALZEME & RENK ALTERNATİFİ PAKETLERİ
 *
 * Panelde kullanıcı referans render üzerine tıklayarak numaralı bölgeler tanımlar; her
 * paket bu numaralara malzeme/renk/doku görseli atar. Bir paket = bir alternatif render.
 * ================================================================================== */

const clamp01 = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(1, num));
};

/**
 * Panelden gelen bölge listesini doğrular ve normalize eder.
 * Malzeme/renk/doku görselinin hiçbiri verilmeyen bölge "korunacak" olarak işaretlenir.
 */
export function decodeRegions(input, { limit = config.maxRegions } = {}) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new InputError('Alternatif üretmek için render üzerinde en az bir bölge işaretleyin.', { code: 'NO_REGION' });
  }
  if (input.length > limit) {
    throw new InputError(`Bir pakette en fazla ${limit} bölge işaretlenebilir.`, { code: 'TOO_MANY_REGIONS' });
  }

  const regions = input.map((raw, index) => {
    const x = clamp01(raw?.x);
    const y = clamp01(raw?.y);
    if (x === null || y === null) {
      throw new InputError(`Bölge ${index + 1} için render üzerindeki konum okunamadı.`, { code: 'BAD_REGION' });
    }

    const number = Number.parseInt(raw?.number, 10) || index + 1;
    const surface = raw?.surface ? resolveSurface(raw.surface) : null;
    const material = resolveMaterial(raw?.material ?? raw?.materialId ?? null);
    const color = resolveColor(raw?.color ?? null);
    const swatch = raw?.swatch ? decodeUpload(raw.swatch, { role: 'reference' }) : null;

    return {
      number,
      label: String(raw?.label || surface?.label || '').trim().slice(0, 120),
      x,
      y,
      surfaceRule: surface?.rule || '',
      surfaceId: surface?.id || null,
      material,
      color,
      swatch,
      note: String(raw?.note || '').trim().slice(0, 400)
    };
  });

  const changing = regions.filter((region) => region.material || region.color || region.swatch);
  if (changing.length === 0) {
    throw new InputError(
      'Bu paket hiçbir bölge için malzeme, renk veya doku görseli içermiyor. En az bir bölgeye malzeme atayın.',
      { code: 'EMPTY_PACKAGE' }
    );
  }

  return regions;
}

/** Bir malzeme paketini kuyruğa alır; iş kimliği hemen döner. */
export function startPackageJob(options) {
  const job = newJob({
    kind: 'package',
    packageName: options.packageName || '',
    regionCount: options.regions.length,
    provider: options.providerName,
    fileName: options.render.name
  });
  job.kind = 'package';

  runPackage(job, options).catch((err) => {
    job.status = 'error';
    job.error = err.message || 'Bilinmeyen hata';
  });

  return job;
}

async function runPackage(job, options) {
  const {
    render,
    regions,
    packageName = '',
    scene = 'auto',
    time = 'auto',
    weather = 'auto',
    aspect = 'source',
    userPrompt = '',
    providerName,
    clientKey = '',
    outputLongEdge = config.outputLongEdge
  } = options;

  step(job, 'analyzing', 'Referans render ve işaretlenen bölgeler okunuyor');
  const sourceMeta = await inspect(render.buffer);
  const provider = getProvider(providerName, clientKey);

  const prepared = await prepareInput(render.buffer, config.inputLongEdge);

  // Malzeme görselleri modele referans olarak gider; her biri ait olduğu bölgeyle etiketlenir.
  const swatchCount = regions.filter((region) => region.swatch).length;
  if (swatchCount) {
    step(job, 'materials', `${swatchCount} malzeme görseli hazırlanıyor`);
  }

  const references = [];
  const promptRegions = [];
  for (const region of regions) {
    let swatchRef = null;
    if (region.swatch) {
      const out = await prepareInput(region.swatch.buffer, config.inputLongEdge);
      const index = references.length + 2; // 1 numaralı görsel her zaman ham renderdır
      swatchRef = `Referans görsel ${index}`;
      references.push({
        buffer: out.buffer,
        mime: 'image/png',
        name: `bolge-${region.number}-malzeme`,
        caption:
          `${swatchRef} — BÖLGE ${region.number}${region.label ? ` (${region.label})` : ''} için malzeme referansı. ` +
          'Yalnızca doku, desen, renk ve yüzey karakteri kaynağıdır; geometrisi, perspektifi, arka planı ve ' +
          'üzerindeki yazılar sahneye taşınmaz.'
      });
    }
    promptRegions.push({ ...region, swatchRef });
  }

  const { instruction } = buildPackagePrompt({
    regions: promptRegions,
    packageName,
    scene,
    time,
    weather,
    aspect,
    userPrompt,
    swatchCount,
    source: { width: sourceMeta.width, height: sourceMeta.height }
  });

  const aspectValue = aspect === 'source' ? sourceMeta.aspect : ASPECT_RATIOS[aspect] ?? sourceMeta.aspect;

  step(job, 'generating', `${provider.label} ile "${packageName || 'alternatif'}" versiyonu render ediliyor`);
  const generated = await provider.generate({
    image: { buffer: prepared.buffer, mime: 'image/png' },
    references,
    instruction,
    aspect: aspect === 'source' ? null : aspect,
    aspectValue,
    scene,
    apiKey: clientKey
  });

  step(job, 'upscaling', `Çıktı ${outputLongEdge}px uzun kenara yükseltiliyor ve PNG olarak kodlanıyor`);
  const finalImage = await finalize(generated.buffer, {
    longEdge: outputLongEdge,
    targetAspect: aspectValue
  });

  job.png = finalImage.buffer;
  job.downloadName = buildPackageFileName(render.name, packageName, finalImage.width, finalImage.height);

  job.result = {
    kind: 'package',
    packageName,
    previewUrl: await preview(finalImage.buffer),
    sourcePreviewUrl: await preview(render.buffer),
    downloadUrl: `/api/jobs/${job.id}/download`,
    fileName: job.downloadName,
    width: finalImage.width,
    height: finalImage.height,
    bytes: finalImage.bytes,
    source: { width: sourceMeta.width, height: sourceMeta.height },
    modelNative: finalImage.native,
    upscaled: finalImage.upscaled,
    scaleFactor: finalImage.scaleFactor,
    aspectMismatch: finalImage.aspectMismatch,
    provider: { id: provider.id, label: provider.label },
    mode: 'Malzeme ve renk alternatifi paketi',
    providerText: generated.providerText,
    resolutionNote: resolutionNote(finalImage),
    checklist: PACKAGE_QC_CHECKLIST,
    legend: promptRegions.map((region) => ({
      number: region.number,
      label: region.label,
      x: region.x,
      y: region.y,
      material: region.material?.label || null,
      color: region.color ? { name: region.color.name, hex: region.color.hex } : null,
      swatch: Boolean(region.swatch),
      summary: combinationLabel(region) || 'korunacak',
      note: region.note
    })),
    instruction
  };

  step(job, 'done', 'Tamamlandı');
}

function buildPackageFileName(sourceName, packageName, width, height) {
  const slug = (value, fallback) =>
    String(value || '')
      .replace(/\.[^.]+$/, '')
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || fallback;

  const base = slug(sourceName, 'render');
  const pack = slug(packageName, 'alternatif');
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}_${pack}_${width}x${height}_${stamp}.png`;
}
