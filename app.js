import { buildSystemPrompt, ART_DIRECTIONS } from './skill.js';

const STORAGE_KEY = 'slidepro.apiKey';
const MODEL_KEY = 'slidepro.model';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

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
  saveSettings: document.getElementById('save-settings'),
  apiStatus: document.getElementById('api-status'),
};

let currentImage = null;

function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function getModel() {
  return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
}

function updateApiStatus() {
  const key = getApiKey();
  if (key) {
    els.apiStatus.textContent = `เชื่อมต่อแล้ว · ${getModel()}`;
    els.apiStatus.className = 'api-status ok';
  } else {
    els.apiStatus.textContent = 'ยังไม่ได้ตั้งค่า API Key';
    els.apiStatus.className = 'api-status warn';
  }
}

function setStatus(msg, type = 'info') {
  els.statusBar.textContent = msg;
  els.statusBar.className = `status-bar ${type}`;
  els.statusBar.style.display = msg ? 'block' : 'none';
}

function openSettings() {
  els.apiKeyInput.value = getApiKey();
  els.modelSelect.value = getModel();
  els.settingsModal.classList.add('open');
}

function closeSettings() {
  els.settingsModal.classList.remove('open');
}

function saveSettings() {
  const key = els.apiKeyInput.value.trim();
  const model = els.modelSelect.value;
  if (key) {
    localStorage.setItem(STORAGE_KEY, key);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  localStorage.setItem(MODEL_KEY, model);
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
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

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
        <button class="copy-btn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span class="copy-label">Copy prompt</span>
        </button>
      </header>
      <pre class="prompt-body">${escapeHtml(p.prompt)}</pre>
    `;
    const btn = card.querySelector('.copy-btn');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(p.prompt);
        const label = btn.querySelector('.copy-label');
        const orig = label.textContent;
        btn.classList.add('copied');
        label.textContent = 'คัดลอกแล้ว!';
        setTimeout(() => {
          btn.classList.remove('copied');
          label.textContent = orig;
        }, 1500);
      } catch (e) {
        setStatus('คัดลอกไม่สำเร็จ: ' + e.message, 'error');
      }
    });
    els.resultsGrid.appendChild(card);
  });

  els.resultsSection.style.display = 'block';
  els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    setStatus(`สำเร็จ! ได้ ${result.prompts.length} prompts — กดปุ่ม Copy prompt แล้วนำไปวางใน Gemini`, 'success');
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
  setStatus('ยินดีต้อนรับ! ก่อนใช้งานครั้งแรก กดปุ่ม Settings มุมขวาบนเพื่อใส่ Claude API Key', 'info');
}
