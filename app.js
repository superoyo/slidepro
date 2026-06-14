import { buildSystemPrompt, ART_DIRECTIONS } from './skill.js';

const STORAGE_KEY = 'slidepro.apiKey';
const MODEL_KEY = 'slidepro.model';
const GEMINI_KEY = 'slidepro.geminiKey';
const GEMINI_MODEL_KEY = 'slidepro.geminiModel';
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
};

let currentImage = null;
let cardStates = [];
let activeLightboxIdx = null;

const getApiKey = () => localStorage.getItem(STORAGE_KEY) || '';
const getModel = () => localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
const getGeminiKey = () => localStorage.getItem(GEMINI_KEY) || '';
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

function updateApiStatus() {
  if (getApiKey()) {
    els.apiStatus.textContent = `Claude · ${getModel()}`;
    els.apiStatus.className = 'api-status ok';
  } else {
    els.apiStatus.textContent = 'Claude: ยังไม่ตั้งค่า';
    els.apiStatus.className = 'api-status warn';
  }
  if (getGeminiKey()) {
    els.geminiStatus.textContent = `Gemini · ${shortenModel(getGeminiModel())}`;
    els.geminiStatus.className = 'api-status ok';
  } else {
    els.geminiStatus.textContent = 'Gemini: ยังไม่ตั้งค่า';
    els.geminiStatus.className = 'api-status warn';
  }
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
  els.apiKeyInput.value = getApiKey();
  els.modelSelect.value = getModel();
  els.geminiKeyInput.value = getGeminiKey();
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
  localStorage.setItem(GEMINI_MODEL_KEY, gModel);

  updateApiStatus();
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
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
  const key = getGeminiKey();
  if (!key) throw new Error('NO_GEMINI_KEY');
  const model = getGeminiModel();
  const isImagen = model.startsWith('imagen-');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${isImagen ? 'predict' : 'generateContent'}`;
  const headers = {
    'content-type': 'application/json',
    'x-goog-api-key': key,
  };

  let body;
  if (isImagen) {
    body = {
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9' }
    };
  } else {
    body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } }
      }
    };
  }

  let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!res.ok && !isImagen && res.status === 400) {
    const errText = await res.text();
    if (/responseFormat|imageConfig|generation_config/i.test(errText)) {
      body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      };
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
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
    if (state.status === 'queued') {
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

    if (state.status === 'done') {
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
  if (!getGeminiKey()) {
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
      detail: `สร้างภาพสำเร็จทั้ง ${done} รูป — คลิกที่ภาพเพื่อดูเต็มและ copy prompt`,
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
}

async function retryOne(idx) {
  const state = cardStates[idx];
  if (!getGeminiKey()) {
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
  if (!state || state.status !== 'done') return;
  activeLightboxIdx = idx;
  const meta = ART_DIRECTIONS.find(a => a.id === state.id) || { short: '' };
  const dataUrl = `data:${state.image.mime};base64,${state.image.data}`;
  els.lightboxImage.src = dataUrl;
  els.lightboxImage.alt = state.name;
  els.lightboxBadge.textContent = state.id;
  els.lightboxTitle.textContent = state.name;
  els.lightboxSub.textContent = meta.short;
  els.lightboxPrompt.textContent = state.prompt;
  els.lightboxDownload.href = dataUrl;
  els.lightboxDownload.download = `slidepro-${state.id}-${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  els.lightboxCopyLabel.textContent = 'Copy prompt';
  els.lightboxCopy.classList.remove('copied');
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
  if (!getApiKey()) {
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

    cardStates = result.prompts.map(p => ({
      id: p.id,
      name: p.name,
      prompt: p.prompt,
      status: 'queued',
      image: null,
      error: null,
    }));
    renderGrid();

    showProgress('ขั้นตอนที่ 2/2 · กำลังสร้างภาพใน Gemini', {
      count: `0/${cardStates.length}`,
      detail: 'จะ generate ทีละรูปเรียงตามลำดับ',
      percent: 0,
      tone: 'active',
    });

    els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    await runImageQueue();
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

updateApiStatus();
if (!getApiKey()) {
  setStatus('ยินดีต้อนรับ! กดปุ่ม Settings มุมขวาบนเพื่อใส่ Claude API Key + Gemini API Key', 'info');
}
