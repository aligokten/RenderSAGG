/**
 * Pano Saha (şantiye pano ve sigorta kaydı) — kural modülü ve dosya yapısı testleri.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../pano-saha/lib/rules.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const mcb = (o = {}) => ({ code: 'F1', label: 'Test', device: 'MCB (otomatik sigorta)', curve: 'C', rating: 16, poles: '1P+N', phase: 'L1', status: 'Aktif', ...o });
const codes = (issues) => issues.map((i) => i.code);

test('kural modülü saf JavaScript: içe aktarım ve Node API yok', async () => {
  const src = await readFile(path.join(ROOT, 'pano-saha/lib/rules.js'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /\bprocess\.|\brequire\(/);
});

test('statik uygulama dosyaları yerinde ve QR kütüphanesi yerel', async () => {
  for (const f of ['index.html', 'app.js', 'styles.css', 'lib/rules.js', 'lib/store.js', 'lib/demo.js', 'vendor/qrcode.js']) {
    await readFile(path.join(ROOT, 'pano-saha', f));
  }
  const html = await readFile(path.join(ROOT, 'pano-saha/index.html'), 'utf8');
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
