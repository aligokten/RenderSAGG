import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { finalize, inspect, prepareInput } from '../server/image.js';

const solid = (width, height, color = '#8899aa') =>
  sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();

test('prepareInput uzun kenarı sınırlar ve oranı korur', async () => {
  const input = await solid(3000, 2000);
  const prepared = await prepareInput(input, 1536);
  assert.equal(prepared.width, 1536);
  assert.equal(prepared.height, 1024);
  assert.equal(prepared.source.width, 3000);
});

test('prepareInput küçük görseli büyütmez', async () => {
  const prepared = await prepareInput(await solid(800, 600), 1536);
  assert.equal(prepared.width, 800);
  assert.equal(prepared.height, 600);
});

test('finalize 4K uzun kenara yükseltir ve oranı korur', async () => {
  const result = await finalize(await solid(1024, 576), { longEdge: 3840 });
  assert.equal(result.width, 3840);
  assert.equal(result.height, 2160);
  assert.equal(result.upscaled, true);
  assert.equal(result.native.width, 1024);
  assert.ok(result.scaleFactor > 3.7);

  const meta = await inspect(result.buffer);
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 3840);
});

test('dikey görselde uzun kenar yükseklik olur', async () => {
  const result = await finalize(await solid(768, 1024), { longEdge: 2560 });
  assert.equal(result.height, 2560);
  assert.equal(result.width, 1920);
});

test('küçük oran sapması sessizce hedefe oturtulur', async () => {
  // 1600x898 ≈ 1.782, hedef 16:9 = 1.778 → %0.2 sapma
  const result = await finalize(await solid(1600, 898), { longEdge: 3840, targetAspect: 16 / 9 });
  assert.equal(result.aspectMismatch, null);
  assert.equal(result.width, 3840);
  assert.equal(result.height, 2160);
});

test('büyük oran sapmasında kırpma yapılmaz, sapma raporlanır', async () => {
  const result = await finalize(await solid(1600, 900), { longEdge: 3840, targetAspect: 1 });
  assert.ok(result.aspectMismatch, 'sapma raporlanmalı');
  assert.equal(result.aspectMismatch.requested, 1);
  assert.ok(result.aspectMismatch.deviationPct > 70);
  // model oranı korunur — kare çıktıya zorlanmaz
  assert.equal(result.width, 3840);
  assert.equal(result.height, 2160);
});

test('bozuk veri anlaşılır hata verir', async () => {
  await assert.rejects(() => inspect(Buffer.from('bu bir görsel değil')), /.+/);
});
