/* Malzeme ve renk alternatifi paketleri — istemci mantığı
 *
 * Akış: referans render yüklenir → render üzerine tıklanarak numaralı bölgeler işaretlenir →
 * her pakette bu numaralara malzeme/renk/doku ataması yapılır → "Versiyonu render et".
 */

const $ = (sel) => document.querySelector(sel);

const el = {
  providerBadge: $('#providerBadge'),
  lockScreen: $('#lockScreen'),
  lockForm: $('#lockForm'),
  lockPassword: $('#lockPassword'),
  lockError: $('#lockError'),

  renderDrop: $('#renderDrop'),
  renderInput: $('#renderInput'),
  renderLoaded: $('#renderLoaded'),
  renderMeta: $('#renderMeta'),
  renderChange: $('#renderChange'),
  clearRegions: $('#clearRegions'),
  markerStage: $('#markerStage'),
  markerImage: $('#markerImage'),
  markerLayer: $('#markerLayer'),
  unsupportedHint: $('#unsupportedHint'),

  regionList: $('#regionList'),
  regionEmpty: $('#regionEmpty'),
  regionCount: $('#regionCount'),

  scene: $('#scene'),
  time: $('#time'),
  weather: $('#weather'),
  aspect: $('#aspect'),
  outputLongEdge: $('#outputLongEdge'),
  provider: $('#provider'),
  apiKeyRow: $('#apiKeyRow'),
  apiKey: $('#apiKey'),
  apiKeyHint: $('#apiKeyHint'),
  rememberKey: $('#rememberKey'),
  prompt: $('#prompt'),

  addPackage: $('#addPackage'),
  renderAll: $('#renderAll'),
  packageList: $('#packageList'),
  packagesIntro: $('#packagesIntro'),
  compareStrip: $('#compareStrip'),
  strip: $('#strip'),
  qcBlock: $('#qcBlock'),
  checklist: $('#checklist'),

  lightbox: $('#lightbox'),
  lbTitle: $('#lbTitle'),
  lbMeta: $('#lbMeta'),
  lbDownload: $('#lbDownload'),
  lbClose: $('#lbClose'),
  lbCompare: $('#lbCompare'),
  lbAfter: $('#lbAfter'),
  lbBefore: $('#lbBefore'),
  lbBeforeWrap: $('#lbBeforeWrap'),
  lbHandle: $('#lbHandle'),
  lbRange: $('#lbRange'),
  lbInstruction: $('#lbInstruction')
};

const CAD_EXTENSIONS = ['skp', 'max', 'rvt', 'pln', 'dwg', 'dxf', '3dm', 'blend', 'fbx', 'obj', 'ifc', 'c4d'];
const PACKAGE_NAMES = ['Paket A', 'Paket B', 'Paket C', 'Paket D', 'Paket E', 'Paket F', 'Paket G', 'Paket H'];
const PASSWORD_KEY = 'panelPassword';
const API_KEY_STORE = 'panelApiKey';

const state = {
  config: null,
  render: null,     // { name, type, data, width, height, bytes }
  regions: [],      // { id, number, x, y, label, surface }
  packages: [],     // { id, name, assign: {regionId: {...}}, job, result, error, steps, busy }
  seq: 0,
  bound: false,
  blobUrls: new Map()
};

const uid = () => `k${++state.seq}${Date.now().toString(36).slice(-4)}`;
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* ---------------- Oturum ---------------- */

const storedPassword = () => sessionStorage.getItem(PASSWORD_KEY) || '';

function authHeaders(extra = {}) {
  const password = storedPassword();
  return password ? { ...extra, 'x-panel-password': password } : extra;
}

function showLock(message) {
  el.lockScreen.hidden = false;
  el.lockError.hidden = !message;
  el.lockError.textContent = message || '';
  el.lockPassword.focus();
}

el.lockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = el.lockPassword.value;
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    showLock('Şifre hatalı. Tekrar deneyin.');
    return;
  }
  sessionStorage.setItem(PASSWORD_KEY, password);
  el.lockScreen.hidden = true;
  el.lockPassword.value = '';
  await init();
});

/* ---------------- Başlangıç ---------------- */

init().catch((err) => alert(err.message));

