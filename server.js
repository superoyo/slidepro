import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const ALL_ENV_NAMES = Object.keys(process.env);

function findEnvVar(candidates) {
  for (const cand of candidates) {
    const target = cand.toUpperCase();
    const match = ALL_ENV_NAMES.find(k => k.toUpperCase() === target);
    if (match) {
      const val = (process.env[match] || '').trim();
      if (val) return { name: match, value: val };
    }
  }
  return { name: null, value: '' };
}

const CLAUDE_CANDIDATES = ['CLAUDE_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_API', 'CLAUDE'];
const GEMINI_CANDIDATES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API', 'GEMINI'];

const claudeFound = findEnvVar(CLAUDE_CANDIDATES);
const geminiFound = findEnvVar(GEMINI_CANDIDATES);

const CLAUDE_ENV_KEY = claudeFound.value;
const CLAUDE_ENV_NAME = claudeFound.name;
const GEMINI_ENV_KEY = geminiFound.value;
const GEMINI_ENV_NAME = geminiFound.name;

app.use(express.json({ limit: '25mb' }));

app.get('/api/config', (req, res) => {
  res.set('cache-control', 'no-store');
  res.json({
    hasClaudeEnvKey: Boolean(CLAUDE_ENV_KEY),
    hasGeminiEnvKey: Boolean(GEMINI_ENV_KEY),
    claudeEnvName: CLAUDE_ENV_NAME || null,
    geminiEnvName: GEMINI_ENV_NAME || null,
  });
});

// Debug: shows which candidate env names server is looking for, and which match
// (returns name presence only, never values).
app.get('/api/env-check', (req, res) => {
  res.set('cache-control', 'no-store');
  const check = (cands) => cands.map(name => {
    const match = ALL_ENV_NAMES.find(k => k.toUpperCase() === name.toUpperCase());
    return { looking_for: name, found_as: match || null, has_value: !!(match && process.env[match]?.trim()) };
  });
  res.json({
    claude: check(CLAUDE_CANDIDATES),
    gemini: check(GEMINI_CANDIDATES),
    hint: 'Env var names are case-insensitive. Common names: CLAUDE_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY',
  });
});

app.post('/api/claude', async (req, res) => {
  const userKey = req.get('x-user-claude-key') || '';
  const key = CLAUDE_ENV_KEY || userKey;
  if (!key) {
    return res.status(401).json({ error: { message: 'ไม่พบ Claude API key (ทั้ง Railway env และของผู้ใช้)' } });
  }
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status)
      .type(upstream.headers.get('content-type') || 'application/json')
      .send(text);
  } catch (e) {
    res.status(502).json({ error: { message: 'Upstream error: ' + e.message } });
  }
});

app.post('/api/gemini-image', async (req, res) => {
  const userKey = req.get('x-user-gemini-key') || '';
  const key = GEMINI_ENV_KEY || userKey;
  if (!key) {
    return res.status(401).json({ error: { message: 'ไม่พบ Gemini API key (ทั้ง Railway env และของผู้ใช้)' } });
  }
  const { model, isImagen, payload } = req.body || {};
  if (!model || !payload) {
    return res.status(400).json({ error: { message: 'Missing model or payload' } });
  }
  const action = isImagen ? 'predict' : 'generateContent';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${action}`;
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    res.status(upstream.status)
      .type(upstream.headers.get('content-type') || 'application/json')
      .send(text);
  } catch (e) {
    res.status(502).json({ error: { message: 'Upstream error: ' + e.message } });
  }
});

app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css|json)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  },
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SlidePro server listening on :${PORT}`);
  console.log(`Claude env key: ${CLAUDE_ENV_KEY ? `detected as "${CLAUDE_ENV_NAME}"` : 'not set'}`);
  console.log(`Gemini env key: ${GEMINI_ENV_KEY ? `detected as "${GEMINI_ENV_NAME}"` : 'not set'}`);
  if (!CLAUDE_ENV_KEY) {
    console.log(`  Looked for (case-insensitive): ${CLAUDE_CANDIDATES.join(', ')}`);
  }
  if (!GEMINI_ENV_KEY) {
    console.log(`  Looked for (case-insensitive): ${GEMINI_CANDIDATES.join(', ')}`);
  }
});
