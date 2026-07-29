/* Mimari render fotogerçekçileştirme paneli — istemci mantığı */

const $ = (sel) => document.querySelector(sel);
const el = {
  providerBadge: $('#providerBadge'),
  renderDrop: $('#renderDrop'),
  renderInput: $('#renderInput'),
  unsupportedHint: $('#unsupportedHint'),
  refGrid: $('#refGrid'),
  refAdd: $('#refAdd'),
  refInput: $('#refInput'),
  modes: $('#modes'),
  scene: $('#scene'),
  time: $('#time'),
  weather: $('#weather'),
  aspect: $('#aspect'),
  aspectHint: $('#aspectHint'),
  outputLongEdge: $('#outputLongEdge'),
  provider: $('#provider'),
  apiKeyRow: $('#apiKeyRow'),
  apiKey: $('#apiKey'),
  apiKeyHint: $('#apiKeyHint'),
  rememberKey: $('#rememberKey'),
  lockScreen: $('#lockScreen'),
  lockForm: $('#lockForm'),
  lockPassword: $('#lockPassword'),
  lockError: $('#lockError'),
  prompt: $('#prompt'),
  promptChips: $('#promptChips'),
  submit: $('#submit'),
  submitHint: $('#submitHint'),
  idleState: $('#idleState'),
  progressState: $('#progressState'),
  errorState: $('#errorState'),
  errorText: $('#errorText'),
  errorBack: $('#errorBack'),
  resultState: $('#resultState'),
  steps: $('#steps'),
  downloadBtn: $('#downloadBtn'),
  compare: $('#compare'),
  beforeWrap: $('#beforeWrap'),
  beforeImg: $('#beforeImg'),
  afterImg: $('#afterImg'),
  compareHandle: $('#compareHandle'),
  compareRange: $('#compareRange'),
  summary: $('#summary'),
  facts: $('#facts'),
  checklist: $('#checklist'),
  instructionDump: $('#instructionDump'),
  againBtn: $('#againBtn'),
  editBtn: $('#editBtn')
};

const CAD_EXTENSIONS = ['skp', 'max', 'rvt', 'pln', 'dwg', 'dxf', '3dm', 'blend', 'fbx', 'obj', 'ifc', 'c4d'];

const PROMPT_CHIPS = [
  'Cephe kaplaması dokusunu gerçek ölçekte, derzleri okunur biçimde işle.',
  'Camlarda iç mekân derinliği görünsün, siyah boşluk olmasın.',
  'Peyzajı Akdeniz iklimine uygun, cepheyi kapatmayacak biçimde geliştir.',
  'Havuz suyunda doğal yansıma, kırılma ve çok hafif dalga olsun.',
  'Beton yüzeyler plastik görünmesin, ince kalıp dokusu taşısın.',
  'Zemin yansımalarını ve temas gölgelerini güçlendir.',
  'Ahşap damar yönü elemanın uzun eksenine paralel olsun.',
  'Ölçek okunurluğu için arka planda birkaç figür olsun, odak olmasınlar.'
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const state = {
  render: null,          // { name, type, data, width, height, previewUrl }
  references: [],
  mode: 'strict',
  config: null,
  jobId: null,
  polling: null,
  blobUrl: null,
  bound: false
};

/* ---------------- Oturum ---------------- */

const PASSWORD_KEY = 'panelPassword';
const API_KEY_STORE = 'panelApiKey';

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

async function unlock(event) {
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
}

/* ---------------- Başlangıç ---------------- */

el.lockForm.addEventListener('submit', unlock);
init().catch((err) => showError(err.message));

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

  renderModes(state.config.modes);
  renderProviders(state.config.providers, state.config.activeProvider);
  renderChips();

  const active = state.config.providers.find((p) => p.id === state.config.activeProvider);
  setProviderBadge(active);
  paintApiKeyRow(active);

  el.outputLongEdge.value = String(state.config.outputLongEdge);

  const remembered = localStorage.getItem(API_KEY_STORE);
  if (remembered) {
    el.apiKey.value = remembered;
    el.rememberKey.checked = true;
  }

  if (!state.bound) {
    bindEvents();
    state.bound = true;
  }
}

/** Sunucuda anahtar yoksa ve panel izin veriyorsa kullanıcı kendi anahtarını girebilir. */
function paintApiKeyRow(provider) {
  const usable = Boolean(state.config.allowClientKey && provider?.acceptsClientKey);
  el.apiKeyRow.hidden = !usable;
  if (!usable) return;
  el.apiKeyHint.textContent = provider.configured
    ? `Sunucuda anahtar tanımlı; boş bırakırsanız sunucunun anahtarı kullanılır. Kendi anahtarınızı girerseniz (${provider.keyHint}) yalnızca bu isteğin süresince kullanılır.`
    : `Bu sağlayıcı için sunucuda anahtar yok. Kendi anahtarınızı girin (${provider.keyHint}). Anahtar sunucuda saklanmaz, loglanmaz.`;
}

