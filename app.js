import { buildSystemPrompt, ART_DIRECTIONS } from './skill.js';

const STORAGE_KEY = 'slidepro.apiKey';
const MODEL_KEY = 'slidepro.model';
const GEMINI_KEY = 'slidepro.geminiKey';
const GEMINI_MODEL_KEY = 'slidepro.geminiModel';
const GEN_IMAGE_KEY = 'slidepro.genImage';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-image';

const GEMINI_MODEL_MIGRATIONS = {
  'gemini-2.5-flash-image-preview': 'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation': 'gemini-2.5-flash-image',
  'imagen-3.0-generate-002': 'imagen-4.0-generate-001',
};

const els = {
  textInput: document.getElementById('text-input'),
  fileInput: document.getElementById('file-input'),
  uploadBtn: document.getElementById('upload-btn'),
  imageChip: document.getElementById('image-chip'),
  imageChipName: document.getElementById('image-chip-name'),
  imagePreview: document.getElementById('image-preview'),
  removeImage: document.getElementById('remove-image'),
  generateBtn: document.getElementById('generate-btn'),
  resultsSection: document.getElementById('results-section'),
  resultsGrid: document.getElementById('results-grid'),
  briefSummary: document.getElementById('brief-summary'),
  statusBar: document.getElementById('status-bar'),
  progress: document.getElementById('progress'),
  progressStage: document.getElementById('progress-stage'),
  progressCount: document.getElementById('progress-count'),
  progressFill: document.getElementById('progress-fill'),
  progressDetail: document.getElementById('progress-detail'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  settingsClose: document.getElementById('settings-close'),
  apiKeyInput: document.getElementById('api-key-input'),
  modelSelect: document.getElementById('model-select'),
  geminiKeyInput: document.getElementById('gemini-key-input'),
  geminiModelSelect: document.getElementById('gemini-model-select'),
  saveSettings: document.getElementById('save-settings'),
  apiStatus: document.getElementById('api-status'),
  geminiStatus: document.getElementById('gemini-status'),
  lightbox: document.getElementById('lightbox'),
  lightboxClose: document.getElementById('lightbox-close'),
  lightboxImage: document.getElementById('lightbox-image'),
  lightboxBadge: document.getElementById('lightbox-badge'),
  lightboxTitle: document.getElementById('lightbox-title'),
  lightboxSub: document.getElementById('lightbox-sub'),
  lightboxPrompt: document.getElementById('lightbox-prompt'),
  lightboxCopy: document.getElementById('lightbox-copy'),
  lightboxCopyLabel: document.getElementById('lightbox-copy-label'),
  lightboxRegen: document.getElementById('lightbox-regen'),
  lightboxDownload: document.getElementById('lightbox-download'),
  toolbarModelSelect: document.getElementById('toolbar-model-select'),
  regenAllBtn: document.getElementById('regen-all-btn'),
  regenAllLabel: document.querySelector('.regen-all-label'),
  genImageToggle: document.getElementById('gen-image-toggle'),
  genImageWarning: document.getElementById('gen-image-warning'),
};

let currentImage = null;
let cardStates = [];
let activeLightboxIdx = null;
let isQueueRunning = false;
let serverConfig = { hasClaudeEnvKey: false, hasGeminiEnvKey: false };

async function loadServerConfig() {
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    if (r.ok) {
      serverConfig = await r.json();
    }
  } catch (e) {
    // Static-host fallback (no backend) — leave defaults; user must enter own keys.
  }
}

const hasClaudeAccess = () => serverConfig.hasClaudeEnvKey || !!getApiKey();
const hasGeminiAccess = () => serverConfig.hasGeminiEnvKey || !!getGeminiKey();

const getApiKey = () => localStorage.getItem(STORAGE_KEY) || '';
const getModel = () => localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
const getGeminiKey = () => localStorage.getItem(GEMINI_KEY) || '';
const getGenImageEnabled = () => localStorage.getItem(GEN_IMAGE_KEY) === '1';
const setGenImageEnabled = (on) => {
  if (on) localStorage.setItem(GEN_IMAGE_KEY, '1');
  else localStorage.removeItem(GEN_IMAGE_KEY);
};
function getGeminiModel() {
  const stored = localStorage.getItem(GEMINI_MODEL_KEY);
  if (!stored) return DEFAULT_GEMINI_MODEL;
  if (GEMINI_MODEL_MIGRATIONS[stored]) {
    const migrated = GEMINI_MODEL_MIGRATIONS[stored];
    localStorage.setItem(GEMINI_MODEL_KEY, migrated);
    return migrated;
  }
  return stored;
}

