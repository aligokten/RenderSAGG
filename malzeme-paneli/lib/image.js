/**
 * Tarayıcı tarafı görüntü işleme.
 *
 * Sunucu sürümünde bu işi sharp yapar (Lanczos yeniden örnekleme). GitHub Pages'te sunucu
 * olmadığı için aynı adımlar canvas ile yürütülür: canvas bilineer örnekleme kullanır, bu
 * yüzden yükseltme kalitesi sharp kadar iyi değildir. Kayıp mümkün olduğunca azaltmak için
 * büyütme tek adımda değil, 2× adımlarla yapılır.
 *
 * Yükseltme HİÇBİR koşulda detay üretmez, yalnızca ölçek büyütür — panel bunu sonuç
 * künyesinde açıkça yazar.
 */

export const ASPECT_RATIOS = {
  source: null,
  '16:9': 16 / 9,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16
};

/** Blob veya data URL'den <img> üretir. */
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    img.onload = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      reject(new Error('Görsel okunamadı. Dosya bozuk olabilir.'));
    };
    img.src = url;
  });
}

const canvasOf = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

function drawScaled(source, width, height, filter = '') {
  const canvas = canvasOf(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (filter) ctx.filter = filter;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Hedefe 2× adımlarla yaklaşır: tek adımda 4× büyütme belirgin bulanıklık üretir,
 * adımlı büyütme kenarları daha derli toplu tutar.
 */
function resampleStepwise(source, targetWidth, targetHeight) {
  let current = source;
  let width = source.width || source.naturalWidth;
  let height = source.height || source.naturalHeight;

  // Küçültme: yarıya inerek git (aliasing'i azaltır)
  while (width > targetWidth * 2 && height > targetHeight * 2) {
    width = Math.max(targetWidth, Math.round(width / 2));
    height = Math.max(targetHeight, Math.round(height / 2));
    current = drawScaled(current, width, height);
  }
  // Büyütme: iki katına çıkarak git
  while (width * 2 < targetWidth && height * 2 < targetHeight) {
    width = Math.min(targetWidth, width * 2);
    height = Math.min(targetHeight, height * 2);
    current = drawScaled(current, width, height);
  }

  return drawScaled(current, targetWidth, targetHeight);
}

const toBlob = (canvas, type = 'image/png', quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Görsel kodlanamadı.'))),
      type,
      quality
    );
  });

/** Blob'u base64'e çevirir (model isteklerinde inline veri için). */
export function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(blob);
  });
}

/** Dosya bilgilerini okur. */
export async function inspect(source) {
  const img = await loadImage(source);
  return { width: img.naturalWidth, height: img.naturalHeight, aspect: img.naturalWidth / img.naturalHeight };
}

/**
 * Modele gönderilecek girdiyi hazırlar: uzun kenarı sınırlar, PNG'e çevirir.
 * Büyütme yapılmaz — model girdisi kaynaktan daha detaylı olamaz.
 */
export async function prepareInput(source, longEdge = 1536) {
  const img = await loadImage(source);
  const currentLongEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = currentLongEdge > longEdge ? longEdge / currentLongEdge : 1;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = scale === 1 ? drawScaled(img, width, height) : resampleStepwise(img, width, height);
  const blob = await toBlob(canvas, 'image/png');
  return { blob, base64: await toBase64(blob), mime: 'image/png', width, height };
}

/**
 * Model çıktısını teslim formatına getirir: hedef uzun kenara yükseltir ve PNG olarak kodlar.
 *
 * Oran davranışı sunucu sürümüyle aynıdır: model çıktısı hedefe çok yakınsa (<= %1.5)
 * sessizce hedefe oturtulur, daha fazla saparsa KIRPILMAZ — sapma künyede raporlanır.
 */
export async function finalize(blob, { longEdge = 3840, targetAspect = null } = {}) {
  const img = await loadImage(blob);
  const native = { width: img.naturalWidth, height: img.naturalHeight };
  const nativeAspect = native.width / native.height;

  let outAspect = nativeAspect;
  let aspectMismatch = null;
  if (targetAspect) {
    const delta = Math.abs(nativeAspect - targetAspect) / targetAspect;
    if (delta <= 0.015) {
      outAspect = targetAspect;
    } else {
      aspectMismatch = {
        requested: Number(targetAspect.toFixed(4)),
        produced: Number(nativeAspect.toFixed(4)),
        deviationPct: Number((delta * 100).toFixed(1))
      };
    }
  }

  const width = outAspect >= 1 ? longEdge : Math.round(longEdge * outAspect);
  const height = outAspect >= 1 ? Math.round(longEdge / outAspect) : longEdge;
  const scaleFactor = Math.max(width / native.width, height / native.height);

  let canvas = resampleStepwise(img, width, height);
  if (scaleFactor > 1.1) {
    // Yükseltmeden gelen yumuşamayı dengeleyen çok ölçülü kontrast/doygunluk düzeltmesi.
    canvas = drawScaled(canvas, width, height, 'contrast(1.03) saturate(1.02)');
  }

  const out = await toBlob(canvas, 'image/png');
  return {
    blob: out,
    width,
    height,
    bytes: out.size,
    native,
    upscaled: scaleFactor > 1.0001,
    scaleFactor: Number(scaleFactor.toFixed(2)),
    aspectMismatch
  };
}

/** Panelde gösterilecek küçük önizleme (data URL). */
export async function preview(blob, longEdge = 1400) {
  const img = await loadImage(blob);
  const current = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = current > longEdge ? longEdge / current : 1;
  const canvas = resampleStepwise(img, Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale));
  return canvas.toDataURL('image/jpeg', 0.86);
}

/**
 * Anahtarsız demo modu. Bu bir yapay zekâ üretimi DEĞİLDİR: yalnızca ton, kontrast ve
 * doygunluk düzeltmesidir; malzeme değişmez. Panelin uçtan uca çalıştığını göstermek içindir.
 */
export async function demoEnhance(blob, { scene = 'auto' } = {}) {
  const img = await loadImage(blob);
  const filter = scene === 'interior'
    ? 'brightness(1.03) saturate(1.06) contrast(1.05)'
    : 'brightness(1.02) saturate(1.1) contrast(1.06)';
  const canvas = drawScaled(img, img.naturalWidth, img.naturalHeight, filter);
  return toBlob(canvas, 'image/png');
}
