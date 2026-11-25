/**
 * FAM Pano — hazır ürün kataloğu (sigorta grubu).
 * Saf JavaScript: tarayıcıda ve Node testlerinde aynen çalışır (içe aktarım yok).
 *
 * Kayıtlar SERİ düzeyindedir: marka + seri + cihaz türü ve o serinin tipik eğri, anma akımı,
 * kutup, kesme kapasitesi ve kaçak akım seçenekleri. Sipariş kodu içermez. Değerler üretici
 * kataloglarındaki tipik aralıklardır; her anma/kutup kombinasyonu her seride bulunmayabilir.
 * Satın almadan veya projeye yazmadan önce ürün etiketini / güncel kataloğu doğrulayın.
 *
 * `generic: true` olan kayıtlar markanın ürün ailesi için GENEL tanımdır (seri adı doğrulanmamış);
 * teknisyen etiketteki model kodunu "Model" alanına yazar.
 */

const MCB = 'MCB (otomatik sigorta)';
const RCBO = 'RCBO (kaçak akımlı otomatik)';
const RCCB = 'RCCB (kaçak akım rölesi)';
const MCCB = 'MCCB (kompakt şalter)';
const NH = 'NH bıçaklı sigorta';
const SPD = 'Parafudr (SPD)';

const R_MCB = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
const R_MCB_WIDE = [1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
const R_RCBO = [6, 10, 13, 16, 20, 25, 32, 40];
const P_MCB = ['1P', '1P+N', '2P', '3P', '3P+N', '4P'];
const P_RCCB = ['2P', '4P'];
const P_MCCB = ['3P', '4P'];

function mcb(brand, series, ka, curves, ratings = R_MCB, extra = {}) {
  return { brand, series, device: MCB, curves, ratings, poles: P_MCB, breakingKa: [ka], ...extra };
}
function rccb(brand, series, ratings, mA, types, extra = {}) {
  return { brand, series, device: RCCB, curves: [], ratings, poles: P_RCCB, breakingKa: [], rcdMa: mA, rcdTypes: types, ...extra };
}
function rcbo(brand, series, ka, mA, types, extra = {}) {
  return { brand, series, device: RCBO, curves: ['B', 'C'], ratings: R_RCBO, poles: ['1P+N'], breakingKa: [ka], rcdMa: mA, rcdTypes: types, ...extra };
}
function mccb(brand, series, ratings, kas, extra = {}) {
  return { brand, series, device: MCCB, curves: [], ratings, poles: P_MCCB, breakingKa: kas, ...extra };
}
function spd(brand, series, extra = {}) {
  return { brand, series, device: SPD, curves: [], ratings: [], poles: ['1P+N', '3P+N', '4P'], breakingKa: [], ...extra };
}

const RAW = [
  // ---------------- Legrand ----------------
  mcb('Legrand', 'RX³ 4500', 4.5, ['B', 'C'], R_MCB, { note: 'Konut / hafif ticari' }),
  mcb('Legrand', 'DX³ 6000', 6, ['B', 'C', 'D'], R_MCB_WIDE),
  mcb('Legrand', 'DX³ 10000', 10, ['B', 'C', 'D'], R_MCB_WIDE),
  rccb('Legrand', 'RX³ ID', [25, 40, 63], [30, 300], ['AC', 'A']),
  rccb('Legrand', 'DX³-ID', [25, 40, 63, 80, 100], [10, 30, 100, 300, 500], ['AC', 'A', 'F']),
  rcbo('Legrand', 'DX³ RCBO', 6, [10, 30, 300], ['AC', 'A']),
  mccb('Legrand', 'DPX³ 160', [16, 25, 40, 63, 100, 125, 160], [16, 25, 36, 50]),
  mccb('Legrand', 'DPX³ 250', [100, 160, 200, 250], [25, 36, 50, 70]),
  spd('Legrand', 'Parafudr Tip 2'),

  // ---------------- Siemens ----------------
  mcb('Siemens', '5SL6', 6, ['B', 'C'], R_MCB_WIDE),
  mcb('Siemens', '5SY4', 10, ['B', 'C', 'D'], R_MCB_WIDE),
  rccb('Siemens', '5SV3', [16, 25, 40, 63, 80], [30, 300], ['AC', 'A']),
  rcbo('Siemens', '5SU1', 6, [10, 30, 300], ['AC', 'A']),
  mccb('Siemens', '3VA1', [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250], [16, 25, 36, 55]),
  {
    brand: 'Siemens', series: '3NA3 (NH gG buşon)', device: NH, curves: ['gG'],
    ratings: [6, 10, 16, 20, 25, 32, 35, 40, 50, 63, 80, 100, 125, 160, 200, 224, 250, 315, 355, 400, 500, 630],
    poles: ['1P', '3P'], breakingKa: [120], note: 'Buşon boyutu (000–3) anma akımına göre değişir'
  },
  spd('Siemens', '5SD7'),

  // ---------------- Viko (Panasonic) ----------------
  mcb('Viko', 'Otomatik sigorta (MCB)', 4.5, ['B', 'C'], R_MCB, { generic: true, breakingKa: [4.5, 6] }),
  rccb('Viko', 'Kaçak akım rölesi (RCCB)', [25, 40, 63], [30, 300], ['AC', 'A'], { generic: true }),
  rcbo('Viko', 'Kaçak akımlı otomatik sigorta (RCBO)', 4.5, [30], ['AC', 'A'], { generic: true, breakingKa: [4.5, 6] }),

  // ---------------- Panasonic ----------------
  mcb('Panasonic', 'Otomatik sigorta (MCB)', 6, ['B', 'C'], R_MCB, { generic: true, breakingKa: [4.5, 6, 10] }),
  rccb('Panasonic', 'Kaçak akım rölesi (RCCB)', [25, 40, 63], [30, 300], ['AC', 'A'], { generic: true }),
  rcbo('Panasonic', 'Kaçak akımlı otomatik sigorta (RCBO)', 6, [30], ['AC', 'A'], { generic: true }),

  // ---------------- Schneider Electric ----------------
  mcb('Schneider Electric', 'Easy9', 4.5, ['B', 'C'], R_MCB),
  mcb('Schneider Electric', 'Acti9 iC60N', 6, ['B', 'C', 'D'], R_MCB_WIDE),
  mcb('Schneider Electric', 'Acti9 iC60H', 10, ['B', 'C', 'D'], R_MCB_WIDE),
  rccb('Schneider Electric', 'Easy9 RCCB', [25, 40, 63], [30, 300], ['AC', 'A']),
  rccb('Schneider Electric', 'Acti9 iID', [25, 40, 63, 80, 100], [10, 30, 100, 300, 500], ['AC', 'A']),
  rcbo('Schneider Electric', 'Acti9 iDPN N Vigi', 6, [10, 30, 300], ['AC', 'A']),
  mccb('Schneider Electric', 'EasyPact CVS', [16, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250], [25, 36, 50]),
  spd('Schneider Electric', 'Acti9 iPRD'),

  // ---------------- ABB ----------------
  mcb('ABB', 'S200', 6, ['B', 'C', 'D'], R_MCB_WIDE),
  mcb('ABB', 'S200M', 10, ['B', 'C', 'D'], R_MCB_WIDE),
  rccb('ABB', 'F200', [16, 25, 40, 63, 80, 100], [10, 30, 100, 300, 500], ['AC', 'A', 'B']),
  rcbo('ABB', 'DS201', 6, [10, 30, 100, 300], ['AC', 'A']),
  mccb('ABB', 'Tmax XT1', [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160], [18, 25, 36, 50, 70]),
  spd('ABB', 'OVR T2'),

  // ---------------- Hager ----------------
  mcb('Hager', 'MBN / MCN (6 kA)', 6, ['B', 'C'], R_MCB),
  mcb('Hager', 'NBN / NCN / NDN (10 kA)', 10, ['B', 'C', 'D'], R_MCB_WIDE),
  rccb('Hager', 'Kaçak akım rölesi (RCCB)', [25, 40, 63, 80], [30, 300], ['AC', 'A'], { generic: true }),
  rcbo('Hager', 'Kaçak akımlı otomatik sigorta (RCBO)', 6, [30], ['AC', 'A'], { generic: true }),

  // ---------------- Eaton ----------------
  mcb('Eaton', 'xPole PL6', 6, ['B', 'C', 'D'], R_MCB_WIDE),
  mcb('Eaton', 'xPole PL7', 10, ['B', 'C', 'D'], R_MCB_WIDE),
  rccb('Eaton', 'xPole PF6', [16, 25, 40, 63], [30, 100, 300], ['AC', 'A'])
];

export const BRANDS = ['Legrand', 'Siemens', 'Viko', 'Panasonic', 'Schneider Electric', 'ABB', 'Hager', 'Eaton'];

export const CATALOG = RAW.map((p) => ({
  id: productId(p.brand, p.series),
  rcdMa: [],
  rcdTypes: [],
  generic: false,
  note: '',
  ...p,
  builtin: true
}));

export function productId(brand, series) {
  return (
    'p-' +
    `${brand}-${series}`
      .toLocaleLowerCase('tr')
      .replace(/³/g, '3')
      .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

/** Virgülle ayrılmış metni sayı/metin listesine çevirir: "6, 10,16" → [6,10,16]. */
export function parseList(text, numeric = false) {
  const out = String(text ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (numeric ? Number(s.replace(',', '.')) : s));
  return numeric ? out.filter((n) => Number.isFinite(n) && n > 0) : out;
}

/** Kullanıcı tanımlı ürünü katalog biçimine getirir. */
export function normalizeCustom(p) {
  return {
    id: p.id || productId(p.brand, p.series),
    brand: String(p.brand || '').trim(),
    series: String(p.series || '').trim(),
    device: p.device || MCB,
    curves: Array.isArray(p.curves) ? p.curves : parseList(p.curves),
    ratings: Array.isArray(p.ratings) ? p.ratings : parseList(p.ratings, true),
    poles: Array.isArray(p.poles) ? p.poles : parseList(p.poles),
    breakingKa: Array.isArray(p.breakingKa) ? p.breakingKa : parseList(p.breakingKa, true),
    rcdMa: Array.isArray(p.rcdMa) ? p.rcdMa : parseList(p.rcdMa, true),
    rcdTypes: Array.isArray(p.rcdTypes) ? p.rcdTypes : parseList(p.rcdTypes),
    note: p.note || '',
    generic: false,
    builtin: false
  };
}

/** Yerleşik katalog + kullanıcı ürünleri (aynı kimlikte kullanıcı kaydı önceliklidir). */
export function allProducts(custom = []) {
  const map = new Map(CATALOG.map((p) => [p.id, p]));
  for (const c of custom) map.set(c.id, normalizeCustom(c));
  return [...map.values()];
}

export function brandsOf(products, device) {
  const set = new Set(products.filter((p) => !device || p.device === device).map((p) => p.brand));
  const known = BRANDS.filter((b) => set.has(b));
  const rest = [...set].filter((b) => !BRANDS.includes(b)).sort((a, b) => a.localeCompare(b, 'tr'));
  return [...known, ...rest];
}

export function seriesOf(products, brand, devices = null) {
  return products.filter((p) => p.brand === brand && (!devices || devices.includes(p.device)));
}

export function findProduct(products, id) {
  return products.find((p) => p.id === id) || null;
}

/**
 * Seri seçildiğinde devreye uygulanacak alanlar. Mevcut değer seride geçerliyse korunur,
 * değilse serinin ilk/uygun değeri seçilir.
 */
export function applyProduct(product, current = {}) {
  if (!product) return {};
  const pick = (list, cur, prefer) => {
    if (!list?.length) return '';
    if (list.some((x) => String(x) === String(cur))) return cur;
    if (prefer !== undefined && list.some((x) => String(x) === String(prefer))) return prefer;
    return list[0];
  };
  const patch = {
    brand: product.brand,
    productId: product.id,
    series: product.series,
    device: product.device,
    curve: pick(product.curves, current.curve, 'C'),
    rating: pick(product.ratings, current.rating, 16),
    poles: pick(product.poles, current.poles, '1P+N'),
    breakingKa: pick(product.breakingKa, current.breakingKa)
  };
  if (product.rcdMa?.length) patch.rcdMa = pick(product.rcdMa, current.rcdMa, 30);
  else patch.rcdMa = '';
  if (product.rcdTypes?.length) patch.rcdType = pick(product.rcdTypes, current.rcdType, 'A');
  else patch.rcdType = '';
  return patch;
}

/** Devre değerleri seçili serinin katalog aralığında mı? */
export function checkAgainstProduct(c, product) {
  if (!product) return [];
  const issues = [];
  const out = (field, label, list, unit = '') => {
    const v = c[field];
    if (v === '' || v == null || !list?.length) return;
    if (!list.some((x) => String(x) === String(v))) {
      issues.push({ level: 'warn', code: `catalog-${field}`, msg: `${product.brand} ${product.series} serisinde ${label} ${v}${unit} katalogda yok (seri: ${list.join(', ')}${unit}).` });
    }
  };
  if (c.device && c.device !== product.device) {
    issues.push({ level: 'warn', code: 'catalog-device', msg: `Seçili seri bir ${product.device}; devrede cihaz "${c.device}" yazılı.` });
  }
  out('curve', 'eğri', product.curves);
  out('rating', 'anma akımı', product.ratings, ' A');
  out('poles', 'kutup', product.poles);
  out('breakingKa', 'kesme kapasitesi', product.breakingKa, ' kA');
  out('rcdMa', 'kaçak akım', product.rcdMa, ' mA');
  out('rcdType', 'RCD tipi', product.rcdTypes);
  return issues;
}

/** Kısa ürün adı: "Siemens 5SL6", genel kayıtta model yazılıysa "Viko · VTA-123". */
export function productLabel(c, product) {
  if (product) {
    if (product.generic) return `${product.brand}${c.model ? ' · ' + c.model : ''}`;
    return `${product.brand} ${product.series}${c.model ? ' · ' + c.model : ''}`;
  }
  return [c.brand, c.series, c.model].filter(Boolean).join(' ');
}

/**
 * Malzeme listesi: aynı marka/seri/cihaz/eğri/anma/kutup/mA kombinasyonlarını sayar.
 * Yedek devreler dahildir (panoda fiziksel olarak bulunurlar).
 */
export function billOfMaterials(circuits, products = CATALOG) {
  const rows = new Map();
  for (const c of circuits) {
    if (!c.device) continue;
    const p = c.productId ? findProduct(products, c.productId) : null;
    const brand = p?.brand || c.brand || '';
    const series = p ? (p.generic ? c.model || p.series : p.series) : c.series || c.model || '';
    // Kesme kapasitesi yalnızca kısa devre koruması yapan cihazlarda anlamlıdır (RCCB / SPD hariç)
    const ka = /^(RCCB|Parafudr|Kontaktör|Yük|Enerji)/.test(c.device) ? '' : c.breakingKa || '';
    const key = [brand, series, c.device, c.curve || '', c.rating || '', c.poles || '', c.rcdMa || '', c.rcdType || '', ka].join('|');
    const row = rows.get(key) || {
      brand, series, device: c.device, curve: c.curve || '', rating: c.rating || '', poles: c.poles || '',
      rcdMa: c.rcdMa || '', rcdType: c.rcdType || '', breakingKa: ka, qty: 0, codes: []
    };
    row.qty++;
    if (c.code) row.codes.push(c.code);
    rows.set(key, row);
  }
  const order = (r) => [r.brand, r.device, r.series, String(r.rating).padStart(5, '0'), r.poles].join('|');
  // Markası girilmemiş cihazlar listenin sonunda
  return [...rows.values()].sort((a, b) => (a.brand ? 0 : 1) - (b.brand ? 0 : 1) || order(a).localeCompare(order(b), 'tr', { numeric: true }));
}
