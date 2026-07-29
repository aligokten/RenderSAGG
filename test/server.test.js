/**
 * Web'de yayınlanan panelin erişim koruması, hız sınırı ve sağlık ucu davranışları.
 *
 * Not: statik `import` ifadeleri hoist edildiği için sunucu modülü DİNAMİK import ile
 * yüklenir; aksi halde ortam değişkenleri config okunduktan sonra atanmış olurdu.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

process.env.NODE_ENV = 'test';
process.env.PANEL_PASSWORD = 'gizli-sifre';
process.env.ALLOW_CLIENT_KEY = 'true';
process.env.RATE_LIMIT_PER_HOUR = '3';
process.env.RENDER_PROVIDER = 'mock';

const { default: app } = await import('../server/index.js');

const server = app.listen(0);
const base = () => `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const samplePayload = async () => ({
  render: {
    name: 'villa.png',
    type: 'image/png',
    data: (await sharp({ create: { width: 320, height: 180, channels: 3, background: '#b8cfe0' } }).png().toBuffer()).toString('base64')
  },
  provider: 'mock'
});

test('/healthz kimlik doğrulama olmadan yanıt verir', async () => {
  const res = await fetch(`${base()}/healthz`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

test('şifre açıkken /api/config kilitli döner ve ayrıntı sızdırmaz', async () => {
  const payload = await (await fetch(`${base()}/api/config`)).json();
  assert.equal(payload.locked, true);
  assert.equal(payload.authRequired, true);
  assert.equal(payload.providers, undefined);
});

test('doğru şifre ile oturum açılır, yanlış şifre 401 verir', async () => {
  const bad = await fetch(`${base()}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'yanlis' })
  });
  assert.equal(bad.status, 401);

  const good = await fetch(`${base()}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'gizli-sifre' })
  });
  assert.equal(good.status, 200);
});

test('şifresiz üretim isteği reddedilir', async () => {
  const res = await fetch(`${base()}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(await samplePayload())
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'AUTH');
});

test('şifre ile uçtan uca üretim çalışır ve PNG indirilebilir', async () => {
  const headers = { 'content-type': 'application/json', 'x-panel-password': 'gizli-sifre' };

  const cfg = await (await fetch(`${base()}/api/config`, { headers })).json();
  assert.equal(cfg.locked, false);
  assert.equal(cfg.allowClientKey, true);
  assert.ok(cfg.providers.find((p) => p.id === 'gemini').acceptsClientKey);

  const started = await fetch(`${base()}/api/render`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...(await samplePayload()), outputLongEdge: 1920 })
  });
  assert.equal(started.status, 202);
  const { id } = await started.json();

  let job;
  const deadline = Date.now() + 30000;
  do {
    await new Promise((resolve) => setTimeout(resolve, 100));
    job = await (await fetch(`${base()}/api/jobs/${id}`, { headers })).json();
  } while (job.status !== 'done' && job.status !== 'error' && Date.now() < deadline);

  assert.equal(job.status, 'done', job.error || '');
  assert.equal(job.result.width, 1920);

  const download = await fetch(`${base()}${job.result.downloadUrl}`, { headers });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'image/png');
  const meta = await sharp(Buffer.from(await download.arrayBuffer())).metadata();
  assert.equal(meta.width, 1920);

  // İndirme ucu da korumalıdır
  assert.equal((await fetch(`${base()}${job.result.downloadUrl}`)).status, 401);
});

test('saatlik sınır aşılınca 429 döner', async () => {
  const headers = { 'content-type': 'application/json', 'x-panel-password': 'gizli-sifre' };
  const body = JSON.stringify(await samplePayload());

  let lastStatus = 0;
  for (let i = 0; i < 6; i += 1) {
    lastStatus = (await fetch(`${base()}/api/render`, { method: 'POST', headers, body })).status;
    if (lastStatus === 429) break;
  }
  assert.equal(lastStatus, 429, 'sınır devreye girmeli');
});