function setGeminiModel(model) {
  localStorage.setItem(GEMINI_MODEL_KEY, model);
  updateApiStatus();
  if (els.toolbarModelSelect && els.toolbarModelSelect.value !== model) {
    els.toolbarModelSelect.value = model;
  }
  if (els.geminiModelSelect && els.geminiModelSelect.value !== model) {
    els.geminiModelSelect.value = model;
  }
}

function updateApiStatus() {
  if (serverConfig.hasClaudeEnvKey) {
    els.apiStatus.textContent = `Claude · ใช้ค่าจาก Railway`;
    els.apiStatus.className = 'api-status ok';
  } else if (getApiKey()) {
    els.apiStatus.textContent = `Claude · ${getModel()}`;
    els.apiStatus.className = 'api-status ok';
  } else {
    els.apiStatus.textContent = 'Claude: ยังไม่ตั้งค่า';
    els.apiStatus.className = 'api-status warn';
  }
  if (serverConfig.hasGeminiEnvKey) {
    els.geminiStatus.textContent = `Gemini · ใช้ค่าจาก Railway`;
    els.geminiStatus.className = 'api-status ok';
  } else if (getGeminiKey()) {
    els.geminiStatus.textContent = `Gemini · ${shortenModel(getGeminiModel())}`;
    els.geminiStatus.className = 'api-status ok';
  } else {
    els.geminiStatus.textContent = 'Gemini: ยังไม่ตั้งค่า';
    els.geminiStatus.className = 'api-status warn';
  }
}

function updateRegenAllBtn() {
  if (!els.regenAllBtn) return;
  const hasCards = cardStates.length > 0;
  els.regenAllBtn.disabled = isQueueRunning || !hasCards;
  els.regenAllLabel.textContent = isQueueRunning ? 'กำลังสร้าง...' : 'Generate รูปใหม่ทั้งหมด';
}

function updateGenImageUI() {
  const on = els.genImageToggle.checked;
  els.genImageWarning.classList.toggle('visible', on);
  setGenImageEnabled(on);
}

function shortenModel(m) {
  return m.replace('gemini-', 'g-').replace('-preview', '').replace('imagen-', 'imagen-');
}

function setStatus(msg, type = 'info') {
  els.statusBar.textContent = msg;
  els.statusBar.className = `status-bar ${type}`;
  els.statusBar.style.display = msg ? 'block' : 'none';
}

function showProgress(stage, { count = '', detail = '', percent = null, tone = 'active' } = {}) {
  els.progress.style.display = 'block';
  els.progress.className = `progress tone-${tone}`;
  els.progressStage.textContent = stage;
  els.progressCount.textContent = count;
  els.progressDetail.textContent = detail;
  if (percent === null) {
    els.progressFill.style.width = '0%';
    els.progressFill.classList.add('indeterminate');
  } else {
    els.progressFill.classList.remove('indeterminate');
    els.progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }
}

function hideProgress() {
  els.progress.style.display = 'none';
}

function openSettings() {
  // Claude
  if (serverConfig.hasClaudeEnvKey) {
    els.apiKeyInput.value = '';
    els.apiKeyInput.placeholder = '••••••••••••••••  (อ่านจาก Railway env แล้ว)';
    els.apiKeyInput.disabled = true;
    document.getElementById('claude-env-note').style.display = 'flex';
  } else {
    els.apiKeyInput.value = getApiKey();
    els.apiKeyInput.placeholder = 'sk-ant-api03-...';
    els.apiKeyInput.disabled = false;
    document.getElementById('claude-env-note').style.display = 'none';
  }
  els.modelSelect.value = getModel();

  // Gemini
  if (serverConfig.hasGeminiEnvKey) {
    els.geminiKeyInput.value = '';
    els.geminiKeyInput.placeholder = '••••••••••••••••  (อ่านจาก Railway env แล้ว)';
    els.geminiKeyInput.disabled = true;
    document.getElementById('gemini-env-note').style.display = 'flex';
  } else {
    els.geminiKeyInput.value = getGeminiKey();
    els.geminiKeyInput.placeholder = 'AIzaSy...';
    els.geminiKeyInput.disabled = false;
    document.getElementById('gemini-env-note').style.display = 'none';
  }
  els.geminiModelSelect.value = getGeminiModel();

  els.settingsModal.classList.add('open');
}

