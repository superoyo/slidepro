import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const CLAUDE_ENV_KEY =
  process.env.CLAUDE_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.CLAUDE_API ||
  process.env.CLAUDE ||
  '';

const GEMINI_ENV_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API ||
  process.env.GEMINI ||
  '';

app.use(express.json({ limit: '25mb' }));

app.get('/api/config', (req, res) => {
  res.set('cache-control', 'no-store');
  res.json({
    hasClaudeEnvKey: Boolean(CLAUDE_ENV_KEY),
    hasGeminiEnvKey: Boolean(GEMINI_ENV_KEY),
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
  console.log(`Claude env key: ${CLAUDE_ENV_KEY ? 'detected' : 'not set'}`);
  console.log(`Gemini env key: ${GEMINI_ENV_KEY ? 'detected' : 'not set'}`);
});
