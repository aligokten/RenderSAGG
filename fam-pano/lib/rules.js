/**
 * FAM Pano — elektrik kuralları ve katalog.
 * Saf JavaScript: tarayıcıda ve Node testlerinde aynen çalışır (içe aktarım yok).
 *
 * ÖNEMLİ: Buradaki kontroller sahadaki kayıt hatalarını yakalamak için YARDIMCI uyarılardır.
 * Proje hesabının, kısa devre/seçicilik etüdünün veya yetkili kişinin periyodik kontrolünün
 * yerini tutmaz.
 */

export const SITE_STATUS = ['Aktif', 'Askıda', 'Tamamlandı'];

export const PANEL_TYPES = [
  'Şantiye ana panosu (geçici)',
  'Şantiye tali panosu (geçici)',
  'Ana dağıtım panosu (ADP)',
  'Tali dağıtım panosu',
  'Kat panosu',
  'Daire / ofis panosu',
  'Aydınlatma panosu',
  'Priz panosu',
  'Mekanik / motor panosu',
  'Asansör panosu',
  'Kompanzasyon panosu',
  'Jeneratör / transfer panosu',
  'UPS panosu',
  'Diğer'
];

export const PANEL_STATUS = ['Montajda', 'Devrede', 'Bakımda', 'Devre dışı', 'Söküldü'];
export const EARTHING_SYSTEMS = ['TN-S', 'TN-C-S', 'TN-C', 'TT', 'IT'];
export const IP_CLASSES = ['IP20', 'IP30', 'IP40', 'IP43', 'IP44', 'IP54', 'IP55', 'IP65', 'IP66'];

export const DEVICE_TYPES = [
  'MCB (otomatik sigorta)',
  'RCBO (kaçak akımlı otomatik)',
  'RCCB (kaçak akım rölesi)',
  'MCCB (kompakt şalter)',
  'Yük ayırıcı / şalter',
  'NH bıçaklı sigorta',
  'Kontaktör',
  'Motor koruma şalteri',
  'Parafudr (SPD)',
  'Enerji analizörü / sayaç',
  'Diğer'
];

/** Akım-koruma yapan ve anma akımı/eğri ile değerlendirilen cihazlar. */
export const PROTECTIVE = new Set([
  'MCB (otomatik sigorta)',
  'RCBO (kaçak akımlı otomatik)',
  'MCCB (kompakt şalter)',
  'NH bıçaklı sigorta',
  'Motor koruma şalteri'
]);

/** Kaçak akım koruması sağlayan cihazlar. */
export const RCD_DEVICES = new Set(['RCBO (kaçak akımlı otomatik)', 'RCCB (kaçak akım rölesi)']);

export const CURVES = ['B', 'C', 'D', 'K', 'Z', 'gG', 'aM'];
export const RCD_TYPES = ['AC', 'A', 'F', 'B'];
export const RCD_MA = [10, 30, 100, 300, 500];
export const BREAKING_KA = [3, 4.5, 6, 10, 15, 16, 25, 36, 50, 70];

/** Kutup → DIN ray modül genişliği (17.5 mm modül). */
export const POLES = { '1P': 1, '1P+N': 2, '2P': 2, '3P': 3, '3P+N': 4, '4P': 4 };

export const PHASES = ['L1', 'L2', 'L3', '3F'];

export const RATINGS = [
  1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600
];

export const CABLE_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
export const CABLE_TYPES = ['NYM', 'NYY', 'N2XH', 'NHXMH', 'H07RN-F (kauçuk)', 'H05VV-F (TTR)', 'NYAF', 'Diğer'];

export const CIRCUIT_STATUS = ['Aktif', 'Yedek', 'Kapalı', 'Arızalı', 'Kilitli (LOTO)'];

export const LOAD_KINDS = [
  'Aydınlatma',
  'Priz',
  'Islak hacim prizi',
  'Şantiye prizi / seyyar',
  'Motor / pompa',
  'Kaynak makinesi',
  'Vinç / kule vinç',
  'Asansör',
  'Isıtma / klima',
  'Konteyner / ofis',
  'Tali pano beslemesi',
  'Diğer'
];

/** Kaçak akım (≤30 mA) koruması beklenen yük türleri. */
export const RCD_REQUIRED_LOADS = new Set(['Priz', 'Islak hacim prizi', 'Şantiye prizi / seyyar', 'Konteyner / ofis']);