function closeSettings() {
  els.settingsModal.classList.remove('open');
}

function saveSettings() {
  const key = els.apiKeyInput.value.trim();
  const model = els.modelSelect.value;
  const gKey = els.geminiKeyInput.value.trim();
  const gModel = els.geminiModelSelect.value;

  if (key) localStorage.setItem(STORAGE_KEY, key); else localStorage.removeItem(STORAGE_KEY);
  if (gKey) localStorage.setItem(GEMINI_KEY, gKey); else localStorage.removeItem(GEMINI_KEY);
  localStorage.setItem(MODEL_KEY, model);
  setGeminiModel(gModel);
  closeSettings();
  setStatus('บันทึกการตั้งค่าแล้ว', 'success');
  setTimeout(() => setStatus(''), 2000);

  if (gKey && cardStates.length && cardStates.some(s => s.status === 'no-key')) {
    runImageQueue();
  }
}

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ media_type: file.type, data: base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function handleImageChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('กรุณาเลือกไฟล์รูปภาพ', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    currentImage = { file, dataUrl: ev.target.result };
    els.imagePreview.src = ev.target.result;
    els.imageChipName.textContent = file.name;
    els.imageChip.classList.add('visible');
    els.uploadBtn.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

function removeImage(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  currentImage = null;
  els.fileInput.value = '';
  els.imagePreview.src = '';
  els.imageChip.classList.remove('visible');
  els.uploadBtn.classList.remove('has-image');
}

function autoResizeTextarea() {
  els.textInput.style.height = 'auto';
  const next = Math.min(els.textInput.scrollHeight, 200);
  els.textInput.style.height = next + 'px';
}

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1]);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
  throw new Error('ไม่พบ JSON ใน response');
}

