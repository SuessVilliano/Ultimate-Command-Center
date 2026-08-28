import crypto from 'crypto';
import * as journal from '../lib/life-journal-db.js';
import { classifyLifeObservation } from './life-journal-routes.js';
import { operate } from './operator-routes.js';
import * as ollama from '../lib/ollama-provider.js';
import { getCommanderPrompt } from '../lib/system-prompt.js';

function expectedToken() {
  return process.env.LIV8_SHORTCUT_TOKEN || process.env.APPLE_HEALTH_INGEST_TOKEN || null;
}

function tokenFrom(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-liv8-token'] || req.body?.token || '';
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function authorized(req) {
  const expected = expectedToken();
  return !!expected && safeEqual(tokenFrom(req), expected);
}

function wantsJournal(mode, text) {
  if (mode === 'journal') return true;
  if (mode !== 'auto') return false;
  return !!classifyLifeObservation(text);
}

async function askJuno(text) {
  const operated = await operate(text);
  if (operated) return operated;
  const ai = await ollama.chat([{ role: 'user', content: text }], {
    systemPrompt: getCommanderPrompt(),
    maxTokens: 900,
    temperature: 0.35,
  });
  return { response: ai.text, provider: ai.provider, model: ai.model, operated: false, toolsUsed: [] };
}

export function registerShortcutRoutes(app) {
  app.get('/api/shortcut/status', (req, res) => {
    res.json({
      ok: true,
      configured: !!expectedToken(),
      modes: ['auto', 'journal', 'assistant'],
      accepts: ['text', 'transcript', 'mode', 'source', 'metadata'],
      returns: ['response', 'spokenText', 'lifeLogged', 'toolsUsed'],
    });
  });

  app.post('/api/shortcut/voice', async (req, res) => {
    try {
      if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Unauthorized Shortcut request' });

      const text = String(req.body?.text || req.body?.transcript || '').trim();
      const mode = String(req.body?.mode || 'auto').toLowerCase();
      if (!text) return res.status(400).json({ ok: false, error: 'text or transcript is required' });
      if (!['auto', 'journal', 'assistant'].includes(mode)) return res.status(400).json({ ok: false, error: 'mode must be auto, journal, or assistant' });

      let lifeLogged = null;
      if (wantsJournal(mode, text)) {
        const parsed = classifyLifeObservation(text) || { category: 'note', text, source: 'ios_shortcut', tags: ['shortcut'] };
        lifeLogged = journal.addEntry({
          ...parsed,
          text,
          source: req.body?.source || 'ios_shortcut',
          metadata: { ...(req.body?.metadata || {}), device: req.headers['user-agent'] || 'ios_shortcut' },
        });
      }

      // journal mode is intentionally fast: save and acknowledge without invoking AI.
      if (mode === 'journal') {
        const spokenText = `Logged to your Life Journal as ${lifeLogged?.category || 'note'}.`;
        return res.json({ ok: true, mode, response: spokenText, spokenText, lifeLogged });
      }

      const ai = await askJuno(text);
      let spokenText = ai.response || 'Done.';
      if (lifeLogged && mode === 'auto') spokenText = `${spokenText}\n\nLogged to Life Journal: ${lifeLogged.category}.`;

      res.json({
        ok: true,
        mode,
        response: ai.response,
        spokenText,
        lifeLogged: lifeLogged ? { id: lifeLogged.id, category: lifeLogged.category, ts: lifeLogged.ts } : null,
        toolsUsed: ai.toolsUsed || [],
        operated: !!ai.operated,
        provider: ai.provider || null,
        model: ai.model || null,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || 'Shortcut request failed' });
    }
  });
}

export default registerShortcutRoutes;
