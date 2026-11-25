import * as S from './lib/store.js';
import * as R from './lib/rules.js';
import { loadDemo } from './lib/demo.js';

/* =========================================================================
   Yardımcılar
   ========================================================================= */

const app = document.getElementById('app');
const modal = document.getElementById('modal');
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const blank = (v) => v === '' || v == null;
const val = (v, unit = '') => (blank(v) ? '<span class="muted">—</span>' : esc(v) + (unit ? ' ' + unit : ''));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—');
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const today = () => new Date().toISOString().slice(0, 10);
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const num = (v) => (blank(v) ? 0 : Number(v));
const plural = (n, w) => `${n} ${w}`;

function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + kind;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), kind === 'err' ? 6000 : 2800);
}

function download(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

const slug = (s) =>
  String(s || 'kayit')
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function levelBadge(level) {
  return { err: '<span class="badge err">Hata</span>', warn: '<span class="badge warn">Uyarı</span>', info: '<span class="badge info">Bilgi</span>' }[level];
}

function phaseTag(c) {
  if (R.isThreePhase(c)) return '<span class="ph F3" title="3 faz">3F</span>';
  if (c.phase) return `<span class="ph ${esc(c.phase)}">${esc(c.phase)}</span>`;
  return '<span class="muted">—</span>';
}

const STATUS_CLASS = {
  Aktif: 'ok', Devrede: 'ok', Uygun: 'ok',
  Yedek: '', Kapalı: '', 'Devre dışı': '', Söküldü: '', Tamamlandı: '',
  Arızalı: 'err', 'Uygun değil': 'err',
  'Kilitli (LOTO)': 'warn', Bakımda: 'warn', Montajda: 'info', Askıda: 'warn', 'Şartlı uygun': 'warn'
};
const statusBadge = (s) => (s ? `<span class="badge ${STATUS_CLASS[s] ?? ''}">${esc(s)}</span>` : '');

/* =========================================================================
   Türetilmiş veriler
   ========================================================================= */

const sitesAll = () => S.all('sites');
const panelsOf = (siteId) => S.where('panels', (p) => p.siteId === siteId).sort((a, b) => R.naturalCompare(a.code, b.code));
const circuitsOf = (panelId) => S.where('circuits', (c) => c.panelId === panelId).sort((a, b) => R.naturalCompare(a.code, b.code));
const inspectionsOf = (panelId) => S.where('inspections', (x) => x.panelId === panelId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const eventsOf = (pred) => S.where('events', pred).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const intervalFor = (p) => num(p.inspectionIntervalDays) || num(S.settings().inspectionIntervalDays) || 30;
const lastInspectionDate = (panelId) => inspectionsOf(panelId)[0]?.date || null;
const isLive = (p) => !['Söküldü', 'Devre dışı'].includes(p.status);

function panelTitle(p) {
  return p ? `${p.code || '—'}${p.name ? ' · ' + p.name : ''}` : '—';
}

/** Devrenin, kendisi dışında ≤30 mA kaçak akım koruması altında olup olmadığı. */
function upstreamRcd(circuit, panel, seen = new Set()) {
  const ok = (ma) => num(ma) > 0 && num(ma) <= 30;
  if (!panel || seen.has(panel.id)) return false;
  seen.add(panel.id);
  if (ok(panel.mainRcdMa)) return true;
  if (circuit?.protectedBy) {
    const r = S.get('circuits', circuit.protectedBy);
    if (r && R.RCD_DEVICES.has(r.device) && ok(r.rcdMa)) return true;
  }
  if (panel.parentCircuitId) {
    const feeder = S.get('circuits', panel.parentCircuitId);
    if (feeder && R.RCD_DEVICES.has(feeder.device) && ok(feeder.rcdMa)) return true;
    if (feeder?.protectedBy) {
      const r = S.get('circuits', feeder.protectedBy);
      if (r && R.RCD_DEVICES.has(r.device) && ok(r.rcdMa)) return true;
    }
  }
  const parent = panel.parentPanelId ? S.get('panels', panel.parentPanelId) : null;
  return parent ? upstreamRcd(null, parent, seen) : false;
}

function circuitIssues(c, panel = S.get('panels', c.panelId)) {
  return R.checkCircuit(c, { panel, upstreamRcd: upstreamRcd(c, panel) });
}

function panelIssues(p, { withCircuits = true } = {}) {
  const circuits = circuitsOf(p.id);
  const feeder = p.parentCircuitId ? S.get('circuits', p.parentCircuitId) : null;
  const out = R.checkPanel(p, circuits, {
    feederRating: feeder?.rating,
    intervalDays: intervalFor(p),
    lastInspection: lastInspectionDate(p.id)
  }).map((i) => ({ ...i, panel: p }));
  if (withCircuits && isLive(p)) {
    for (const c of circuits) for (const i of circuitIssues(c, p)) out.push({ ...i, panel: p, circuit: c });
  }
  return out;
}

function allIssues() {
  const out = [];
  for (const p of S.all('panels')) {
    const site = S.get('sites', p.siteId);
    if (!isLive(p) || site?.status === 'Tamamlandı') continue;
    out.push(...panelIssues(p).map((i) => ({ ...i, site })));
  }
  const rank = { err: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

function descendants(panelId) {
  const ids = new Set();
  const walk = (id) => {
    for (const p of S.where('panels', (x) => x.parentPanelId === id)) {
      if (!ids.has(p.id)) {
        ids.add(p.id);
        walk(p.id);
      }
    }
  };
  walk(panelId);
  return ids;
}

/* =========================================================================
   Alan tanımları (formlar)
   ========================================================================= */

const opts = (arr) => arr.map((x) => (typeof x === 'object' ? x : { value: x, label: String(x) }));

const SITE_FIELDS = [
  { section: 'Şantiye' },
  { k: 'name', label: 'Şantiye adı', required: true, w: 4 },
  { k: 'code', label: 'Kısa kod', w: 2, placeholder: 'YV-B' },
  { k: 'address', label: 'Adres / konum' },
  { k: 'status', label: 'Durum', type: 'select', options: R.SITE_STATUS, w: 2, default: 'Aktif' },
  { k: 'startDate', label: 'Başlangıç', type: 'date', w: 2 },
  { k: 'endDate', label: 'Bitiş', type: 'date', w: 2 },
  { section: 'Taraflar' },
  { k: 'client', label: 'İşveren', w: 3 },
  { k: 'contractor', label: 'Elektrik yüklenicisi', w: 3 },
  { k: 'siteChief', label: 'Şantiye şefi', w: 2 },
  { k: 'electricalLead', label: 'Elektrik sorumlusu', w: 2 },
  { k: 'phone', label: 'Telefon', type: 'tel', w: 2 },
  { section: 'Enerji' },
  { k: 'utilityNo', label: 'Abone / sayaç no', w: 2 },
  { k: 'transformerKva', label: 'Trafo gücü', type: 'number', unit: 'kVA', w: 2 },
  { k: 'contractKw', label: 'Sözleşme gücü', type: 'number', unit: 'kW', w: 2 },
  { k: 'notes', label: 'Notlar', type: 'textarea' },
  { k: 'photos', label: 'Fotoğraflar', type: 'photos' }
];

function panelFields(siteId, selfId) {
  const exclude = selfId ? new Set([selfId, ...descendants(selfId)]) : new Set();
  return [
    { section: 'Kimlik' },
    { k: 'siteId', label: 'Şantiye', type: 'select', required: true, w: 3, options: () => sitesAll().map((s) => ({ value: s.id, label: s.name })), default: siteId },
    { k: 'code', label: 'Pano kodu', required: true, w: 1, placeholder: 'KP-1' },
    { k: 'name', label: 'Pano adı', w: 2, placeholder: 'Konteyner ofis panosu' },
    { k: 'type', label: 'Pano türü', type: 'select', options: R.PANEL_TYPES, w: 3, empty: '—' },
    { k: 'status', label: 'Durum', type: 'select', options: R.PANEL_STATUS, w: 3, default: 'Devrede' },
    { k: 'location', label: 'Konum (blok / kat / mahal)', placeholder: 'B Blok, 3. kat, merdiven sahanlığı' },
    { section: 'Besleme' },
    {
      k: 'parentPanelId', label: 'Besleyen pano', type: 'select', w: 3, empty: '— Doğrudan şebeke / sayaç —',
      options: (v) => S.where('panels', (p) => p.siteId === v.siteId && !exclude.has(p.id)).sort((a, b) => R.naturalCompare(a.code, b.code)).map((p) => ({ value: p.id, label: panelTitle(p) }))
    },
    {
      k: 'parentCircuitId', label: 'Besleyen devre', type: 'select', w: 3, empty: '— Seçilmedi —',
      show: (v) => !!v.parentPanelId,
      options: (v) => (v.parentPanelId ? circuitsOf(v.parentPanelId).map((c) => ({ value: c.id, label: `${c.code} · ${R.deviceShort(c)} · ${c.label || ''}` })) : [])
    },
    { k: 'feedCable', label: 'Besleme kablosu', w: 3, placeholder: 'NYY 4x16+10' },
    { k: 'voltage', label: 'Gerilim', type: 'select', options: ['400/230 V', '400 V', '230 V'], w: 3, default: '400/230 V' },
    { section: 'Giriş ve koruma' },
    { k: 'mainDevice', label: 'Giriş cihazı', w: 2, placeholder: 'MCCB 3P / Yük ayırıcı 4P' },
    { k: 'mainRating', label: 'Giriş anma akımı', type: 'number', unit: 'A', w: 2 },
    { k: 'mainRcdMa', label: 'Giriş kaçak akım', type: 'select', options: [{ value: '', label: 'Yok' }, ...opts(R.RCD_MA).map((o) => ({ ...o, label: o.label + ' mA' }))], w: 2 },
    { k: 'shortCircuitKa', label: 'Kısa devre seviyesi (Ik)', type: 'number', unit: 'kA', w: 2, help: 'Devre kesme kapasitesi bununla karşılaştırılır.' },
    { k: 'earthingSystem', label: 'Topraklama sistemi', type: 'select', options: R.EARTHING_SYSTEMS, w: 2, empty: '—' },
    { k: 'ipClass', label: 'Koruma sınıfı', type: 'select', options: R.IP_CLASSES, w: 2, empty: '—' },
    { section: 'Gövde' },
    { k: 'manufacturer', label: 'İmalatçı / marka', w: 2 },
    { k: 'rows', label: 'Ray sırası', type: 'number', w: 2, default: 1, min: 1 },
    { k: 'modulesPerRow', label: 'Sıra başına modül', type: 'number', w: 2, default: 18, min: 4 },
    { k: 'responsible', label: 'Pano sorumlusu', w: 3 },
    { k: 'inspectionIntervalDays', label: 'Kontrol aralığı', type: 'number', unit: 'gün', w: 3, help: `Boşsa genel ayar (${S.settings().inspectionIntervalDays} gün).` },
    { k: 'notes', label: 'Notlar', type: 'textarea' },
    { k: 'photos', label: 'Fotoğraflar', type: 'photos' }
  ];
}

function circuitFields(panel, selfId) {
  const rcds = circuitsOf(panel.id).filter((c) => c.id !== selfId && R.RCD_DEVICES.has(c.device));
  const isRcd = (v) => R.RCD_DEVICES.has(v.device);
  const protective = (v) => R.PROTECTIVE.has(v.device);
  return [
    { section: 'Devre' },
    { k: 'code', label: 'No', required: true, w: 1, placeholder: 'F1' },
    { k: 'label', label: 'Beslediği yer', w: 3, placeholder: 'Ofis prizleri' },
    { k: 'loadKind', label: 'Yük türü', type: 'select', options: R.LOAD_KINDS, w: 2, empty: '—' },
    { k: 'location', label: 'Mahal / güzergâh', w: 4 },
    { k: 'status', label: 'Durum', type: 'select', options: R.CIRCUIT_STATUS, w: 2, default: 'Aktif' },
    { k: 'lotoBy', label: 'Kilidi takan', w: 3, show: (v) => v.status === 'Kilitli (LOTO)', required: (v) => v.status === 'Kilitli (LOTO)' },
    { k: 'lotoNote', label: 'Kilit nedeni', w: 3, show: (v) => v.status === 'Kilitli (LOTO)' },
    { section: 'Koruma cihazı' },
    { k: 'device', label: 'Cihaz', type: 'select', options: R.DEVICE_TYPES, w: 3, default: 'MCB (otomatik sigorta)' },
    { k: 'curve', label: 'Eğri / sınıf', type: 'select', options: R.CURVES, w: 1, empty: '—', show: protective },
    { k: 'rating', label: 'Anma akımı', type: 'number', unit: 'A', w: 2, list: R.RATINGS },
    { k: 'poles', label: 'Kutup', type: 'select', options: Object.keys(R.POLES), w: 2, default: '1P+N' },
    { k: 'phase', label: 'Faz', type: 'select', options: R.PHASES, w: 2, empty: '—', help: 'Tek fazlıda L1/L2/L3; 3 fazlıda 3F.' },
    { k: 'breakingKa', label: 'Kesme kapasitesi', type: 'select', options: opts(R.BREAKING_KA).map((o) => ({ ...o, label: o.label + ' kA' })), w: 2, empty: '—', show: protective },
    { k: 'rcdMa', label: 'Kaçak akım', type: 'select', options: opts(R.RCD_MA).map((o) => ({ ...o, label: o.label + ' mA' })), w: 2, empty: '—', show: isRcd },
    { k: 'rcdType', label: 'RCD tipi', type: 'select', options: R.RCD_TYPES, w: 2, empty: '—', show: isRcd },
    {
      k: 'protectedBy', label: 'Bağlı olduğu kaçak akım rölesi', type: 'select', w: 4, empty: rcds.length ? '— Yok —' : '— Bu panoda RCCB/RCBO yok —',
      options: () => rcds.map((c) => ({ value: c.id, label: `${c.code} · ${R.deviceShort(c)}` })), show: (v) => !isRcd(v)
    },
    { k: 'brand', label: 'Marka / model', w: 2 },
    { section: 'Kablo ve yük' },
    { k: 'cableType', label: 'Kablo tipi', type: 'select', options: R.CABLE_TYPES, w: 2, empty: '—' },
    { k: 'cableCores', label: 'Damar', w: 1, placeholder: '3x' },
    { k: 'cableSection', label: 'Kesit', type: 'select', options: opts(R.CABLE_SECTIONS).map((o) => ({ ...o, label: o.label + ' mm²' })), w: 1, empty: '—' },
    { k: 'cableLength', label: 'Uzunluk', type: 'number', unit: 'm', w: 2 },
    { k: 'loadKw', label: 'Kurulu / tahmini yük', type: 'number', unit: 'kW', w: 2, step: '0.01' },
    { k: 'cosphi', label: 'cos φ', type: 'number', w: 2, step: '0.01', placeholder: String(S.settings().defaultCosphi) },
    { k: 'notes', label: 'Notlar', type: 'textarea' },
    { issues: (v) => circuitIssues({ ...v, panelId: panel.id }, panel) }
  ];
}

function inspectionFields(fixedPanel) {
  return [
    {
      k: 'panelId', label: 'Pano', type: 'select', required: true, w: 6, default: fixedPanel?.id,
      options: () => S.all('panels').filter(isLive).map((p) => ({ value: p.id, label: `${S.get('sites', p.siteId)?.code || ''} / ${panelTitle(p)}` }))
    },
    { k: 'date', label: 'Tarih', type: 'date', required: true, w: 2, default: today() },
    { k: 'type', label: 'Kontrol türü', type: 'select', options: R.INSPECTION_TYPES, w: 4, default: R.INSPECTION_TYPES[0] },
    { k: 'by', label: 'Kontrol eden', w: 3, default: S.settings().userName },
    { k: 'result', label: 'Sonuç', type: 'select', options: ['Uygun', 'Şartlı uygun', 'Uygun değil'], w: 3, default: 'Uygun' },
    { section: 'Ölçümler (varsa)' },
    { k: 'earthOhm', label: 'Topraklama direnci', type: 'number', unit: 'Ω', w: 2, step: '0.01' },
    { k: 'insulationMohm', label: 'İzolasyon direnci', type: 'number', unit: 'MΩ', w: 2, step: '0.1' },
    { k: 'loopOhm', label: 'Çevrim empedansı', type: 'number', unit: 'Ω', w: 2, step: '0.01' },
    { k: 'rcdTripMs', label: 'RCD açma süresi', type: 'number', unit: 'ms', w: 2 },
    { k: 'rcdTripMa', label: 'RCD açma akımı', type: 'number', unit: 'mA', w: 2 },
    { k: 'maxTempC', label: 'En yüksek sıcaklık', type: 'number', unit: '°C', w: 2 },
    { k: 'notes', label: 'Bulgular', type: 'textarea' },
    { k: 'nextActions', label: 'Yapılacaklar', type: 'textarea' },
    { k: 'photos', label: 'Fotoğraflar', type: 'photos' }
  ];
}

function eventFields(fixedPanel) {
  return [
    {
      k: 'panelId', label: 'Pano', type: 'select', required: true, w: 3, default: fixedPanel?.id,
      options: () => S.all('panels').map((p) => ({ value: p.id, label: `${S.get('sites', p.siteId)?.code || ''} / ${panelTitle(p)}` }))
    },
    {
      k: 'circuitId', label: 'Devre', type: 'select', w: 3, empty: '— Pano geneli —',
      options: (v) => (v.panelId ? circuitsOf(v.panelId).map((c) => ({ value: c.id, label: `${c.code} · ${c.label || R.deviceShort(c)}` })) : [])
    },
    { k: 'date', label: 'Tarih / saat', type: 'datetime-local', required: true, w: 3, default: nowLocal() },
    { k: 'type', label: 'Olay', type: 'select', options: R.EVENT_TYPES, w: 3, default: 'Sigorta attı' },
    { k: 'by', label: 'Kaydeden', w: 6, default: S.settings().userName },
    { k: 'description', label: 'Açıklama', type: 'textarea', required: true },
    { k: 'photos', label: 'Fotoğraflar', type: 'photos' },
    {
      issues: (v) =>
        v.type?.startsWith('LOTO') && v.circuitId
          ? [{ level: 'info', msg: v.type === 'LOTO kilitleme' ? 'Kaydedince devre "Kilitli (LOTO)" durumuna alınır.' : 'Kaydedince devre kilidi kaldırılır ve "Aktif" olur.' }]
          : []
    }
  ];
}

const FIELD_LABELS = {};
for (const f of [...SITE_FIELDS, ...panelFields(), ...circuitFields({ id: '' }), ...inspectionFields(), ...eventFields()]) if (f.k) FIELD_LABELS[f.k] = f.label;

/* =========================================================================
   Form motoru
   ========================================================================= */

let formState = null;

function readForm() {
  const form = document.getElementById('modal-form');
  const v = { ...formState.values };
  for (const f of formState.fields) {
    if (!f.k || f.type === 'photos') continue;
    const el = form.elements[f.k];
    if (!el) continue;
    if (f.type === 'number') v[f.k] = el.value === '' ? '' : Number(el.value);
    else if (f.type === 'checkbox') v[f.k] = el.checked;
    else if (f.type === 'select' && el.value !== '' && Array.isArray(f.options) && f.options.some((o) => typeof (o?.value ?? o) === 'number')) v[f.k] = Number(el.value);
    else v[f.k] = el.value;
  }
  for (const f of formState.fields) if (f.type === 'photos') v[f.k] = [...formState.photos[f.k]];
  return v;
}

function optionList(f, values) {
  const list = typeof f.options === 'function' ? f.options(values) : opts(f.options || []);
  return opts(list);
}

function selectHtml(f, values) {
  const cur = values[f.k] ?? '';
  const list = optionList(f, values);
  let html = f.empty !== undefined ? `<option value="">${esc(f.empty)}</option>` : '';
  let found = cur === '';
  for (const o of list) {
    const sel = String(o.value) === String(cur);
    if (sel) found = true;
    html += `<option value="${esc(o.value)}"${sel ? ' selected' : ''}>${esc(o.label)}</option>`;
  }
  if (!found) html += `<option value="${esc(cur)}" selected>${esc(cur)} (listede yok)</option>`;
  return html;
}

function fieldHtml(f, values) {
  if (f.section) return `<div class="section-title">${esc(f.section)}</div>`;
  if (f.issues) return `<div class="inline-issues" data-issues></div>`;
  const id = 'f_' + f.k;
  const v = values[f.k] ?? '';
  const req = typeof f.required === 'function' ? f.required(values) : f.required;
  const label = `<label for="${id}">${esc(f.label)}${f.unit ? ` <span class="muted">(${esc(f.unit)})</span>` : ''}${req ? ' <span class="req">*</span>' : ''}</label>`;
  let input = '';
  const common = `id="${id}" name="${esc(f.k)}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}`;
  switch (f.type) {
    case 'select':
      input = `<select ${common}>${selectHtml(f, values)}</select>`;
      break;
    case 'textarea':
      input = `<textarea ${common} rows="3">${esc(v)}</textarea>`;
      break;
    case 'photos':
      return `<div class="field w6" data-field="${f.k}"><span class="lbl">${esc(f.label)}</span>
        <div class="thumbs" data-thumbs="${f.k}"></div>
        <label class="btn sm" style="align-self:flex-start">📷 Fotoğraf ekle
          <input type="file" accept="image/*" multiple hidden data-photo-input="${f.k}" /></label>
        <span class="help">Fotoğraflar küçültülerek yalnızca bu cihazda saklanır.</span></div>`;
    case 'number': {
      const list = f.list ? `<datalist id="${id}_l">${f.list.map((x) => `<option value="${x}">`).join('')}</datalist>` : '';
      input = `<input type="number" inputmode="decimal" ${common} value="${esc(v)}" step="${f.step || 'any'}"${f.min != null ? ` min="${f.min}"` : ''}${f.list ? ` list="${id}_l"` : ''} />${list}`;
      break;
    }
    default:
      input = `<input type="${f.type || 'text'}" ${common} value="${esc(v)}" />`;
  }
  const show = f.show ? f.show(values) : true;
  return `<div class="field w${f.w || 6}" data-field="${f.k}"${show ? '' : ' hidden'}>${label}${input}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}<span class="err-msg" hidden></span></div>`;
}

function refreshForm() {
  const form = document.getElementById('modal-form');
  const v = readForm();
  for (const f of formState.fields) {
    if (!f.k) continue;
    const wrap = form.querySelector(`[data-field="${f.k}"]`);
    if (!wrap) continue;
    if (f.show) wrap.hidden = !f.show(v);
    if (f.type === 'select' && typeof f.options === 'function') {
      const el = form.elements[f.k];
      const html = selectHtml(f, v);
      if (el.dataset.html !== html) {
        el.innerHTML = html;
        el.dataset.html = html;
      }
    }
  }
  const box = form.querySelector('[data-issues]');
  const issuesField = formState.fields.find((f) => f.issues);
  if (box && issuesField) {
    const list = issuesField.issues(v);
    box.innerHTML = list.map((i) => `<div class="issue ${i.level}"><span class="dot ${i.level}"></span><span>${esc(i.msg)}</span></div>`).join('');
  }
}

async function renderThumbs(k) {
  const box = document.querySelector(`[data-thumbs="${k}"]`);
  if (!box) return;
  const ids = formState.photos[k];
  box.innerHTML = ids.map((id) => `<div class="thumb" data-photo="${id}"><img alt="" /><button type="button" data-act="photo-remove" data-k="${k}" data-id="${id}" aria-label="Kaldır">✕</button></div>`).join('');
  hydrateThumbs(box);
}

async function hydrateThumbs(root = document) {
  for (const el of root.querySelectorAll('[data-photo]')) {
    const img = el.querySelector('img');
    if (img.src) continue;
    try {
      const p = await S.getPhoto(el.dataset.photo);
      if (p) img.src = p.dataUrl;
      else el.remove();
    } catch {
      /* IndexedDB yoksa sessizce geç */
    }
  }
}

/**
 * Genel form penceresi.
 * onSubmit(values) → true (kapat) | string (hata mesajı)
 */
function openForm({ title, fields, values = {}, submitLabel = 'Kaydet', onSubmit, onDelete, extraButtons = '', ctx = {} }) {
  const v = { ...values };
  for (const f of fields) if (f.k && blank(v[f.k]) && f.default !== undefined) v[f.k] = f.default;
  formState = { fields, values: v, onSubmit, onDelete, photos: {}, original: {}, added: [], ctx };
  for (const f of fields) if (f.type === 'photos') {
    formState.photos[f.k] = [...(v[f.k] || [])];
    formState.original[f.k] = [...(v[f.k] || [])];
  }
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `<div class="form-grid">${fields.map((f) => fieldHtml(f, v)).join('')}</div>`;
  document.getElementById('modal-foot').innerHTML = `
    ${onDelete ? '<button type="button" class="btn danger left" data-act="form-delete">Sil</button>' : ''}
    ${extraButtons}
    <button type="button" class="btn" data-act="modal-close">Vazgeç</button>
    <button type="submit" class="btn primary">${esc(submitLabel)}</button>`;
  for (const f of fields) if (f.type === 'photos') renderThumbs(f.k);
  refreshForm();
  if (!modal.open) modal.showModal();
  const first = modal.querySelector('.modal-body input:not([type=file]), .modal-body select, .modal-body textarea');
  if (first && window.matchMedia('(min-width: 700px)').matches) first.focus();
}

function closeModal({ discard = true } = {}) {
  if (discard && formState?.added?.length) for (const id of formState.added) S.deletePhoto(id).catch(() => {});
  formState = null;
  if (modal.open) modal.close();
}

modal.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeModal();
});
modal.addEventListener('input', () => formState && refreshForm());
modal.addEventListener('change', async (e) => {
  const input = e.target.closest('[data-photo-input]');
  if (!input || !formState) return;
  const k = input.dataset.photoInput;
  for (const file of input.files) {
    try {
      const dataUrl = await S.compressImage(file);
      const id = S.uid('ph');
      await S.putPhoto({ id, dataUrl, createdAt: new Date().toISOString(), name: file.name });
      formState.photos[k].push(id);
      formState.added.push(id);
    } catch (err) {
      toast(err.message || 'Fotoğraf eklenemedi.', 'err');
    }
  }
  input.value = '';
  renderThumbs(k);
});

document.getElementById('modal-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!formState) return;
  const v = readForm();
  const form = e.currentTarget;
  let bad = false;
  for (const f of formState.fields) {
    if (!f.k) continue;
    const wrap = form.querySelector(`[data-field="${f.k}"]`);
    if (!wrap || wrap.hidden) continue;
    const req = typeof f.required === 'function' ? f.required(v) : f.required;
    const msg = wrap.querySelector('.err-msg');
    const missing = req && blank(v[f.k]);
    wrap.classList.toggle('invalid', missing);
    if (msg) {
      msg.hidden = !missing;
      msg.textContent = missing ? 'Zorunlu alan.' : '';
    }
    if (missing) bad = true;
  }
  if (bad) {
    form.querySelector('.invalid input, .invalid select, .invalid textarea')?.focus();
    return;
  }
  // Gizli alanları temizle (ör. RCD olmayan cihazda mA)
  for (const f of formState.fields) {
    if (f.k && f.show && !f.show(v) && f.type !== 'photos') v[f.k] = '';
  }
  const removed = [];
  for (const [k, orig] of Object.entries(formState.original)) for (const id of orig) if (!v[k].includes(id)) removed.push(id);
  const res = formState.onSubmit(v);
  if (typeof res === 'string') {
    toast(res, 'err');
    return;
  }
  if (res === false) return;
  for (const id of removed) S.deletePhoto(id).catch(() => {});
  closeModal({ discard: false });
});

/* =========================================================================
   Kayıt işlemleri
   ========================================================================= */

function editSite(site) {
  openForm({
    title: site ? 'Şantiyeyi düzenle' : 'Yeni şantiye',
    fields: SITE_FIELDS,
    values: site || {},
    onDelete: site ? () => deleteRecord('sites', site) : null,
    onSubmit: (v) => {
      if (site) S.update('sites', site.id, v);
      else {
        const s = S.create('sites', v);
        location.hash = `#/santiye/${s.id}`;
      }
      toast('Şantiye kaydedildi.');
      return true;
    }
  });
}

function editPanel(panel, defaults = {}) {
  const siteId = panel?.siteId || defaults.siteId || sitesAll()[0]?.id;
  if (!siteId) {
    toast('Önce bir şantiye ekleyin.', 'err');
    return;
  }
  openForm({
    title: panel ? `Panoyu düzenle — ${panel.code}` : 'Yeni pano',
    fields: panelFields(siteId, panel?.id),
    values: panel || defaults,
    onDelete: panel ? () => deleteRecord('panels', panel) : null,
    onSubmit: (v) => {
      const dup = S.where('panels', (p) => p.siteId === v.siteId && p.id !== panel?.id && p.code?.trim().toLocaleUpperCase('tr') === v.code.trim().toLocaleUpperCase('tr'));
      if (dup.length) return `Bu şantiyede ${v.code} kodlu bir pano zaten var.`;
      if (!v.parentPanelId) v.parentCircuitId = '';
      if (panel) {
        S.update('panels', panel.id, v);
        if (panel.siteId !== v.siteId) for (const c of circuitsOf(panel.id)) S.update('circuits', c.id, { siteId: v.siteId });
      } else {
        const p = S.create('panels', v);
        location.hash = `#/pano/${p.id}`;
      }
      toast('Pano kaydedildi.');
      return true;
    }
  });
}

function editCircuit(panel, circuit, preset = {}) {
  const circuits = circuitsOf(panel.id);
  const defaults = circuit
    ? circuit
    : { code: R.nextCode(circuits, S.settings().codePrefix || 'F'), phase: R.suggestPhase(circuits), breakingKa: 6, curve: 'C', ...preset };
  openForm({
    ctx: { panel },
    title: circuit ? `Devre ${circuit.code} — ${panel.code}` : `Yeni devre — ${panel.code}`,
    fields: circuitFields(panel, circuit?.id),
    values: defaults,
    onDelete: circuit ? () => deleteRecord('circuits', circuit) : null,
    extraButtons: circuit ? '<button type="button" class="btn" data-act="form-copy-circuit">Kopyala</button>' : '',
    onSubmit: (v) => {
      const dup = circuitsOf(panel.id).find((c) => c.id !== circuit?.id && c.code?.toLocaleUpperCase('tr') === v.code.toLocaleUpperCase('tr'));
      if (dup) return `${panel.code} panosunda ${v.code} numarası zaten kullanılıyor.`;
      if (R.isThreePhase(v)) v.phase = '3F';
      else if (v.phase === '3F') v.phase = '';
      const wasLoto = circuit?.status === 'Kilitli (LOTO)';
      const isLoto = v.status === 'Kilitli (LOTO)';
      if (isLoto && !wasLoto) v.lotoAt = new Date().toISOString();
      if (!isLoto) Object.assign(v, { lotoBy: '', lotoNote: '', lotoAt: '' });
      let rec;
      if (circuit) rec = S.update('circuits', circuit.id, v);
      else rec = S.create('circuits', { ...v, panelId: panel.id, siteId: panel.siteId });
      if (isLoto !== wasLoto && (circuit || isLoto)) {
        S.create('events', {
          siteId: panel.siteId, panelId: panel.id, circuitId: rec.id, date: nowLocal(),
          type: isLoto ? 'LOTO kilitleme' : 'LOTO açma', by: S.settings().userName || v.lotoBy || '',
          description: isLoto ? `Kilidi takan: ${v.lotoBy}${v.lotoNote ? ' — ' + v.lotoNote : ''}` : 'Kilit kaldırıldı, devre aktif.'
        });
      }
      toast(`Devre ${v.code} kaydedildi.`);
      return true;
    }
  });
}

function bulkCircuits(panel) {
  const circuits = circuitsOf(panel.id);
  const prefix = S.settings().codePrefix || 'F';
  const start = Number(R.nextCode(circuits, prefix).slice(prefix.length));
  openForm({
    title: `Toplu devre ekle — ${panel.code}`,
    submitLabel: 'Devreleri ekle',
    fields: [
      { k: 'count', label: 'Adet', type: 'number', required: true, w: 2, default: 6, min: 1 },
      { k: 'start', label: 'İlk numara', type: 'number', w: 2, default: start, help: `${prefix}${start}, ${prefix}${start + 1}…` },
      { k: 'rotate', label: 'Faz dağıtımı', type: 'select', options: ['L1 → L2 → L3 sırayla', 'En az yüklü faza', 'Atama yapma'], w: 2 },
      { k: 'label', label: 'Beslediği yer (ön ek)', w: 3, placeholder: 'Daire prizleri → "Daire prizleri 1, 2…"' },
      { k: 'loadKind', label: 'Yük türü', type: 'select', options: R.LOAD_KINDS, w: 3, empty: '—' },
      { k: 'device', label: 'Cihaz', type: 'select', options: R.DEVICE_TYPES, w: 3, default: 'MCB (otomatik sigorta)' },
      { k: 'curve', label: 'Eğri', type: 'select', options: R.CURVES, w: 1, default: 'C' },
      { k: 'rating', label: 'Anma', type: 'number', unit: 'A', w: 2, default: 16, list: R.RATINGS },
      { k: 'poles', label: 'Kutup', type: 'select', options: Object.keys(R.POLES), w: 2, default: '1P+N' },
      { k: 'breakingKa', label: 'Kesme kap.', type: 'select', options: opts(R.BREAKING_KA).map((o) => ({ ...o, label: o.label + ' kA' })), w: 2, default: 6 },
      { k: 'rcdMa', label: 'Kaçak akım', type: 'select', options: opts(R.RCD_MA).map((o) => ({ ...o, label: o.label + ' mA' })), w: 2, empty: '—', show: (v) => R.RCD_DEVICES.has(v.device) },
      { k: 'cableType', label: 'Kablo', type: 'select', options: R.CABLE_TYPES, w: 2, empty: '—' },
      { k: 'cableSection', label: 'Kesit', type: 'select', options: opts(R.CABLE_SECTIONS).map((o) => ({ ...o, label: o.label + ' mm²' })), w: 2, empty: '—' },
      { k: 'loadKw', label: 'Devre başı yük', type: 'number', unit: 'kW', w: 2, step: '0.01' }
    ],
    onSubmit: (v) => {
      const n = Math.min(96, Math.max(1, Math.floor(v.count)));
      const first = Math.max(1, Math.floor(v.start || start));
      const existing = new Set(circuitsOf(panel.id).map((c) => c.code.toLocaleUpperCase('tr')));
      for (let i = 0; i < n; i++) if (existing.has(`${prefix}${first + i}`.toLocaleUpperCase('tr'))) return `${prefix}${first + i} zaten var; ilk numarayı değiştirin.`;
      const three = ['3P', '3P+N', '4P'].includes(v.poles);
      for (let i = 0; i < n; i++) {
        let phase = '';
        if (three) phase = '3F';
        else if (v.rotate?.startsWith('L1')) phase = ['L1', 'L2', 'L3'][i % 3];
        else if (v.rotate?.startsWith('En')) phase = R.suggestPhase(circuitsOf(panel.id));
        S.create('circuits', {
          siteId: panel.siteId, panelId: panel.id, code: `${prefix}${first + i}`,
          label: v.label ? `${v.label} ${i + 1}` : '', loadKind: v.loadKind, device: v.device, curve: v.curve, rating: v.rating,
          poles: v.poles, phase, breakingKa: v.breakingKa, rcdMa: v.rcdMa, cableType: v.cableType, cableSection: v.cableSection,
          loadKw: v.loadKw, status: 'Aktif'
        });
      }
      toast(`${n} devre eklendi.`);
      return true;
    }
  });
}

function editInspection(rec, panel) {
  openForm({
    title: rec ? 'Kontrol kaydı' : 'Yeni kontrol kaydı',
    fields: inspectionFields(panel),
    values: rec || {},
    onDelete: rec ? () => deleteRecord('inspections', rec) : null,
    onSubmit: (v) => {
      v.siteId = S.get('panels', v.panelId)?.siteId || '';
      if (rec) S.update('inspections', rec.id, v);
      else S.create('inspections', v);
      toast('Kontrol kaydedildi.');
      return true;
    }
  });
}

function editEvent(rec, panel, preset = {}) {
  openForm({
    title: rec ? 'Olay kaydı' : 'Yeni olay kaydı',
    fields: eventFields(panel),
    values: rec || preset,
    onDelete: rec ? () => deleteRecord('events', rec) : null,
    onSubmit: (v) => {
      v.siteId = S.get('panels', v.panelId)?.siteId || '';
      if (rec) S.update('events', rec.id, v);
      else {
        S.create('events', v);
        const c = v.circuitId && S.get('circuits', v.circuitId);
        if (c && v.type === 'LOTO kilitleme') S.update('circuits', c.id, { status: 'Kilitli (LOTO)', lotoBy: v.by || S.settings().userName, lotoNote: v.description, lotoAt: new Date().toISOString() });
        if (c && v.type === 'LOTO açma' && c.status === 'Kilitli (LOTO)') S.update('circuits', c.id, { status: 'Aktif', lotoBy: '', lotoNote: '', lotoAt: '' });
        if (c && v.type === 'Arıza' && c.status === 'Aktif') S.update('circuits', c.id, { status: 'Arızalı' });
      }
      toast('Olay kaydedildi.');
      return true;
    }
  });
}

function deleteRecord(col, rec) {
  const what = {
    sites: `"${rec.name}" şantiyesi, tüm panoları, devreleri, kontrol ve olay kayıtlarıyla`,
    panels: `${rec.code} panosu, tüm devreleri, kontrol ve olay kayıtlarıyla`,
    circuits: `${rec.code} devresi`,
    inspections: 'Bu kontrol kaydı',
    events: 'Bu olay kaydı'
  }[col];
  if (!confirm(`${what} kalıcı olarak silinecek. Emin misiniz?\n\nGeri almak için önceden alınmış bir yedek gerekir.`)) return;
  S.remove(col, rec.id);
  closeModal({ discard: false });
  toast('Silindi.');
  if (col === 'sites') location.hash = '#/santiyeler';
  if (col === 'panels') location.hash = `#/santiye/${rec.siteId}`;
}

function toggleLoto(circuit) {
  const panel = S.get('panels', circuit.panelId);
  if (circuit.status === 'Kilitli (LOTO)') {
    if (!confirm(`${panel.code} / ${circuit.code} kilidi kaldırılsın mı?\n\nKilidi yalnızca takan kişi veya yetkili sorumlu kaldırmalıdır.`)) return;
    S.update('circuits', circuit.id, { status: 'Aktif', lotoBy: '', lotoNote: '', lotoAt: '' });
    S.create('events', { siteId: panel.siteId, panelId: panel.id, circuitId: circuit.id, date: nowLocal(), type: 'LOTO açma', by: S.settings().userName, description: 'Kilit kaldırıldı, devre aktif.' });
    toast(`${circuit.code} kilidi kaldırıldı.`);
  } else {
    editEvent(null, panel, { panelId: panel.id, circuitId: circuit.id, type: 'LOTO kilitleme', description: '' });
  }
}

/* =========================================================================
   CSV
   ========================================================================= */

const CIRCUIT_COLUMNS = [
  { label: 'Şantiye', get: (c) => S.get('sites', c.siteId)?.name },
  { label: 'Pano', get: (c) => S.get('panels', c.panelId)?.code },
  { label: 'Pano adı', get: (c) => S.get('panels', c.panelId)?.name },
  { label: 'No', key: 'code' },
  { label: 'Beslediği yer', key: 'label' },
  { label: 'Yük türü', key: 'loadKind' },
  { label: 'Mahal', key: 'location' },
  { label: 'Cihaz', key: 'device' },
  { label: 'Kısa', get: (c) => R.deviceShort(c) },
  { label: 'Eğri', key: 'curve' },
  { label: 'Anma (A)', key: 'rating' },
  { label: 'Kutup', key: 'poles' },
  { label: 'Faz', key: 'phase' },
  { label: 'Kesme (kA)', key: 'breakingKa' },
  { label: 'Kaçak (mA)', key: 'rcdMa' },
  { label: 'RCD tipi', key: 'rcdType' },
  { label: 'Kablo', key: 'cableType' },
  { label: 'Damar', key: 'cableCores' },
  { label: 'Kesit (mm²)', key: 'cableSection' },
  { label: 'Uzunluk (m)', key: 'cableLength' },
  { label: 'Yük (kW)', key: 'loadKw' },
  { label: 'Durum', key: 'status' },
  { label: 'LOTO', key: 'lotoBy' },
  { label: 'Marka', key: 'brand' },
  { label: 'Not', key: 'notes' },
  { label: 'Uyarılar', get: (c) => circuitIssues(c).filter((i) => i.level !== 'info').map((i) => i.msg).join(' | ') }
];

const INSPECTION_COLUMNS = [
  { label: 'Tarih', key: 'date' },
  { label: 'Şantiye', get: (x) => S.get('sites', x.siteId)?.name },
  { label: 'Pano', get: (x) => S.get('panels', x.panelId)?.code },
  { label: 'Tür', key: 'type' },
  { label: 'Kontrol eden', key: 'by' },
  { label: 'Sonuç', key: 'result' },
  { label: 'Topraklama (Ω)', key: 'earthOhm' },
  { label: 'İzolasyon (MΩ)', key: 'insulationMohm' },
  { label: 'Çevrim (Ω)', key: 'loopOhm' },
  { label: 'RCD (ms)', key: 'rcdTripMs' },
  { label: 'RCD (mA)', key: 'rcdTripMa' },
  { label: 'Sıcaklık (°C)', key: 'maxTempC' },
  { label: 'Bulgular', key: 'notes' },
  { label: 'Yapılacaklar', key: 'nextActions' }
];

/* =========================================================================
   Ortak parçalar
   ========================================================================= */

function issueList(issues, { link = true, limit = Infinity } = {}) {
  if (!issues.length) return '<p class="muted">Uyarı yok.</p>';
  return `<ul class="list">${issues
    .slice(0, limit)
    .map((i) => {
      const where = [i.site?.code || i.site?.name, i.panel?.code, i.circuit?.code].filter(Boolean).join(' / ');
      const href = i.circuit ? `#/pano/${i.panel.id}?tab=devreler&devre=${i.circuit.id}` : i.panel ? `#/pano/${i.panel.id}?tab=uyarilar` : '';
      return `<li><span class="dot ${i.level}" style="margin-top:7px;width:8px;height:8px;border-radius:99px;flex:none"></span>
        <div class="grow">${esc(i.msg)}${link && where ? `<div class="meta"><a href="${href}">${esc(where)}</a>${i.circuit?.label ? ' · ' + esc(i.circuit.label) : ''}</div>` : ''}</div>
        ${levelBadge(i.level)}</li>`;
    })
    .join('')}</ul>${issues.length > limit ? `<p class="small muted">+${issues.length - limit} daha · <a href="#/uyarilar">tümü</a></p>` : ''}`;
}

function auditList(entries) {
  if (!entries.length) return '<p class="muted">Kayıt yok.</p>';
  const colName = { sites: 'Şantiye', panels: 'Pano', circuits: 'Devre', inspections: 'Kontrol', events: 'Olay' };
  const act = { create: 'eklendi', update: 'güncellendi', delete: 'silindi' };
  return `<ul class="timeline">${entries
    .map((a) => {
      const diffs = a.changes
        ? Object.entries(a.changes)
            .filter(([k]) => k !== 'photos')
            .slice(0, 6)
            .map(([k, [b, c]]) => `${esc(FIELD_LABELS[k] || k)}: <s>${esc(fmtVal(b))}</s> → <ins>${esc(fmtVal(c))}</ins>`)
            .join(' · ')
        : '';
      const panel = a.panelId && S.get('panels', a.panelId);
      return `<li><time>${fmtDateTime(a.at)}</time><div><b>${colName[a.col] || a.col}</b> ${esc(a.title)} ${act[a.action]}${a.by ? ` <span class="muted">— ${esc(a.by)}</span>` : ''}
        ${panel && a.col !== 'panels' ? ` <span class="muted">(${esc(panel.code)})</span>` : ''}
        ${diffs ? `<div class="diff">${diffs}</div>` : ''}</div></li>`;
    })
    .join('')}</ul>`;
}

function fmtVal(v) {
  if (blank(v)) return '∅';
  if (typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v)) return fmtDateTime(v);
  if (typeof v === 'string' && /^[pcs][a-z0-9]{8,}$/.test(v)) {
    const r = S.get('panels', v) || S.get('circuits', v) || S.get('sites', v);
    if (r) return r.code || r.name;
  }
  return Array.isArray(v) ? `${v.length} öğe` : String(v);
}

function inspectionStateBadge(p) {
  const d = R.inspectionDue(lastInspectionDate(p.id), intervalFor(p));
  if (d.state === 'never') return '<span class="badge warn">Kontrol yok</span>';
  if (d.state === 'overdue') return `<span class="badge err">${d.days} gün gecikti</span>`;
  if (d.state === 'soon') return `<span class="badge info">${d.days} gün kaldı</span>`;
  return `<span class="badge ok">${fmtDate(d.next)}'e kadar</span>`;
}