export const INSPECTION_TYPES = [
  'Rutin görsel kontrol',
  'Kaçak akım rölesi testi',
  'Topraklama direnci ölçümü',
  'İzolasyon direnci ölçümü',
  'Çevrim empedansı ölçümü',
  'Termal kamera',
  'Sıkılık / tork kontrolü',
  'Periyodik kontrol (yetkili kişi)'
];

export const EVENT_TYPES = ['Sigorta attı', 'Arıza', 'Değişim / revizyon', 'Bakım', 'LOTO kilitleme', 'LOTO açma', 'Not'];

/**
 * Bakır iletken, PVC yalıtım, döşeme yöntemi C (duvar üstü), 30 °C ortam —
 * IEC 60364-5-52 Tablo B.52.4 değerleri (A). Düzeltme faktörleri (gruplama, sıcaklık,
 * döşeme şekli) UYGULANMAMIŞTIR; gerçek taşıma kapasitesi daha düşük olabilir.
 */
export const AMPACITY_CU_C = {
  2: { 1.5: 19.5, 2.5: 27, 4: 36, 6: 46, 10: 63, 16: 85, 25: 112, 35: 138, 50: 168, 70: 213, 95: 258, 120: 299, 150: 344, 185: 392, 240: 461 },
  3: { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 96, 35: 119, 50: 144, 70: 184, 95: 223, 120: 259, 150: 299, 185: 341, 240: 403 }
};

export const VOLTAGE_LN = 230;
export const VOLTAGE_LL = 400;

export function moduleWidth(circuit) {
  return POLES[circuit?.poles] ?? 1;
}

export function isThreePhase(circuit) {
  return circuit?.phase === '3F' || ['3P', '3P+N', '4P'].includes(circuit?.poles);
}

/** Yüklü iletken sayısı (ampasite tablosu seçimi için). */
export function loadedConductors(circuit) {
  return isThreePhase(circuit) ? 3 : 2;
}

export function cableAmpacity(section, conductors = 2) {
  const table = AMPACITY_CU_C[conductors >= 3 ? 3 : 2];
  return table[Number(section)] ?? null;
}

/** kW → faz akımı (A). */
export function loadCurrent(kw, threePhase, cosphi = 0.9) {
  const p = Number(kw) * 1000;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return threePhase ? p / (Math.sqrt(3) * VOLTAGE_LL * cosphi) : p / (VOLTAGE_LN * cosphi);
}

