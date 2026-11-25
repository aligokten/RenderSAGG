/**
 * FAM Pano (şantiye pano ve sigorta kaydı) — kural modülü ve dosya yapısı testleri.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../fam-pano/lib/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const mcb = (o = {}) => ({ code: 'F1', label: 'Test', device: 'MCB (otomatik sigorta)', curve: 'C', rating: 16, poles: '1P+N', phase: 'L1', status: 'Aktif', ...o });
const codes = (issues) => issues.map((i) => i.code);

test('kural modülü saf JavaScript: içe aktarım ve Node API yok', async () => {
  const src = await readFile(path.join(ROOT, 'fam-pano/lib/rules.js'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /\bprocess\.|\brequire\(/);
});

test('statik uygulama dosyaları yerinde ve QR kütüphanesi yerel', async () => {
  for (const f of ['index.html', 'app.js', 'styles.css', 'lib/rules.js', 'lib/store.js', 'lib/demo.js', 'vendor/qrcode.js']) {
    await readFile(path.join(ROOT, 'fam-pano', f));
  }
  const html = await readFile(path.join(ROOT, 'fam-pano/index.html'), 'utf8');
  assert.match(html, /src="\.\/vendor\/qrcode\.js"/, 'QR kütüphanesi sahada çevrimdışı çalışmak için yerelden yüklenmeli');
});

test('kablo kesiti sigortayı taşıyamıyorsa hata', () => {
  assert.ok(codes(R.checkCircuit(mcb({ rating: 32, cableSection: 2.5 }))).includes('cable-overload'));
  assert.ok(!codes(R.checkCircuit(mcb({ rating: 16, cableSection: 2.5 }))).includes('cable-overload'));
  // 3 fazlı devrede 3 yüklü iletken tablosu kullanılır: 6 mm² ≈ 41 A
  assert.ok(codes(R.checkCircuit(mcb({ poles: '3P+N', phase: '3F', rating: 50, cableSection: 6 }))).includes('cable-overload'));
  assert.ok(!codes(R.checkCircuit(mcb({ poles: '3P+N', phase: '3F', rating: 40, cableSection: 6 }))).includes('cable-overload'));
});

test('yük akımı sigortayı aşarsa hata', () => {
  // 5 kW tek faz, cos 0.9 → ≈24 A > 16 A
  assert.ok(codes(R.checkCircuit(mcb({ loadKw: 5 }))).includes('load-over-rating'));
  assert.ok(!codes(R.checkCircuit(mcb({ loadKw: 2 }))).some((c) => c.startsWith('load')));
});

test('kesme kapasitesi pano kısa devre seviyesinin altındaysa hata', () => {
  assert.ok(codes(R.checkCircuit(mcb({ breakingKa: 6 }), { panel: { shortCircuitKa: 10 } })).includes('breaking-capacity'));
  assert.ok(!codes(R.checkCircuit(mcb({ breakingKa: 10 }), { panel: { shortCircuitKa: 10 } })).includes('breaking-capacity'));
});

test('priz devresi ≤30 mA kaçak akım koruması ister (kendi RCBO veya üstte RCD)', () => {
  assert.ok(codes(R.checkCircuit(mcb({ loadKind: 'Priz' }))).includes('rcd-missing'));
  assert.ok(!codes(R.checkCircuit(mcb({ loadKind: 'Priz' }), { upstreamRcd: true })).includes('rcd-missing'));
  const rcbo = mcb({ loadKind: 'Islak hacim prizi', device: 'RCBO (kaçak akımlı otomatik)', rcdMa: 30 });
  assert.ok(!codes(R.checkCircuit(rcbo)).includes('rcd-missing'));
  const rcbo300 = { ...rcbo, rcdMa: 300 };
  assert.ok(codes(R.checkCircuit(rcbo300)).includes('rcd-missing'));
  // Aydınlatma için zorunlu tutulmaz; yedek devre denetlenmez
  assert.ok(!codes(R.checkCircuit(mcb({ loadKind: 'Aydınlatma' }))).includes('rcd-missing'));
  assert.ok(!codes(R.checkCircuit(mcb({ loadKind: 'Priz', status: 'Yedek' }))).includes('rcd-missing'));
});

test('LOTO kilidinin sahibi yoksa uyarı', () => {
  assert.ok(codes(R.checkCircuit(mcb({ status: 'Kilitli (LOTO)' }))).includes('loto-owner'));
  assert.ok(!codes(R.checkCircuit(mcb({ status: 'Kilitli (LOTO)', lotoBy: 'Ali' }))).includes('loto-owner'));
});

test('faz yükleri: 3 fazlı yük eşit bölünür, yedek/kapalı devre sayılmaz', () => {
  const loads = R.phaseLoads([
    mcb({ phase: 'L1', loadKw: 3 }),
    mcb({ phase: 'L2', loadKw: 1 }),
    mcb({ poles: '3P', phase: '3F', loadKw: 9 }),
    mcb({ phase: 'L3', loadKw: 5, status: 'Yedek' }),
    mcb({ phase: '', loadKw: 2 })
  ]);
  assert.deepEqual(loads, { L1: 6, L2: 4, L3: 3, unassigned: 2 });
  assert.equal(R.phaseImbalance(loads), Math.round(((6 - 3) / (13 / 3)) * 1000) / 10);
  assert.equal(R.suggestPhase([mcb({ phase: 'L1', loadKw: 3 }), mcb({ phase: 'L2', loadKw: 1 })]), 'L3');
});

test('pano denetimleri: dengesizlik, mükerrer numara, seçicilik, kontrol gecikmesi', () => {
  const panel = { status: 'Devrede', mainRating: 63, earthingSystem: 'TN-S' };
  const circuits = [mcb({ code: 'F1', loadKw: 6 }), mcb({ code: 'F1', phase: 'L2', loadKw: 0.5 })];
  const today = new Date('2026-06-30T10:00:00');
  const issues = R.checkPanel(panel, circuits, { feederRating: 63, intervalDays: 30, lastInspection: '2026-05-01', today });
  const c = codes(issues);
  assert.ok(c.includes('imbalance'));
  assert.ok(c.includes('dup-code'));
  assert.ok(c.includes('selectivity'));
  assert.ok(c.includes('overdue'));
  assert.ok(codes(R.checkPanel(panel, [], { today })).includes('never-inspected'));
});

test('kontrol vadesi', () => {
  const today = new Date('2026-06-30T10:00:00');
  assert.equal(R.inspectionDue(null, 30, today).state, 'never');
  assert.equal(R.inspectionDue('2026-06-25', 30, today).state, 'ok');
  assert.equal(R.inspectionDue('2026-06-05', 30, today).state, 'soon');
  const o = R.inspectionDue('2026-05-01', 30, today);
  assert.equal(o.state, 'overdue');
  assert.equal(o.days, 30);
});

test('cihaz kısa gösterimi ve devre numarası', () => {
  assert.equal(R.deviceShort(mcb()), 'C16 1P+N');
  assert.equal(R.deviceShort({ device: 'RCBO (kaçak akımlı otomatik)', curve: 'B', rating: 16, poles: '1P+N', rcdMa: 30, rcdType: 'A' }), 'RCBO B16 1P+N 30mA A');
  assert.equal(R.deviceShort({ device: 'RCCB (kaçak akım rölesi)', rating: 40, poles: '3P+N', rcdMa: 30 }), 'RCCB 40A 3P+N 30mA');
  assert.equal(R.deviceShort({ device: 'NH bıçaklı sigorta', curve: 'gG', rating: 63, poles: '3P' }), 'NH 63 gG 3P');
  assert.equal(R.nextCode([{ code: 'F1' }, { code: 'F10' }, { code: 'RCD1' }]), 'F11');
  assert.equal(R.nextCode([]), 'F1');
  assert.ok(R.naturalCompare('F2', 'F10') < 0);
});

test('CSV: Excel uyumlu BOM, ; ayraç ve kaçış', () => {
  const csv = R.toCsv([{ a: 'x;y', b: 'say "hi"' }], [{ label: 'A', key: 'a' }, { label: 'B', key: 'b' }]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv.slice(1), 'A;B\r\n"x;y";"say ""hi"""');
});

/* ---------------- Ürün kataloğu ---------------- */