function issueCountBadges(issues) {
  const e = issues.filter((i) => i.level === 'err').length;
  const w = issues.filter((i) => i.level === 'warn').length;
  return `${e ? `<span class="badge err">${e} hata</span>` : ''}${w ? `<span class="badge warn">${w} uyarı</span>` : ''}${!e && !w ? '<span class="badge ok">Sorun yok</span>' : ''}`;
}

function emptyState(title, text, actions = '') {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${text}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}

function circuitTable(circuits, { showPanel = false, id = 'ctable' } = {}) {
  if (!circuits.length) return '';
  const rows = circuits
    .map((c) => {
      const panel = S.get('panels', c.panelId);
      const issues = circuitIssues(c, panel);
      const lvl = issues.some((i) => i.level === 'err') ? 'err' : issues.some((i) => i.level === 'warn') ? 'warn' : '';
      const trips = S.where('events', (e) => e.circuitId === c.id && e.type === 'Sigorta attı' && Date.now() - new Date(e.date) < 30 * 86400000).length;
      const search = [c.code, c.label, c.loadKind, c.location, c.device, R.deviceShort(c), c.cableType, c.cableSection, c.notes, panel?.code].join(' ').toLocaleLowerCase('tr');
      return `<tr class="clickable st-${esc((c.status || '').split(' ')[0])}" data-act="open-circuit" data-id="${c.id}" data-search="${esc(search)}" data-status="${esc(c.status)}" data-phase="${esc(c.phase)}" data-level="${lvl}">
        <td class="nowrap"><b class="mono">${esc(c.code)}</b>${lvl ? ` <span class="dot ${lvl}" style="display:inline-block;width:8px;height:8px;border-radius:99px" title="${esc(issues.filter((i) => i.level === lvl).map((i) => i.msg).join('\n'))}"></span>` : ''}</td>
        ${showPanel ? `<td class="nowrap"><a href="#/pano/${panel?.id}" data-stop>${esc(panel?.code)}</a></td>` : ''}
        <td>${val(c.label)}${c.location ? `<div class="small muted">${esc(c.location)}</div>` : ''}</td>
        <td class="nowrap">${esc(R.deviceShort(c)) || '<span class="muted">—</span>'}</td>
        <td>${phaseTag(c)}</td>
        <td class="nowrap">${c.cableSection ? `${esc(c.cableType || '')} ${esc(c.cableCores || '')}${esc(c.cableSection)} mm²` : '<span class="muted">—</span>'}</td>
        <td class="num">${blank(c.loadKw) || !c.loadKw ? '<span class="muted">—</span>' : esc(c.loadKw)}</td>
        <td>${statusBadge(c.status)}${c.status === 'Kilitli (LOTO)' && c.lotoBy ? `<div class="small muted">${esc(c.lotoBy)}</div>` : ''}${trips ? `<div class="small" style="color:var(--warn)">${trips}× attı (30 gün)</div>` : ''}</td>
        <td class="nowrap"><button class="btn sm" data-act="loto" data-id="${c.id}" title="LOTO kilitle / aç">${c.status === 'Kilitli (LOTO)' ? '🔓' : '🔒'}</button>
          <button class="btn sm" data-act="trip" data-id="${c.id}" title="Sigorta attı kaydı">⚡</button></td>
      </tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table class="data" id="${id}">
    <thead><tr><th>No</th>${showPanel ? '<th>Pano</th>' : ''}<th>Beslediği yer</th><th>Cihaz</th><th>Faz</th><th>Kablo</th><th class="num">kW</th><th>Durum</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function circuitToolbar(tableId) {
  return `<div class="toolbar" data-filter-for="${tableId}">
    <input class="grow" type="search" placeholder="Devrelerde ara…" data-filter="q" />
    <select data-filter="status"><option value="">Tüm durumlar</option>${R.CIRCUIT_STATUS.map((s) => `<option>${esc(s)}</option>`).join('')}</select>
    <select data-filter="phase"><option value="">Tüm fazlar</option>${R.PHASES.map((s) => `<option>${s}</option>`).join('')}</select>
    <select data-filter="level"><option value="">Uyarı filtresi yok</option><option value="err">Hatalı</option><option value="warn">Uyarılı</option></select>
  </div>`;
}

function applyFilters(bar) {
  const table = document.getElementById(bar.dataset.filterFor);
  if (!table) return;
  const f = {};
  for (const el of bar.querySelectorAll('[data-filter]')) f[el.dataset.filter] = el.value.toLocaleLowerCase('tr').trim();
  let shown = 0;
  for (const tr of table.tBodies[0].rows) {
    const ok =
      (!f.q || tr.dataset.search.includes(f.q)) &&
      (!f.status || tr.dataset.status.toLocaleLowerCase('tr') === f.status) &&
      (!f.phase || tr.dataset.phase.toLocaleLowerCase('tr') === f.phase) &&
      (!f.level || tr.dataset.level === f.level || (f.level === 'warn' && tr.dataset.level === 'err'));
    tr.hidden = !ok;
    if (ok) shown++;
  }
  let note = bar.querySelector('.fcount');
  if (!note) {
    note = document.createElement('span');
    note.className = 'fcount small muted';
    bar.appendChild(note);
  }
  note.textContent = `${shown} / ${table.tBodies[0].rows.length}`;
}

function tabs(base, current, list) {
  return `<nav class="tabs" role="tablist">${list
    .map(([key, label, badge]) => `<a href="${base}?tab=${key}" class="${current === key ? 'active' : ''}" role="tab" aria-selected="${current === key}">${label}${badge ? ` ${badge}` : ''}</a>`)
    .join('')}</nav>`;
}

function photoGallery(ids) {
  if (!ids?.length) return '<p class="muted">Fotoğraf yok.</p>';
  return `<div class="thumbs gallery">${ids.map((id) => `<div class="thumb" data-photo="${id}"><img alt="Fotoğraf" /></div>`).join('')}</div>`;
}

/* =========================================================================
   Görünümler
   ========================================================================= */

function viewDashboard() {
  const sites = sitesAll();
  if (!sites.length) {
    return `<div class="page-head"><div class="titles"><h1>Hoş geldiniz</h1>
      <p>Her şantiyenin panolarını, sigortalarını, kontrollerini ve LOTO kilitlerini tek yerde kayıt altında tutun.</p></div></div>
      ${emptyState(
        'Henüz kayıt yok',
        'Bir şantiye ekleyerek başlayın ya da sistemi örnek veriyle deneyin. Veriler yalnızca bu cihazda saklanır; <b>Ayarlar → Yedek</b> ile dışa aktarıp başka cihaza taşıyabilirsiniz.',
        '<button class="btn primary" data-act="new-site">+ Şantiye ekle</button><button class="btn" data-act="demo">Örnek veriyle dene</button><a class="btn" href="#/ayarlar">Yedekten yükle</a>'
      )}`;
  }
  const active = sites.filter((s) => s.status !== 'Tamamlandı');
  const activeIds = new Set(active.map((s) => s.id));
  const panels = S.all('panels').filter((p) => activeIds.has(p.siteId) && isLive(p));
  const panelIds = new Set(panels.map((p) => p.id));
  const circuits = S.all('circuits').filter((c) => panelIds.has(c.panelId));
  const issues = allIssues();
  const errs = issues.filter((i) => i.level === 'err');
  const loto = circuits.filter((c) => c.status === 'Kilitli (LOTO)');
  const due = panels.map((p) => ({ p, d: R.inspectionDue(lastInspectionDate(p.id), intervalFor(p)) }));
  const overdue = due.filter((x) => x.d.state === 'overdue' || x.d.state === 'never');
  const schedule = due
    .filter((x) => x.d.state !== 'ok')
    .sort((a, b) => ({ never: 0, overdue: 1, soon: 2 })[a.d.state] - ({ never: 0, overdue: 1, soon: 2 })[b.d.state] || (b.d.days || 0) - (a.d.days || 0));
  const recentEvents = eventsOf((e) => activeIds.has(e.siteId)).slice(0, 6);

  return `
  <div class="page-head"><div class="titles"><h1>Özet</h1><p>${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
    <div class="actions"><button class="btn" data-act="new-event">⚡ Olay kaydet</button><button class="btn" data-act="new-inspection">✓ Kontrol kaydet</button><button class="btn primary" data-act="new-site">+ Şantiye</button></div></div>
  <div class="kpis">
    <a class="kpi" href="#/santiyeler"><div class="v">${active.length}</div><div class="l">Aktif şantiye</div></a>
    <a class="kpi" href="#/santiyeler"><div class="v">${panels.length}</div><div class="l">Devredeki pano</div></a>
    <div class="kpi"><div class="v">${circuits.filter((c) => c.status === 'Aktif').length}<span class="muted" style="font-size:15px"> / ${circuits.length}</span></div><div class="l">Aktif / toplam devre</div></div>
    <a class="kpi ${errs.length ? 'err' : ''}" href="#/uyarilar"><div class="v">${errs.length}</div><div class="l">Kayıt hatası</div></a>
    <a class="kpi ${overdue.length ? 'warn' : ''}" href="#/kontroller"><div class="v">${overdue.length}</div><div class="l">Geciken / yapılmamış kontrol</div></a>
    <a class="kpi ${loto.length ? 'warn' : ''}" href="#/loto"><div class="v">${loto.length}</div><div class="l">LOTO kilitli devre</div></a>
  </div>
  <div class="grid cols-2">
    <section class="card"><div class="card-head"><h2>Öncelikli uyarılar</h2><a href="#/uyarilar" class="small">Tümü</a></div>${issueList(issues.filter((i) => i.level !== 'info'), { limit: 8 })}</section>
    <section class="card"><div class="card-head"><h2>Kontrol takvimi</h2><a href="#/kontroller" class="small">Tümü</a></div>
      ${schedule.length ? `<ul class="list">${schedule.slice(0, 8).map(({ p }) => `<li><div class="grow"><a href="#/pano/${p.id}?tab=kontroller"><b>${esc(p.code)}</b> ${esc(p.name || '')}</a><div class="meta">${esc(S.get('sites', p.siteId)?.name)} · her ${intervalFor(p)} günde</div></div>${inspectionStateBadge(p)}</li>`).join('')}</ul>` : '<p class="muted">Tüm panoların kontrolü güncel.</p>'}
    </section>
    <section class="card"><div class="card-head"><h2>Son olaylar</h2></div>
      ${recentEvents.length ? `<ul class="list">${recentEvents.map(eventRow).join('')}</ul>` : '<p class="muted">Olay kaydı yok.</p>'}</section>
    <section class="card"><div class="card-head"><h2>Son değişiklikler</h2></div>${auditList(S.auditLog().slice(-8).reverse())}</section>
  </div>
  <h2 style="margin:22px 0 12px">Şantiyeler</h2>
  <div class="grid cards">${sites.filter((s) => s.status !== 'Tamamlandı').map(siteCard).join('')}</div>`;
}

function eventRow(e) {
  const p = S.get('panels', e.panelId);
  const c = e.circuitId && S.get('circuits', e.circuitId);
  const cls = { 'Sigorta attı': 'warn', Arıza: 'err', 'LOTO kilitleme': 'warn', 'LOTO açma': 'ok' }[e.type] || '';
  return `<li><div class="grow"><span class="badge ${cls}">${esc(e.type)}</span> ${esc(e.description)}
    <div class="meta">${fmtDateTime(e.date)} · <a href="#/pano/${p?.id}?tab=olaylar">${esc(p?.code || '?')}${c ? ' / ' + esc(c.code) : ''}</a>${e.by ? ' · ' + esc(e.by) : ''}</div></div>
    <button class="btn sm" data-act="open-event" data-id="${e.id}">Aç</button></li>`;
}

function siteCard(s) {
  const panels = panelsOf(s.id);
  const circuits = S.where('circuits', (c) => c.siteId === s.id);
  const issues = s.status === 'Tamamlandı' ? [] : panels.filter(isLive).flatMap((p) => panelIssues(p));
  return `<a class="card site-card" href="#/santiye/${s.id}">
    <div class="row"><div><h3>${esc(s.name)}</h3><div class="small muted">${esc(s.code || '')}${s.address ? ' · ' + esc(s.address) : ''}</div></div>${statusBadge(s.status)}</div>
    <div class="mini-stats"><div><b>${panels.length}</b>pano</div><div><b>${circuits.length}</b>devre</div><div><b>${circuits.filter((c) => c.status === 'Kilitli (LOTO)').length}</b>LOTO</div></div>
    <div class="chips">${s.status === 'Tamamlandı' ? '<span class="badge">Arşiv</span>' : issueCountBadges(issues)}</div></a>`;
}

function viewSites(q) {
  const filter = q.get('durum') || 'Aktif';
  const sites = sitesAll().filter((s) => filter === 'Tümü' || s.status === filter);
  return `
  <div class="page-head"><div class="titles"><h1>Şantiyeler</h1><p>${sitesAll().length} şantiye kayıtlı.</p></div>
    <div class="actions"><button class="btn primary" data-act="new-site">+ Şantiye</button></div></div>
  <nav class="tabs">${['Aktif', 'Askıda', 'Tamamlandı', 'Tümü'].map((s) => `<a href="#/santiyeler?durum=${s}" class="${filter === s ? 'active' : ''}">${s} <span class="badge">${s === 'Tümü' ? sitesAll().length : sitesAll().filter((x) => x.status === s).length}</span></a>`).join('')}</nav>
  ${sites.length ? `<div class="grid cards">${sites.map(siteCard).join('')}</div>` : emptyState('Bu durumda şantiye yok', '', '<button class="btn primary" data-act="new-site">+ Şantiye ekle</button>')}`;
}

function panelTree(siteId) {
  const panels = panelsOf(siteId);
  if (!panels.length) return emptyState('Bu şantiyede pano yok', 'Şantiye ana panosuyla başlayın; tali panoları onu “besleyen pano” seçerek bağlayın.', `<button class="btn primary" data-act="new-panel" data-site="${siteId}">+ Pano ekle</button>`);
  const ids = new Set(panels.map((p) => p.id));
  const children = (pid) => panels.filter((p) => (pid ? p.parentPanelId === pid : !p.parentPanelId || !ids.has(p.parentPanelId)));
  const node = (p) => {
    const issues = isLive(p) ? panelIssues(p) : [];
    const feeder = p.parentCircuitId && S.get('circuits', p.parentCircuitId);
    const cs = circuitsOf(p.id);
    const kids = children(p.id);
    return `<li><a class="tree-node" href="#/pano/${p.id}">
        <span class="code">${esc(p.code)}</span>
        <span class="grow">${esc(p.name || p.type || '')}<div class="feed-note">${esc(p.location || '')}${feeder ? ` · ${esc(feeder.code)} (${esc(R.deviceShort(feeder))}) üzerinden` : ''}</div></span>
        <span class="small muted">${cs.length} devre${p.mainRating ? ` · ${esc(p.mainRating)} A` : ''}</span>
        ${statusBadge(p.status)} ${isLive(p) ? inspectionStateBadge(p) + issueCountBadges(issues) : ''}
      </a>${kids.length ? `<ul>${kids.map(node).join('')}</ul>` : ''}</li>`;
  };
  return `<ul class="tree">${children(null).map(node).join('')}</ul>`;
}

function viewSite(id, q) {
  const s = S.get('sites', id);
  if (!s) return notFound();
  const tab = q.get('tab') || 'panolar';
  const panels = panelsOf(id);
  const circuits = S.where('circuits', (c) => c.siteId === id).sort((a, b) => R.naturalCompare(S.get('panels', a.panelId)?.code, S.get('panels', b.panelId)?.code) || R.naturalCompare(a.code, b.code));
  const insp = S.where('inspections', (x) => x.siteId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const events = eventsOf((e) => e.siteId === id);
  const base = `#/santiye/${id}`;
  let body = '';
  if (tab === 'panolar') body = panelTree(id);
  if (tab === 'devreler') body = circuits.length ? circuitToolbar('site-circuits') + circuitTable(circuits, { showPanel: true, id: 'site-circuits' }) : emptyState('Devre yok', 'Panolara devre ekledikçe burada listelenir.');
  if (tab === 'kontroller') body = inspectionTable(insp);
  if (tab === 'olaylar') body = events.length ? `<div class="card"><ul class="list">${events.map(eventRow).join('')}</ul></div>` : emptyState('Olay kaydı yok', 'Sigorta atması, arıza, değişim ve LOTO hareketleri burada birikir.');
  if (tab === 'bilgi') {
    body = `<div class="card"><dl class="spec">
      ${[['Adres', s.address], ['İşveren', s.client], ['Elektrik yüklenicisi', s.contractor], ['Şantiye şefi', s.siteChief], ['Elektrik sorumlusu', s.electricalLead], ['Telefon', s.phone], ['Başlangıç', s.startDate && fmtDate(s.startDate)], ['Bitiş', s.endDate && fmtDate(s.endDate)], ['Abone / sayaç', s.utilityNo], ['Trafo', s.transformerKva && s.transformerKva + ' kVA'], ['Sözleşme gücü', s.contractKw && s.contractKw + ' kW']]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${val(v)}</dd></div>`)
        .join('')}</dl>${s.notes ? `<p style="white-space:pre-wrap;margin-top:14px">${esc(s.notes)}</p>` : ''}</div>
      <div class="card"><h3 style="margin-bottom:10px">Fotoğraflar</h3>${photoGallery(s.photos)}</div>`;
  }
  if (tab === 'gecmis') body = `<div class="card">${auditList(S.auditLog((a) => a.siteId === id || a.recId === id).reverse().slice(0, 200))}</div>`;
  const totalKw = circuits.filter((c) => c.status === 'Aktif' && !S.get('panels', c.panelId)?.parentPanelId).reduce((n, c) => n + num(c.loadKw), 0);
  return `
  <div class="page-head"><div class="titles"><div class="crumbs"><a href="#/santiyeler">Şantiyeler</a></div>
    <h1>${esc(s.name)} ${statusBadge(s.status)}</h1><p>${esc(s.code || '')}${s.address ? ' · ' + esc(s.address) : ''}</p></div>
    <div class="actions">
      <button class="btn" data-act="edit-site" data-id="${id}">Düzenle</button>
      <button class="btn" data-act="csv-site" data-id="${id}">CSV</button>
      <button class="btn primary" data-act="new-panel" data-site="${id}">+ Pano</button>
    </div></div>
  <div class="kpis">
    <div class="kpi"><div class="v">${panels.length}</div><div class="l">Pano</div></div>
    <div class="kpi"><div class="v">${circuits.length}</div><div class="l">Devre</div></div>
    <div class="kpi"><div class="v">${Math.round(totalKw * 10) / 10}</div><div class="l">Ana panolardaki yük (kW)</div></div>
    <div class="kpi ${circuits.some((c) => c.status === 'Kilitli (LOTO)') ? 'warn' : ''}"><div class="v">${circuits.filter((c) => c.status === 'Kilitli (LOTO)').length}</div><div class="l">LOTO</div></div>
  </div>
  ${tabs(base, tab, [
    ['panolar', 'Pano ağacı', `<span class="badge">${panels.length}</span>`],
    ['devreler', 'Tüm devreler', `<span class="badge">${circuits.length}</span>`],
    ['kontroller', 'Kontroller', `<span class="badge">${insp.length}</span>`],
    ['olaylar', 'Olaylar', `<span class="badge">${events.length}</span>`],
    ['bilgi', 'Bilgiler'],
    ['gecmis', 'Geçmiş']
  ])}
  ${body}`;
}

function inspectionTable(list) {
  if (!list.length) return emptyState('Kontrol kaydı yok', 'Görsel kontrol, RCD testi, topraklama ve izolasyon ölçümlerini kaydedin; sistem bir sonraki kontrol tarihini takip eder.', '<button class="btn primary" data-act="new-inspection">+ Kontrol kaydet</button>');
  return `<div class="table-wrap"><table class="data"><thead><tr><th>Tarih</th><th>Pano</th><th>Tür</th><th>Sonuç</th><th>Ölçümler</th><th>Kontrol eden</th></tr></thead><tbody>
    ${list
      .map((x) => {
        const p = S.get('panels', x.panelId);
        const m = [
          x.earthOhm !== '' && x.earthOhm != null && `RA ${x.earthOhm} Ω`,
          x.insulationMohm !== '' && x.insulationMohm != null && `Riso ${x.insulationMohm} MΩ`,
          x.loopOhm !== '' && x.loopOhm != null && `Zs ${x.loopOhm} Ω`,
          x.rcdTripMs !== '' && x.rcdTripMs != null && `RCD ${x.rcdTripMs} ms`,
          x.rcdTripMa !== '' && x.rcdTripMa != null && `IΔ ${x.rcdTripMa} mA`,
          x.maxTempC !== '' && x.maxTempC != null && `${x.maxTempC} °C`
        ].filter(Boolean);
        return `<tr class="clickable" data-act="open-inspection" data-id="${x.id}"><td class="nowrap">${fmtDate(x.date)}</td><td class="nowrap"><b>${esc(p?.code)}</b></td><td>${esc(x.type)}${x.notes ? `<div class="small muted">${esc(x.notes)}</div>` : ''}</td><td>${statusBadge(x.result)}</td><td class="small">${m.join(' · ') || '<span class="muted">—</span>'}</td><td>${val(x.by)}</td></tr>`;
      })
      .join('')}</tbody></table></div>`;
}

function railView(panel, circuits) {
  const perRow = Math.max(4, num(panel.modulesPerRow) || 18);
  const ordered = [];
  const rcdKids = new Map();
  for (const c of circuits) if (c.protectedBy && circuits.some((x) => x.id === c.protectedBy)) {
    if (!rcdKids.has(c.protectedBy)) rcdKids.set(c.protectedBy, []);
    rcdKids.get(c.protectedBy).push(c);
  }
  for (const c of circuits) {
    if (c.protectedBy && rcdKids.has(c.protectedBy)) continue;
    ordered.push(c);
    if (rcdKids.has(c.id)) ordered.push(...rcdKids.get(c.id));
  }
  const rows = [[]];
  let used = 0;
  for (const c of ordered) {
    const w = Math.min(perRow, R.moduleWidth(c));
    if (used + w > perRow) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(c);
    used += w;
  }
  const declared = Math.max(1, num(panel.rows) || 1);
  while (rows.length < declared) rows.push([]);
  const over = rows.length > declared;
  const html = rows
    .map((row, ri) => {
      const usedM = row.reduce((n, c) => n + Math.min(perRow, R.moduleWidth(c)), 0);
      const devs = row
        .map((c) => {
          const issues = circuitIssues(c, panel);
          const lvl = issues.some((i) => i.level === 'err') ? 'err' : issues.some((i) => i.level === 'warn') ? 'warn' : '';
          const cls = [
            c.status === 'Yedek' && 'spare',
            c.status === 'Kapalı' && 'off',
            c.status === 'Arızalı' && 'fault',
            c.status === 'Kilitli (LOTO)' && 'loto',
            R.RCD_DEVICES.has(c.device) && 'rcd'
          ].filter(Boolean).join(' ');
          const tip = `${c.code} — ${R.deviceShort(c)}\n${c.label || ''}\n${c.status}${issues.length ? '\n\n' + issues.map((i) => '• ' + i.msg).join('\n') : ''}`;
          return `<button type="button" class="dev ${cls}" style="--w:${Math.min(perRow, R.moduleWidth(c))}" data-act="open-circuit" data-id="${c.id}" title="${esc(tip)}">
            ${lvl ? `<span class="issue-pin ${lvl}"></span>` : ''}
            <span class="dcode">${esc(c.code)}</span><span class="lever"></span>
            <span class="dval">${esc(c.curve && !['gG', 'aM'].includes(c.curve) && R.PROTECTIVE.has(c.device) ? c.curve : '')}${esc(c.rating || '')}</span>
            <span class="dlbl">${esc(c.status === 'Kilitli (LOTO)' ? '🔒 ' : '')}${esc(c.label || (c.status === 'Yedek' ? 'yedek' : ''))}</span></button>`;
        })
        .join('');
      const blanks = Array.from({ length: Math.max(0, perRow - usedM) }, () => '<span class="blank"></span>').join('');
      return `<div class="rail-label">Sıra ${ri + 1} · ${usedM}/${perRow} modül${ri >= declared ? ' · <b style="color:var(--err)">tanımlı ray sayısını aşıyor</b>' : ''}</div><div class="rail-row"><div class="rail">${devs}${blanks}</div></div>`;
    })
    .join('');
  const totalUsed = circuits.reduce((n, c) => n + R.moduleWidth(c), 0);
  return `<div class="card">
    <div class="card-head"><h3>Pano önden görünüm</h3><span class="small muted">${totalUsed} modül dolu · ${declared}×${perRow} kapasite</span></div>
    ${over ? '<div class="notice warn" style="margin-bottom:10px">Cihazlar tanımlı ray kapasitesine sığmıyor. Pano bilgilerinden ray sırası / modül sayısını güncelleyin.</div>' : ''}
    <div class="enclosure">${html}</div>
    <div class="legend"><span><i style="background:var(--ok)"></i>Aktif</span><span><i style="background:var(--warn)"></i>LOTO</span><span><i style="background:var(--err)"></i>Arızalı</span><span><i style="background:var(--muted)"></i>Kapalı</span><span><i style="border:1px dashed var(--muted)"></i>Yedek</span><span><i style="background:var(--info-soft);border:1px solid var(--info)"></i>Kaçak akım cihazı</span><span>Kaçak akıma bağlı devreler rölenin hemen sağında gösterilir.</span></div>
  </div>`;
}

function loadView(panel, circuits) {
  const loads = R.phaseLoads(circuits);
  const imb = R.phaseImbalance(loads);
  const cos = num(S.settings().defaultCosphi) || 0.9;
  const amps = { L1: R.loadCurrent(loads.L1, false, cos), L2: R.loadCurrent(loads.L2, false, cos), L3: R.loadCurrent(loads.L3, false, cos) };
  const main = num(panel.mainRating);
  const scale = Math.max(main || 0, amps.L1, amps.L2, amps.L3, 1) * 1.1;
  const total = loads.L1 + loads.L2 + loads.L3 + loads.unassigned;
  const suggestion = R.suggestPhase(circuits);
  const single = circuits.filter((c) => !R.isThreePhase(c) && c.status === 'Aktif' && num(c.loadKw) > 0);
  return `<div class="grid cols-2">
    <div class="card"><div class="card-head"><h3>Faz yükleri</h3>${imb > 30 ? `<span class="badge err">Dengesizlik %${imb}</span>` : imb > 15 ? `<span class="badge warn">Dengesizlik %${imb}</span>` : `<span class="badge ok">Dengesizlik %${imb}</span>`}</div>
      <div class="phase-bars">${['L1', 'L2', 'L3']
        .map((ph) => `<div class="pbar"><span class="ph ${ph}">${ph}</span><div class="track" role="img" aria-label="${ph} ${amps[ph].toFixed(1)} amper">
          <div class="fill ${ph}" style="width:${(amps[ph] / scale) * 100}%"></div>${main ? `<span class="limit" style="left:${(main / scale) * 100}%" title="Giriş ${main} A"></span>` : ''}</div>
          <span class="val"><b>${amps[ph].toFixed(1)} A</b> · ${loads[ph]} kW</span></div>`)
        .join('')}</div>
      <p class="small muted" style="margin-top:12px">Akım = kW / (230 V × cos φ ${cos}); eş zamanlılık katsayısı uygulanmamıştır (en kötü durum). ${main ? `Kırmızı çizgi: giriş şalteri ${main} A.` : 'Giriş şalteri girilirse sınır çizgisi gösterilir.'}</p>
      ${loads.unassigned ? `<div class="notice warn">${loads.unassigned} kW tek fazlı yük faza atanmamış.</div>` : ''}
    </div>
    <div class="card"><h3 style="margin-bottom:10px">Özet</h3><dl class="spec">
      <div><dt>Toplam kurulu yük</dt><dd>${Math.round(total * 100) / 100} kW</dd></div>
      <div><dt>Giriş şalteri</dt><dd>${val(panel.mainRating, 'A')}</dd></div>
      <div><dt>En az yüklü faz</dt><dd><span class="ph ${suggestion}">${suggestion}</span> — yeni tek fazlı devre için önerilir</dd></div>
      <div><dt>3 fazlı devre</dt><dd>${circuits.filter(R.isThreePhase).length}</dd></div>
    </dl>
    <h3 style="margin:16px 0 8px">Tek fazlı yükler</h3>
    ${single.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>No</th><th>Yer</th><th>Faz</th><th class="num">kW</th></tr></thead><tbody>${single.sort((a, b) => num(b.loadKw) - num(a.loadKw)).map((c) => `<tr class="clickable" data-act="open-circuit" data-id="${c.id}"><td><b class="mono">${esc(c.code)}</b></td><td>${val(c.label)}</td><td>${phaseTag(c)}</td><td class="num">${esc(c.loadKw)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Yük girilmiş tek fazlı devre yok.</p>'}
    </div></div>`;
}

function viewPanel(id, q) {
  const p = S.get('panels', id);
  if (!p) return notFound();
  const s = S.get('sites', p.siteId);
  const tab = q.get('tab') || 'devreler';
  const circuits = circuitsOf(id);
  const issues = panelIssues(p);
  const insp = inspectionsOf(id);
  const events = eventsOf((e) => e.panelId === id);
  const parent = p.parentPanelId && S.get('panels', p.parentPanelId);
  const feeder = p.parentCircuitId && S.get('circuits', p.parentCircuitId);
  const kids = S.where('panels', (x) => x.parentPanelId === id);
  const base = `#/pano/${id}`;
  let body = '';
  if (tab === 'devreler') {
    body = circuits.length
      ? circuitToolbar('panel-circuits') + circuitTable(circuits, { id: 'panel-circuits' })
      : emptyState('Bu panoda devre yok', 'Devreleri tek tek ya da toplu olarak ekleyin. Her devre için cihaz, kablo ve beslediği yer kaydedilir.', `<button class="btn primary" data-act="new-circuit" data-panel="${id}">+ Devre</button><button class="btn" data-act="bulk" data-panel="${id}">Toplu ekle</button>`);
  }
  if (tab === 'gorunum') body = railView(p, circuits);
  if (tab === 'yuk') body = loadView(p, circuits);
  if (tab === 'kontroller') body = `<div class="toolbar"><button class="btn primary" data-act="new-inspection" data-panel="${id}">+ Kontrol</button><span class="muted small">Kontrol aralığı: ${intervalFor(p)} gün · ${inspectionStateBadge(p)}</span></div>${inspectionTable(insp)}`;
  if (tab === 'olaylar') body = `<div class="toolbar"><button class="btn primary" data-act="new-event" data-panel="${id}">+ Olay</button></div>${events.length ? `<div class="card"><ul class="list">${events.map(eventRow).join('')}</ul></div>` : emptyState('Olay kaydı yok', 'Devre tablosundaki ⚡ düğmesiyle sigorta atmalarını tek dokunuşla kaydedebilirsiniz.')}`;
  if (tab === 'uyarilar') body = `<div class="card">${issueList(issues, { link: true })}</div><p class="small muted" style="margin-top:10px">Bu denetimler kayıt hatalarını yakalamak içindir; proje hesabının, seçicilik etüdünün ve yetkili kişinin periyodik kontrolünün yerini tutmaz. Kablo kapasiteleri bakır/PVC, döşeme yöntemi C, 30 °C değerleridir; düzeltme faktörü uygulanmaz.</p>`;
  if (tab === 'bilgi') {
    body = `<div class="grid cols-2"><div class="card"><dl class="spec">
      ${[['Tür', p.type], ['Konum', p.location], ['Gerilim', p.voltage], ['Topraklama', p.earthingSystem], ['Koruma sınıfı', p.ipClass], ['Giriş cihazı', p.mainDevice], ['Giriş anma', p.mainRating && p.mainRating + ' A'], ['Giriş kaçak akım', p.mainRcdMa && p.mainRcdMa + ' mA'], ['Kısa devre seviyesi', p.shortCircuitKa && p.shortCircuitKa + ' kA'], ['Besleme kablosu', p.feedCable], ['İmalatçı', p.manufacturer], ['Ray', `${p.rows || 1} × ${p.modulesPerRow || 18} modül`], ['Sorumlu', p.responsible], ['Kontrol aralığı', intervalFor(p) + ' gün'], ['Oluşturan', p.createdBy], ['Son güncelleme', fmtDateTime(p.updatedAt)]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${val(v)}</dd></div>`)
        .join('')}</dl>${p.notes ? `<p style="white-space:pre-wrap;margin-top:14px">${esc(p.notes)}</p>` : ''}</div>
      <div class="card"><h3>QR etiket</h3><p class="small muted">Pano kapağına yapıştırın. Okutulduğunda bu cihazda (veya aynı yedeğin yüklendiği cihazda) panoyu açar.</p><div class="qr" data-qr="${esc(panelUrl(p))}"></div><p class="small mono" style="overflow-wrap:anywhere">${esc(panelUrl(p))}</p></div></div>
      <div class="card"><h3 style="margin-bottom:10px">Fotoğraflar</h3>${photoGallery(p.photos)}</div>`;
  }
  if (tab === 'gecmis') body = `<div class="card">${auditList(S.auditLog((a) => a.panelId === id).reverse().slice(0, 300))}</div>`;

  const errs = issues.filter((i) => i.level === 'err').length;
  const warns = issues.filter((i) => i.level === 'warn').length;
  return `
  <div class="page-head"><div class="titles">
    <div class="crumbs"><a href="#/santiyeler">Şantiyeler</a> › <a href="#/santiye/${s?.id}">${esc(s?.name || '?')}</a>${parent ? ` › <a href="#/pano/${parent.id}">${esc(parent.code)}</a>` : ''}</div>
    <h1><span class="mono">${esc(p.code)}</span> ${esc(p.name || '')} ${statusBadge(p.status)}</h1>
    <p>${esc(p.type || '')}${p.location ? ' · ' + esc(p.location) : ''}</p>
    <div class="chips" style="margin-top:8px">
      ${p.mainRating ? `<span class="badge">Giriş ${esc(p.mainDevice || '')} ${esc(p.mainRating)} A</span>` : ''}
      ${p.mainRcdMa ? `<span class="badge info">${esc(p.mainRcdMa)} mA giriş RCD</span>` : ''}
      ${p.earthingSystem ? `<span class="badge">${esc(p.earthingSystem)}</span>` : ''}
      ${p.ipClass ? `<span class="badge">${esc(p.ipClass)}</span>` : ''}
      ${feeder ? `<span class="badge">Besleme: ${esc(parent?.code)} / ${esc(feeder.code)} ${esc(R.deviceShort(feeder))}</span>` : parent ? `<span class="badge">Besleme: ${esc(parent.code)}</span>` : ''}
      ${kids.length ? `<span class="badge">Beslediği: ${kids.map((k) => esc(k.code)).join(', ')}</span>` : ''}
      ${inspectionStateBadge(p)}
    </div></div>
    <div class="actions">
      <button class="btn" data-act="edit-panel" data-id="${id}">Düzenle</button>
      <a class="btn" href="#/yazdir/${id}">🖨 Etiket / liste</a>
      <button class="btn" data-act="dup-panel" data-id="${id}">Kopyala</button>
      <button class="btn" data-act="csv-panel" data-id="${id}">CSV</button>
      <button class="btn" data-act="bulk" data-panel="${id}">Toplu ekle</button>
      <button class="btn primary" data-act="new-circuit" data-panel="${id}">+ Devre</button>
    </div></div>
  ${tabs(base, tab, [
    ['devreler', 'Devreler', `<span class="badge">${circuits.length}</span>`],
    ['gorunum', 'Pano görünümü'],
    ['yuk', 'Yük ve faz'],
    ['uyarilar', 'Uyarılar', errs ? `<span class="badge err">${errs}</span>` : warns ? `<span class="badge warn">${warns}</span>` : ''],
    ['kontroller', 'Kontroller', `<span class="badge">${insp.length}</span>`],
    ['olaylar', 'Olaylar', `<span class="badge">${events.length}</span>`],
    ['bilgi', 'Bilgi ve QR'],
    ['gecmis', 'Geçmiş']
  ])}
  ${body}`;
}

function panelUrl(p) {
  return `${location.origin}${location.pathname}#/pano/${p.id}`;
}

function viewAlerts(q) {
  const level = q.get('seviye') || '';
  const siteId = q.get('santiye') || '';
  let issues = allIssues();
  const counts = { err: 0, warn: 0, info: 0 };
  for (const i of issues) counts[i.level]++;
  if (level) issues = issues.filter((i) => i.level === level);
  if (siteId) issues = issues.filter((i) => i.site?.id === siteId);
  const href = (patch) => {
    const p = new URLSearchParams({ seviye: level, santiye: siteId, ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `#/uyarilar?${p}`;
  };
  return `
  <div class="page-head"><div class="titles"><h1>Uyarılar</h1><p>Devredeki panolar ve devreleri üzerinde otomatik kayıt denetimleri. Tamamlanan şantiyeler ve devre dışı panolar hariçtir.</p></div></div>
  <nav class="tabs">
    <a href="${href({ seviye: '' })}" class="${!level ? 'active' : ''}">Tümü <span class="badge">${counts.err + counts.warn + counts.info}</span></a>
    <a href="${href({ seviye: 'err' })}" class="${level === 'err' ? 'active' : ''}">Hata <span class="badge err">${counts.err}</span></a>
    <a href="${href({ seviye: 'warn' })}" class="${level === 'warn' ? 'active' : ''}">Uyarı <span class="badge warn">${counts.warn}</span></a>
    <a href="${href({ seviye: 'info' })}" class="${level === 'info' ? 'active' : ''}">Bilgi <span class="badge info">${counts.info}</span></a>
  </nav>
  <div class="toolbar"><select data-nav-select>
    <option value="${href({ santiye: '' })}">Tüm şantiyeler</option>
    ${sitesAll().filter((s) => s.status !== 'Tamamlandı').map((s) => `<option value="${href({ santiye: s.id })}"${s.id === siteId ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}
  </select></div>
  <div class="card">${issueList(issues)}</div>
  <p class="small muted" style="margin-top:10px">Denetimler: kablo kesiti–sigorta uyumu, yük akımı, kesme kapasitesi–kısa devre seviyesi, priz/ıslak hacim/seyyar devrelerde ≤30 mA kaçak akım, faz dengesi, giriş şalteri kullanımı, üst–alt pano seçiciliği, mükerrer devre numarası, kontrol tarihleri ve LOTO sahibi. Proje hesabının yerini tutmaz.</p>`;
}

function viewInspections() {
  const panels = S.all('panels').filter((p) => isLive(p) && S.get('sites', p.siteId)?.status !== 'Tamamlandı');
  const rows = panels
    .map((p) => ({ p, d: R.inspectionDue(lastInspectionDate(p.id), intervalFor(p)) }))
    .sort((a, b) => ({ never: 0, overdue: 1, soon: 2, ok: 3 })[a.d.state] - ({ never: 0, overdue: 1, soon: 2, ok: 3 })[b.d.state] || (a.d.next || 0) - (b.d.next || 0));
  const all = S.all('inspections').slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `
  <div class="page-head"><div class="titles"><h1>Kontroller</h1><p>Panoların kontrol takvimi ve tüm kontrol kayıtları.</p></div>
    <div class="actions"><button class="btn" data-act="csv-inspections">CSV</button><button class="btn primary" data-act="new-inspection">+ Kontrol kaydet</button></div></div>
  <section class="card"><div class="card-head"><h2>Takvim</h2><span class="small muted">Varsayılan aralık ${S.settings().inspectionIntervalDays} gün (Ayarlar). Pano bazında değiştirilebilir.</span></div>
    ${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Pano</th><th>Şantiye</th><th>Son kontrol</th><th>Aralık</th><th>Durum</th><th></th></tr></thead><tbody>
    ${rows.map(({ p }) => `<tr><td><a href="#/pano/${p.id}?tab=kontroller"><b>${esc(p.code)}</b> ${esc(p.name || '')}</a></td><td>${esc(S.get('sites', p.siteId)?.name)}</td><td>${fmtDate(lastInspectionDate(p.id))}</td><td>${intervalFor(p)} gün</td><td>${inspectionStateBadge(p)}</td><td><button class="btn sm" data-act="new-inspection" data-panel="${p.id}">+ Kontrol</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">Devrede pano yok.</p>'}</section>
  <section style="margin-top:16px"><h2 style="margin-bottom:10px">Kayıtlar</h2>${inspectionTable(all)}</section>`;
}

function viewLoto() {
  const list = S.where('circuits', (c) => c.status === 'Kilitli (LOTO)').sort((a, b) => (a.lotoAt || '').localeCompare(b.lotoAt || ''));
  const history = eventsOf((e) => e.type?.startsWith('LOTO')).slice(0, 40);
  return `
  <div class="page-head"><div class="titles"><h1>LOTO — kilitli devreler</h1><p>Üzerinde çalışma yapılan ya da güvenlik nedeniyle enerjisi kesilip kilitlenen devreler. Kilidi yalnızca takan kişi kaldırmalıdır.</p></div></div>
  ${list.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Şantiye / pano</th><th>Devre</th><th>Kilidi takan</th><th>Neden</th><th>Ne zamandan beri</th><th></th></tr></thead><tbody>
  ${list.map((c) => {
    const p = S.get('panels', c.panelId);
    return `<tr><td>${esc(S.get('sites', c.siteId)?.code || '')} / <a href="#/pano/${p?.id}"><b>${esc(p?.code)}</b></a></td><td><b class="mono">${esc(c.code)}</b> ${esc(c.label || '')}<div class="small muted">${esc(R.deviceShort(c))}</div></td><td>${val(c.lotoBy)}</td><td>${val(c.lotoNote)}</td><td class="nowrap">${fmtDateTime(c.lotoAt)}</td><td><button class="btn sm" data-act="loto" data-id="${c.id}">🔓 Kilidi aç</button></td></tr>`;
  }).join('')}</tbody></table></div>` : emptyState('Kilitli devre yok', 'Bir devreyi kilitlemek için devre tablosundaki 🔒 düğmesini kullanın.')}
  <section class="card" style="margin-top:16px"><h2 style="margin-bottom:8px">LOTO geçmişi</h2>${history.length ? `<ul class="list">${history.map(eventRow).join('')}</ul>` : '<p class="muted">Kayıt yok.</p>'}</section>`;
}

function viewSearch(q) {
  const term = (q.get('q') || '').toLocaleLowerCase('tr').trim();
  if (!term) return `<h1>Arama</h1><p class="muted">Üstteki arama kutusunu kullanın.</p>`;
  const has = (...xs) => xs.join(' ').toLocaleLowerCase('tr').includes(term);
  const sites = sitesAll().filter((s) => has(s.name, s.code, s.address, s.client));
  const panels = S.all('panels').filter((p) => has(p.code, p.name, p.location, p.type, p.notes));
  const circuits = S.all('circuits').filter((c) => has(c.code, c.label, c.location, c.loadKind, R.deviceShort(c), c.cableType, c.notes, c.brand));
  return `
  <div class="page-head"><div class="titles"><h1>“${esc(q.get('q'))}” için sonuçlar</h1><p>${sites.length + panels.length + circuits.length} sonuç</p></div></div>
  ${sites.length ? `<h2 style="margin-bottom:10px">Şantiyeler</h2><div class="grid cards" style="margin-bottom:18px">${sites.map(siteCard).join('')}</div>` : ''}
  ${panels.length ? `<h2 style="margin-bottom:10px">Panolar</h2><div class="card" style="margin-bottom:18px"><ul class="list">${panels.map((p) => `<li><div class="grow"><a href="#/pano/${p.id}"><b>${esc(p.code)}</b> ${esc(p.name || '')}</a><div class="meta">${esc(S.get('sites', p.siteId)?.name)} · ${esc(p.location || '')}</div></div>${statusBadge(p.status)}</li>`).join('')}</ul></div>` : ''}
  ${circuits.length ? `<h2 style="margin-bottom:10px">Devreler</h2>${circuitTable(circuits.slice(0, 300), { showPanel: true, id: 'search-circuits' })}` : ''}
  ${!sites.length && !panels.length && !circuits.length ? emptyState('Sonuç yok', 'Pano kodu, devre numarası, mahal, kablo tipi veya cihaz (ör. “C16”, “RCBO”) ile arayın.') : ''}`;
}

function viewSettings() {
  const st = S.settings();
  const kb = Math.round(S.storageUsage() / 1024);
  const theme = document.documentElement.dataset.theme || 'auto';
  return `
  <div class="page-head"><div class="titles"><h1>Ayarlar</h1><p>Bu cihazdaki tercihler, yedekleme ve veri yönetimi.</p></div></div>
  <div class="grid cols-2">
  <section class="card"><h2 style="margin-bottom:12px">Genel</h2>
    <form class="form-grid" id="settings-form">
      <div class="field w6"><label for="s_user">Kullanıcı adı</label><input id="s_user" name="userName" value="${esc(st.userName)}" placeholder="Ad Soyad" /><span class="help">Değişiklik geçmişine, kontrol ve olay kayıtlarına işlenir.</span></div>
      <div class="field w2"><label for="s_int">Kontrol aralığı (gün)</label><input id="s_int" name="inspectionIntervalDays" type="number" min="1" value="${esc(st.inspectionIntervalDays)}" /></div>
      <div class="field w2"><label for="s_cos">Varsayılan cos φ</label><input id="s_cos" name="defaultCosphi" type="number" step="0.01" min="0.5" max="1" value="${esc(st.defaultCosphi)}" /></div>
      <div class="field w2"><label for="s_pre">Devre no ön eki</label><input id="s_pre" name="codePrefix" value="${esc(st.codePrefix)}" maxlength="4" /></div>
      <div class="field w3"><label for="s_theme">Tema</label><select id="s_theme" name="theme"><option value="auto"${theme === 'auto' ? ' selected' : ''}>Cihaza göre</option><option value="light"${theme === 'light' ? ' selected' : ''}>Açık</option><option value="dark"${theme === 'dark' ? ' selected' : ''}>Koyu</option></select></div>
      <div class="field w6"><button class="btn primary" type="submit" style="align-self:flex-start">Kaydet</button></div>
    </form></section>
  <section class="card"><h2 style="margin-bottom:8px">Yedek ve paylaşım</h2>
    <p class="small muted">Tüm veriler yalnızca bu tarayıcıda saklanır (${kb} KB kayıt + fotoğraflar). Tarayıcı verisi silinirse kayıtlar da silinir — düzenli yedek alın. Yedek dosyasını başka bir cihaza <b>birleştirerek</b> yüklediğinizde aynı kayıtlardan yeni olanı korunur; böylece ekip arasında dosya ile senkron yapılabilir.</p>
    <div class="actions" style="margin:12px 0">
      <button class="btn primary" data-act="backup" data-photos="1">Yedek indir (fotoğraflı)</button>
      <button class="btn" data-act="backup" data-photos="0">Yedek indir (fotoğrafsız)</button>
    </div>
    <div class="actions">
      <label class="btn">Yedek yükle — birleştir<input type="file" accept="application/json,.json" hidden data-import="merge" /></label>
      <label class="btn danger">Yedek yükle — tümünü değiştir<input type="file" accept="application/json,.json" hidden data-import="replace" /></label>
    </div>
    <h3 style="margin:18px 0 8px">Dışa aktar</h3>
    <div class="actions"><button class="btn" data-act="csv-all">Tüm devreler (CSV)</button><button class="btn" data-act="csv-inspections">Kontroller (CSV)</button><button class="btn" data-act="csv-audit">Değişiklik geçmişi (CSV)</button></div>
  </section>
  <section class="card"><h2 style="margin-bottom:8px">Veri</h2>
    <p class="small muted">${sitesAll().length} şantiye · ${S.all('panels').length} pano · ${S.all('circuits').length} devre · ${S.all('inspections').length} kontrol · ${S.all('events').length} olay · ${S.auditLog().length} geçmiş kaydı</p>
    <div class="actions" style="margin-top:12px"><button class="btn" data-act="demo">Örnek şantiye ekle</button><button class="btn danger" data-act="reset">Tüm verileri sil</button></div>
  </section>
  <section class="card"><h2 style="margin-bottom:8px">Hakkında</h2>
    <p class="small">Pano Saha, şantiyelerdeki elektrik panolarının, sigorta ve koruma cihazlarının, kablo ve yük bilgilerinin, periyodik kontrollerin, arıza ve LOTO kayıtlarının tutulduğu sunucusuz bir sahadır. İnternet bağlantısı yalnızca sayfanın ilk açılışı için gerekir; QR kodu dahil her şey cihazda üretilir.</p>
    <p class="small muted">Otomatik denetimler bilgilendirme amaçlıdır; elektrik projesinin, kısa devre ve seçicilik hesaplarının ve yetkili kişilerce yapılan periyodik kontrollerin yerini tutmaz.</p>
  </section></div>`;
}

function viewPrint(id) {
  const p = S.get('panels', id);
  if (!p) return notFound();
  const s = S.get('sites', p.siteId);
  const circuits = circuitsOf(id);
  const parent = p.parentPanelId && S.get('panels', p.parentPanelId);
  const feeder = p.parentCircuitId && S.get('circuits', p.parentCircuitId);
  const perRow = Math.max(4, num(p.modulesPerRow) || 18);
  const mm = 17.5 * 0.9; // ekranda/çıktıda modül genişliği (mm), %90 ölçek
  return `
  <div class="print-actions toolbar no-print"><a class="btn" href="#/pano/${id}">← Panoya dön</a><button class="btn primary" data-act="print">🖨 Yazdır</button><span class="small muted">A4 dikey. Devre şeritlerini kesip cihazların altına yapıştırabilirsiniz (modül = 17,5 mm; yazdırırken ölçeği %100 seçin, şerit %90 ölçeklidir — gerekirse ayarlayın).</span></div>
  <div class="sheet">
    <div class="head">
      <div class="grow"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em">${esc(s?.name || '')}${s?.code ? ' · ' + esc(s.code) : ''}</div>
        <h1>${esc(p.code)} — ${esc(p.name || p.type || '')}</h1>
        <div class="kv">
          <div><b>Konum:</b> ${esc(p.location || '—')}</div>
          <div><b>Gerilim:</b> ${esc(p.voltage || '—')}</div>
          <div><b>Topraklama:</b> ${esc(p.earthingSystem || '—')}</div>
          <div><b>Giriş:</b> ${esc(p.mainDevice || '')} ${p.mainRating ? esc(p.mainRating) + ' A' : '—'}</div>
          <div><b>Giriş RCD:</b> ${p.mainRcdMa ? esc(p.mainRcdMa) + ' mA' : '—'}</div>
          <div><b>Ik:</b> ${p.shortCircuitKa ? esc(p.shortCircuitKa) + ' kA' : '—'}</div>
          <div><b>Besleme:</b> ${parent ? esc(parent.code) + (feeder ? ' / ' + esc(feeder.code) + ' ' + esc(R.deviceShort(feeder)) : '') : 'Şebeke / sayaç'}</div>
          <div><b>Kablo:</b> ${esc(p.feedCable || '—')}</div>
          <div><b>Sorumlu:</b> ${esc(p.responsible || s?.electricalLead || '—')}</div>
        </div></div>
      <div class="qr" data-qr="${esc(panelUrl(p))}" data-qr-size="3"></div>
    </div>
    <div class="danger-strip"><span>⚡ TEHLİKE — YÜKSEK GERİLİM · Müdahaleden önce enerjiyi kesin, kilitleyin ve gerilim yokluğunu ölçün. Yetkisiz kişiler dokunamaz.</span></div>
    <table><thead><tr><th style="width:42px">No</th><th>Beslediği yer</th><th style="width:120px">Cihaz</th><th style="width:34px">Faz</th><th style="width:110px">Kablo</th><th style="width:70px">Durum</th></tr></thead><tbody>
      ${circuits.map((c) => `<tr><td><b>${esc(c.code)}</b></td><td>${esc(c.label || (c.status === 'Yedek' ? 'Yedek' : ''))}${c.location ? ` — ${esc(c.location)}` : ''}</td><td>${esc(R.deviceShort(c))}</td><td>${esc(R.isThreePhase(c) ? '3F' : c.phase || '')}</td><td>${c.cableSection ? `${esc(c.cableType || '')} ${esc(c.cableCores || '')}${esc(c.cableSection)} mm²` : ''}</td><td>${esc(c.status === 'Aktif' ? '' : c.status)}</td></tr>`).join('') || '<tr><td colspan="6">Devre kaydı yok.</td></tr>'}
    </tbody></table>
    <h2>Cihaz etiket şeridi</h2>
    ${chunkRows(circuits, perRow).map((row) => `<div class="labels">${row.map((c) => `<div class="lab" style="width:${(Math.min(perRow, R.moduleWidth(c)) * mm).toFixed(1)}mm"><b>${esc(c.code)}</b>${esc(R.deviceShort(c).replace(/ (1P\+N|1P|2P|3P\+N|3P|4P)/, ''))}<br>${esc(c.label || '')}</div>`).join('')}</div>`).join('')}
    <div class="foot"><span>Pano Saha · yazdırma ${new Date().toLocaleString('tr-TR')}</span><span>Son kontrol: ${fmtDate(lastInspectionDate(id))} · Son güncelleme: ${fmtDate(p.updatedAt)}</span></div>
  </div>`;
}

function chunkRows(circuits, perRow) {
  const rows = [[]];
  let used = 0;
  for (const c of circuits) {
    const w = Math.min(perRow, R.moduleWidth(c));
    if (used + w > perRow) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(c);
    used += w;
  }
  return rows.filter((r) => r.length);
}

function notFound() {
  return emptyState('Kayıt bulunamadı', 'Bu kayıt silinmiş ya da bu cihazda yok. QR kodu başka bir cihazda oluşturulduysa, o cihazın yedeğini buraya “birleştir” ile yükleyin.', '<a class="btn primary" href="#/">Özete dön</a>');
}

/* =========================================================================
   Yönlendirme ve çizim
   ========================================================================= */

function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}

function render() {
  const { parts, q } = parseHash();
  const [r, id] = parts;
  const navKey = { santiye: 'santiyeler', pano: 'santiyeler', yazdir: 'santiyeler' }[r] || r || 'ozet';
  for (const a of document.querySelectorAll('[data-nav]')) a.classList.toggle('active', a.dataset.nav === navKey);
  const scroll = window.scrollY;
  const prevKey = render.key;
  render.key = location.hash.split('?')[0] + (q.get('tab') || '');

  let html;
  switch (r) {
    case undefined: html = viewDashboard(); break;
    case 'santiyeler': html = viewSites(q); break;
    case 'santiye': html = viewSite(id, q); break;
    case 'pano': html = viewPanel(id, q); break;
    case 'uyarilar': html = viewAlerts(q); break;
    case 'kontroller': html = viewInspections(); break;
    case 'loto': html = viewLoto(); break;
    case 'ara': html = viewSearch(q); break;
    case 'ayarlar': html = viewSettings(); break;
    case 'yazdir': html = viewPrint(id); break;
    default: html = notFound();
  }
  // Açık filtreleri koru
  const filters = {};
  for (const el of app.querySelectorAll('[data-filter-for] [data-filter]')) filters[el.closest('[data-filter-for]').dataset.filterFor + el.dataset.filter] = el.value;
  app.innerHTML = html;
  for (const el of app.querySelectorAll('[data-filter-for] [data-filter]')) {
    const v = filters[el.closest('[data-filter-for]').dataset.filterFor + el.dataset.filter];
    if (v) el.value = v;
  }
  for (const bar of app.querySelectorAll('[data-filter-for]')) applyFilters(bar);
  if (prevKey === render.key) window.scrollTo(0, scroll);
  else window.scrollTo(0, 0);

  hydrateThumbs(app);
  drawQrs();
  updateBadges();
  updateWho();
  const searchEl = document.getElementById('search');
  if (r === 'ara' && document.activeElement !== searchEl) searchEl.value = q.get('q') || '';

  // QR/derin bağlantı: ?devre=ID ile devre penceresini aç
  const cid = q.get('devre');
  if (r === 'pano' && cid && !modal.open) {
    const c = S.get('circuits', cid);
    const p = S.get('panels', id);
    if (c && p) {
      history.replaceState(null, '', location.hash.replace(/[?&]devre=[^&]+/, ''));
      editCircuit(p, c);
    }
  }
}

function drawQrs() {
  for (const el of app.querySelectorAll('[data-qr]')) {
    if (typeof window.qrcode !== 'function') {
      el.innerHTML = '<p class="small muted">QR kütüphanesi yüklenemedi; sayfayı yenileyin.</p>';
      continue;
    }
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(el.dataset.qr);
      qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: Number(el.dataset.qrSize) || 4, margin: 2, scalable: false });
      const svg = el.querySelector('svg');
      if (svg) svg.setAttribute('role', 'img');
    } catch {
      el.textContent = 'QR üretilemedi.';
    }
  }
}

function updateBadges() {
  const issues = allIssues().filter((i) => i.level === 'err').length;
  const loto = S.where('circuits', (c) => c.status === 'Kilitli (LOTO)').length;
  const a = document.getElementById('nav-alerts');
  a.hidden = !issues;
  a.textContent = issues;
  const l = document.getElementById('nav-loto');
  l.hidden = !loto;
  l.textContent = loto;
  l.style.background = 'var(--warn)';
}

function updateWho() {
  const who = document.getElementById('who');
  const name = S.settings().userName;
  who.textContent = name ? `👤 ${name}` : '👤 Adınızı girin';
  who.title = 'Kayıtlara işlenecek kullanıcı adı — değiştirmek için tıklayın';
}

/* =========================================================================
   Olaylar
   ========================================================================= */

const actions = {
  'modal-close': () => closeModal(),
  'form-delete': () => formState?.onDelete?.(),
  'form-copy-circuit': () => {
    const v = readForm();
    const p = formState?.ctx?.panel;
    if (!p) return;
    const { id, createdAt, updatedAt, photos, lotoBy, lotoNote, lotoAt, ...rest } = v;
    closeModal();
    editCircuit(p, null, { ...rest, code: R.nextCode(circuitsOf(p.id), S.settings().codePrefix || 'F'), status: rest.status === 'Kilitli (LOTO)' ? 'Aktif' : rest.status });
  },
  'photo-remove': (d) => {
    formState.photos[d.k] = formState.photos[d.k].filter((x) => x !== d.id);
    renderThumbs(d.k);
  },
  'new-site': () => editSite(null),
  'edit-site': (d) => editSite(S.get('sites', d.id)),
  'new-panel': (d) => editPanel(null, { siteId: d.site || parseSiteFromHash() }),
  'edit-panel': (d) => editPanel(S.get('panels', d.id)),
  'dup-panel': (d) => {
    const p = S.get('panels', d.id);
    const code = prompt('Yeni panonun kodu:', R.nextCode(panelsOf(p.siteId), p.code.replace(/\d+$/, '')) || p.code + '-2');
    if (!code) return;
    if (panelsOf(p.siteId).some((x) => x.code.toLocaleUpperCase('tr') === code.toLocaleUpperCase('tr'))) return toast('Bu kod kullanılıyor.', 'err');
    const copy = S.duplicatePanel(p.id, { code, status: 'Montajda' });
    toast(`${p.code} → ${code} kopyalandı (${circuitsOf(copy.id).length} devre).`);
    location.hash = `#/pano/${copy.id}`;
  },
  'new-circuit': (d) => editCircuit(S.get('panels', d.panel)),
  bulk: (d) => bulkCircuits(S.get('panels', d.panel)),
  'open-circuit': (d) => {
    const c = S.get('circuits', d.id);
    if (c) editCircuit(S.get('panels', c.panelId), c);
  },
  loto: (d) => toggleLoto(S.get('circuits', d.id)),
  trip: (d) => {
    const c = S.get('circuits', d.id);
    const p = S.get('panels', c.panelId);
    editEvent(null, p, { panelId: p.id, circuitId: c.id, type: 'Sigorta attı', description: `${c.code} (${R.deviceShort(c)}) attı.` });
  },
  'new-inspection': (d) => editInspection(null, S.get('panels', d.panel || parseHash().parts[1]) || null),
  'open-inspection': (d) => editInspection(S.get('inspections', d.id)),
  'new-event': (d) => editEvent(null, S.get('panels', d.panel || '') || null),
  'open-event': (d) => editEvent(S.get('events', d.id)),
  'csv-panel': (d) => {
    const p = S.get('panels', d.id);
    download(`${slug(p.code)}-devreler.csv`, R.toCsv(circuitsOf(p.id), CIRCUIT_COLUMNS), 'text/csv;charset=utf-8');
  },
  'csv-site': (d) => {
    const s = S.get('sites', d.id);
    const list = S.where('circuits', (c) => c.siteId === s.id).sort((a, b) => R.naturalCompare(S.get('panels', a.panelId)?.code, S.get('panels', b.panelId)?.code) || R.naturalCompare(a.code, b.code));
    download(`${slug(s.code || s.name)}-devreler.csv`, R.toCsv(list, CIRCUIT_COLUMNS), 'text/csv;charset=utf-8');
  },
  'csv-all': () => download(`pano-saha-devreler-${today()}.csv`, R.toCsv(S.all('circuits'), CIRCUIT_COLUMNS), 'text/csv;charset=utf-8'),
  'csv-inspections': () => download(`pano-saha-kontroller-${today()}.csv`, R.toCsv(S.all('inspections'), INSPECTION_COLUMNS), 'text/csv;charset=utf-8'),
  'csv-audit': () =>
    download(
      `pano-saha-gecmis-${today()}.csv`,
      R.toCsv(S.auditLog(), [
        { label: 'Zaman', key: 'at' },
        { label: 'Kullanıcı', key: 'by' },
        { label: 'İşlem', key: 'action' },
        { label: 'Tür', key: 'col' },
        { label: 'Kayıt', key: 'title' },
        { label: 'Değişiklikler', get: (a) => (a.changes ? Object.entries(a.changes).map(([k, [b, c]]) => `${FIELD_LABELS[k] || k}: ${fmtVal(b)} → ${fmtVal(c)}`).join(' | ') : '') }
      ]),
      'text/csv;charset=utf-8'
    ),
  backup: async (d) => {
    const data = await S.exportBackup({ includePhotos: d.photos === '1' });
    download(`pano-saha-yedek-${today()}.json`, JSON.stringify(data), 'application/json');
    toast('Yedek indirildi.');
  },
  demo: () => {
    const { site } = loadDemo(S);
    toast('Örnek şantiye eklendi.');
    location.hash = `#/santiye/${site.id}`;
  },
  reset: async () => {
    if (!confirm('Bu cihazdaki TÜM şantiye, pano, devre, kontrol, olay ve fotoğraf kayıtları silinecek. Önce yedek aldınız mı?')) return;
    if (prompt('Onaylamak için SİL yazın:') !== 'SİL') return;
    await S.resetAll();
    toast('Tüm veriler silindi.');
    location.hash = '#/';
  },
  print: () => window.print()
};

function parseSiteFromHash() {
  const { parts } = parseHash();
  if (parts[0] === 'santiye') return parts[1];
  if (parts[0] === 'pano') return S.get('panels', parts[1])?.siteId;
  return undefined;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-stop]')) return;
  const img = e.target.closest('.thumb img');
  if (img?.src && !e.target.closest('button')) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<img src="${img.src}" alt="" />`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  e.stopPropagation();
  fn(el.dataset, el);
});

app.addEventListener('input', (e) => {
  const bar = e.target.closest('[data-filter-for]');
  if (bar) applyFilters(bar);
});
app.addEventListener('change', async (e) => {
  const bar = e.target.closest('[data-filter-for]');
  if (bar) return applyFilters(bar);
  if (e.target.matches('[data-nav-select]')) {
    location.hash = e.target.value;
    return;
  }
  const imp = e.target.closest('[data-import]');
  if (imp?.files?.[0]) {
    const mode = imp.dataset.import;
    try {
      const data = JSON.parse(await imp.files[0].text());
      const err = S.validateBackup(data);
      if (err) throw new Error(err);
      if (mode === 'replace' && !confirm('Bu cihazdaki tüm kayıtlar silinip yedekteki verilerle değiştirilecek. Devam edilsin mi?')) return;
      const st = await S.importBackup(data, mode);
      toast(mode === 'replace' ? `Yedek yüklendi (${st.added} kayıt).` : `Birleştirildi: ${st.added} yeni, ${st.updated} güncellenen, ${st.kept} değişmeyen kayıt.`);
    } catch (err) {
      toast('Yedek yüklenemedi: ' + err.message, 'err');
    }
    imp.value = '';
  }
});
app.addEventListener('submit', (e) => {
  if (e.target.id !== 'settings-form') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const theme = f.get('theme');
  try {
    if (theme === 'auto') localStorage.removeItem('pano-saha:theme');
    else localStorage.setItem('pano-saha:theme', theme);
  } catch {}
  applyTheme();
  S.updateSettings({
    userName: String(f.get('userName') || '').trim(),
    inspectionIntervalDays: Math.max(1, Number(f.get('inspectionIntervalDays')) || 30),
    defaultCosphi: Math.min(1, Math.max(0.5, Number(f.get('defaultCosphi')) || 0.9)),
    codePrefix: String(f.get('codePrefix') || 'F').trim() || 'F'
  });
  toast('Ayarlar kaydedildi.');
});

document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = document.getElementById('search').value.trim();
  location.hash = v ? `#/ara?q=${encodeURIComponent(v)}` : '#/';
});
document.getElementById('who').addEventListener('click', () => {
  const name = prompt('Kayıtlara işlenecek adınız:', S.settings().userName || '');
  if (name !== null) S.updateSettings({ userName: name.trim() });
});

function applyTheme() {
  let t = null;
  try {
    t = localStorage.getItem('pano-saha:theme');
  } catch {}
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

window.addEventListener('hashchange', () => {
  if (modal.open) closeModal();
  render();
});
let renderQueued = false;
S.subscribe(() => {
  const err = S.lastSaveError();
  if (err) toast('Kayıt yapılamadı: tarayıcı depolama alanı dolu olabilir. Yedek alıp eski fotoğrafları silin.', 'err');
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => {
    renderQueued = false;
    render();
  });
});
window.addEventListener('load', drawQrs);

applyTheme();
render();
