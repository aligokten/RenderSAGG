import { config } from '../config.js';

export const id = 'openai';
export const label = 'OpenAI (images/edits)';

/** gpt-image-2 ve sonrası serbest WIDTHxHEIGHT boyut kabul eder; öncekiler sabit listeyle sınırlıdır. */
export function supportsArbitrarySize(model = config.openai.model) {
  return /gpt-image-([2-9]|\d{2})/i.test(model);
}

/** input_fidelity yalnızca gpt-image-1 ailesinde anlamlı; gpt-image-2 girdiyi zaten yüksek sadakatle işler. */
export function usesInputFidelity(model = config.openai.model) {
  return /gpt-image-1/i.test(model);
}

// API sınırları: kenarlar 16'nın katı, oran 1:3 ile 3:1 arasında, en büyük çözünürlük 3840x2160.
export const MAX_EDGE = 3840;
export const MAX_PIXELS = 3840 * 2160;
const MIN_EDGE = 256;

const toMultipleOf16 = (value) => Math.max(MIN_EDGE, Math.round(value / 16) * 16);

/**
 * Hedef uzun kenar ve orandan API'nin kabul edeceği boyut dizesini üretir.
 * Sınırı aşan istekler oran korunarak küçültülür; kalan fark panelde yükseltmeyle kapatılır
 * ve sonuç künyesinde açıkça belirtilir.
 */
export function sizeFor({ model = config.openai.model, aspectValue = 1, longEdge = config.outputLongEdge } = {}) {
  if (!supportsArbitrarySize(model)) {
    if (aspectValue >= 1.2) return '1536x1024';
    if (aspectValue <= 0.84) return '1024x1536';
    return '1024x1024';
  }

  const aspect = Math.min(3, Math.max(1 / 3, aspectValue || 1));
  let width;
  let height;
  if (aspect >= 1) {
    width = Math.min(longEdge, MAX_EDGE);
    height = width / aspect;
  } else {
    height = Math.min(longEdge, MAX_EDGE);
    width = height * aspect;
  }

  // Toplam piksel sınırını oran bozulmadan uygula.
  const excess = Math.sqrt((width * height) / MAX_PIXELS);
  if (excess > 1) {
    width /= excess;
    height /= excess;
  }

  return `${toMultipleOf16(Math.min(width, MAX_EDGE))}x${toMultipleOf16(Math.min(height, MAX_EDGE))}`;
}

export function isConfigured(clientKey = '') {
  return Boolean(clientKey || config.openai.apiKey);
}

export function describe() {
  const native4k = supportsArbitrarySize();
  return {
    id,
    label,
    model: config.openai.model,
    configured: isConfigured(),
    acceptsClientKey: true,
    keyHint: 'platform.openai.com üzerinden alınan API anahtarı',
    nativeHighRes: native4k,
    note: native4k
      ? 'Ham render + referanslar tek istekte gönderilir. Bu model 3840×2160’a kadar doğrudan üretir; ' +
        'boyut API sınırlarına göre yuvarlanır (kenarlar 16’nın katı, oran 1:3–3:1).'
      : 'Çıktı 1024–1536 piksel aralığındadır; 4K çıktı yükseltme ile üretilir. Doğrudan 4K için ' +
        'OPENAI_MODEL değerini gpt-image-2 veya sonrasına alın.'
  };
}

/** OpenAI'nin İngilizce hata gövdesini panelde işe yarar Türkçe mesaja çevirir. */
export function explainOpenAIError(status, payload, model = config.openai.model) {
  const raw = payload?.error?.message || `HTTP ${status}`;

  if (status === 401) {
    return 'API anahtarı geçersiz veya süresi dolmuş. OPENAI_API_KEY değerini kontrol edin.';
  }
  if (status === 403 && /verif/i.test(raw)) {
    return (
      `Bu modeli kullanmak için kuruluş doğrulaması gerekiyor: ${model}. ` +
      'platform.openai.com → Settings → Organization → General → "Verify Organization" adımını tamamlayın. ' +
      'Doğrulama sonrası erişimin yayılması 15 dakikayı bulabilir.'
    );
  }
  if (status === 429) {
    if (/quota|billing|insufficient/i.test(raw)) {
      return `Hesabın kotası/bakiyesi yetersiz. platform.openai.com → Billing bölümünden bakiye ekleyin. Ham mesaj: ${raw}`;
    }
    return `İstek sınırına takıldı, kısa bir süre sonra tekrar deneyin. Ham mesaj: ${raw}`;
  }
  if (status === 404 || /does not exist|not found/i.test(raw)) {
    return (
      `Model bulunamadı veya bu anahtarla kullanılamıyor: ${model}. ` +
      'OPENAI_MODEL değerini hesabınızın eriştiği bir görsel modeliyle değiştirin.'
    );
  }
  if (status === 400 && /content|safety|rejected|policy/i.test(raw)) {
    return `İstek içerik politikası nedeniyle reddedildi. Prompt metnini sadeleştirip tekrar deneyin. Ham mesaj: ${raw}`;
  }
  return `OpenAI isteği başarısız: ${raw}`;
}

function buildForm({ image, references, instruction, model, size, quality, withInputFidelity }) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', instruction);
  form.append('n', '1');
  form.append('output_format', 'png');
  if (quality) form.append('quality', quality);
  if (size) form.append('size', size);
  if (withInputFidelity) form.append('input_fidelity', 'high');

  form.append('image[]', new Blob([image.buffer], { type: image.mime }), 'render.png');
  references.forEach((ref, index) => {
    form.append('image[]', new Blob([ref.buffer], { type: ref.mime }), `reference-${index + 1}.png`);
  });
  return form;
}

async function call(form, key) {
  const response = await fetch(`${config.openai.baseUrl}/images/edits`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(config.requestTimeoutMs)
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

/** Boyut/kalite/sadakat parametreleri reddedildiyse sade bir istekle tekrar denenebilir. */
function isParameterError(payload) {
  const message = payload?.error?.message || '';
  const param = payload?.error?.param || '';
  return /size|quality|input_fidelity|output_format|unsupported|invalid value/i.test(`${message} ${param}`);
}

export async function generate({
  image,
  references = [],
  instruction,
  aspectValue = null,
  outputLongEdge = config.outputLongEdge,
  apiKey = ''
}) {
  const key = apiKey || config.openai.apiKey;
  if (!key) {
    throw new Error('OPENAI_API_KEY tanımlı değil.');
  }

  const model = config.openai.model;
  const size = sizeFor({ model, aspectValue: aspectValue || 1, longEdge: outputLongEdge });

  let { response, payload } = await call(
    buildForm({
      image,
      references,
      instruction,
      model,
      size,
      quality: config.openai.quality,
      withInputFidelity: usesInputFidelity(model)
    }),
    key
  );

  // Parametre reddinde bir kez daha, API'nin varsayılanlarıyla dene.
  if (!response.ok && isParameterError(payload)) {
    ({ response, payload } = await call(
      buildForm({ image, references, instruction, model, size: null, quality: null, withInputFidelity: false }),
      key
    ));
  }

  if (!response.ok) {
    throw new Error(explainOpenAIError(response.status, payload, model));
  }

  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI görsel döndürmedi.');
  }

  return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png', providerText: null };
}