async function init() {
  const res = await fetch('/api/config', { headers: authHeaders() });
  if (!res.ok) throw new Error('Sunucu yapılandırması okunamadı.');
  const cfg = await res.json();

  if (cfg.locked) {
    showLock(storedPassword() ? 'Oturum sona erdi, şifreyi tekrar girin.' : '');
    return;
  }
  state.config = cfg;
  el.lockScreen.hidden = true;

  renderProviders(cfg.providers, cfg.activeProvider);
  const active = cfg.providers.find((p) => p.id === cfg.activeProvider);
  setProviderBadge(active);
  paintApiKeyRow(active);
  el.outputLongEdge.value = String(cfg.outputLongEdge);

  el.checklist.innerHTML = (cfg.packageChecklist || [])
    .map((item) => `<li><label><input type="checkbox" /> <span>${escapeHtml(item)}</span></label></li>`)
    .join('');

  const remembered = localStorage.getItem(API_KEY_STORE);
  if (remembered) {
    el.apiKey.value = remembered;
    el.rememberKey.checked = true;
  }

  if (!state.bound) {
    bindEvents();
    state.bound = true;
  }
  if (state.packages.length === 0) addPackage();
}

function renderProviders(providers, active) {
  const allowClientKey = Boolean(state.config?.allowClientKey);
  el.provider.innerHTML = providers
    .map((p) => {
      const selectable = p.configured || (allowClientKey && p.acceptsClientKey);
      const suffix = p.configured ? '' : allowClientKey && p.acceptsClientKey ? ' — kendi anahtarınızla' : ' — anahtar yok';
      return `<option value="${p.id}" ${p.id === active ? 'selected' : ''} ${selectable ? '' : 'disabled'}>${escapeHtml(p.label + suffix)}</option>`;
    })
    .join('');
}

function setProviderBadge(provider) {
  if (!provider) return;
  el.providerBadge.textContent = `${provider.label} · ${provider.model}`;
  el.providerBadge.classList.toggle('warn', provider.id === 'mock');
  el.providerBadge.title = provider.note || '';
}

function paintApiKeyRow(provider) {
  const usable = Boolean(state.config.allowClientKey && provider?.acceptsClientKey);
  el.apiKeyRow.hidden = !usable;
  if (!usable) return;
  el.apiKeyHint.textContent = provider.configured
    ? `Sunucuda anahtar tanımlı; boş bırakırsanız sunucunun anahtarı kullanılır. Kendi anahtarınızı girerseniz (${provider.keyHint}) yalnızca bu isteğin süresince kullanılır.`
    : `Bu sağlayıcı için sunucuda anahtar yok. Kendi anahtarınızı girin (${provider.keyHint}). Anahtar sunucuda saklanmaz, loglanmaz.`;
}

/* ---------------- Olaylar ---------------- */

function bindEvents() {
  el.renderDrop.addEventListener('click', () => el.renderInput.click());
  el.renderDrop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      el.renderInput.click();
    }
  });
  el.renderChange.addEventListener('click', () => el.renderInput.click());
  el.renderInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const parsed = await readFile(file);
    if (!parsed) return;
    state.render = parsed;
    paintRender();
  });

  ['dragenter', 'dragover'].forEach((type) =>
    el.renderDrop.addEventListener(type, (event) => {
      event.preventDefault();
      el.renderDrop.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach((type) =>
    el.renderDrop.addEventListener(type, (event) => {
      event.preventDefault();
      el.renderDrop.classList.remove('drag');
    })
  );
  el.renderDrop.addEventListener('drop', async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const parsed = await readFile(file);
    if (!parsed) return;
    state.render = parsed;
    paintRender();
  });

  el.clearRegions.addEventListener('click', () => {
    if (state.regions.length && !confirm('İşaretlenen tüm bölgeler ve paketlerdeki atamaları silinsin mi?')) return;
    state.regions = [];
    state.packages.forEach((pkg) => { pkg.assign = {}; });
    paintRegions();
    paintPackages();
  });

  el.markerStage.addEventListener('click', (event) => {
    if (event.target.closest('.pin')) return;
    addRegionAt(event);
  });

  el.provider.addEventListener('change', () => {
    const provider = state.config.providers.find((p) => p.id === el.provider.value);
    setProviderBadge(provider);
    paintApiKeyRow(provider);
  });

  const persistKey = () => {
    if (el.rememberKey.checked && el.apiKey.value.trim()) localStorage.setItem(API_KEY_STORE, el.apiKey.value.trim());
    else localStorage.removeItem(API_KEY_STORE);
  };
  el.rememberKey.addEventListener('change', persistKey);
  el.apiKey.addEventListener('change', persistKey);

  el.addPackage.addEventListener('click', () => addPackage());
  el.renderAll.addEventListener('click', renderAllPackages);

  el.lbClose.addEventListener('click', closeLightbox);
  el.lightbox.addEventListener('click', (event) => {
    if (event.target === el.lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !el.lightbox.hidden) closeLightbox();
  });
  bindLightboxCompare();
}

/* ---------------- Dosya okuma ---------------- */

const extensionOf = (name = '') => name.split('.').pop().toLowerCase();

async function readFile(file) {
  const ext = extensionOf(file.name);
  if (CAD_EXTENSIONS.includes(ext)) return showUnsupported(ext);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return showUnsupported(ext || file.type);
  if (file.size > state.config.maxUploadMB * 1024 * 1024) {
    return showUnsupported(null, `Dosya ${state.config.maxUploadMB} MB sınırını aşıyor.`);
  }

  el.unsupportedHint.hidden = true;
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
  const size = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = data;
  });
  return { name: file.name, type: file.type, data, bytes: file.size, ...size };
}