async function callClaude(userText, imageData) {
  if (!hasClaudeAccess()) throw new Error('NO_API_KEY');

  const userContent = [];
  if (imageData) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: imageData.media_type, data: imageData.data }
    });
  }
  userContent.push({
    type: 'text',
    text: userText || 'สรุปเรื่องในรูปนี้เป็นสไลด์ 1 หน้า 16:9'
  });

  const body = {
    model: getModel(),
    max_tokens: 16000,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: userContent }]
  };

  const headers = { 'content-type': 'application/json' };
  if (!serverConfig.hasClaudeEnvKey && getApiKey()) {
    headers['x-user-claude-key'] = getApiKey();
  }

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errBody = '';
    try { errBody = JSON.stringify(await res.json()); } catch { errBody = await res.text(); }
    throw new Error(`Claude API ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('ไม่พบเนื้อหา text ใน response');
  return extractJson(textBlock.text);
}

async function callGeminiImage(prompt) {
  if (!hasGeminiAccess()) throw new Error('NO_GEMINI_KEY');
  const model = getGeminiModel();
  const isImagen = model.startsWith('imagen-');

  const headers = { 'content-type': 'application/json' };
  if (!serverConfig.hasGeminiEnvKey && getGeminiKey()) {
    headers['x-user-gemini-key'] = getGeminiKey();
  }

  let payload;
  if (isImagen) {
    payload = {
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9' }
    };
  } else {
    payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } }
      }
    };
  }

  const post = (body) => fetch('/api/gemini-image', {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, isImagen, payload: body }),
  });

  let res = await post(payload);

  if (!res.ok && !isImagen && res.status === 400) {
    const errText = await res.text();
    if (/responseFormat|imageConfig|generation_config/i.test(errText)) {
      payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      };
      res = await post(payload);
    } else {
      throw new Error(`Gemini API ${res.status}: ${errText}`);
    }
  }

  if (!res.ok) {
    let errBody = '';
    try { errBody = JSON.stringify(await res.json()); } catch { errBody = await res.text(); }
    throw new Error(`Gemini API ${res.status}: ${errBody}`);
  }
  const data = await res.json();

  if (isImagen) {
    const pred = (data.predictions || [])[0];
    const b64 = pred?.bytesBase64Encoded || pred?.image?.imageBytes;
    const mime = pred?.mimeType || 'image/png';
    if (!b64) throw new Error('Imagen ไม่ส่งภาพกลับมา');
    return { mime, data: b64 };
  }

  const cand = (data.candidates || [])[0];
  const parts = cand?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.data || p.inline_data?.data);
  if (!imgPart) {
    const textPart = parts.find(p => p.text);
    const reason = textPart?.text || cand?.finishReason || 'unknown';
    throw new Error('Gemini ไม่ส่งภาพกลับ — ' + reason);
  }
  const inline = imgPart.inlineData || imgPart.inline_data;
  return { mime: inline.mimeType || inline.mime_type || 'image/png', data: inline.data };
}

function renderBrief(result) {
  els.briefSummary.innerHTML = `
    <div class="brief-row"><span class="brief-label">หัวข้อ:</span> ${escapeHtml(result.topic || '')}</div>
    <div class="brief-row"><span class="brief-label">HEADLINE:</span> ${escapeHtml(result.headline || '')}</div>
    <div class="brief-row"><span class="brief-label">SUBTITLE:</span> ${escapeHtml(result.subtitle || '')}</div>
    <div class="brief-row"><span class="brief-label">ITEMS (${(result.items||[]).length}):</span></div>
    <ol class="brief-items">
      ${(result.items||[]).map(i => `<li><strong>${escapeHtml(i.title)}</strong> — ${escapeHtml(i.desc)} <em>(${escapeHtml(i.icon||'')})</em></li>`).join('')}
    </ol>
    ${result.footer ? `<div class="brief-row"><span class="brief-label">FOOTER:</span> ${escapeHtml(result.footer)}</div>` : ''}
  `;
}

function renderGrid() {
  els.resultsGrid.innerHTML = '';
  cardStates.forEach((state, idx) => {
    const meta = ART_DIRECTIONS.find(a => a.id === state.id) || { short: '' };
    const card = document.createElement('article');
    card.className = `image-card status-${state.status}`;
    card.dataset.idx = String(idx);

    let visual = '';
    if (state.status === 'prompt-only') {
      visual = `
        <div class="state-overlay prompt-only">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
          <div class="state-text">Prompt พร้อมใช้</div>
          <div class="state-sub">คลิกเพื่อดูและคัดลอก prompt · กดปุ่ม Generate ด้านบนเพื่อสร้างภาพ</div>
        </div>`;
    } else if (state.status === 'queued') {
      visual = `
        <div class="state-overlay queued">
          <div class="queue-pill"><span class="queue-dot"></span>เข้าคิว</div>
        </div>`;
    } else if (state.status === 'generating') {
      visual = `
        <div class="state-overlay generating">
          <div class="spinner-lg"></div>
          <div class="state-text">กำลังสร้างภาพ...</div>
          <div class="state-sub">${escapeHtml(shortenModel(getGeminiModel()))}</div>
        </div>`;
    } else if (state.status === 'done') {
      const dataUrl = `data:${state.image.mime};base64,${state.image.data}`;
      visual = `<img class="card-image" src="${dataUrl}" alt="${escapeHtml(state.name)}">
                <div class="card-image-overlay"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M21 14v7H3V3h7"/></svg> คลิกเพื่อดูภาพเต็ม + prompt</div>`;
    } else if (state.status === 'error') {
      visual = `
        <div class="state-overlay error">
          <div class="error-mark">!</div>
          <div class="state-text">สร้างภาพไม่สำเร็จ</div>
          <div class="state-sub">${escapeHtml(state.error || '').slice(0, 120)}</div>
          <button class="retry-btn" type="button">ลองอีกครั้ง</button>
        </div>`;
    } else if (state.status === 'no-key') {
      visual = `
        <div class="state-overlay no-key">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          <div class="state-text">ยังไม่ตั้งค่า Gemini API Key</div>
          <button class="settings-shortcut" type="button">ไปที่ Settings</button>
        </div>`;
    }

    card.innerHTML = `
      <div class="card-visual">${visual}</div>
      <div class="card-meta">
        <span class="card-badge">${state.id}</span>
        <div class="card-meta-text">
          <h3 class="card-title">${escapeHtml(state.name)}</h3>
          <p class="card-sub">${escapeHtml(meta.short)}</p>
        </div>
      </div>
    `;

    if (state.status === 'done' || state.status === 'prompt-only') {
      card.querySelector('.card-visual').addEventListener('click', () => openLightbox(idx));
    }
    if (state.status === 'error') {
      card.querySelector('.retry-btn').addEventListener('click', () => retryOne(idx));
    }
    if (state.status === 'no-key') {
      card.querySelector('.settings-shortcut').addEventListener('click', openSettings);
    }

    els.resultsGrid.appendChild(card);
  });
}