/** Devre yükünün fazlara dağılımı (kW). 3 fazlı yük eşit bölünür; faz atanmamış tek fazlı yük "atanmamış"a gider. */
export function phaseLoads(circuits) {
  const out = { L1: 0, L2: 0, L3: 0, unassigned: 0 };
  for (const c of circuits) {
    if (!c || c.status === 'Yedek' || c.status === 'Kapalı') continue;
    const kw = Number(c.loadKw) || 0;
    if (kw <= 0) continue;
    if (isThreePhase(c)) {
      out.L1 += kw / 3;
      out.L2 += kw / 3;
      out.L3 += kw / 3;
    } else if (['L1', 'L2', 'L3'].includes(c.phase)) {
      out[c.phase] += kw;
    } else {
      out.unassigned += kw;
    }
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}

/** Faz dengesizliği: (en yüksek − en düşük) / ortalama, yüzde. Yük yoksa 0. */
export function phaseImbalance(loads) {
  const v = [loads.L1, loads.L2, loads.L3];
  const avg = (v[0] + v[1] + v[2]) / 3;
  if (avg <= 0) return 0;
  return Math.round(((Math.max(...v) - Math.min(...v)) / avg) * 1000) / 10;
}

/** Önerilen faz: en az yüklü faz. */
export function suggestPhase(circuits) {
  const loads = phaseLoads(circuits);
  return ['L1', 'L2', 'L3'].sort((a, b) => loads[a] - loads[b])[0];
}

/**
 * Tek bir devrenin kayıt uyarıları.
 * @param {object} c devre
 * @param {object} ctx { panel, upstreamRcd: boolean }
 * @returns {{level:'err'|'warn'|'info', code:string, msg:string}[]}
 */
export function checkCircuit(c, ctx = {}) {
  const issues = [];
  const add = (level, code, msg) => issues.push({ level, code, msg });
  const panel = ctx.panel || {};
  const protective = PROTECTIVE.has(c.device);
  const rating = Number(c.rating) || 0;

  if (!c.label && c.status !== 'Yedek') add('warn', 'no-label', 'Devrenin beslediği yer yazılmamış — pano kapağı listesinde boş görünür.');

  if (protective && c.status !== 'Yedek') {
    if (!rating) add('warn', 'no-rating', 'Anma akımı girilmemiş.');
    if (c.cableSection) {
      const iz = cableAmpacity(c.cableSection, loadedConductors(c));
      if (iz && rating > iz) {
        add('err', 'cable-overload', `Kablo ${c.cableSection} mm² (≈${iz} A) ${rating} A sigortayla korunamaz — kablo aşırı yükte yanabilir.`);
      } else if (iz && rating > iz * 0.9) {
        add('warn', 'cable-tight', `Kablo ${c.cableSection} mm² (≈${iz} A) ${rating} A için sınırda; gruplama/sıcaklık düzeltmesiyle yetersiz kalabilir.`);
      }
    } else if (c.status === 'Aktif') {
      add('info', 'no-cable', 'Kablo kesiti girilmemiş; kablo-sigorta uyumu denetlenemiyor.');
    }
    const ib = loadCurrent(c.loadKw, isThreePhase(c), Number(c.cosphi) || 0.9);
    if (ib && rating && ib > rating) {
      add('err', 'load-over-rating', `Tahmini yük akımı ${ib.toFixed(1)} A, sigorta ${rating} A — devre sürekli atar.`);
    } else if (ib && rating && ib > rating * 0.8) {
      add('warn', 'load-high', `Tahmini yük akımı ${ib.toFixed(1)} A, sigortanın %${Math.round((ib / rating) * 100)}'i.`);
    }
    const ik = Number(panel.shortCircuitKa) || 0;
    const icu = Number(c.breakingKa) || 0;
    if (ik && icu && icu < ik) {
      add('err', 'breaking-capacity', `Kesme kapasitesi ${icu} kA, pano kısa devre seviyesi ${ik} kA — arızada cihaz patlayabilir.`);
    }
  }

  if (RCD_REQUIRED_LOADS.has(c.loadKind) && c.status !== 'Yedek') {
    const ownRcd = RCD_DEVICES.has(c.device) && Number(c.rcdMa) > 0 && Number(c.rcdMa) <= 30;
    if (!ownRcd && !ctx.upstreamRcd) {
      add('err', 'rcd-missing', `${c.loadKind} devresinde ≤30 mA kaçak akım koruması görünmüyor.`);
    }
  }

  if (RCD_DEVICES.has(c.device) && !Number(c.rcdMa)) {
    add('warn', 'rcd-no-ma', 'Kaçak akım cihazının hassasiyeti (mA) girilmemiş.');
  }

  if (!isThreePhase(c) && !c.phase && c.status === 'Aktif' && c.device !== 'Parafudr (SPD)') {
    add('info', 'no-phase', 'Faz atanmamış; faz dengesine katılamıyor.');
  }

  if (c.status === 'Kilitli (LOTO)' && !c.lotoBy) {
    add('warn', 'loto-owner', 'LOTO kilidinin sahibi yazılmamış.');
  }
  if (c.status === 'Arızalı') add('warn', 'faulty', 'Devre arızalı olarak işaretli.');

  return issues;
}

/** Panonun üst düzey uyarıları (devreler hariç). */
export function checkPanel(panel, circuits, { mainRating, feederRating, today = new Date(), intervalDays = 30, lastInspection } = {}) {
  const issues = [];
  const add = (level, code, msg) => issues.push({ level, code, msg });

  const loads = phaseLoads(circuits);
  const imb = phaseImbalance(loads);
  const mainA = Number(mainRating || panel.mainRating) || 0;
  // Giriş şalterine göre hafif yüklü panoda dengesizlik pratik sorun değildir → bilgi.
  const light = mainA > 0 && loadCurrent(Math.max(loads.L1, loads.L2, loads.L3), false, 0.9) < mainA * 0.25;
  if (imb > 30) add(light ? 'info' : 'err', 'imbalance', `Faz dengesizliği %${imb}${light ? ' (pano hafif yüklü)' : ' — yükleri fazlar arasında yeniden dağıtın'}.`);
  else if (imb > 15) add(light ? 'info' : 'warn', 'imbalance', `Faz dengesizliği %${imb}.`);
  if (loads.unassigned > 0) add('info', 'unassigned-load', `${loads.unassigned} kW yük faza atanmamış.`);

  const main = Number(mainRating || panel.mainRating) || 0;
  if (main) {
    const maxPhaseKw = Math.max(loads.L1, loads.L2, loads.L3);
    const iPhase = loadCurrent(maxPhaseKw, false, 0.9);
    if (iPhase > main) add('err', 'main-over', `En yüklü faz ≈${iPhase.toFixed(0)} A, giriş şalteri ${main} A (eş zamanlılık hariç).`);
    else if (iPhase > main * 0.8) add('warn', 'main-high', `En yüklü faz ≈${iPhase.toFixed(0)} A, giriş şalterinin %${Math.round((iPhase / main) * 100)}'i.`);
  }

  const isSwitch = /ayırıcı|ayirici|şalter$|switch/i.test(panel.mainDevice || '');
  if (feederRating && main && !isSwitch && main >= Number(feederRating)) {
    add('warn', 'selectivity', `Giriş şalteri (${main} A) besleyen üst devreden (${feederRating} A) küçük değil — seçicilik sağlanmayabilir.`);
  }

  if (!panel.earthingSystem) add('info', 'no-earthing', 'Topraklama sistemi (TN-S, TT…) girilmemiş.');
  if (panel.type?.includes('geçici') && panel.ipClass && Number(panel.ipClass.slice(2, 3)) < 4) {
    add('warn', 'ip-low', `Geçici şantiye panosu için ${panel.ipClass} düşük; dış ortamda en az IP44 önerilir.`);
  }

  const due = inspectionDue(lastInspection, intervalDays, today);
  if (panel.status === 'Devrede' || panel.status === 'Bakımda') {
    if (due.state === 'never') add('warn', 'never-inspected', 'Bu pano için kontrol kaydı yok.');
    else if (due.state === 'overdue') add('err', 'overdue', `Kontrol ${due.days} gün gecikti.`);
    else if (due.state === 'soon') add('info', 'due-soon', `Kontrole ${due.days} gün kaldı.`);
  }

  const counts = {};
  for (const c of circuits) {
    if (!c.code) continue;
    counts[c.code] = (counts[c.code] || 0) + 1;
  }
  for (const [code, n] of Object.entries(counts)) {
    if (n > 1) add('err', 'dup-code', `${code} numarası ${n} devrede kullanılmış.`);
  }

  return issues;
}

/** Kontrol durumu: never | overdue | soon | ok */
export function inspectionDue(lastDate, intervalDays = 30, today = new Date()) {
  if (!lastDate) return { state: 'never', days: null, next: null };
  const last = new Date(lastDate);
  const next = new Date(last.getTime() + intervalDays * 86400000);
  const days = Math.ceil((next - startOfDay(today)) / 86400000);
  if (days < 0) return { state: 'overdue', days: -days, next };
  if (days <= 7) return { state: 'soon', days, next };
  return { state: 'ok', days, next };
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Kısa cihaz etiketi: "C16 1P", "RCBO B16 30mA", "RCCB 40A 30mA A". */
export function deviceShort(c) {
  const parts = [];
  if (c.device?.startsWith('RCBO')) parts.push('RCBO');
  else if (c.device?.startsWith('RCCB')) parts.push('RCCB');
  else if (c.device?.startsWith('MCCB')) parts.push('MCCB');
  else if (c.device?.startsWith('NH')) parts.push('NH');
  else if (c.device?.startsWith('Kontaktör')) parts.push('KNT');
  else if (c.device?.startsWith('Parafudr')) parts.push('SPD');
  else if (c.device?.startsWith('Motor')) parts.push('MKŞ');
  else if (c.device?.startsWith('Yük')) parts.push('ŞLT');
  const rating = Number(c.rating) || '';
  if (c.device?.startsWith('RCCB') || c.device?.startsWith('Yük') || c.device?.startsWith('Kontaktör')) {
    if (rating) parts.push(`${rating}A`);
  } else if (rating) {
    parts.push(`${c.curve && !['gG', 'aM'].includes(c.curve) ? c.curve : ''}${rating}${c.curve && ['gG', 'aM'].includes(c.curve) ? ' ' + c.curve : ''}`);
  }
  if (c.poles) parts.push(c.poles);
  if (RCD_DEVICES.has(c.device) && c.rcdMa) parts.push(`${c.rcdMa}mA${c.rcdType ? ' ' + c.rcdType : ''}`);
  return parts.join(' ').trim();
}

/** Bir sonraki devre numarası: F1, F2 … (mevcut en büyük + 1). */
export function nextCode(circuits, prefix = 'F') {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`, 'i');
  for (const c of circuits) {
    const m = re.exec(c.code || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

/** Doğal sıralama: F2 < F10, -Q1 < -Q12 */
export function naturalCompare(a = '', b = '') {
  return String(a).localeCompare(String(b), 'tr', { numeric: true, sensitivity: 'base' });
}

/** CSV hücresi kaçışı (Excel uyumlu, ; ayraç). */
export function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const head = columns.map((c) => csvCell(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(';'));
  return '﻿' + [head, ...body].join('\r\n');
}
