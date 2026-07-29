import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PIXELS,
  explainOpenAIError,
  sizeFor,
  supportsArbitrarySize,
  usesInputFidelity
} from '../server/providers/openai.js';

const parse = (size) => size.split('x').map(Number);

test('model ailesi doğru tanınır', () => {
  assert.equal(supportsArbitrarySize('gpt-image-2'), true);
  assert.equal(supportsArbitrarySize('gpt-image-1'), false);
  assert.equal(supportsArbitrarySize('gpt-image-1.5'), false);
  assert.equal(usesInputFidelity('gpt-image-1'), true);
  assert.equal(usesInputFidelity('gpt-image-1.5'), true);
  assert.equal(usesInputFidelity('gpt-image-2'), false);
});

test('eski modeller sabit boyut listesine eşlenir', () => {
  assert.equal(sizeFor({ model: 'gpt-image-1', aspectValue: 16 / 9 }), '1536x1024');
  assert.equal(sizeFor({ model: 'gpt-image-1', aspectValue: 9 / 16 }), '1024x1536');
  assert.equal(sizeFor({ model: 'gpt-image-1', aspectValue: 1 }), '1024x1024');
});

test('gpt-image-2 için 16:9 4K isteği sınırlar içinde kalır', () => {
  const size = sizeFor({ model: 'gpt-image-2', aspectValue: 16 / 9, longEdge: 3840 });
  const [width, height] = parse(size);
  assert.equal(size, '3840x2160');
  assert.equal(width * height <= MAX_PIXELS, true);
});

test('kenarlar her zaman 16’nın katı olur', () => {
  for (const aspect of [1.78, 1.5, 1.33, 1, 0.75, 0.5625, 2.4]) {
    const [width, height] = parse(sizeFor({ model: 'gpt-image-2', aspectValue: aspect, longEdge: 3840 }));
    assert.equal(width % 16, 0, `genişlik 16'nın katı değil: ${width}`);
    assert.equal(height % 16, 0, `yükseklik 16'nın katı değil: ${height}`);
  }
});

test('piksel sınırını aşan oranlar küçültülür, oran korunur', () => {
  // 1:1 4K istemek 3840x3840 = 14.7 MP olurdu; sınır 8.3 MP
  const [width, height] = parse(sizeFor({ model: 'gpt-image-2', aspectValue: 1, longEdge: 3840 }));
  assert.equal(width * height <= MAX_PIXELS, true);
  assert.ok(Math.abs(width / height - 1) < 0.02, 'kare oran korunmalı');
});

test('aşırı panoramik oran API sınırına (3:1) çekilir', () => {
  const [width, height] = parse(sizeFor({ model: 'gpt-image-2', aspectValue: 6, longEdge: 3840 }));
  assert.ok(width / height <= 3.05, `oran 3:1 üstünde: ${width / height}`);
});

test('dikey istekte uzun kenar yükseklik olur', () => {
  const [width, height] = parse(sizeFor({ model: 'gpt-image-2', aspectValue: 9 / 16, longEdge: 2560 }));
  assert.ok(height > width);
  assert.equal(height % 16, 0);
});

test('kuruluş doğrulaması hatası adım adım anlatılır', () => {
  const message = explainOpenAIError(
    403,
    { error: { message: "Your organization must be verified to use the model 'gpt-image-2'." } },
    'gpt-image-2'
  );
  assert.match(message, /kuruluş doğrulaması/);
  assert.match(message, /Verify Organization/);
});

test('bakiye ve anahtar hataları ayrı ayrı açıklanır', () => {
  assert.match(
    explainOpenAIError(429, { error: { message: 'You exceeded your current quota, please check your plan and billing details.' } }),
    /bakiyesi yetersiz/
  );
  assert.match(explainOpenAIError(401, { error: { message: 'Incorrect API key provided' } }), /anahtar[ıi] geçersiz/i);
  assert.match(
    explainOpenAIError(404, { error: { message: "The model 'yok' does not exist" } }, 'yok'),
    /Model bulunamadı/
  );
});
