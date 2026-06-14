import { buildSystemPrompt, ART_DIRECTIONS } from './skill.js';

const STORAGE_KEY = 'slidepro.apiKey';
const MODEL_KEY = 'slidepro.model';
const GEMINI_KEY = 'slidepro.geminiKey';
const GEMINI_MODEL_KEY = 'slidepro.geminiModel';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-image';

const els = {
  textInput: document.getElementById('text-input'),
  fileInput: document.getElementById('file-input'),
  fileLabel: document.getElementById('file-label'),
  imagePreview: document.getElementById('image-preview'),
  removeImage: document.getElementById('remove-image'),
  generateBtn: document.getElementById('generate-btn'),
  resultsSection: document.getElementById('results-section'),
  resultsGrid: document.getElementById('results-grid'),
  briefSummary: document.getElementById('brief-summary'),
  statusBar: document.getElementById('status-bar'),
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
};

let currentImage = null;

const GEMINI_MODEL_MIGRATIONS = {
  'gemini-2.5-flash-image-preview': 'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation': 'gemini-2.5-flash-image',
  'imagen-3.0-generate-002': 'imagen-4.0-generate-001',
};

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
}

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
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
    els.imagePreview.style.display = 'block';
    els.removeImage.style.display = 'inline-block';
    els.fileLabel.textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  currentImage = null;
  els.fileInput.value = '';
  els.imagePreview.style.display = 'none';
  els.imagePreview.src = '';
  els.removeImage.style.display = 'none';
  els.fileLabel.textContent = 'แนบรูปภาพ (ไม่บังคับ)';
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
    throw new Error(`Claude API error ${res.status}: ${errBody}`);
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
      generationConfig: { responseModalities: ['IMAGE'] }
    };
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
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
    if (!b64) throw new Error('Imagen ไม่ส่งภาพกลับมา: ' + JSON.stringify(data).slice(0, 300));
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

function renderResults(result) {
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

  els.resultsGrid.innerHTML = '';
  const prompts = result.prompts || [];

  prompts.forEach((p) => {
    const meta = ART_DIRECTIONS.find(a => a.id === p.id) || { short: '' };
    const card = document.createElement('article');
    card.className = 'prompt-card';
    card.innerHTML = `
      <header class="prompt-card-header">
        <span class="prompt-badge">${p.id}</span>
        <div class="prompt-title-wrap">
          <h3 class="prompt-title">${escapeHtml(p.name)}</h3>
          <p class="prompt-sub">${escapeHtml(meta.short)}</p>
        </div>
      </header>
      <div class="prompt-actions">
        <button class="action-btn copy-btn" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span class="copy-label">Copy prompt</span>
        </button>
        <button class="action-btn gen-btn" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 7L23 12l-7.5 2.5L13 22l-2.5-7.5L3 12l7.5-2z"></path></svg>
          <span class="gen-label">Generate Image</span>
        </button>
      </div>
      <div class="image-area" style="display:none;"></div>
      <pre class="prompt-body">${escapeHtml(p.prompt)}</pre>
    `;

    const copyBtn = card.querySelector('.copy-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(p.prompt);
        const label = copyBtn.querySelector('.copy-label');
        const orig = label.textContent;
        copyBtn.classList.add('copied');
        label.textContent = 'คัดลอกแล้ว!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          label.textContent = orig;
        }, 1500);
      } catch (e) {
        setStatus('คัดลอกไม่สำเร็จ: ' + e.message, 'error');
      }
    });

    const genBtn = card.querySelector('.gen-btn');
    const imageArea = card.querySelector('.image-area');
    genBtn.addEventListener('click', () => handleGenerateImage(p, genBtn, imageArea));

    els.resultsGrid.appendChild(card);
  });

  els.resultsSection.style.display = 'block';
  els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleGenerateImage(promptObj, btn, imageArea) {
  if (!getGeminiKey()) {
    setStatus('⚠ ยังไม่ได้ตั้งค่า Gemini API Key — กดปุ่ม Settings มุมขวาบน', 'error');
    openSettings();
    return;
  }
  const label = btn.querySelector('.gen-label');
  const origLabel = label.textContent;
  btn.disabled = true;
  btn.classList.add('loading');
  label.textContent = 'กำลังสร้างภาพ...';

  imageArea.style.display = 'block';
  imageArea.innerHTML = `<div class="image-loading"><div class="spinner"></div><span>กำลัง gen ภาพจาก ${escapeHtml(getGeminiModel())}... (10-40 วินาที)</span></div>`;

  try {
    const img = await callGeminiImage(promptObj.prompt);
    const dataUrl = `data:${img.mime};base64,${img.data}`;
    const filename = `slidepro-${promptObj.id}-${promptObj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    imageArea.innerHTML = `
      <img class="gen-image" src="${dataUrl}" alt="${escapeHtml(promptObj.name)}">
      <div class="image-actions">
        <a class="action-btn" href="${dataUrl}" download="${filename}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download
        </a>
        <button class="action-btn regen-btn" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          Regenerate
        </button>
        <a class="action-btn" href="${dataUrl}" target="_blank">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          Open
        </a>
      </div>
    `;
    imageArea.querySelector('.regen-btn').addEventListener('click', () => handleGenerateImage(promptObj, btn, imageArea));
    label.textContent = 'Generated';
  } catch (e) {
    if (e.message === 'NO_GEMINI_KEY') {
      setStatus('⚠ ยังไม่ได้ตั้งค่า Gemini API Key', 'error');
      openSettings();
    } else {
      setStatus('Gen ภาพไม่สำเร็จ: ' + e.message, 'error');
    }
    imageArea.innerHTML = `<div class="image-error">เกิดข้อผิดพลาด: ${escapeHtml(e.message)}</div>`;
    label.textContent = origLabel;
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
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
    setStatus('⚠ ระบบทำงานไม่ได้: ยังไม่ได้ตั้งค่า Claude API Key — กดปุ่ม Settings มุมขวาบนเพื่อใส่ key', 'error');
    openSettings();
    return;
  }

  els.generateBtn.disabled = true;
  els.generateBtn.classList.add('loading');
  setStatus('กำลังเรียก Claude API และสร้าง prompt 10 แบบ... (อาจใช้เวลา 20-60 วินาที)', 'info');

  try {
    const imageData = currentImage ? await readFileAsBase64(currentImage.file) : null;
    const result = await callClaude(text, imageData);
    if (!result.prompts || !Array.isArray(result.prompts) || result.prompts.length === 0) {
      throw new Error('ไม่ได้รับ prompts จาก Claude');
    }
    const geminiNote = getGeminiKey() ? ' กดปุ่ม Generate Image บนการ์ดเพื่อ gen ภาพได้เลย' : ' (ตั้ง Gemini API key ใน Settings เพื่อ gen ภาพได้)';
    setStatus(`สำเร็จ! ได้ ${result.prompts.length} prompts —${geminiNote}`, 'success');
    renderResults(result);
  } catch (e) {
    if (e.message === 'NO_API_KEY') {
      setStatus('⚠ ระบบทำงานไม่ได้: ยังไม่ได้ตั้งค่า Claude API Key', 'error');
      openSettings();
    } else {
      setStatus('เกิดข้อผิดพลาด: ' + e.message, 'error');
      console.error(e);
    }
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

updateApiStatus();
if (!getApiKey()) {
  setStatus('ยินดีต้อนรับ! ก่อนใช้งานครั้งแรก กดปุ่ม Settings มุมขวาบนเพื่อใส่ Claude API Key (และ Gemini API Key ถ้าจะ gen ภาพ)', 'info');
}
