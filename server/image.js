import sharp from 'sharp';

sharp.cache(false);

export const ASPECT_RATIOS = {
  source: null,
  '16:9': 16 / 9,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16
};

/** Görselin temel bilgilerini okur. */
export async function inspect(buffer) {
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('Görsel boyutları okunamadı. Dosya bozuk olabilir.');
  }
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    aspect: meta.width / meta.height,
    hasAlpha: Boolean(meta.hasAlpha)
  };
}

/**
 * Modele gönderilecek girdiyi hazırlar: uzun kenarı sınırlar, PNG'e çevirir.
 * Küçültme yapılır, büyütme yapılmaz — model girdisi kaynaktan daha detaylı olamaz.
 */
export async function prepareInput(buffer, longEdge) {
  const meta = await inspect(buffer);
  const currentLongEdge = Math.max(meta.width, meta.height);
  const pipeline = sharp(buffer).flatten({ background: '#ffffff' });

  if (currentLongEdge > longEdge) {
    const scale = longEdge / currentLongEdge;
    pipeline.resize({
      width: Math.round(meta.width * scale),
      height: Math.round(meta.height * scale),
      kernel: 'lanczos3',
      fit: 'fill'
    });
  }

  const out = await pipeline.png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true });
  return {
    buffer: out.data,
    width: out.info.width,
    height: out.info.height,
    source: meta
  };
}

/**
 * Model çıktısını nihai teslim formatına getirir: hedef uzun kenara (varsayılan 4K) yükseltir,
 * ölçeğe göre çok hafif keskinleştirir ve PNG olarak kodlar.
 *
 * Oran davranışı: model çıktısının oranı hedefe çok yakınsa (<= %1.5) sessizce hedefe oturtulur;
 * daha fazla saparsa KIRPILMAZ — modelin oranı korunur ve sapma raporlanır.
 */
export async function finalize(buffer, { longEdge = 3840, targetAspect = null, sharpen = true } = {}) {
  const native = await inspect(buffer);

  let outAspect = native.aspect;
  let aspectMismatch = null;

  if (targetAspect) {
    const delta = Math.abs(native.aspect - targetAspect) / targetAspect;
    if (delta <= 0.015) {
      outAspect = targetAspect;
    } else {
      aspectMismatch = {
        requested: Number(targetAspect.toFixed(4)),
        produced: Number(native.aspect.toFixed(4)),
        deviationPct: Number((delta * 100).toFixed(1))
      };
    }
  }

  let width;
  let height;
  if (outAspect >= 1) {
    width = longEdge;
    height = Math.round(longEdge / outAspect);
  } else {
    height = longEdge;
    width = Math.round(longEdge * outAspect);
  }

  const scaleFactor = Math.max(width / native.width, height / native.height);
  const pipeline = sharp(buffer).resize({ width, height, kernel: 'lanczos3', fit: 'fill' });

  if (sharpen && scaleFactor > 1.1) {
    // Yükseltmeden gelen yumuşamayı dengeleyen ölçülü unsharp — halo üretmeyecek seviyede.
    const sigma = Math.min(1.6, 0.6 + (scaleFactor - 1) * 0.2);
    pipeline.sharpen({ sigma, m1: 0.4, m2: 1.6 });
  }

  const out = await pipeline
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: out.data,
    width: out.info.width,
    height: out.info.height,
    bytes: out.data.length,
    native: { width: native.width, height: native.height },
    upscaled: scaleFactor > 1.0001,
    scaleFactor: Number(scaleFactor.toFixed(2)),
    aspectMismatch
  };
}

/** Panelde gösterilecek küçük önizleme (data URL için). */
export async function preview(buffer, longEdge = 1400) {
  const meta = await inspect(buffer);
  const current = Math.max(meta.width, meta.height);
  const pipeline = sharp(buffer);
  if (current > longEdge) {
    const scale = longEdge / current;
    pipeline.resize({
      width: Math.round(meta.width * scale),
      height: Math.round(meta.height * scale),
      kernel: 'lanczos3'
    });
  }
  const data = await pipeline.jpeg({ quality: 86 }).toBuffer();
  return `data:image/jpeg;base64,${data.toString('base64')}`;
}

/**
 * API anahtarı olmadan panelin uçtan uca çalışmasını sağlayan yerel iyileştirme.
 * Bu bir yapay zekâ üretimi DEĞİLDİR: yalnızca ton, kontrast, doygunluk ve netlik düzeltmesidir.
 */
export async function localEnhance(buffer, { scene = 'auto' } = {}) {
  const warm = scene === 'interior';
  return sharp(buffer)
    .flatten({ background: '#ffffff' })
    .modulate({ brightness: 1.02, saturation: warm ? 1.06 : 1.1 })
    .linear(1.06, -8) // hafif kontrast; siyahları kapatmadan
    .gamma(1.03)
    .sharpen({ sigma: 0.7, m1: 0.3, m2: 1.2 })
    .png({ compressionLevel: 6 })
    .toBuffer();
}
