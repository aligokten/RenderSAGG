/**
 * Pano Saha — veri katmanı.
 * Kayıtlar localStorage'da tek JSON olarak, fotoğraflar IndexedDB'de tutulur.
 * Hiçbir veri bir sunucuya gönderilmez; paylaşım/yedek JSON dosyası ile yapılır.
 */

const KEY = 'pano-saha:v1';
export const COLLECTIONS = ['sites', 'panels', 'circuits', 'inspections', 'events'];

const DEFAULT_SETTINGS = {
  userName: '',
  inspectionIntervalDays: 30,
  defaultCosphi: 0.9,
  codePrefix: 'F'
};

function emptyDb() {
  return { version: 1, sites: [], panels: [], circuits: [], inspections: [], events: [], audit: [], settings: { ...DEFAULT_SETTINGS } };
}

export function uid(prefix = '') {
  const r = crypto.getRandomValues(new Uint32Array(2));
  return prefix + Date.now().toString(36) + r[0].toString(36) + r[1].toString(36).slice(0, 3);
}

let db = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDb();
    return normalize(JSON.parse(raw));
  } catch {
    return emptyDb();
  }
}

function normalize(data) {
  const base = emptyDb();
  for (const k of [...COLLECTIONS, 'audit']) base[k] = Array.isArray(data?.[k]) ? data[k] : [];
  base.settings = { ...DEFAULT_SETTINGS, ...(data?.settings || {}) };
  return base;
}

let saveError = null;
function persist() {
  try {
    if (db.audit.length > 3000) db.audit = db.audit.slice(-3000);
    localStorage.setItem(KEY, JSON.stringify(db));
    saveError = null;
  } catch (e) {
    saveError = e;
  }
  for (const fn of listeners) fn();
}

export function lastSaveError() {
  return saveError;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function settings() {
  return db.settings;
}

export function updateSettings(patch) {
  db.settings = { ...db.settings, ...patch };
  persist();
}

export function all(col) {
  return db[col];
}

export function get(col, id) {
  return db[col].find((x) => x.id === id) || null;
}

export function where(col, pred) {
  return db[col].filter(pred);
}

function audit(action, col, rec, changes) {
  db.audit.push({
    id: uid('a'),
    at: new Date().toISOString(),
    by: db.settings.userName || '',
    action,
    col,
    recId: rec.id,
    title: rec.code || rec.name || rec.title || rec.type || '',
    siteId: rec.siteId || null,
    panelId: col === 'panels' ? rec.id : rec.panelId || null,
    changes: changes || null
  });
}

const PREFIX = { sites: 's', panels: 'p', circuits: 'c', inspections: 'i', events: 'e' };

export function create(col, data) {
  const now = new Date().toISOString();
  const rec = { ...data, id: uid(PREFIX[col]), createdAt: now, updatedAt: now, createdBy: db.settings.userName || '' };
  db[col].push(rec);
  audit('create', col, rec);
  persist();
  return rec;
}

export function update(col, id, patch) {
  const rec = get(col, id);
  if (!rec) return null;
  const changes = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id' || k === 'updatedAt') continue;
    const before = rec[k] ?? '';
    const after = v ?? '';
    if (JSON.stringify(before) !== JSON.stringify(after)) changes[k] = [before, after];
  }
  if (!Object.keys(changes).length) return rec;
  Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
  audit('update', col, rec, changes);
  persist();
  return rec;
}

/** Kaydı ve bağlı alt kayıtları siler; silinen fotoğraf kimliklerini döndürür. */
export function remove(col, id) {
  const rec = get(col, id);
  if (!rec) return [];
  const photos = [...(rec.photos || [])];
  const drop = (c, pred) => {
    for (const r of db[c].filter(pred)) photos.push(...(r.photos || []));
    db[c] = db[c].filter((r) => !pred(r));
  };
  if (col === 'sites') {
    const panelIds = new Set(db.panels.filter((p) => p.siteId === id).map((p) => p.id));
    drop('circuits', (c) => panelIds.has(c.panelId));
    drop('inspections', (x) => panelIds.has(x.panelId));
    drop('events', (x) => panelIds.has(x.panelId));
    drop('panels', (p) => p.siteId === id);
  }
  if (col === 'panels') {
    drop('circuits', (c) => c.panelId === id);
    drop('inspections', (x) => x.panelId === id);
    drop('events', (x) => x.panelId === id);
    for (const p of db.panels) if (p.parentPanelId === id) Object.assign(p, { parentPanelId: '', parentCircuitId: '' });
  }
  if (col === 'circuits') {
    for (const p of db.panels) if (p.parentCircuitId === id) p.parentCircuitId = '';
  }
  db[col] = db[col].filter((r) => r.id !== id);
  audit('delete', col, rec);
  persist();
  for (const pid of photos) deletePhoto(pid).catch(() => {});
  return photos;
}

