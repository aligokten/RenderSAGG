import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_ASPECTS,
  imageSizeForLongEdge,
  nearestSupportedAspect,
  supportsImageSize
} from '../server/providers/gemini.js';

test('hedef uzun kenar API boyut adına eşlenir', () => {
  assert.equal(imageSizeForLongEdge(3840), '4K');
  assert.equal(imageSizeForLongEdge(5120), '4K');
  assert.equal(imageSizeForLongEdge(2560), '2K');
  assert.equal(imageSizeForLongEdge(1920), '2K');
  assert.equal(imageSizeForLongEdge(1024), '1K');
});

test('imageSize yalnızca Gemini 3 nesli modellerde gönderilir', () => {
  assert.equal(supportsImageSize('gemini-3-pro-image'), true);
  assert.equal(supportsImageSize('gemini-3-pro-image-preview'), true);
  assert.equal(supportsImageSize('gemini-2.5-flash-image'), false);
});

test('kaynak oranına yakın desteklenen oran seçilir', () => {
  assert.equal(nearestSupportedAspect(16 / 9), '16:9');
  assert.equal(nearestSupportedAspect(1600 / 900), '16:9');
  assert.equal(nearestSupportedAspect(3 / 2), '3:2');
  assert.equal(nearestSupportedAspect(1), '1:1');
  assert.equal(nearestSupportedAspect(9 / 16), '9:16');
});

test('yeterince yakın oran yoksa oran gönderilmez (model girdiyi izler)', () => {
  // 2.5 (5:2 panoramik) desteklenen listede yok; en yakın 21:9 ≈ 2.33 → %7 sapma
  assert.equal(nearestSupportedAspect(2.5), null);
  assert.equal(nearestSupportedAspect(1.5 * 1.1), null);
});

test('desteklenen oran listesi panelin sunduğu oranları kapsar', () => {
  for (const aspect of ['16:9', '3:2', '4:3', '1:1', '9:16']) {
    assert.ok(SUPPORTED_ASPECTS.includes(aspect), `${aspect} listede olmalı`);
  }
});
