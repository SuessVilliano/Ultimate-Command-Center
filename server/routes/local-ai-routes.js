import * as ollama from '../lib/ollama-provider.js';

export function registerLocalAiRoutes(app) {
  app.get('/api/ai/local/status', async (req, res) => {
    try { res.json(await ollama.status()); }
    catch { res.status(500).json({ ok: false, error: 'Local AI status failed' }); }
  });

  app.post('/api/ai/local/chat', async (req, res) => {
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
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      console.warn('[Local AI] request failed:', error?.message || 'unknown error');
      res.status(503).json({ ok: false, error: 'Local AI is unavailable', provider: 'ollama' });
    }
  });
}

export default registerLocalAiRoutes;