function showUnsupported(ext, override) {
  el.unsupportedHint.hidden = false;
  el.unsupportedHint.innerHTML =
    override ||
    `<b>${escapeHtml((ext || 'Bu dosya').toUpperCase())}</b> dosyasının geometrisi güvenilir biçimde okunamaz.
     Bu panel PNG/JPG/WEBP render görselleri ile çalışır.`;
  return null;
}

/* ---------------- Referans render ve bölgeler ---------------- */

function paintRender() {
  const loaded = Boolean(state.render);
  el.renderDrop.hidden = loaded;
  el.renderLoaded.hidden = !loaded;
  if (!loaded) return;

  el.markerImage.src = state.render.data;
  const ratio = state.render.height ? (state.render.width / state.render.height).toFixed(2) : '—';
  el.renderMeta.textContent =
    `${state.render.name} · ${state.render.width}×${state.render.height} px · oran ${ratio} · ${formatBytes(state.render.bytes)}`;
  paintPackages();
}

function addRegionAt(event) {
  if (!state.render) return;
  if (state.regions.length >= (state.config.maxRegions || 8)) {
    alert(`En fazla ${state.config.maxRegions || 8} bölge işaretlenebilir.`);
    return;
  }
  const rect = el.markerStage.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  state.regions.push({
    id: uid(),
    number: state.regions.length + 1,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    label: '',
    surface: ''
  });
  paintRegions();
  paintPackages();
}

function renumber() {
  state.regions.forEach((region, index) => { region.number = index + 1; });
}

function paintRegions() {
  renumber();
  const count = state.regions.length;
  el.regionCount.textContent = count ? `${count} bölge` : '';
  el.regionEmpty.hidden = count > 0;

  el.markerLayer.innerHTML = state.regions
    .map(
      (region) => `
      <button type="button" class="pin" data-id="${region.id}" style="left:${(region.x * 100).toFixed(2)}%;top:${(region.y * 100).toFixed(2)}%"
        title="${escapeHtml(region.label || `Bölge ${region.number}`)} — sürükleyerek taşıyın">${region.number}</button>`
    )
    .join('');
  el.markerLayer.querySelectorAll('.pin').forEach(bindPinDrag);

  const surfaceOptions = (selected) =>
    ['<option value="">Yüzey türü (opsiyonel)</option>']
      .concat(
        (state.config.surfaces || []).map(
          (surface) => `<option value="${surface.id}" ${surface.id === selected ? 'selected' : ''}>${escapeHtml(surface.label)}</option>`
        )
      )
      .join('');

  el.regionList.innerHTML = state.regions
    .map(
      (region) => `
      <li class="region-row" data-id="${region.id}">
        <span class="pin-no">${region.number}</span>
        <div class="region-fields">
          <input type="text" class="region-label" value="${escapeHtml(region.label)}" placeholder="Bölge adı — ör. cephe kaplaması" />
          <select class="region-surface">${surfaceOptions(region.surface)}</select>
        </div>
        <button type="button" class="x" title="Bölgeyi sil">×</button>
      </li>`
    )
    .join('');

  el.regionList.querySelectorAll('.region-row').forEach((row) => {
    const region = state.regions.find((item) => item.id === row.dataset.id);
    row.querySelector('.region-label').addEventListener('input', (event) => {
      region.label = event.target.value;
      const pin = el.markerLayer.querySelector(`.pin[data-id="${region.id}"]`);
      if (pin) pin.title = `${region.label || `Bölge ${region.number}`} — sürükleyerek taşıyın`;
      document.querySelectorAll(`.pkg-row[data-region="${region.id}"] .pkg-row-title`).forEach((node) => {
        node.textContent = region.label || `Bölge ${region.number}`;
      });
    });
    row.querySelector('.region-surface').addEventListener('change', (event) => {
      region.surface = event.target.value;
      if (!region.label) {
        const surface = (state.config.surfaces || []).find((item) => item.id === event.target.value);
        if (surface) {
          region.label = surface.label;
          paintRegions();
          paintPackages();
        }
      }
    });
    row.querySelector('.x').addEventListener('click', () => {
      state.regions = state.regions.filter((item) => item.id !== region.id);
      state.packages.forEach((pkg) => { delete pkg.assign[region.id]; });
      paintRegions();
      paintPackages();
    });
  });
}

