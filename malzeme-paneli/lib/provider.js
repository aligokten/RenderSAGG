/**
 * Tarayıcıdan görsel üretimi.
 *
 * Sunucusuz sürümde istek doğrudan tarayıcıdan sağlayıcıya gider; API anahtarı yalnızca
 * kullanıcının kendi tarayıcısındadır ve hiçbir sunucuya iletilmez. Bunun bedeli, anahtarın
 * tarayıcıda bulunmasıdır: paylaşılan bir bilgisayarda "hatırla" seçeneğini işaretlemeyin.
 */

import { demoEnhance, toBase64 } from './image.js';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Google Gemini (image edit)',
    model: 'gemini-2.5-flash-image',
    needsKey: true,
    keyHint: 'aistudio.google.com üzerinden alınan API anahtarı',
    note: 'Referans render + malzeme görselleri tek istekte gider. Model çıktısı genelde ~1K–2K uzun kenardır; büyük çıktı yükseltme ile üretilir.'
  },
  {
    id: 'openai',
    label: 'OpenAI (images/edits)',
    model: 'gpt-image-1',
    needsKey: true,
    keyHint: 'platform.openai.com üzerinden alınan API anahtarı',
    note: 'Tarayıcıdan doğrudan çağrılır. OpenAI tarayıcı isteklerini engellerse (CORS) tarayıcı konsolunda ağ hatası görürsünüz; bu durumda Gemini kullanın.'
  },
  {
    id: 'demo',
    label: 'Yerel demo (anahtarsız)',
    model: 'canvas/local',
    needsKey: false,
    note: 'Yapay zekâ üretimi DEĞİLDİR: malzemeyi değiştirmez, yalnızca ton ve kontrast düzeltir. Panelin uçtan uca çalıştığını görmek içindir.'
  }
];

export const providerById = (id) => PROVIDERS.find((provider) => provider.id === id) || PROVIDERS[0];

/**
 * @param {object} req
 * @param {{base64:string, mime:string, blob:Blob}} req.image  Referans render
 * @param {Array<{base64:string, mime:string, caption:string, name:string}>} req.references
 * @param {string} req.instruction
 * @param {string|null} req.aspect  '16:9' gibi; kaynak oranı için null
 * @returns {Promise<{blob:Blob, providerText:string|null}>}
 */
export async function generate({ providerId, image, references = [], instruction, aspect, aspectValue, scene, apiKey, model }) {
  if (providerId === 'demo') {
    return {
      blob: await demoEnhance(image.blob, { scene }),
      providerText: 'Yerel demo modu: görsel yapay zekâ ile yeniden üretilmedi, malzeme değişmedi; yalnızca ton/kontrast düzeltmesi uygulandı.'
    };
  }
  if (providerId === 'openai') return generateOpenAI({ image, references, instruction, aspectValue, apiKey, model });
  return generateGemini({ image, references, instruction, aspect, apiKey, model });
}

async function generateGemini({ image, references, instruction, aspect, apiKey, model }) {
  if (!apiKey) throw new Error('Gemini API anahtarı girilmedi.');

  const parts = [
    { text: instruction },
    { inline_data: { mime_type: image.mime, data: image.base64 } }
  ];
  references.forEach((ref) => {
    parts.push({ text: ref.caption });
    parts.push({ inline_data: { mime_type: ref.mime, data: ref.base64 } });
  });

  const generationConfig = { responseModalities: ['IMAGE'] };
  if (aspect) generationConfig.imageConfig = { aspectRatio: aspect };

  const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Gemini isteği başarısız: ${payload?.error?.message || `HTTP ${response.status}`}`);
  }
  if (payload?.promptFeedback?.blockReason) {
    throw new Error(`Gemini isteği engellendi (${payload.promptFeedback.blockReason}). Not alanlarını sadeleştirip tekrar deneyin.`);
  }

  const candidate = payload?.candidates?.[0];
  const candidateParts = candidate?.content?.parts || [];
  const imagePart = candidateParts.find((part) => part.inlineData?.data || part.inline_data?.data);
  if (!imagePart) {
    const text = candidateParts.map((part) => part.text).filter(Boolean).join(' ').trim();
    const finish = candidate?.finishReason ? ` (finishReason: ${candidate.finishReason})` : '';
    throw new Error(`Gemini görsel döndürmedi${finish}.${text ? ' Model yanıtı: ' + text.slice(0, 300) : ''}`);
  }

  const inline = imagePart.inlineData || imagePart.inline_data;
  return {
    blob: base64ToBlob(inline.data, inline.mimeType || inline.mime_type || 'image/png'),
    providerText: candidateParts.map((part) => part.text).filter(Boolean).join(' ').trim() || null
  };
}

/** İstenen oranı API'nin desteklediği en yakın boyuta eşler. */
function sizeForAspect(aspectValue) {
  if (!aspectValue) return 'auto';
  if (aspectValue >= 1.2) return '1536x1024';
  if (aspectValue <= 0.84) return '1024x1536';
  return '1024x1024';
}

async function generateOpenAI({ image, references, instruction, aspectValue, apiKey, model }) {
  if (!apiKey) throw new Error('OpenAI API anahtarı girilmedi.');

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', instruction);
  form.append('n', '1');
  form.append('quality', 'high');
  form.append('input_fidelity', 'high');
  form.append('size', sizeForAspect(aspectValue));
  form.append('image[]', image.blob, 'render.png');
  references.forEach((ref, index) => {
    const slug = String(ref.name || `reference-${index + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    form.append('image[]', base64ToBlob(ref.base64, ref.mime), `${slug || `reference-${index + 1}`}.png`);
  });

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form
    });
  } catch (err) {
    throw new Error(
      'OpenAI isteği tarayıcıdan gönderilemedi (ağ/CORS engeli). Bu sürüm sunucusuz çalıştığı için ' +
      'istek doğrudan tarayıcıdan gider; Gemini sağlayıcısını kullanabilirsiniz.'
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`OpenAI isteği başarısız: ${payload?.error?.message || `HTTP ${response.status}`}`);
  }
  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI görsel döndürmedi.');
  return { blob: base64ToBlob(b64, 'image/png'), providerText: null };
}

function base64ToBlob(base64, mime = 'image/png') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export { toBase64 };
