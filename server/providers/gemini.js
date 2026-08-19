import { config } from '../config.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const id = 'gemini';
export const label = 'Google Gemini (image edit)';

export function isConfigured(clientKey = '') {
  return Boolean(clientKey || config.gemini.apiKey);
}

export function describe() {
  return {
    id,
    label,
    model: config.gemini.model,
    configured: isConfigured(),
    acceptsClientKey: true,
    keyHint: 'aistudio.google.com üzerinden alınan API anahtarı',
    note: 'Ham render + referanslar tek istekte gönderilir. Model çıktısı genelde ~1K–2K uzun kenardır; 4K çıktı yükseltme ile üretilir.'
  };
}

/**
 * @param {object} req
 * @param {{buffer:Buffer, mime:string}} req.image        Ham render (model girdisi)
 * @param {Array<{buffer:Buffer, mime:string}>} req.references
 * @param {string} req.instruction
 * @param {string|null} req.aspect  '16:9' gibi; kaynak oranı için null
 * @returns {Promise<{buffer:Buffer, mime:string, providerText:string|null}>}
 */
export async function generate({ image, references = [], instruction, aspect = null, apiKey = '' }) {
  const key = apiKey || config.gemini.apiKey;
  if (!key) {
    throw new Error('GEMINI_API_KEY tanımlı değil.');
  }

  const parts = [
    { text: instruction },
    { inline_data: { mime_type: image.mime, data: image.buffer.toString('base64') } }
  ];

  references.forEach((ref, index) => {
    parts.push({
      text: ref.caption || `Referans görsel ${index + 1} — yalnızca malzeme, renk, ışık ve atmosfer kaynağı.`
    });
    parts.push({ inline_data: { mime_type: ref.mime, data: ref.buffer.toString('base64') } });
  });

  const generationConfig = { responseModalities: ['IMAGE'] };
  if (aspect) generationConfig.imageConfig = { aspectRatio: aspect };

  const url = `${ENDPOINT}/${encodeURIComponent(config.gemini.model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': key
    },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
    signal: AbortSignal.timeout(config.requestTimeoutMs)
  });

  const payload = await response.json().catch(() => null);

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
