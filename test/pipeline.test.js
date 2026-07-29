import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { decodeUpload, getJob, startJob } from '../server/pipeline.js';

const samplePng = async () =>
  (await sharp({ create: { width: 640, height: 360, channels: 3, background: '#b8cfe0' } }).png().toBuffer()).toString('base64');

test('CAD/BIM dosyaları reddedilir ve doğru dosyalar istenir', async () => {
  const data = await samplePng();
  for (const name of ['proje.skp', 'model.rvt', 'plan.dwg', 'sahne.blend']) {
    assert.throws(
      () => decodeUpload({ name, type: 'image/png', data }),
      (err) => {
        assert.equal(err.code, 'UNSUPPORTED_FORMAT');
        assert.match(err.message, /clay render/);
        return true;
      },
      name
    );
  }
});

test('raster olmayan türler reddedilir', async () => {
  const data = await samplePng();
  assert.throws(() => decodeUpload({ name: 'a.gif', type: 'image/gif', data }), /Desteklenmeyen dosya türü/);
});

test('data URL öneki temizlenerek çözülür', async () => {
  const data = await samplePng();
  const decoded = decodeUpload({ name: 'render.png', type: 'image/png', data: `data:image/png;base64,${data}` });
  assert.ok(decoded.buffer.length > 0);
  assert.equal(decoded.mime, 'image/png');
  const meta = await sharp(decoded.buffer).metadata();
  assert.equal(meta.width, 640);
});

test('iş uçtan uca çalışır ve 4K PNG üretir', async (t) => {
  const data = await samplePng();
  const render = decodeUpload({ name: 'villa.png', type: 'image/png', data });
  const job = startJob({
    render,
    references: [],
    mode: 'strict',
    scene: 'exterior',
    aspect: 'source',
    userPrompt: 'Cephe dokusu gerçek ölçekte olsun.',
    providerName: 'mock',
    outputLongEdge: 3840
  });

  const deadline = Date.now() + 60000;
  while (getJob(job.id).status !== 'done' && getJob(job.id).status !== 'error' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const finished = getJob(job.id);
  assert.equal(finished.status, 'done', finished.error || '');
  assert.equal(finished.result.width, 3840);
  assert.equal(finished.result.height, 2160);
  assert.match(finished.downloadName, /^villa_fotogercek_3840x2160_\d{4}-\d{2}-\d{2}\.png$/);

  const meta = await sharp(finished.png).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 3840);

  // Çözünürlük iddiası dürüst olmalı: yükseltme yapıldıysa açıkça yazmalı
  assert.match(finished.result.resolutionNote, /Lanczos ile bu boyuta yükseltildi/);
  assert.equal(finished.result.upscaled, true);
});

test('yapılandırılmamış sağlayıcı işi anlaşılır hata ile biter', async () => {
  const data = await samplePng();
  const job = startJob({
    render: decodeUpload({ name: 'a.png', type: 'image/png', data }),
    providerName: 'gemini'
  });

  const deadline = Date.now() + 10000;
  while (getJob(job.id).status !== 'error' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(getJob(job.id).status, 'error');
  assert.match(getJob(job.id).error, /yapılandırılmamış/);
});
