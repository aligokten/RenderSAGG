import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCombinations,
  catalog,
  combinationLabel,
  resolveColor,
  resolveMaterial,
  resolveSurface,
  MATERIALS,
  MAX_VARIANTS
} from '../server/materials.js';
import { buildPackagePrompt } from '../server/prompt.js';

test('katalog panelin ihtiyaç duyduğu alanları verir', () => {
  const data = catalog();
  assert.ok(data.materials.length > 20);
  assert.ok(data.colors.length > 10);
  assert.ok(data.surfaces.length > 5);
  assert.equal(data.maxVariants, MAX_VARIANTS);
  for (const material of data.materials) {
    assert.ok(material.spec.length > 40, `${material.id} malzeme tanımı yetersiz`);
    assert.ok(['exact', 'tone'].includes(material.colorMode));
  }
});

test('katalog malzemesi ve serbest malzeme tanımı çözülür', () => {
  assert.equal(resolveMaterial('thermowood').label, MATERIALS.thermowood.label);
  assert.equal(resolveMaterial({ id: 'travertine' }).colorMode, 'tone');
  assert.equal(resolveMaterial('yok-boyle-bir-malzeme'), null);

  const custom = resolveMaterial({ label: 'Cam mozaik 2x2' });
  assert.equal(custom.custom, true);
  assert.equal(custom.colorMode, 'exact');
  assert.ok(custom.spec.length > 0);
});

test('renk paletten, hex ile veya serbest adla çözülür', () => {
  assert.equal(resolveColor('anthracite').hex, '#3A3E42');
  assert.equal(resolveColor('#abc').hex, '#AABBCC');
  assert.equal(resolveColor({ name: 'RAL 7016', hex: '#383E42' }).hex, '#383E42');
  assert.equal(resolveColor('cok-uzun-olmayan-ad').hex, null);
  assert.equal(resolveColor(null), null);
});

test('kombinasyonlar matris ve eşleşme kipinde üretilir, sınır aşılmaz', () => {
  const matrix = buildCombinations({ materials: ['thermowood', 'travertine'], colors: ['anthracite', 'sand', 'olive'] });
  assert.equal(matrix.length, 6);

  const paired = buildCombinations({ materials: ['thermowood', 'travertine'], colors: ['anthracite', 'sand'], pairing: 'paired' });
  assert.equal(paired.length, 2);
  assert.equal(paired[1].material.id, 'travertine');
  assert.equal(paired[1].color.id, 'sand');

  const onlyColors = buildCombinations({ colors: ['anthracite', 'sand'] });
  assert.equal(onlyColors.length, 2);
  assert.equal(onlyColors[0].material, null);

  const capped = buildCombinations({
    materials: Object.keys(MATERIALS).slice(0, 6),
    colors: ['anthracite', 'sand', 'olive']
  });
  assert.equal(capped.length, MAX_VARIANTS);

  assert.equal(buildCombinations({}).length, 0);
});

test('kombinasyon adı malzeme ve rengi birlikte gösterir', () => {
  const [first] = buildCombinations({ materials: ['thermowood'], colors: ['anthracite'] });
  assert.equal(combinationLabel(first), 'Termowood (ısıl işlemli çam) · Antrasit');
});

test('yüzey kuralı ve serbest yüzey tanımı çözülür', () => {
  assert.match(resolveSurface('facade').rule, /dış cephe kaplaması/);
  const custom = resolveSurface({ id: 'custom', note: 'girişteki tavan alnı' });
  assert.equal(custom.label, 'girişteki tavan alnı');
});

test('paket talimatı bölgeleri numarayla, konumla ve malzeme tanımıyla anlatır', () => {
  const { instruction } = buildPackagePrompt({
    packageName: 'Paket A',
    regions: [
      {
        number: 1,
        label: 'Cephe kaplaması',
        x: 0.25,
        y: 0.7,
        material: resolveMaterial('thermowood'),
        color: resolveColor('anthracite'),
        swatchRef: 'Referans görsel 2',
        surfaceRule: resolveSurface('facade').rule,
        note: '8 mm gölge derzi'
      },
      { number: 2, label: 'Tezgâh', x: 0.8, y: 0.4, material: resolveMaterial('marble'), color: null }
    ],
    swatchCount: 1,
    source: { width: 1920, height: 1080 }
  });

  assert.match(instruction, /"Paket A" paketi \(2 bölge\)/);
  assert.match(instruction, /BÖLGE 1 — Cephe kaplaması/);
  assert.match(instruction, /sol kenarından %25, üst kenarından %70/);
  assert.match(instruction, /Referans görsel 2/);
  assert.match(instruction, /8 mm gölge derzi/);
  assert.match(instruction, /BÖLGE 2 — Tezgâh/);

  // Doğal malzemede renk ton olarak yorumlanır, boya gibi uygulanmaz
  assert.match(instruction, /doğal ton aralığında yorumlanır/);
  // Numaralar çıktıya çizilmemeli
  assert.match(instruction, /GÖRSELE İŞARET KOYULMAZ/);
  // Karşılaştırılabilirlik: kadraj ve ışık aynı kalmalı
  assert.match(instruction, /kadrajın birebir aynı kalması zorunludur/);
});

test('malzemesi verilmeyen bölge korunur olarak talimata girer', () => {
  const { instruction } = buildPackagePrompt({
    regions: [{ number: 1, label: 'Çatı', x: 0.5, y: 0.2 }]
  });
  assert.match(instruction, /BİREBİR KORUNUR, hiçbir değişiklik yapılmaz/);
});