function renderModes(modes) {
  el.modes.innerHTML = modes
    .map(
      (mode, index) => `
      <label class="mode${index === 0 ? ' selected' : ''}">
        <input type="radio" name="mode" value="${mode.id}" ${index === 0 ? 'checked' : ''} />
        <span><b>${mode.label}</b><span>${mode.hint}</span></span>
      </label>`
    )
    .join('');

  el.modes.addEventListener('change', (event) => {
    if (event.target.name !== 'mode') return;
    state.mode = event.target.value;
    el.modes.querySelectorAll('.mode').forEach((node) => {
      node.classList.toggle('selected', node.querySelector('input').checked);
    });
  });
}

function renderProviders(providers, active) {
  const allowClientKey = Boolean(state.config?.allowClientKey);
  el.provider.innerHTML = providers
    .map((p) => {
      // Sunucuda anahtar yoksa bile, kullanıcı kendi anahtarını girebiliyorsa seçilebilir kalsın.
      const selectable = p.configured || (allowClientKey && p.acceptsClientKey);
      const suffix = p.configured ? '' : allowClientKey && p.acceptsClientKey ? ' — kendi anahtarınızla' : ' — anahtar yok';
      return `<option value="${p.id}" ${p.id === active ? 'selected' : ''} ${selectable ? '' : 'disabled'}>${p.label}${suffix}</option>`;
    })
    .join('');
}

function setProviderBadge(provider) {
  if (!provider) return;
  el.providerBadge.textContent = `${provider.label} · ${provider.model}`;
  el.providerBadge.classList.toggle('warn', provider.id === 'mock');
  el.providerBadge.title = provider.note || '';
}

function renderChips() {
  el.promptChips.innerHTML = PROMPT_CHIPS.map((text) => `<button type="button" class="chip">${text}</button>`).join('');
  el.promptChips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    const current = el.prompt.value.trim();
    el.prompt.value = current ? `${current}\n${chip.textContent}` : chip.textContent;
    el.prompt.focus();
  });
}

/* ---------------- Olaylar ---------------- */

function bindEvents() {
  el.renderDrop.addEventListener('click', (event) => {
    if (event.target.closest('[data-clear]')) return;
    el.renderInput.click();
  });
  el.renderDrop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      el.renderInput.click();
    }
  });
  el.renderInput.addEventListener('change', (event) => {
    if (event.target.files[0]) loadRender(event.target.files[0]);
    event.target.value = '';
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
  el.renderDrop.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) loadRender(file);
  });

  el.renderDrop.addEventListener('click', (event) => {
    if (!event.target.closest('[data-clear]')) return;
    event.stopPropagation();
    state.render = null;
    paintRenderSlot();
  });

  el.refAdd.addEventListener('click', () => el.refInput.click());
  el.refInput.addEventListener('change', async (event) => {
    for (const file of [...event.target.files]) {
      if (state.references.length >= state.config.maxReferenceImages) break;
      const parsed = await readFile(file);
      if (parsed) state.references.push(parsed);
    }
    event.target.value = '';
    paintReferences();
  });

  el.aspect.addEventListener('change', () => {
    el.aspectHint.hidden = el.aspect.value === 'source';
  });

  el.provider.addEventListener('change', () => {
    const provider = state.config.providers.find((p) => p.id === el.provider.value);
    setProviderBadge(provider);
    paintApiKeyRow(provider);
  });

  el.rememberKey.addEventListener('change', () => {
    if (el.rememberKey.checked && el.apiKey.value.trim()) {
      localStorage.setItem(API_KEY_STORE, el.apiKey.value.trim());
    } else {
      localStorage.removeItem(API_KEY_STORE);
    }
  });
  el.apiKey.addEventListener('change', () => {
    if (el.rememberKey.checked && el.apiKey.value.trim()) {
      localStorage.setItem(API_KEY_STORE, el.apiKey.value.trim());
    }
  });

  el.submit.addEventListener('click', submit);
  el.againBtn.addEventListener('click', submit);
  el.editBtn.addEventListener('click', showIdle);
  el.errorBack.addEventListener('click', showIdle);

  bindCompare();
  window.addEventListener('resize', sizeBeforeImage);
}

/* ---------------- Dosya işleme ---------------- */

function extensionOf(name = '') {
  return name.split('.').pop().toLowerCase();
}