/** İşaretçiyi sürükleyerek konumunu düzeltme. */
function bindPinDrag(pin) {
  let dragging = false;
  let moved = false;

  pin.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    moved = false;
    pin.setPointerCapture(event.pointerId);
  });
  pin.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    moved = true;
    const region = state.regions.find((item) => item.id === pin.dataset.id);
    if (!region) return;
    const rect = el.markerStage.getBoundingClientRect();
    region.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    region.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    pin.style.left = `${(region.x * 100).toFixed(2)}%`;
    pin.style.top = `${(region.y * 100).toFixed(2)}%`;
  });
  const stop = (event) => {
    if (!dragging) return;
    dragging = false;
    if (moved) event.stopPropagation();
  };
  pin.addEventListener('pointerup', stop);
  pin.addEventListener('pointercancel', stop);
  pin.addEventListener('click', (event) => event.stopPropagation());
}

/* ---------------- Paketler ---------------- */

function addPackage(copyFrom = null) {
  const name = PACKAGE_NAMES[state.packages.length] || `Paket ${state.packages.length + 1}`;
  const pkg = {
    id: uid(),
    name: copyFrom ? `${copyFrom.name} kopyası` : name,
    assign: copyFrom ? structuredClone(copyFrom.assign) : {},
    job: null,
    steps: [],
    result: null,
    error: null,
    busy: false
  };
  state.packages.push(pkg);
  paintPackages();
  return pkg;
}

function assignmentOf(pkg, regionId) {
  if (!pkg.assign[regionId]) {
    pkg.assign[regionId] = { materialId: '', materialLabel: '', color: null, note: '', swatch: null };
  }
  return pkg.assign[regionId];
}

function hasAnyAssignment(pkg) {
  return state.regions.some((region) => {
    const a = pkg.assign[region.id];
    if (!a) return false;
    return Boolean((a.materialId && a.materialId !== '__custom') || (a.materialId === '__custom' && a.materialLabel) || a.color || a.swatch);
  });
}

function materialOptions(selected) {
  const groups = new Map();
  (state.config.materials || []).forEach((material) => {
    if (!groups.has(material.group)) groups.set(material.group, []);
    groups.get(material.group).push(material);
  });
  const options = ['<option value="">Malzeme seçilmedi</option>'];
  for (const [group, items] of groups) {
    options.push(`<optgroup label="${escapeHtml(group)}">`);
    items.forEach((material) => {
      options.push(
        `<option value="${material.id}" ${material.id === selected ? 'selected' : ''} title="${escapeHtml(material.spec)}">${escapeHtml(material.label)}</option>`
      );
    });
    options.push('</optgroup>');
  }
  options.push(`<option value="__custom" ${selected === '__custom' ? 'selected' : ''}>Kendim yazacağım…</option>`);
  return options.join('');
}

function colorOptions(selectedId) {
  const options = ['<option value="">Renk belirtilmedi</option>'];
  (state.config.colors || []).forEach((color) => {
    options.push(`<option value="${color.id}" ${color.id === selectedId ? 'selected' : ''}>${escapeHtml(color.name)} · ${color.hex}</option>`);
  });
  options.push(`<option value="__custom" ${selectedId === '__custom' ? 'selected' : ''}>Özel renk…</option>`);
  return options.join('');
}