import * as C from '../fam-pano/lib/catalog.js';
import { loadDemo } from '../fam-pano/lib/demo.js';

test('katalog modülü saf JavaScript', async () => {
  const src = await readFile(path.join(ROOT, 'fam-pano/lib/catalog.js'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /\bprocess\.|\brequire\(/);
});

test('katalog kayıtları geçerli alan değerleri kullanır ve kimlikler tekil', () => {
  const ids = new Set();
  for (const p of C.CATALOG) {
    assert.ok(!ids.has(p.id), `mükerrer kimlik ${p.id}`);
    ids.add(p.id);
    assert.ok(R.DEVICE_TYPES.includes(p.device), `${p.id}: cihaz türü`);
    for (const c of p.curves) assert.ok(R.CURVES.includes(c), `${p.id}: eğri ${c}`);
    for (const k of p.poles) assert.ok(k in R.POLES, `${p.id}: kutup ${k}`);
    for (const t of p.rcdTypes) assert.ok(R.RCD_TYPES.includes(t), `${p.id}: RCD tipi ${t}`);
    for (const n of [...p.ratings, ...p.breakingKa, ...p.rcdMa]) assert.ok(typeof n === 'number' && n > 0, `${p.id}: sayı ${n}`);
    if (R.RCD_DEVICES.has(p.device)) assert.ok(p.rcdMa.length && p.rcdTypes.length, `${p.id}: kaçak akım değerleri`);
    if (p.device === 'MCB (otomatik sigorta)') assert.ok(p.curves.length && p.ratings.length && p.breakingKa.length, `${p.id}: MCB değerleri`);
  }
});

test('istenen markalar katalogda ve her birinde MCB + kaçak akım cihazı var', () => {
  for (const brand of ['Legrand', 'Siemens', 'Viko', 'Panasonic']) {
    const list = C.seriesOf(C.CATALOG, brand);
    assert.ok(list.some((p) => p.device === 'MCB (otomatik sigorta)'), `${brand} MCB`);
    assert.ok(list.some((p) => R.RCD_DEVICES.has(p.device)), `${brand} RCD`);
  }
  assert.deepEqual(C.brandsOf(C.CATALOG).slice(0, 4), ['Legrand', 'Siemens', 'Viko', 'Panasonic']);
});

test('seri seçimi uygun değerleri doldurur, geçerli mevcut değeri korur', () => {
  const p = C.findProduct(C.CATALOG, C.productId('Siemens', '5SL6'));
  assert.ok(p);
  const fresh = C.applyProduct(p, {});
  assert.equal(fresh.device, 'MCB (otomatik sigorta)');
  assert.equal(fresh.curve, 'C');
  assert.equal(fresh.rating, 16);
  assert.equal(fresh.breakingKa, 6);
  assert.equal(fresh.rcdMa, '');
  const kept = C.applyProduct(p, { curve: 'B', rating: 32, poles: '3P' });
  assert.equal(kept.curve, 'B');
  assert.equal(kept.rating, 32);
  assert.equal(kept.poles, '3P');
  // 5SL6'da D eğrisi yok → C'ye düşer
  assert.equal(C.applyProduct(p, { curve: 'D' }).curve, 'C');
  const rccb = C.applyProduct(C.findProduct(C.CATALOG, C.productId('Legrand', 'DX³-ID')), { rating: 16 });
  assert.equal(rccb.rcdMa, 30);
  assert.equal(rccb.rcdType, 'A');
  assert.equal(rccb.rating, 25);
  assert.equal(rccb.curve, '');
});

test('seri dışı değerler uyarı verir', () => {
  const p = C.findProduct(C.CATALOG, C.productId('Siemens', '5SL6'));
  const ok = C.checkAgainstProduct({ device: p.device, curve: 'C', rating: 16, poles: '1P', breakingKa: 6 }, p);
  assert.deepEqual(ok, []);
  const bad = C.checkAgainstProduct({ device: p.device, curve: 'D', rating: 80, poles: '1P', breakingKa: 10 }, p).map((i) => i.code);
  assert.deepEqual(bad.sort(), ['catalog-breakingKa', 'catalog-curve', 'catalog-rating']);
  assert.ok(C.checkAgainstProduct({ device: 'MCCB (kompakt şalter)' }, p).some((i) => i.code === 'catalog-device'));
});

test('kendi ürünü: virgüllü metin listeye çevrilir', () => {
  const p = C.normalizeCustom({ brand: 'Örnek', series: 'X1', device: 'MCB (otomatik sigorta)', curves: 'B, C', ratings: '6,10; 16', poles: '1P 3P', breakingKa: '4,5' });
  assert.deepEqual(p.curves, ['B', 'C']);
  assert.deepEqual(p.ratings, [6, 10, 16]);
  assert.deepEqual(p.poles, ['1P', '3P']);
  assert.equal(p.builtin, false);
  const all = C.allProducts([p]);
  assert.equal(all.length, C.CATALOG.length + 1);
  assert.ok(C.brandsOf(all).includes('Örnek'));
});

test('malzeme listesi aynı ürünleri gruplar ve sayar', () => {
  const id = C.productId('Legrand', 'DX³ 6000');
  const rows = C.billOfMaterials([
    { code: 'F1', device: 'MCB (otomatik sigorta)', productId: id, curve: 'C', rating: 16, poles: '1P+N' },
    { code: 'F2', device: 'MCB (otomatik sigorta)', productId: id, curve: 'C', rating: 16, poles: '1P+N' },
    { code: 'F3', device: 'MCB (otomatik sigorta)', productId: id, curve: 'B', rating: 10, poles: '1P+N' },
    { code: 'F4', device: 'MCB (otomatik sigorta)', curve: 'C', rating: 16, poles: '1P+N' }
  ]);
  assert.equal(rows.length, 3);
  const c16 = rows.find((r) => r.brand === 'Legrand' && r.rating === 16);
  assert.equal(c16.qty, 2);
  assert.deepEqual(c16.codes, ['F1', 'F2']);
  assert.equal(c16.series, 'DX³ 6000');
  assert.equal(rows[rows.length - 1].brand, '', 'markasızlar sona');
});

test('örnek veri katalog serilerinin aralığında kalır', () => {
  const db = { sites: [], panels: [], circuits: [], inspections: [], events: [] };
  let n = 0;
  const store = {
    create: (col, data) => {
      const rec = { ...data, id: `${col}${++n}` };
      db[col].push(rec);
      return rec;
    },
    update: (col, id, patch) => Object.assign(db[col].find((r) => r.id === id), patch)
  };
  loadDemo(store);
  const branded = db.circuits.filter((c) => c.productId);
  assert.ok(branded.length >= 15);
  for (const c of branded) {
    const p = C.findProduct(C.CATALOG, c.productId);
    assert.ok(p, `${c.code}: ${c.productId} katalogda yok`);
    assert.deepEqual(C.checkAgainstProduct(c, p), [], `${c.code} (${c.productId})`);
  }
});

test('malzeme listesinde RCCB ve parafudr kesme kapasitesine göre bölünmez', () => {
  const rows = C.billOfMaterials([
    { code: 'R1', device: 'RCCB (kaçak akım rölesi)', rating: 40, poles: '4P', rcdMa: 30, breakingKa: 6 },
    { code: 'R2', device: 'RCCB (kaçak akım rölesi)', rating: 40, poles: '4P', rcdMa: 30, breakingKa: 10 }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, 2);
  assert.equal(rows[0].breakingKa, '');
});