async function runImageQueue() {
  if (isQueueRunning) return;
  if (!hasGeminiAccess()) {
    cardStates.forEach(s => { if (s.status !== 'done') s.status = 'no-key'; });
    renderGrid();
    showProgress('ยังไม่ตั้งค่า Gemini API Key', {
      count: '',
      detail: 'ไปที่ Settings เพื่อใส่ Gemini API Key แล้วระบบจะเริ่มสร้างภาพอัตโนมัติ',
      percent: 0,
      tone: 'warn',
    });
    return;
  }

  isQueueRunning = true;
  updateRegenAllBtn();

  try {
    const pending = cardStates
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.status !== 'done');

    pending.forEach(({ i }) => cardStates[i].status = 'queued');
    renderGrid();

    let done = cardStates.filter(s => s.status === 'done').length;
    let failed = 0;
    const total = cardStates.length;

    for (let k = 0; k < pending.length; k++) {
      const idx = pending[k].i;
      const state = cardStates[idx];
      state.status = 'generating';
      state.error = null;
      renderGrid();

      const current = done + failed + 1;
      showProgress(`กำลังสร้างภาพใน Gemini · ${state.name}`, {
        count: `${current}/${total}`,
        detail: `โมเดล ${getGeminiModel()} · ภาพอาจใช้เวลา 10–40 วินาทีต่อรูป`,
        percent: (current - 1) / total * 100,
        tone: 'active',
      });

      try {
        const img = await callGeminiImage(state.prompt);
        state.status = 'done';
        state.image = img;
        done++;
      } catch (e) {
        state.status = 'error';
        state.error = e.message;
        failed++;
      }
      renderGrid();
    }

    if (failed === 0) {
      showProgress('เสร็จสิ้น', {
        count: `${done}/${total}`,
        detail: `สร้างภาพสำเร็จทั้ง ${done} รูป (โมเดล ${getGeminiModel()}) — คลิกที่ภาพเพื่อดูเต็มและ copy prompt`,
        percent: 100,
        tone: 'success',
      });
    } else {
      showProgress('เสร็จสิ้น (มีบางรูปที่ผิดพลาด)', {
        count: `${done}/${total}`,
        detail: `สำเร็จ ${done} รูป · ผิดพลาด ${failed} รูป — กดปุ่ม "ลองอีกครั้ง" บนการ์ดที่ error`,
        percent: 100,
        tone: 'warn',
      });
    }
  } finally {
    isQueueRunning = false;
    updateRegenAllBtn();
  }
}

async function regenerateAllImages() {
  if (isQueueRunning || !cardStates.length) return;
  if (!hasGeminiAccess()) {
    setStatus('⚠ ยังไม่ตั้งค่า Gemini API Key — กดปุ่ม Settings มุมขวาบน', 'error');
    openSettings();
    return;
  }
  cardStates.forEach(s => {
    s.status = 'queued';
    s.image = null;
    s.error = null;
  });
  renderGrid();
  showProgress(`กำลัง regenerate ภาพทั้งหมดด้วย ${getGeminiModel()}`, {
    count: `0/${cardStates.length}`,
    detail: 'ใช้ prompts ชุดเดิมจาก Claude — ไม่ต้องเรียก Claude ใหม่',
    percent: 0,
    tone: 'active',
  });
  await runImageQueue();
}

