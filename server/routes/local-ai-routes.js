import * as ollama from '../lib/ollama-provider.js';
import { CAPABILITIES, SOURCE_OF_TRUTH, AGENT_JOBS } from '../lib/capability-registry.js';

const BRIDGE_URL = () => String(process.env.MAC_AI_BRIDGE_URL || '').replace(/\/$/, '');
const BRIDGE_TOKEN = () => process.env.LIV8_MAC_BRIDGE_TOKEN || '';

async function bridgeFetch(path, options = {}) {
  if (!BRIDGE_URL() || !BRIDGE_TOKEN()) throw new Error('Mac AI bridge is not configured');
  const res = await fetch(`${BRIDGE_URL()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BRIDGE_TOKEN()}`,
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(120000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Mac AI bridge HTTP ${res.status}`);
  return data;
}

async function getAiStatus() {
  if (BRIDGE_URL() && BRIDGE_TOKEN()) {
    try {
      const data = await bridgeFetch('/api/ai/bridge/status', { method: 'GET', signal: AbortSignal.timeout(6000) });
      return { ...data, remote: true, route: 'mac-bridge' };
    } catch (error) {
      return { ok: false, provider: 'ollama', remote: true, route: 'mac-bridge', error: error.message };
    }
  }
  return ollama.status();
}

async function chatAi(messages, body = {}) {
  if (BRIDGE_URL() && BRIDGE_TOKEN()) {
    return bridgeFetch('/api/ai/bridge/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        model: body.model,
        fast: body.fast === true,
        systemPrompt: body.systemPrompt,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
      }),
    });
  }

  return ollama.chat(messages, {
    model: body.model,
    fast: body.fast === true,
    systemPrompt: body.systemPrompt,
    maxTokens: body.maxTokens,
    temperature: body.temperature,
  });
}

export function registerLocalAiRoutes(app) {
  app.get('/api/ai/local/status', async (req, res) => {
    try { res.json(await getAiStatus()); }
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
      const result = await chatAi(messages, body);
      res.json({ ok: true, ...result });
    } catch (error) {
      console.warn('[Local AI] request failed:', error?.message || 'unknown error');
      res.status(503).json({
        ok: false,
        error: 'Local AI is unavailable',
        provider: 'ollama',
        bridgeConfigured: Boolean(BRIDGE_URL() && BRIDGE_TOKEN()),
        detail: error?.message || 'unknown error'
      });
    }
  });
}

export default registerLocalAiRoutes;