function paintPackages() {
  el.packagesIntro.hidden = state.packages.length > 0 && state.regions.length > 0;

  if (!state.render) {
    el.packageList.innerHTML = '<p class="note">Paketleri doldurmak için önce soldan referans render görselini yükleyin.</p>';
    return;
  }

  el.packageList.innerHTML = state.packages.map(packageMarkup).join('');
  state.packages.forEach(bindPackage);
  paintStrip();
}

function packageMarkup(pkg) {
  const rows = state.regions.length
    ? state.regions.map((region) => rowMarkup(pkg, region)).join('')
    : '<p class="hint">Bu pakete malzeme atamak için render üzerinde en az bir bölge işaretleyin.</p>';

  return `
    <article class="pkg${pkg.busy ? ' busy' : ''}" data-id="${pkg.id}">
      <header class="pkg-head">
        <input type="text" class="pkg-name" value="${escapeHtml(pkg.name)}" placeholder="Paket adı" />
        <div class="row-actions">
          <button type="button" class="ghost small pkg-copy">Kopyala</button>
          <button type="button" class="ghost small pkg-delete">Sil</button>
        </div>
      </header>
      <div class="pkg-rows">${rows}</div>
      <footer class="pkg-foot">
        <button type="button" class="primary small pkg-render">Versiyonu render et</button>
        <span class="pkg-status">${escapeHtml(statusText(pkg))}</span>
      </footer>
      <ol class="steps pkg-steps"></ol>
      <div class="pkg-error" hidden></div>
      <div class="pkg-result" hidden></div>
    </article>`;
}

function rowMarkup(pkg, region) {
  const a = pkg.assign[region.id] || {};
  const swatch = a.swatch;
  const customColor = a.color && a.color.custom;
  return `
    <div class="pkg-row" data-region="${region.id}">
      <span class="pin-no">${region.number}</span>
      <div class="pkg-row-main">
        <div class="pkg-row-title">${escapeHtml(region.label || `Bölge ${region.number}`)}</div>
        <div class="pkg-fields">
          <select class="row-material">${materialOptions(a.materialId || '')}</select>
          <input type="text" class="row-material-custom" placeholder="Malzeme adı" value="${escapeHtml(a.materialLabel || '')}" ${a.materialId === '__custom' ? '' : 'hidden'} />
          <select class="row-color">${colorOptions(customColor ? '__custom' : a.color?.id || '')}</select>
          <input type="color" class="row-color-custom" value="${escapeHtml(a.color?.hex || '#C8B394')}" ${customColor ? '' : 'hidden'} />
          <input type="text" class="row-note" placeholder="Not — ör. yatay derz, 8 mm ek aralığı" value="${escapeHtml(a.note || '')}" />
        </div>
      </div>
      <div class="swatch-slot${swatch ? ' filled' : ''}" tabindex="0" role="button"
           title="Bu bölge için malzeme görseli (kartela, doku fotoğrafı) yükleyin">
        <input type="file" class="row-swatch-input" accept="image/png,image/jpeg,image/webp" hidden />
        ${swatch
          ? `<img src="${swatch.data}" alt="Bölge ${region.number} malzeme görseli" /><button type="button" class="x row-swatch-clear" title="Kaldır">×</button>`
          : '<span class="swatch-empty">+ Malzeme<br />görseli</span>'}
      </div>
    </div>`;
}

function statusText(pkg) {
  if (pkg.busy) return 'render ediliyor…';
  if (pkg.error) return 'hata';
  if (pkg.result) return 'hazır';
  if (!state.regions.length) return 'bölge bekleniyor';
  if (!hasAnyAssignment(pkg)) return 'malzeme bekleniyor';
  return 'render edilmeye hazır';
}

