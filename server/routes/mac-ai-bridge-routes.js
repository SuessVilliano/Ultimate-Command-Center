import * as ollama from '../lib/ollama-provider.js';

function authorized(req) {
  const expected = process.env.LIV8_MAC_BRIDGE_TOKEN;
  if (!expected) return false;
  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const header = String(req.headers['x-liv8-bridge-token'] || '');
  return bearer === expected || header === expected;
}

export function registerMacAiBridgeRoutes(app) {
  app.get('/api/ai/bridge/status', async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const status = await ollama.status();
    res.status(status.ok ? 200 : 503).json({ ...status, bridge: true });
  });

  app.post('/api/ai/bridge/chat', async (req, res) => {
    if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      const body = req.body || {};
      const messages = Array.isArray(body.messages)
        ? body.messages
        : [{ role: 'user', content: body.message || body.prompt || '' }];
      const result = await ollama.chat(messages, {
        model: body.model,
        fast: body.fast === true,
        systemPrompt: body.systemPrompt,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
        timeoutMs: body.timeoutMs,
      });
      res.json({ ok: true, ...result, via: 'mac-bridge' });
    } catch (error) {
      res.status(503).json({ ok: false, error: error?.message || 'Mac AI unavailable' });
    }
  });

  console.log('Authenticated Mac AI bridge routes registered');
}

export default registerMacAiBridgeRoutes;