async function readFile(file) {
  const ext = extensionOf(file.name);
  if (CAD_EXTENSIONS.includes(ext)) {
    showUnsupported(ext);
    return null;
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showUnsupported(ext || file.type);
    return null;
  }
  if (file.size > state.config.maxUploadMB * 1024 * 1024) {
    showUnsupported(null, `Dosya ${state.config.maxUploadMB} MB sınırını aşıyor.`);
    return null;
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
    `<b>${(ext || 'Bu dosya').toUpperCase()}</b> dosyasının geometrisi güvenilir biçimde okunamaz, bu yüzden mimari tahmin edilmez.
     Lütfen şunlardan uygun olanları yükleyin: PNG/JPG ham render, farklı kamera açıları, clay render, normal veya depth map,
     Material/Object ID pass, plan-kesit-görünüş PDF’leri, malzeme listesi.`;
}

async function loadRender(file) {
  const parsed = await readFile(file);
  if (!parsed) return;
  state.render = parsed;
  paintRenderSlot();
}

function paintRenderSlot() {
  const empty = el.renderDrop.querySelector('.dz-empty');
  const filled = el.renderDrop.querySelector('.dz-filled');

  if (!state.render) {
    empty.hidden = false;
    filled.hidden = true;
    el.submit.disabled = true;
    el.submitHint.textContent = 'Başlamak için ham renderı yükleyin.';
    return;
  }

  empty.hidden = true;
  filled.hidden = false;
  filled.querySelector('img').src = state.render.data;
  const ratio = state.render.height ? (state.render.width / state.render.height).toFixed(2) : '—';
  filled.querySelector('.dz-meta').textContent =
    `${state.render.name} · ${state.render.width}×${state.render.height} px · oran ${ratio} · ${formatBytes(state.render.bytes)}`;

  el.submit.disabled = false;
  el.submitHint.textContent = 'Mimari geometri ve kamera korunur; yalnızca gerçekçilik geliştirilir.';
}

function paintReferences() {
  el.refGrid.querySelectorAll('.ref-item').forEach((node) => node.remove());
  state.references.forEach((ref, index) => {
    const item = document.createElement('div');
    item.className = 'ref-item';
    item.innerHTML = `<img src="${ref.data}" alt="Referans ${index + 1}" /><button type="button" title="Kaldır">×</button>`;
    item.querySelector('button').addEventListener('click', () => {
      state.references.splice(index, 1);
      paintReferences();
    });
    el.refGrid.insertBefore(item, el.refAdd);
  });
  el.refAdd.hidden = state.references.length >= state.config.maxReferenceImages;
}

/* ---------------- Üretim ---------------- */

async function submit() {
  if (!state.render) return;

  showProgress();
  try {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        render: { name: state.render.name, type: state.render.type, data: state.render.data },
        references: state.references.map((ref) => ({ name: ref.name, type: ref.type, data: ref.data })),
        mode: state.mode,
        scene: el.scene.value,
        time: el.time.value,
        weather: el.weather.value,
        aspect: el.aspect.value,
        prompt: el.prompt.value,
        provider: el.provider.value,
        apiKey: el.apiKeyRow.hidden ? '' : el.apiKey.value.trim(),
        outputLongEdge: Number(el.outputLongEdge.value)
      })
    });

    const payload = await res.json();
    if (res.status === 401) {
      sessionStorage.removeItem(PASSWORD_KEY);
      showLock('Oturum sona erdi, şifreyi tekrar girin.');
      return;
    }
    if (!res.ok) throw new Error(payload.error || 'İstek reddedildi.');

    state.jobId = payload.id;
    poll();
  } catch (err) {
    showError(err.message);
  }
}