function bindPackage(pkg) {
  const card = el.packageList.querySelector(`.pkg[data-id="${pkg.id}"]`);
  if (!card) return;

  card.querySelector('.pkg-name').addEventListener('input', (event) => {
    pkg.name = event.target.value;
  });
  card.querySelector('.pkg-copy').addEventListener('click', () => addPackage(pkg));
  card.querySelector('.pkg-delete').addEventListener('click', () => {
    if (pkg.busy) return;
    state.packages = state.packages.filter((item) => item.id !== pkg.id);
    if (state.packages.length === 0) addPackage();
    else paintPackages();
  });
  card.querySelector('.pkg-render').addEventListener('click', () => renderPackage(pkg));

  card.querySelectorAll('.pkg-row').forEach((row) => {
    const regionId = row.dataset.region;
    const a = assignmentOf(pkg, regionId);

    const materialSelect = row.querySelector('.row-material');
    const materialCustom = row.querySelector('.row-material-custom');
    materialSelect.addEventListener('change', () => {
      a.materialId = materialSelect.value;
      materialCustom.hidden = a.materialId !== '__custom';
      if (a.materialId !== '__custom') a.materialLabel = '';
      refreshStatus(pkg);
    });
    materialCustom.addEventListener('input', () => {
      a.materialLabel = materialCustom.value;
      refreshStatus(pkg);
    });

    const colorSelect = row.querySelector('.row-color');
    const colorCustom = row.querySelector('.row-color-custom');
    const applyColor = () => {
      if (colorSelect.value === '') {
        a.color = null;
        colorCustom.hidden = true;
      } else if (colorSelect.value === '__custom') {
        colorCustom.hidden = false;
        a.color = { id: colorCustom.value, name: colorCustom.value, hex: colorCustom.value, custom: true };
      } else {
        colorCustom.hidden = true;
        const palette = (state.config.colors || []).find((color) => color.id === colorSelect.value);
        a.color = palette ? { id: palette.id, name: palette.name, hex: palette.hex } : null;
      }
      refreshStatus(pkg);
    };
    colorSelect.addEventListener('change', applyColor);
    colorCustom.addEventListener('input', applyColor);

    row.querySelector('.row-note').addEventListener('input', (event) => {
      a.note = event.target.value;
    });

    const slot = row.querySelector('.swatch-slot');
    const input = row.querySelector('.row-swatch-input');
    slot.addEventListener('click', (event) => {
      if (event.target.closest('.row-swatch-clear')) return;
      input.click();
    });
    slot.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    });
    ['dragenter', 'dragover'].forEach((type) =>
      slot.addEventListener(type, (event) => {
        event.preventDefault();
        slot.classList.add('drag');
      })
    );
    ['dragleave', 'drop'].forEach((type) =>
      slot.addEventListener(type, (event) => {
        event.preventDefault();
        slot.classList.remove('drag');
      })
    );
    slot.addEventListener('drop', async (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const parsed = await readFile(file);
      if (!parsed) return;
      a.swatch = parsed;
      paintPackages();
    });
    input.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      const parsed = await readFile(file);
      if (!parsed) return;
      a.swatch = parsed;
      paintPackages();
    });
    row.querySelector('.row-swatch-clear')?.addEventListener('click', (event) => {
      event.stopPropagation();
      a.swatch = null;
      paintPackages();
    });
  });

  paintPackageState(pkg);
}

function refreshStatus(pkg) {
  const card = el.packageList.querySelector(`.pkg[data-id="${pkg.id}"] .pkg-status`);
  if (card) card.textContent = statusText(pkg);
}

/* ---------------- Üretim ---------------- */

function payloadFor(pkg) {
  return {
    render: { name: state.render.name, type: state.render.type, data: state.render.data },
    packageName: pkg.name,
    regions: state.regions.map((region) => {
      const a = pkg.assign[region.id] || {};
      const material =
        a.materialId === '__custom'
          ? a.materialLabel ? { label: a.materialLabel } : null
          : a.materialId || null;
      return {
        number: region.number,
        label: region.label,
        x: region.x,
        y: region.y,
        surface: region.surface ? { id: region.surface } : null,
        material,
        color: a.color ? { id: a.color.id, name: a.color.name, hex: a.color.hex } : null,
        note: a.note || '',
        swatch: a.swatch ? { name: a.swatch.name, type: a.swatch.type, data: a.swatch.data } : null
      };
    }),
    scene: el.scene.value,
    time: el.time.value,
    weather: el.weather.value,
    aspect: el.aspect.value,
    prompt: el.prompt.value,
    provider: el.provider.value,
    apiKey: el.apiKeyRow.hidden ? '' : el.apiKey.value.trim(),
    outputLongEdge: Number(el.outputLongEdge.value)
  };
}

