import { config } from '../config.js';

export const id = 'openai';
export const label = 'OpenAI (images/edits)';

export function isConfigured(clientKey = '') {
  return Boolean(clientKey || config.openai.apiKey);
}

export function describe() {
  return {
    id,
    label,
    model: config.openai.model,
    configured: isConfigured(),
    acceptsClientKey: true,
    keyHint: 'platform.openai.com üzerinden alınan API anahtarı',
    note: 'Çıktı 1024–1536 piksel aralığındadır; 4K çıktı yükseltme ile üretilir. Oran, desteklenen en yakın boyuta eşlenir.'
  };
}

/** İstenen oranı API'nin desteklediği en yakın boyuta eşler. */
function sizeForAspect(aspectValue) {
  if (!aspectValue) return 'auto';
  if (aspectValue >= 1.2) return '1536x1024';
  if (aspectValue <= 0.84) return '1024x1536';
  return '1024x1024';
}

export async function generate({ image, references = [], instruction, aspectValue = null, apiKey = '' }) {
  const key = apiKey || config.openai.apiKey;
  if (!key) {
    throw new Error('OPENAI_API_KEY tanımlı değil.');
  }

  const form = new FormData();
  form.append('model', config.openai.model);
  form.append('prompt', instruction);
  form.append('n', '1');
  form.append('quality', 'high');
  form.append('input_fidelity', 'high');
  form.append('size', sizeForAspect(aspectValue));
  form.append('image[]', new Blob([image.buffer], { type: image.mime }), 'render.png');

  references.forEach((ref, index) => {
    // Dosya adı modele hangi referansın hangi bölgeye ait olduğunu bildiren tek kanaldır.
    const slug = String(ref.name || `reference-${index + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `reference-${index + 1}`;
    form.append('image[]', new Blob([ref.buffer], { type: ref.mime }), `${slug}.png`);
  });

  const response = await fetch(`${config.openai.baseUrl}/images/edits`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(config.requestTimeoutMs)
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`OpenAI isteği başarısız: ${detail}`);
  }

  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI görsel döndürmedi.');
  }

  return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png', providerText: null };
}
