import { localAiStatus, localAiChat } from '../lib/local-ai-client.js';
import { CAPABILITIES, SOURCE_OF_TRUTH, AGENT_JOBS } from '../lib/capability-registry.js';

export function registerLocalAiRoutes(app) {
  app.get('/api/ai/local/status', async (req, res) => {
    try { res.json(await localAiStatus()); }
    catch { res.status(500).json({ ok: false, error: 'Local AI status failed' }); }
  });

  app.get('/api/ai/capabilities', (req, res) => {
    res.json({
      ok: true,
      sourceOfTruth: SOURCE_OF_TRUTH,
      capabilities: CAPABILITIES,
      agentJobs: AGENT_JOBS,
      executionPolicy: {
        safeReadsAndAnalysis: 'proactive_allowed',
        externalWrites: 'explicit_user_intent_required',
        destructiveWrites: 'explicit_user_intent_required',
        liveTrading: 'dedicated_confirmation_gate_required'
      }
    });
  });

  app.post('/api/ai/local/chat', async (req, res) => {
    try {
      const body = req.body || {};
      const messages = Array.isArray(body.messages)
        ? body.messages
        : [{ role: 'user', content: body.message || body.prompt || '' }];
      const result = await localAiChat(messages, body);
      res.json({ ok: true, ...result });
    } catch (error) {
      console.warn('[Local AI] request failed:', error?.message || 'unknown error');
      res.status(503).json({
        ok: false,
        error: 'Local AI is unavailable',
        provider: 'ollama',
        bridgeConfigured: Boolean(process.env.LIV8_MAC_BRIDGE_TOKEN),
        detail: error?.message || 'unknown error'
      });
    }
  });
}

export default registerLocalAiRoutes;
