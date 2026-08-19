import { config } from '../config.js';

export const id = 'kling';
export const label = 'Kling AI (görsel referanslı üretim)';

const ASPECT_MAP = {
  '16:9': '16:9',
  '9:16': '9:16',
  '1:1': '1:1'
  // Kling'in görsel üretim ucunda 4:3/3:2 gibi oranların desteklendiği doğrulanamadı;
  // desteklenmeyen bir değer göndermek isteği tümden reddettirir, bu yüzden diğer
  // oranlarda alan hiç gönderilmez ve Kling kendi varsayılanını kullanır.
};

const PROMPT_LIMIT = 2500;

export function isConfigured(clientKey = '') {
  return Boolean(clientKey || config.kling.apiKey);
}

export function describe() {
  return {
    id,
    label,
    model: config.kling.model || '(sağlayıcı varsayılanı)',
    configured: isConfigured(),
    acceptsClientKey: true,
    keyHint: 'klingai.com geliştirici panelinden alınan tekli API anahtarı (Bearer token)',
    note:
      'ÖNEMLİ FARK: Kling’in görsel referans modu (image_reference: subject) stil/konu tutarlılığı için ' +
      'tasarlanmıştır; Gemini/OpenAI’daki gibi piksel-sadık DÜZENLEME değildir. Geometri ve kamera açısının ' +
      'birebir korunacağı garanti edilmez — sonucu mutlaka kalite kontrol listesine göre denetleyin. Ayrıca ' +
      `Kling talimat uzunluğunu ${PROMPT_LIMIT} karakterle sınırlar; uzun talimatlar bu sağlayıcı için ` +
      'kısaltılmış özete indirgenir (bkz. compactInstruction). Kling ücretsiz değildir: satın alınmış ' +
      'kaynak birimlerinizi (resource units) harcar. Bu entegrasyon halka açık dokümantasyon ve SDK ' +
      'kaynağından derlendi; klingai.com bu ortamdan erişilemediği için uçtan uca doğrulanamadı.'
  };
}

/**
 * Kling'in prompt alanı PROMPT_LIMIT karakterle sınırlıdır; panelin ürettiği tam talimat
 * (CORE_RULES + mod + sahne + ... ) bunu tek başına aşar. Düz kırpma en kritik kuralı (mimariyi
 * koru) kaybettirebileceğinden: sabit, kısa bir çekirdek kural + talimatın SONU (kullanıcının asıl
 * isteği, bölge/malzeme atamaları, çıktı talebi genelde metnin sonunda yer alır) korunur.
 */
export function compactInstruction(instruction, limit = PROMPT_LIMIT) {
  const preamble =
    'KURAL: Mimari geometri, kütle, kamera açısı ve kadrajı BİREBİR KORU; yeni kapı/pencere/duvar/kat ' +
    'ekleme, mevcut öğeleri taşıma veya kırpma yapma. Yalnızca aşağıda açıkça istenen değişikliği uygula:\n\n';

  if (instruction.length <= limit) return instruction;
  const budget = Math.max(0, limit - preamble.length - 1);
  const tail = instruction.slice(-budget);
  // Cümle ortasından başlamamak için ilk tam cümleye/satıra atla.
  const cut = tail.search(/[\n.] /);
  return preamble + (cut > 0 && cut < budget * 0.3 ? tail.slice(cut + 2) : tail);
}

function mapAspect(aspect) {
  return aspect ? ASPECT_MAP[aspect] : undefined;
}

async function pollTask(baseUrl, apiKey, taskId) {
  const deadline = Date.now() + config.requestTimeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/v1/images/generations/${taskId}`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30000)
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Kling görev durumu alınamadı: ${payload?.message || `HTTP ${res.status}`}`);
    }
    const status = payload?.data?.task_status;
    if (status === 'succeed') return payload.data;
    if (status === 'failed') {
      throw new Error(`Kling üretimi başarısız: ${payload?.data?.task_status_msg || 'sebep bildirilmedi'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('Kling üretimi zaman aşımına uğradı (görev kuyrukta beklemeye devam ediyor olabilir).');
}

/**
 * @param {object} req
 * @param {{buffer:Buffer, mime:string}} req.image  Referans render (yalnızca ana görsel gönderilir;
 *   Kling'in görsel üretim ucu birden fazla referansı bizim gemini/openai akışımızdaki gibi
 *   desteklemediği için malzeme kartelaları burada YOK SAYILIR — talimat metnine güvenilir).
 * @param {string} req.instruction
 * @param {string|null} req.aspect
 */
export async function generate({ image, instruction, aspect = null, apiKey = '' }) {
  const key = apiKey || config.kling.apiKey;
  if (!key) throw new Error('KLING_API_KEY tanımlı değil.');

  const baseUrl = config.kling.baseUrl.replace(/\/+$/, '');
  const body = {
    prompt: compactInstruction(instruction),
    image: image.buffer.toString('base64'),
    image_reference: 'subject',
    image_fidelity: 0.85,
    n: 1
  };
  if (config.kling.model) body.model_name = config.kling.model;
  const mappedAspect = mapAspect(aspect);
  if (mappedAspect) body.aspect_ratio = mappedAspect;

  const created = await fetch(`${baseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.requestTimeoutMs)
  });
  const createdPayload = await created.json().catch(() => null);
  if (!created.ok) {
    throw new Error(`Kling isteği başarısız: ${createdPayload?.message || `HTTP ${created.status}`}`);
  }

  const taskId = createdPayload?.data?.task_id;
  if (!taskId) throw new Error('Kling görev kimliği (task_id) döndürmedi.');

  const result = await pollTask(baseUrl, key, taskId);
  const outputs = result?.task_result?.images || [];
  const first = outputs[0];
  if (!first) throw new Error('Kling görev tamamlandı ama görsel döndürmedi.');

  let buffer;
  if (first.url) {
    const imgRes = await fetch(first.url, { signal: AbortSignal.timeout(config.requestTimeoutMs) });
    if (!imgRes.ok) throw new Error(`Kling çıktı görseli indirilemedi: HTTP ${imgRes.status}`);
    buffer = Buffer.from(await imgRes.arrayBuffer());
  } else if (first.image || first.b64_json) {
    buffer = Buffer.from(first.image || first.b64_json, 'base64');
  } else {
    throw new Error('Kling yanıtında tanınan bir görsel alanı (url/image/b64_json) bulunamadı.');
  }

  return {
    buffer,
    mime: 'image/png',
    providerText:
      'Kling AI stil/konu referans modu kullanıldı: piksel-sadık düzenleme garantisi yoktur, sonucu ' +
      'kalite kontrol listesine göre mutlaka denetleyin.'
  };
}
