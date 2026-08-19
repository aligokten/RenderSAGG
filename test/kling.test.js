import test from 'node:test';
import assert from 'node:assert/strict';
import { compactInstruction, describe, generate, isConfigured } from '../server/providers/kling.js';

test('yapılandırma: anahtarsız isConfigured false, clientKey ile true döner', () => {
  assert.equal(isConfigured(), false);
  assert.equal(isConfigured('bir-anahtar'), true);
});

test('describe() sağlayıcının garanti FARKINI açıkça yazar', () => {
  const info = describe();
  assert.equal(info.id, 'kling');
  assert.match(info.note, /piksel-sadık DÜZENLEME değildir/);
  assert.match(info.note, /ücretsiz değildir/);
});

test('compactInstruction: limit altındaki talimata dokunmaz', () => {
  const short = 'Kısa bir talimat.';
  assert.equal(compactInstruction(short, 2500), short);
});

test('compactInstruction: uzun talimatta çekirdek kural + talimatın SONU korunur, limit aşılmaz', () => {
  const filler = 'A'.repeat(3000);
  const tailMarker = 'BÖLGE 1 — Cephe kaplaması: termowood, antrasit renk.';
  const long = `${filler}\n\n${tailMarker}`;
  const compact = compactInstruction(long, 2500);

  assert.ok(compact.length <= 2500, `beklenen <=2500, gelen ${compact.length}`);
  assert.match(compact, /Mimari geometri.*BİREBİR KORU/);
  assert.match(compact, /termowood, antrasit renk/, 'talimatın en özgül kısmı (sonu) hayatta kalmalı');
});

test('generate(): istek gövdesi doğru alanları taşır, gövde base64 (URL değil) gönderir', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/v1/images/generations')) {
      return {
        ok: true,
        json: async () => ({ data: { task_id: 'task-1' } })
      };
    }
    if (String(url).includes('/v1/images/generations/task-1')) {
      return {
        ok: true,
        json: async () => ({
          data: { task_status: 'succeed', task_result: { images: [{ url: 'https://cdn.example/out.png' }] } }
        })
      };
    }
    if (String(url) === 'https://cdn.example/out.png') {
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer };
    }
    throw new Error(`beklenmeyen istek: ${url}`);
  };

  try {
    const result = await generate({
      image: { buffer: Buffer.from('render-bytes'), mime: 'image/png' },
      instruction: 'Kısa test talimatı.',
      aspect: '16:9',
      apiKey: 'test-anahtari'
    });

    assert.equal(calls[0].url.endsWith('/v1/images/generations'), true);
    assert.equal(calls[0].options.headers.authorization, 'Bearer test-anahtari');
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.image, Buffer.from('render-bytes').toString('base64'), 'görsel base64 olarak gönderilmeli, URL değil');
    assert.equal(body.aspect_ratio, '16:9');
    assert.equal(body.image_reference, 'subject');
    assert.equal(body.n, 1);

    assert.equal(calls[1].url.endsWith('/v1/images/generations/task-1'), true, 'ikinci çağrı görev sorgulamalı');

    assert.equal(result.buffer.toString('hex'), Buffer.from([1, 2, 3, 4]).toString('hex'));
    assert.match(result.providerText, /piksel-sadık/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generate(): desteklenmeyen oranda aspect_ratio alanı hiç gönderilmez', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/v1/images/generations')) {
      return { ok: true, json: async () => ({ data: { task_id: 't' } }) };
    }
    return {
      ok: true,
      json: async () => ({ data: { task_status: 'succeed', task_result: { images: [{ image: Buffer.from([9]).toString('base64') }] } } })
    };
  };
  const originalFetchCapture = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options?.body) capturedBody = JSON.parse(options.body);
    return originalFetchCapture(url, options);
  };

  try {
    await generate({
      image: { buffer: Buffer.from('x'), mime: 'image/png' },
      instruction: 'talimat',
      aspect: '4:3',
      apiKey: 'k'
    });
    assert.equal(capturedBody.aspect_ratio, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generate(): görev başarısız olursa Kling’in sebep mesajıyla hata fırlatır', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/v1/images/generations')) {
      return { ok: true, json: async () => ({ data: { task_id: 't2' } }) };
    }
    return {
      ok: true,
      json: async () => ({ data: { task_status: 'failed', task_status_msg: 'içerik politikası ihlali' } })
    };
  };
  try {
    await assert.rejects(
      generate({ image: { buffer: Buffer.from('x'), mime: 'image/png' }, instruction: 'x', apiKey: 'k' }),
      /içerik politikası ihlali/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generate(): anahtar hiç verilmezse ağa hiç gitmeden anlaşılır hata verir', async () => {
  await assert.rejects(
    generate({ image: { buffer: Buffer.from('x'), mime: 'image/png' }, instruction: 'x', apiKey: '' }),
    /KLING_API_KEY tanımlı değil/
  );
});
