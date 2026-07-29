import { config } from '../config.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const id = 'gemini';
export const label = 'Google Gemini (image edit)';

/** API'nin kabul ettiği oran değerleri; bunun dışındaki oranlar gönderilmez. */
export const SUPPORTED_ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

/** imageConfig.imageSize yalnızca Gemini 3 nesli görsel modellerinde bulunur. */
export function supportsImageSize(model = config.gemini.model) {
  return /gemini-3/i.test(model);
}

/** Hedef uzun kenarı API'nin kabul ettiği en yakın boyut adına çevirir. */
export function imageSizeForLongEdge(longEdge) {
  if (longEdge >= 3000) return '4K';
  if (longEdge >= 1800) return '2K';
  return '1K';
}

/**
 * Kaynak oranına en yakın desteklenen oranı bulur.
 * Sapma toleransı aşılırsa null döner — bu durumda oran gönderilmez ve model girdi
 * görselin oranını izler; böylece kadraj zorla değiştirilmiş olmaz.
 */
export function nearestSupportedAspect(ratio, tolerance = 0.015) {
  let best = null;
  for (const label of SUPPORTED_ASPECTS) {
    const [w, h] = label.split(':').map(Number);
    const value = w / h;
    const deviation = Math.abs(value - ratio) / ratio;
    if (!best || deviation < best.deviation) best = { label, deviation };
  }
  return best && best.deviation <= tolerance ? best.label : null;
}

export function isConfigured(clientKey = '') {
  return Boolean(clientKey || config.gemini.apiKey);
}

export function describe() {
  const native4k = supportsImageSize();
  return {
    id,
    label,
    model: config.gemini.model,
    configured: isConfigured(),
    acceptsClientKey: true,
    keyHint: 'aistudio.google.com üzerinden alınan API anahtarı',
    nativeHighRes: native4k,
    note: native4k
      ? 'Ham render + referanslar tek istekte gönderilir. Bu model 4K’ya kadar doğrudan üretebilir; ' +
        'model yine de daha küçük döndürürse fark yükseltme ile kapatılır ve sonuç künyesinde belirtilir.'
      : 'Ham render + referanslar tek istekte gönderilir. Bu modelin çıktısı ~1K–2K uzun kenardır; ' +
        '4K çıktı yükseltme ile üretilir. Doğrudan 4K için GEMINI_MODEL değerini gemini-3 nesli bir görsel modele alın.'
  };
}

function buildBody({ image, references, instruction, aspect, imageSize }) {
  const parts = [
    { text: instruction },
    { inline_data: { mime_type: image.mime, data: image.buffer.toString('base64') } }
  ];

  references.forEach((ref, index) => {
    parts.push({ text: `Referans görsel ${index + 1} — yalnızca malzeme, renk, ışık ve atmosfer kaynağı.` });
    parts.push({ inline_data: { mime_type: ref.mime, data: ref.buffer.toString('base64') } });
  });

  // Dokümantasyondaki şekil TEXT+IMAGE; yalnızca IMAGE bazı modellerde reddedilir.
  const generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
  const imageConfig = {};
  if (aspect) imageConfig.aspectRatio = aspect;
  if (imageSize) imageConfig.imageSize = imageSize;
  if (Object.keys(imageConfig).length) generationConfig.imageConfig = imageConfig;

  return { contents: [{ role: 'user', parts }], generationConfig };
}

async function call(url, key, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.requestTimeoutMs)
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

/** Bilinmeyen alan / geçersiz argüman hatalarında imageConfig'siz tekrar denenebilir mi? */
function isFieldError(payload) {
  const message = payload?.error?.message || '';
  return /unknown name|invalid.*argument|not supported|imageConfig|imageSize|aspectRatio/i.test(message);
}

/**
 * @param {object} req
 * @param {{buffer:Buffer, mime:string}} req.image   Ham render (model girdisi)
 * @param {Array<{buffer:Buffer, mime:string}>} req.references
 * @param {string} req.instruction
 * @param {string|null} req.aspect       '16:9' gibi; kaynak oranı için null
 * @param {number|null} req.aspectValue  Kaynak oranının sayısal değeri
 * @param {number} req.outputLongEdge    Hedef uzun kenar (imageSize eşlemesi için)
 * @returns {Promise<{buffer:Buffer, mime:string, providerText:string|null}>}
 */
export async function generate({
  image,
  references = [],
  instruction,
  aspect = null,
  aspectValue = null,
  outputLongEdge = config.outputLongEdge,
  apiKey = ''
}) {
  const key = apiKey || config.gemini.apiKey;
  if (!key) {
    throw new Error('GEMINI_API_KEY tanımlı değil.');
  }

  // Panelde "kaynak oranı" seçiliyse, kaynağa yeterince yakın desteklenen bir oran varsa onu
  // bildiririz; yoksa hiç oran göndermeyip modelin girdi görseli izlemesini sağlarız.
  let effectiveAspect = aspect;
  if (!effectiveAspect && aspectValue) effectiveAspect = nearestSupportedAspect(aspectValue);
  if (effectiveAspect && !SUPPORTED_ASPECTS.includes(effectiveAspect)) effectiveAspect = null;

  const imageSize = supportsImageSize() ? imageSizeForLongEdge(outputLongEdge) : null;
  const url = `${ENDPOINT}/${encodeURIComponent(config.gemini.model)}:generateContent`;

  let { response, payload } = await call(url, key, buildBody({ image, references, instruction, aspect: effectiveAspect, imageSize }));

  // imageConfig'i kabul etmeyen modellerde isteği sadeleştirip bir kez daha dene.
  if (!response.ok && (imageSize || effectiveAspect) && isFieldError(payload)) {
    ({ response, payload } = await call(url, key, buildBody({ image, references, instruction, aspect: null, imageSize: null })));
  }

  if (!response.ok) {
    const detail = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini isteği başarısız: ${detail}`);
  }

  const candidate = payload?.candidates?.[0];
  const blockReason = payload?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini isteği engellendi (${blockReason}). Prompt metnini sadeleştirip tekrar deneyin.`);
  }

  const candidateParts = candidate?.content?.parts || [];
  const imagePart = candidateParts.find((part) => part.inlineData?.data || part.inline_data?.data);
  if (!imagePart) {
    const text = candidateParts.map((part) => part.text).filter(Boolean).join(' ').trim();
    const finish = candidate?.finishReason ? ` (finishReason: ${candidate.finishReason})` : '';
    throw new Error(`Gemini görsel döndürmedi${finish}.${text ? ' Model yanıtı: ' + text.slice(0, 300) : ''}`);
  }

  const inline = imagePart.inlineData || imagePart.inline_data;
  return {
    buffer: Buffer.from(inline.data, 'base64'),
    mime: inline.mimeType || inline.mime_type || 'image/png',
    providerText: candidateParts.map((part) => part.text).filter(Boolean).join(' ').trim() || null
  };
}