async function retryOne(idx) {
  const state = cardStates[idx];
  if (!hasGeminiAccess()) {
    openSettings();
    return;
  }
  state.status = 'generating';
  state.error = null;
  renderGrid();
  showProgress(`กำลังสร้างภาพใหม่ · ${state.name}`, {
    count: '',
    detail: `โมเดล ${getGeminiModel()}`,
    percent: null,
    tone: 'active',
  });
  try {
    const img = await callGeminiImage(state.prompt);
    state.status = 'done';
    state.image = img;
  } catch (e) {
    state.status = 'error';
    state.error = e.message;
  }
  renderGrid();
  const done = cardStates.filter(s => s.status === 'done').length;
  const failed = cardStates.filter(s => s.status === 'error').length;
  showProgress('เสร็จสิ้น', {
    count: `${done}/${cardStates.length}`,
    detail: failed ? `ยังเหลือ ${failed} รูปที่ error` : `สร้างภาพสำเร็จทั้งหมด`,
    percent: 100,
    tone: failed ? 'warn' : 'success',
  });
}

function openLightbox(idx) {
  const state = cardStates[idx];
  if (!state || (state.status !== 'done' && state.status !== 'prompt-only')) return;
  activeLightboxIdx = idx;
  const meta = ART_DIRECTIONS.find(a => a.id === state.id) || { short: '' };
  els.lightboxBadge.textContent = state.id;
  els.lightboxTitle.textContent = state.name;
  els.lightboxSub.textContent = meta.short;
  els.lightboxPrompt.textContent = state.prompt;
  els.lightboxCopyLabel.textContent = 'Copy prompt';
  els.lightboxCopy.classList.remove('copied');

  const side = document.querySelector('.lightbox-image-side');
  let placeholder = side.querySelector('.lightbox-placeholder');

  if (state.image) {
    const dataUrl = `data:${state.image.mime};base64,${state.image.data}`;
    els.lightboxImage.src = dataUrl;
    els.lightboxImage.alt = state.name;
    els.lightboxImage.style.display = '';
    els.lightboxDownload.style.display = '';
    els.lightboxDownload.href = dataUrl;
    els.lightboxDownload.download = `slidepro-${state.id}-${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    if (placeholder) placeholder.remove();
  } else {
    els.lightboxImage.style.display = 'none';
    els.lightboxImage.src = '';
    els.lightboxDownload.style.display = 'none';
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'lightbox-placeholder';
      side.appendChild(placeholder);
    }
    placeholder.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <div class="placeholder-title">ยังไม่ได้สร้างภาพ</div>
      <div class="placeholder-sub">คัดลอก prompt ไปวางที่ Gemini เอง<br>หรือกดปุ่ม Regenerate ด้านขวาเพื่อให้ระบบ gen ให้ (ใช้ Gemini API key + มีค่าใช้จ่าย)</div>
    `;
  }

  els.lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  els.lightbox.classList.remove('open');
  document.body.style.overflow = '';
  activeLightboxIdx = null;
}

async function copyPromptFromLightbox() {
  if (activeLightboxIdx === null) return;
  const state = cardStates[activeLightboxIdx];
  try {
    await navigator.clipboard.writeText(state.prompt);
    els.lightboxCopy.classList.add('copied');
    els.lightboxCopyLabel.textContent = 'คัดลอกแล้ว!';
    setTimeout(() => {
      els.lightboxCopy.classList.remove('copied');
      els.lightboxCopyLabel.textContent = 'Copy prompt';
    }, 1500);
  } catch (e) {
    setStatus('คัดลอกไม่สำเร็จ: ' + e.message, 'error');
  }
}

