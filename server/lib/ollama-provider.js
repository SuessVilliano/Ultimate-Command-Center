/**
 * LIV8 local AI provider — Ollama on the Mac mini.
 *
 * Default brain: qwen3:8b
 * Fast worker: gemma3:4b
 * No API key and no per-token cost.
 */

const BASE_URL = () => (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MAIN_MODEL = () => process.env.OLLAMA_MODEL || 'qwen3:8b';
const FAST_MODEL = () => process.env.OLLAMA_FAST_MODEL || 'gemma3:4b';

function buildMessages(messages = [], systemPrompt = null) {
  const out = [];
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
  for (const m of messages) {
    if (!m?.content) continue;
    out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) });
  }
  return out;
}

export function config() {
  return {
    provider: 'ollama',
    baseUrl: BASE_URL(),
    model: MAIN_MODEL(),
    fastModel: FAST_MODEL(),
    local: true,
    cost: '$0',
  };
}

export async function status() {
  try {
    const res = await fetch(`${BASE_URL()}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { ok: false, ...config(), error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models || []).map(m => m.name || m.model).filter(Boolean);
    return {
      ok: true,
      ...config(),
      models,
      mainReady: models.some(m => m === MAIN_MODEL() || m.startsWith(`${MAIN_MODEL()}:`)),
      fastReady: models.some(m => m === FAST_MODEL() || m.startsWith(`${FAST_MODEL()}:`)),
    };
  } catch (error) {
    return { ok: false, ...config(), error: 'Local Ollama is not reachable' };
  }
}

export async function chat(messages, options = {}) {
  const model = options.model || (options.fast ? FAST_MODEL() : MAIN_MODEL());
  const payload = {
    model,
    messages: buildMessages(messages, options.systemPrompt),
    stream: false,
    options: {
      temperature: options.temperature ?? 0.6,
      num_predict: options.maxTokens || 1024,
    },
  };

  const res = await fetch(`${BASE_URL()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeoutMs || 120000),
  });

  if (!res.ok) {
    throw new Error(`Local Ollama request failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  return {
    text: data?.message?.content || '',
    provider: 'ollama',
    model,
    local: true,
    cost: '$0',
    usage: {
      prompt_tokens: data?.prompt_eval_count || null,
      completion_tokens: data?.eval_count || null,
    },
  };
}
