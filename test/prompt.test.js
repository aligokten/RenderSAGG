import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, MODES, NEGATIVE_PROMPT } from '../server/prompt.js';

test('varsayılan mod kesin korumadır ve temel kuralları taşır', () => {
  const { instruction } = buildPrompt({});
  assert.ok(instruction.includes('MİMARİYİ KORU, SADECE GERÇEKÇİLİĞİ GELİŞTİR'));
  assert.ok(instruction.includes('KESİN KORUMA MODU'));
  assert.ok(instruction.includes('Kamera konumu, perspektif, lens ve kadraj'));
});

test('her mod kendi kural bloğunu ekler', () => {
  for (const mode of Object.keys(MODES)) {
    const { instruction } = buildPrompt({ mode, userPrompt: 'test' });
    assert.ok(instruction.includes(MODES[mode].label.toLocaleUpperCase('tr')), `${mode} bloğu eksik`);
  }
});

test('kullanıcı talebi en yüksek öncelikli blok olarak eklenir', () => {
  const { instruction } = buildPrompt({ mode: 'revision', userPrompt: 'Sadece giriş kapısı ahşap olsun.' });
  assert.ok(instruction.includes('Sadece giriş kapısı ahşap olsun.'));
  assert.ok(instruction.includes('KULLANICININ EK TALEBİ'));
});

test('revizyon modunda talep yoksa mimari değişiklik yapılmaması söylenir', () => {
  const { instruction } = buildPrompt({ mode: 'revision', userPrompt: '   ' });
  assert.ok(instruction.includes('Hiçbir mimari veya malzeme değişikliği'));
});

test('kaynak oranı korunurken kırpma yasaklanır, farklı oranda genişletme istenir', () => {
  const kept = buildPrompt({ aspect: 'source', source: { width: 1600, height: 900 } }).instruction;
  assert.ok(kept.includes('1600x900'));
  assert.ok(kept.includes('Kadraj kırpılmaz'));

  const widened = buildPrompt({ aspect: '16:9' }).instruction;
  assert.ok(widened.includes('GENİŞLETİLEREK'));
  assert.ok(widened.includes('Mevcut mimari eleman'));
});

test('referans kuralı yalnızca referans varken eklenir', () => {
  assert.ok(!buildPrompt({ referenceCount: 0 }).instruction.includes('REFERANS GÖRSELLER'));
  const withRefs = buildPrompt({ referenceCount: 2 }).instruction;
  assert.ok(withRefs.includes('REFERANS GÖRSELLER'));
  assert.ok(withRefs.includes('ASLA ham rendera taşınmaz'));
});

test('olumsuz liste talimata dahil edilir', () => {
  const { instruction, negative } = buildPrompt({});
  assert.equal(negative, NEGATIVE_PROMPT);
  for (const item of ['kamera açısını, perspektifi veya kadrajı değiştirmek', 'eriyen veya deforme mimari elemanlar']) {
    assert.ok(instruction.includes(item), `eksik: ${item}`);
  }
});

test('sahne ve zaman seçimleri talimata yansır', () => {
  const interior = buildPrompt({ scene: 'interior', time: 'night', weather: 'rain' }).instruction;
  assert.ok(interior.includes('SAHNE TÜRÜ: İÇ MEKÂN'));
  assert.ok(interior.includes('ZAMAN: Gece'));
  assert.ok(interior.includes('HAVA: Yağmur sonrası'));
});