function poll() {
  clearInterval(state.polling);
  state.polling = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${state.jobId}`, { headers: authHeaders() });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || 'İş durumu alınamadı.');

      paintSteps(job.steps, job.status);

      if (job.status === 'done') {
        clearInterval(state.polling);
        showResult(job.result);
      } else if (job.status === 'error') {
        clearInterval(state.polling);
        showError(job.error);
      }
    } catch (err) {
      clearInterval(state.polling);
      showError(err.message);
    }
  }, 1200);
}

function paintSteps(steps, status) {
  el.steps.innerHTML = steps
    .map((step, index) => {
      const isLast = index === steps.length - 1;
      const cls = status === 'done' || !isLast ? 'done' : 'active';
      return `<li class="${cls}">${step.label}</li>`;
    })
    .join('');
}

/* ---------------- Görünümler ---------------- */

function only(node) {
  [el.idleState, el.progressState, el.errorState, el.resultState].forEach((section) => {
    section.hidden = section !== node;
  });
}

function showIdle() { only(el.idleState); }

function showProgress() {
  el.steps.innerHTML = '<li class="active">İstek gönderiliyor</li>';
  only(el.progressState);
}

function showError(message) {
  el.errorText.textContent = message || 'Bilinmeyen hata.';
  only(el.errorState);
}

function showResult(result) {
  el.afterImg.src = result.previewUrl;
  el.beforeImg.src = result.sourcePreviewUrl;
  el.afterImg.onload = sizeBeforeImage;

  el.downloadBtn.setAttribute('download', result.fileName);
  prepareDownload(result);

  el.summary.textContent =
    'Render fotogerçekçi hale getirildi. Mimari geometri ve kamera açısı korunarak malzeme, ışık, cam, peyzaj ve yüzey detayları geliştirildi.';

  const facts = [
    ['Çıktı', `${result.width}×${result.height} px PNG`],
    ['Dosya boyutu', formatBytes(result.bytes)],
    ['Kaynak', `${result.source.width}×${result.source.height} px`],
    ['Model çıktısı (gerçek)', `${result.modelNative.width}×${result.modelNative.height} px`],
    ['Yükseltme', result.upscaled ? `${result.scaleFactor}× Lanczos` : 'gerekmedi'],
    ['Mod', result.mode],
    ['Sağlayıcı', result.provider.label]
  ];
  if (result.aspectMismatch) {
    facts.push([
      'Oran uyarısı',
      `istenen ${result.aspectMismatch.requested}, üretilen ${result.aspectMismatch.produced} (%${result.aspectMismatch.deviationPct} sapma) — kırpma yapılmadı`
    ]);
  }
  el.facts.innerHTML = facts
    .map(([term, value], index) => {
      const warn = result.aspectMismatch && index === facts.length - 1 ? ' class="warn"' : '';
      return `<div${warn}><dt>${term}</dt><dd>${value}</dd></div>`;
    })
    .join('');

  const notes = [result.resolutionNote, result.providerText].filter(Boolean).join(' ');
  el.checklist.innerHTML =
    result.checklist.map((item) => `<li><label><input type="checkbox" /> <span>${item}</span></label></li>`).join('') +
    (notes ? `<li class="hint">${notes}</li>` : '');

  el.instructionDump.textContent = result.instruction;

  only(el.resultState);
  setCompare(50);
}

/**
 * PNG'i blob olarak indirir. Panel şifreliyken <a href> başlık gönderemeyeceği için
 * dosya yetkili istekle çekilip object URL'e bağlanır.
 */
async function prepareDownload(result) {
  if (state.blobUrl) {
    URL.revokeObjectURL(state.blobUrl);
    state.blobUrl = null;
  }

  el.downloadBtn.textContent = 'PNG hazırlanıyor…';
  el.downloadBtn.removeAttribute('href');

  try {
    const res = await fetch(result.downloadUrl, { headers: authHeaders() });
    if (!res.ok) throw new Error('PNG indirilemedi.');
    const blob = await res.blob();
    state.blobUrl = URL.createObjectURL(blob);
    el.downloadBtn.href = state.blobUrl;
    el.downloadBtn.textContent = `PNG indir · ${formatBytes(blob.size)}`;
  } catch (err) {
    el.downloadBtn.textContent = 'PNG indir';
    el.downloadBtn.href = result.downloadUrl; // şifresiz kurulumda doğrudan bağlantı yeterli
  }
}

/* ---------------- Karşılaştırma sürgüsü ---------------- */

function sizeBeforeImage() {
  const width = el.compare.clientWidth;
  const height = el.compare.clientHeight;
  if (!width || !height) return;
  el.beforeImg.style.width = `${width}px`;
  el.beforeImg.style.height = `${height}px`;
}

function setCompare(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  el.beforeWrap.style.width = `${clamped}%`;
  el.compareHandle.style.left = `${clamped}%`;
  el.compareRange.value = String(Math.round(clamped));
  sizeBeforeImage();
}

function bindCompare() {
  let dragging = false;

  const update = (clientX) => {
    const rect = el.compare.getBoundingClientRect();
    setCompare(((clientX - rect.left) / rect.width) * 100);
  };

  el.compare.addEventListener('pointerdown', (event) => {
    dragging = true;
    el.compare.setPointerCapture(event.pointerId);
    update(event.clientX);
  });
  el.compare.addEventListener('pointermove', (event) => {
    if (dragging) update(event.clientX);
  });
  el.compare.addEventListener('pointerup', () => { dragging = false; });
  el.compare.addEventListener('pointercancel', () => { dragging = false; });

  el.compareRange.addEventListener('input', () => setCompare(Number(el.compareRange.value)));
}