/** Panoyu tüm devreleriyle kopyalar (kontrol ve olay kayıtları kopyalanmaz). */
export function duplicatePanel(id, overrides = {}) {
  const src = get('panels', id);
  if (!src) return null;
  const { id: _i, createdAt, updatedAt, photos, ...rest } = src;
  const copy = create('panels', { ...rest, ...overrides, photos: [] });
  for (const c of db.circuits.filter((x) => x.panelId === id)) {
    const { id: _c, createdAt: _a, updatedAt: _b, photos: _p, ...crest } = c;
    db.circuits.push({ ...crest, id: uid('c'), panelId: copy.id, siteId: copy.siteId, photos: [], createdAt: copy.createdAt, updatedAt: copy.createdAt });
  }
  persist();
  return copy;
}

export function auditLog(filter = () => true) {
  return db.audit.filter(filter);
}

/* ---------------- Yedek / geri yükleme ---------------- */

export async function exportBackup({ includePhotos = true } = {}) {
  const out = JSON.parse(JSON.stringify(db));
  out.exportedAt = new Date().toISOString();
  out.app = 'pano-saha';
  if (includePhotos) out.photoData = await allPhotos();
  return out;
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object') return 'Dosya JSON nesnesi değil.';
  if (data.app && data.app !== 'pano-saha') return 'Bu dosya Pano Saha yedeği değil.';
  if (!Array.isArray(data.sites) || !Array.isArray(data.panels) || !Array.isArray(data.circuits)) {
    return 'Dosyada şantiye/pano/devre listeleri yok.';
  }
  return null;
}

/**
 * mode = 'replace': mevcut veriyi tamamen değiştirir.
 * mode = 'merge': aynı kimlikli kayıtlardan updatedAt'i yeni olanı tutar, diğerlerini ekler.
 */
export async function importBackup(data, mode = 'merge') {
  const err = validateBackup(data);
  if (err) throw new Error(err);
  const incoming = normalize(data);
  const stats = { added: 0, updated: 0, kept: 0 };
  if (mode === 'replace') {
    await clearPhotos();
    incoming.settings = { ...incoming.settings, userName: db.settings.userName };
    db = incoming;
    stats.added = COLLECTIONS.reduce((n, c) => n + db[c].length, 0);
  } else {
    for (const col of COLLECTIONS) {
      const byId = new Map(db[col].map((r) => [r.id, r]));
      for (const r of incoming[col]) {
        const cur = byId.get(r.id);
        if (!cur) {
          db[col].push(r);
          stats.added++;
        } else if ((r.updatedAt || '') > (cur.updatedAt || '')) {
          Object.assign(cur, r);
          stats.updated++;
        } else stats.kept++;
      }
    }
    const seen = new Set(db.audit.map((a) => a.id));
    for (const a of incoming.audit) if (!seen.has(a.id)) db.audit.push(a);
    db.audit.sort((a, b) => (a.at < b.at ? -1 : 1));
  }
  if (Array.isArray(data.photoData)) {
    for (const p of data.photoData) if (p?.id && p?.dataUrl) await putPhoto(p);
  }
  persist();
  return stats;
}

export function resetAll() {
  db = emptyDb();
  persist();
  return clearPhotos();
}

export function storageUsage() {
  try {
    return (localStorage.getItem(KEY) || '').length * 2;
  } catch {
    return 0;
  }
}

/* ---------------- Fotoğraflar (IndexedDB) ---------------- */

let idbPromise = null;
function idb() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('pano-saha-photos', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return idbPromise;
}

async function tx(mode, fn) {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const t = d.transaction('photos', mode);
    const store = t.objectStore('photos');
    const req = fn(store);
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export function putPhoto(photo) {
  return tx('readwrite', (s) => s.put(photo));
}
export function getPhoto(id) {
  return tx('readonly', (s) => s.get(id));
}
export function deletePhoto(id) {
  return tx('readwrite', (s) => s.delete(id));
}
function allPhotos() {
  return tx('readonly', (s) => s.getAll()).then((x) => x || []);
}
function clearPhotos() {
  return tx('readwrite', (s) => s.clear()).catch(() => {});
}

/** Görseli uzun kenarı en fazla `max` px JPEG'e küçültür. */
export function compressImage(file, max = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Görsel okunamadı.'));
    };
    img.src = url;
  });
}