async function renderPackage(pkg) {
  if (pkg.busy) return;
  if (!state.render) {
    alert('Önce referans render görselini yükleyin.');
    return;
  }
  if (!state.regions.length) {
    alert('Render üzerinde en az bir bölge işaretleyin.');
    return;
  }
  if (!hasAnyAssignment(pkg)) {
    alert('Bu pakette en az bir bölgeye malzeme, renk veya malzeme görseli atayın.');
    return;
  }

  pkg.busy = true;
  pkg.error = null;
  pkg.result = null;
  pkg.steps = [{ label: 'İstek gönderiliyor', key: 'queued' }];
  paintPackageState(pkg);

  try {
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(payloadFor(pkg))
    });
    const payload = await res.json();

    if (res.status === 401) {
      pkg.busy = false;
      sessionStorage.removeItem(PASSWORD_KEY);
      showLock('Oturum sona erdi, şifreyi tekrar girin.');
      return;
    }
    if (!res.ok) throw new Error(payload.error || 'İstek reddedildi.');

    pkg.job = payload.id;
    await pollPackage(pkg);
  } catch (err) {
    pkg.busy = false;
    pkg.error = err.message;
    paintPackageState(pkg);
  }
}

async function pollPackage(pkg) {
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${pkg.job}`, { headers: authHeaders() });
        const job = await res.json();
        if (!res.ok) throw new Error(job.error || 'İş durumu alınamadı.');

        pkg.steps = job.steps || [];
        if (job.status === 'done') {
          clearInterval(timer);
          pkg.busy = false;
          pkg.result = job.result;
          paintPackageState(pkg);
          paintStrip();
          prepareDownload(pkg);
          resolve();
        } else if (job.status === 'error') {
          clearInterval(timer);
          pkg.busy = false;
          pkg.error = job.error;
          paintPackageState(pkg);
          resolve();
        } else {
          paintPackageState(pkg);
        }
      } catch (err) {
        clearInterval(timer);
        pkg.busy = false;
        pkg.error = err.message;
        paintPackageState(pkg);
        resolve();
      }
    }, 1200);
  });
}

async function renderAllPackages() {
  const pending = state.packages.filter((pkg) => !pkg.busy && hasAnyAssignment(pkg));
  if (!pending.length) {
    alert('Render edilecek paket yok: paketlere malzeme atayın.');
    return;
  }
  // Sağlayıcı sınırlarını zorlamamak için paketler sırayla üretilir.
  for (const pkg of pending) {
    await renderPackage(pkg);
  }
}

function paintPackageState(pkg) {
  const card = el.packageList.querySelector(`.pkg[data-id="${pkg.id}"]`);
  if (!card) return;

  card.classList.toggle('busy', pkg.busy);
  card.querySelector('.pkg-status').textContent = statusText(pkg);
  card.querySelector('.pkg-render').disabled = pkg.busy;

  const steps = card.querySelector('.pkg-steps');
  steps.hidden = !pkg.busy;
  steps.innerHTML = pkg.busy
    ? (pkg.steps || [])
        .map((step, index) => `<li class="${index === pkg.steps.length - 1 ? 'active' : 'done'}">${escapeHtml(step.label)}</li>`)
        .join('')
    : '';

  const error = card.querySelector('.pkg-error');
  error.hidden = !pkg.error;
  error.textContent = pkg.error || '';

  const result = card.querySelector('.pkg-result');
  result.hidden = !pkg.result;
  if (!pkg.result) return;

  const legend = (pkg.result.legend || [])
    .map(
      (item) => `
      <li>
        <span class="pin-no small">${item.number}</span>
        <span>
          <b>${escapeHtml(item.label || `Bölge ${item.number}`)}</b>
          <span class="hint">${escapeHtml(item.summary)}${item.swatch ? ' · yüklenen malzeme görseli' : ''}</span>
        </span>
        ${item.color?.hex ? `<i class="dot" style="background:${escapeHtml(item.color.hex)}"></i>` : ''}
      </li>`
    )
    .join('');

  result.innerHTML = `
    <div class="pkg-result-grid">
      <button type="button" class="thumb" data-open="${pkg.id}">
        <img src="${pkg.result.previewUrl}" alt="${escapeHtml(pkg.name)} alternatif render" />
        <span>Büyüt ve karşılaştır</span>
      </button>
      <div>
        <ul class="legend">${legend}</ul>
        <p class="hint">${escapeHtml(pkg.result.width)}×${escapeHtml(pkg.result.height)} px PNG · ${formatBytes(pkg.result.bytes)} · ${escapeHtml(pkg.result.provider.label)}</p>
        <p class="hint">${escapeHtml(pkg.result.resolutionNote)}</p>
        <div class="row-actions">
          <a class="primary small pkg-download" download="${escapeHtml(pkg.result.fileName)}">PNG indir</a>
          <button type="button" class="ghost small pkg-again">Yeniden üret</button>
        </div>
      </div>
    </div>`;

  result.querySelector('.thumb').addEventListener('click', () => openLightbox(pkg));
  result.querySelector('.pkg-again').addEventListener('click', () => renderPackage(pkg));
  const link = result.querySelector('.pkg-download');
  const blobUrl = state.blobUrls.get(pkg.id);
  if (blobUrl) link.href = blobUrl;
  else link.href = pkg.result.downloadUrl;
}

/**
 * PNG'i blob olarak indirir: panel şifreliyken <a href> başlık gönderemez.
 */
async function prepareDownload(pkg) {
  const previous = state.blobUrls.get(pkg.id);
  if (previous) {
    URL.revokeObjectURL(previous);
    state.blobUrls.delete(pkg.id);
  }
  try {
    const res = await fetch(pkg.result.downloadUrl, { headers: authHeaders() });
    if (!res.ok) throw new Error('PNG indirilemedi.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    state.blobUrls.set(pkg.id, url);
    paintPackageState(pkg);
  } catch {
    /* şifresiz kurulumda doğrudan bağlantı yeterli */
  }
}

/* ---------------- Karşılaştırma şeridi ---------------- */

function paintStrip() {
  const done = state.packages.filter((pkg) => pkg.result);
  el.compareStrip.hidden = done.length === 0;
  el.qcBlock.hidden = done.length === 0;
  if (!done.length) return;

  el.strip.innerHTML = [
    `<figure class="strip-item"><img src="${state.render.data}" alt="Referans render" /><figcaption>Referans</figcaption></figure>`,
    ...done.map(
      (pkg) => `
      <figure class="strip-item" data-open="${pkg.id}">
        <img src="${pkg.result.previewUrl}" alt="${escapeHtml(pkg.name)}" />
        <figcaption>${escapeHtml(pkg.name)}</figcaption>
      </figure>`
    )
  ].join('');

  el.strip.querySelectorAll('.strip-item[data-open]').forEach((node) => {
    node.addEventListener('click', () => {
      const pkg = state.packages.find((item) => item.id === node.dataset.open);
      if (pkg) openLightbox(pkg);
    });
  });
}

/* ---------------- Büyük görünüm ---------------- */

function openLightbox(pkg) {
  el.lbTitle.textContent = pkg.name;
  el.lbMeta.textContent = `${pkg.result.width}×${pkg.result.height} px · ${formatBytes(pkg.result.bytes)}`;
  el.lbAfter.src = pkg.result.previewUrl;
  el.lbBefore.src = pkg.result.sourcePreviewUrl || state.render.data;
  el.lbInstruction.textContent = pkg.result.instruction;
  el.lbDownload.setAttribute('download', pkg.result.fileName);
  el.lbDownload.href = state.blobUrls.get(pkg.id) || pkg.result.downloadUrl;
  el.lightbox.hidden = false;
  el.lbAfter.onload = sizeBefore;
  setCompare(50);
}

function closeLightbox() {
  el.lightbox.hidden = true;
}

function sizeBefore() {
  const width = el.lbCompare.clientWidth;
  const height = el.lbCompare.clientHeight;
  if (!width || !height) return;
  el.lbBefore.style.width = `${width}px`;
  el.lbBefore.style.height = `${height}px`;
}

function setCompare(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  el.lbBeforeWrap.style.width = `${clamped}%`;
  el.lbHandle.style.left = `${clamped}%`;
  el.lbRange.value = String(Math.round(clamped));
  sizeBefore();
}

function bindLightboxCompare() {
  let dragging = false;
  const update = (clientX) => {
    const rect = el.lbCompare.getBoundingClientRect();
    setCompare(((clientX - rect.left) / rect.width) * 100);
  };
  el.lbCompare.addEventListener('pointerdown', (event) => {
    dragging = true;
    el.lbCompare.setPointerCapture(event.pointerId);
    update(event.clientX);
  });
  el.lbCompare.addEventListener('pointermove', (event) => {
    if (dragging) update(event.clientX);
  });
  el.lbCompare.addEventListener('pointerup', () => { dragging = false; });
  el.lbCompare.addEventListener('pointercancel', () => { dragging = false; });
  el.lbRange.addEventListener('input', () => setCompare(Number(el.lbRange.value)));
  window.addEventListener('resize', sizeBefore);
}