async function regenFromLightbox() {
  if (activeLightboxIdx === null) return;
  const idx = activeLightboxIdx;
  closeLightbox();
  await retryOne(idx);
  if (cardStates[idx].status === 'done') openLightbox(idx);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function onGenerate() {
  const text = els.textInput.value.trim();
  if (!text && !currentImage) {
    setStatus('กรุณาใส่หัวข้อ (ข้อความ) หรือแนบรูปภาพอย่างน้อย 1 อย่าง', 'error');
    return;
  }
  if (!hasClaudeAccess()) {
    setStatus('⚠ ยังไม่ได้ตั้งค่า Claude API Key — กดปุ่ม Settings มุมขวาบน', 'error');
    openSettings();
    return;
  }

  els.generateBtn.disabled = true;
  els.generateBtn.classList.add('loading');
  setStatus('', 'info');

  showProgress('ขั้นตอนที่ 1/2 · ประมวลผลใน Claude', {
    count: '',
    detail: `วิเคราะห์หัวข้อและสร้างโครงสไลด์ + 10 prompts (โมเดล ${getModel()}) — ใช้เวลา 20–60 วินาที`,
    percent: null,
    tone: 'active',
  });

  try {
    const imageData = currentImage ? await readFileAsBase64(currentImage.file) : null;
    const result = await callClaude(text, imageData);
    if (!result.prompts || !Array.isArray(result.prompts) || result.prompts.length === 0) {
      throw new Error('Claude ไม่ได้ส่ง prompts กลับมา');
    }

    renderBrief(result);
    els.resultsSection.style.display = 'block';

    const willGenImage = els.genImageToggle.checked;

    cardStates = result.prompts.map(p => ({
      id: p.id,
      name: p.name,
      prompt: p.prompt,
      status: willGenImage ? 'queued' : 'prompt-only',
      image: null,
      error: null,
    }));
    renderGrid();
    updateRegenAllBtn();

    els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (willGenImage) {
      showProgress('ขั้นตอนที่ 2/2 · กำลังสร้างภาพใน Gemini', {
        count: `0/${cardStates.length}`,
        detail: 'จะ generate ทีละรูปเรียงตามลำดับ',
        percent: 0,
        tone: 'active',
      });
      await runImageQueue();
    } else {
      showProgress('เสร็จสิ้น — Prompt 10 อันพร้อมใช้', {
        count: `${cardStates.length}/${cardStates.length}`,
        detail: 'คลิกที่การ์ดเพื่อดูและคัดลอก prompt · กดปุ่ม Generate รูปใหม่ด้านบนถ้าต้องการให้ระบบ gen ภาพให้',
        percent: 100,
        tone: 'success',
      });
    }
  } catch (e) {
    if (e.message === 'NO_API_KEY') {
      setStatus('⚠ ยังไม่ได้ตั้งค่า Claude API Key', 'error');
      openSettings();
    } else {
      setStatus('เกิดข้อผิดพลาด: ' + e.message, 'error');
      console.error(e);
    }
    showProgress('ผิดพลาด', {
      count: '',
      detail: e.message,
      percent: 100,
      tone: 'error',
    });
  } finally {
    els.generateBtn.disabled = false;
    els.generateBtn.classList.remove('loading');
  }
}

els.settingsBtn.addEventListener('click', openSettings);
els.settingsClose.addEventListener('click', closeSettings);
els.saveSettings.addEventListener('click', saveSettings);
els.settingsModal.addEventListener('click', (e) => {
  if (e.target === els.settingsModal) closeSettings();
});
els.fileInput.addEventListener('change', handleImageChange);
els.removeImage.addEventListener('click', removeImage);
els.generateBtn.addEventListener('click', onGenerate);
els.toolbarModelSelect.addEventListener('change', (e) => setGeminiModel(e.target.value));
els.regenAllBtn.addEventListener('click', regenerateAllImages);
els.genImageToggle.addEventListener('change', updateGenImageUI);
els.textInput.addEventListener('input', autoResizeTextarea);
els.textInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    onGenerate();
  }
});

els.lightboxClose.addEventListener('click', closeLightbox);
els.lightbox.addEventListener('click', (e) => {
  if (e.target === els.lightbox) closeLightbox();
});
els.lightboxCopy.addEventListener('click', copyPromptFromLightbox);
els.lightboxRegen.addEventListener('click', regenFromLightbox);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (els.lightbox.classList.contains('open')) closeLightbox();
    else if (els.settingsModal.classList.contains('open')) closeSettings();
  }
});

els.toolbarModelSelect.value = getGeminiModel();
els.genImageToggle.checked = getGenImageEnabled();
updateGenImageUI();
updateRegenAllBtn();
updateApiStatus();

loadServerConfig().then(() => {
  updateApiStatus();
  if (!hasClaudeAccess()) {
    setStatus('ยินดีต้อนรับ! กดปุ่ม Settings มุมขวาบนเพื่อใส่ Claude API Key (หรือ set CLAUDE_API_KEY ใน Railway env)', 'info');
  } else if (serverConfig.hasClaudeEnvKey) {
    setStatus('✓ ตรวจพบ Claude API Key จาก Railway env — พร้อมใช้งาน', 'success');
    setTimeout(() => setStatus(''), 3000);
  }
});
