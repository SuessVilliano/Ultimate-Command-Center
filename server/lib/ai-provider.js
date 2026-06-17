/**
 * LIV8 Command Center - AI Provider Module
 * Supports Claude, GPT, Gemini, Groq (Llama/Qwen), and NVIDIA NIM
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { getSetting, setSetting, logAgentInteraction } from './database.js';
import { DEFAULT_AGENT_PERSONA } from './agent-persona.js';

// Provider instances
let anthropicClient = null;
let openaiClient = null;
let geminiClient = null;
let kimiApiKey = null; // NVIDIA NIM API key for Kimi
let groqApiKey = null; // Groq API key for Llama/Qwen (free tier available)
let ollamaBaseUrl = null; // Ollama local server URL (free, 100% on-device, no key)
let geminiCliPath = null; // Path to the `gemini` CLI (login-based, no API key)
let claudeCliPath = null; // Path to the `claude` CLI / Claude Code (uses your Max plan login)

// Current configuration
let currentProvider = 'gemini';
let storedKeys = { anthropic: null, openai: null, gemini: null, kimi: null, groq: null, ollama: null };
let currentModel = null;

// Default local Ollama endpoint
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Find an executable by name across PATH + common install locations.
 * GUI-launched apps have a thin PATH, so we also check Homebrew / npm-global.
 */
function findBin(name, override) {
  if (override && existsSync(override)) return override;
  const dirs = (process.env.PATH || '').split(':').filter(Boolean);
  const home = process.env.HOME || '';
  const extra = [
    '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin',
    home && path.join(home, '.npm-global/bin'),
    home && path.join(home, '.local/bin'),
    home && path.join(home, '.nvm/versions'), // best-effort
  ].filter(Boolean);
  for (const d of [...dirs, ...extra]) {
    try { const p = path.join(d, name); if (existsSync(p)) return p; } catch (e) {}
  }
  return null;
}

/** Re-detect the login-based CLIs (call after install). */
export function detectCLIs() {
  geminiCliPath = findBin('gemini', process.env.GEMINI_CLI_PATH);
  claudeCliPath = findBin('claude', process.env.CLAUDE_CLI_PATH);
  return { geminiCli: !!geminiCliPath, claudeCli: !!claudeCliPath };
}

/**
 * Initialize AI providers with API keys
 */
export function initAIProviders(config = {}) {
  // Try to load persisted keys from database first
  let persistedAnthropicKey = null;
  let persistedOpenaiKey = null;
  let persistedGeminiKey = null;
  let persistedKimiKey = null;

  try {
    persistedAnthropicKey = getSetting('anthropic_api_key', null);
    persistedOpenaiKey = getSetting('openai_api_key', null);
    persistedGeminiKey = getSetting('gemini_api_key', null);
    persistedKimiKey = getSetting('kimi_api_key', null);
    var persistedGroqKey = null;
    try { persistedGroqKey = getSetting('groq_api_key', null); } catch (e) {}
  } catch (e) {
    // Database might not be ready yet
    var persistedGroqKey = null;
  }

  // Priority: config > persisted > env var
  const anthropicKey = config.anthropicKey || persistedAnthropicKey || process.env.ANTHROPIC_API_KEY;
  const openaiKey = config.openaiKey || persistedOpenaiKey || process.env.OPENAI_API_KEY;
  const geminiKey = config.geminiKey || persistedGeminiKey || process.env.GEMINI_API_KEY;
  const kimiKey = config.kimiKey || persistedKimiKey || process.env.KIMI_API_KEY || process.env.NVIDIA_API_KEY;
  const groqKey = config.groqKey || persistedGroqKey || process.env.GROQ_API_KEY;

  // Ollama: local, free, runs entirely on the laptop. Enabled when a base URL is
  // configured, when AI_PROVIDER is ollama, or when a URL was saved in settings.
  let persistedOllamaUrl = null;
  try { persistedOllamaUrl = getSetting('ollama_base_url', null); } catch (e) {}
  const requestedProvider = config.provider || process.env.AI_PROVIDER || '';
  const ollamaUrl = config.ollamaBaseUrl || persistedOllamaUrl || process.env.OLLAMA_BASE_URL
    || (requestedProvider === 'ollama' ? DEFAULT_OLLAMA_URL : null);

  storedKeys = { anthropic: anthropicKey || null, openai: openaiKey || null, gemini: geminiKey || null, kimi: kimiKey || null, groq: groqKey || null, ollama: ollamaUrl || null };

  if (anthropicKey) {
    anthropicClient = new Anthropic({ apiKey: anthropicKey });
    console.log('Anthropic (Claude) client initialized');
  }

  if (openaiKey) {
    openaiClient = new OpenAI({ apiKey: openaiKey });
    console.log('OpenAI (GPT) client initialized');
  }

  if (geminiKey) {
    geminiClient = new GoogleGenerativeAI(geminiKey);
    console.log('Google (Gemini) client initialized');
  }

  if (kimiKey) {
    kimiApiKey = kimiKey;
    console.log('NVIDIA (Kimi) API key configured');
  }

  if (groqKey) {
    groqApiKey = groqKey;
    console.log('Groq API key configured (Llama/Qwen available)');
  }

  if (ollamaUrl) {
    ollamaBaseUrl = ollamaUrl.replace(/\/+$/, '');
    console.log(`Ollama (local) configured at ${ollamaBaseUrl} — free, runs on this machine`);
  }

  // Detect login-based CLIs (no API key — uses your existing Claude/Gemini login)
  detectCLIs();
  if (geminiCliPath) console.log(`Gemini CLI found at ${geminiCliPath} (login-based, no key)`);
  if (claudeCliPath) console.log(`Claude CLI found at ${claudeCliPath} (uses your Anthropic login/Max plan)`);

  // Set default provider
  let savedProvider = null;
  try { savedProvider = getSetting('ai_provider', null); } catch (e) {}
  currentProvider = savedProvider || config.provider || process.env.AI_PROVIDER || 'gemini';
  currentModel = getDefaultModel(currentProvider);

  console.log(`AI Provider initialized: ${currentProvider} (Ollama: ${!!ollamaBaseUrl}, Claude: ${!!anthropicClient}, OpenAI: ${!!openaiClient}, Gemini: ${!!geminiClient}, Kimi: ${!!kimiApiKey}, Groq: ${!!groqApiKey})`);

  return {
    ollama: !!ollamaBaseUrl,
    'gemini-cli': !!geminiCliPath,
    'claude-cli': !!claudeCliPath,
    claude: !!anthropicClient,
    openai: !!openaiClient,
    gemini: !!geminiClient,
    kimi: !!kimiApiKey,
    groq: !!groqApiKey,
    currentProvider,
    currentModel
  };
}

/**
 * Get default model for a provider
 */
function getDefaultModel(provider) {
  if (provider === 'gemini-cli') return process.env.GEMINI_CLI_MODEL || 'gemini-2.5-flash';
  if (provider === 'claude-cli') return process.env.CLAUDE_CLI_MODEL || 'sonnet';
  if (provider === 'ollama') return process.env.OLLAMA_MODEL || 'llama3.1';
  if (provider === 'openai') {
    return process.env.GPT_MODEL || 'gpt-4o';
  }
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  if (provider === 'kimi') return process.env.KIMI_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct';
  if (provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
}

/**
 * Get the cheapest available provider for bulk/routine operations.
 * Priority: Groq (free tier Llama/Qwen) > Gemini (free/cheap) > Kimi (free tier) > OpenAI > Claude (most expensive)
 */
export function getCostEffectiveProvider() {
  if (ollamaBaseUrl) return { provider: 'ollama', model: getDefaultModel('ollama') };
  if (groqApiKey) return { provider: 'groq', model: getDefaultModel('groq') };
  if (geminiClient) return { provider: 'gemini', model: getDefaultModel('gemini') };
  if (kimiApiKey) return { provider: 'kimi', model: getDefaultModel('kimi') };
  if (openaiClient) return { provider: 'openai', model: getDefaultModel('openai') };
  if (anthropicClient) return { provider: 'claude', model: getDefaultModel('claude') };
  return { provider: currentProvider, model: currentModel };
}

/**
 * Switch AI provider
 */
export function switchProvider(provider, model = null) {
  if (provider === 'openai' && !openaiClient) {
    throw new Error('OpenAI API key not configured');
  }
  if (provider === 'claude' && !anthropicClient) {
    throw new Error('Anthropic API key not configured');
  }
  if (provider === 'gemini' && !geminiClient) {
    throw new Error('Gemini API key not configured');
  }
  if (provider === 'kimi' && !kimiApiKey) {
    throw new Error('Kimi/NVIDIA API key not configured');
  }
  if (provider === 'groq' && !groqApiKey) {
    throw new Error('Groq API key not configured. Get a free key at console.groq.com');
  }
  if (provider === 'ollama' && !ollamaBaseUrl) {
    throw new Error('Ollama not configured. Install Ollama from ollama.com, run "ollama pull llama3.1", then set the base URL (default http://localhost:11434).');
  }
  if (provider === 'gemini-cli' && !geminiCliPath) {
    detectCLIs();
    if (!geminiCliPath) throw new Error('Gemini CLI not found. Install it (npm install -g @google/gemini-cli) and run "gemini" once to log in.');
  }
  if (provider === 'claude-cli' && !claudeCliPath) {
    detectCLIs();
    if (!claudeCliPath) throw new Error('Claude CLI not found. Install it (npm install -g @anthropic-ai/claude-code) and run "claude" once to log in.');
  }

  currentProvider = provider;
  currentModel = model || getDefaultModel(provider);

  // Persist to database if available
  try {
    setSetting('ai_provider', provider);
    setSetting('ai_model', currentModel);
  } catch (e) {
    // Database might not be initialized yet
  }

  return { provider: currentProvider, model: currentModel };
}

/**
 * Get current provider info
 */
export function getCurrentProvider() {
  return {
    provider: currentProvider,
    model: currentModel,
    available: {
      ollama: !!ollamaBaseUrl,
      'gemini-cli': !!geminiCliPath,
      'claude-cli': !!claudeCliPath,
      claude: !!anthropicClient,
      openai: !!openaiClient,
      gemini: !!geminiClient,
      kimi: !!kimiApiKey,
      groq: !!groqApiKey
    },
    hasKeys: {
      ollama: !!storedKeys.ollama,
      'gemini-cli': !!geminiCliPath,
      'claude-cli': !!claudeCliPath,
      claude: !!storedKeys.anthropic,
      openai: !!storedKeys.openai,
      gemini: !!storedKeys.gemini,
      kimi: !!storedKeys.kimi,
      groq: !!storedKeys.groq
    },
    ollamaBaseUrl: ollamaBaseUrl || '',
    models: {
      'claude-cli': [
        { id: 'sonnet', name: 'Claude Sonnet (Max plan login)', default: true },
        { id: 'opus', name: 'Claude Opus (Max plan login)' },
        { id: 'haiku', name: 'Claude Haiku (Max plan login)' }
      ],
      'gemini-cli': [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (CLI login)', default: true },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (CLI login)' }
      ],
      ollama: [
        { id: 'llama3.1', name: 'Llama 3.1 8B (local)', default: true },
        { id: 'llama3.2', name: 'Llama 3.2 3B (local, fast)' },
        { id: 'qwen2.5', name: 'Qwen 2.5 7B (local)' },
        { id: 'mistral', name: 'Mistral 7B (local)' },
        { id: 'gemma2', name: 'Gemma 2 9B (local)' }
      ],
      groq: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Free)', default: true },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Free)' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Free)' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Free)' }
      ],
      gemini: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.5 Flash', default: true },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
      ],
      claude: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', default: true },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
      ],
      openai: [
        { id: 'gpt-4o', name: 'GPT-4o', default: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
      ],
      kimi: [
        { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', default: true },
        { id: 'nvidia/llama-3.1-nemotron-51b-instruct', name: 'Nemotron 51B' },
        { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B' }
      ]
    }
  };
}

/**
 * Update API key dynamically
 */
export function updateApiKey(provider, apiKey) {
  if (provider === 'claude' || provider === 'anthropic') {
    anthropicClient = new Anthropic({ apiKey });
    storedKeys.anthropic = apiKey;
    // Persist to database
    try {
      setSetting('anthropic_api_key', apiKey);
    } catch (e) {
      console.log('Could not persist Anthropic key to database');
    }
    console.log('Anthropic API key updated');
    return true;
  }

  if (provider === 'openai' || provider === 'gpt') {
    openaiClient = new OpenAI({ apiKey });
    storedKeys.openai = apiKey;
    // Persist to database
    try {
      setSetting('openai_api_key', apiKey);
    } catch (e) {
      console.log('Could not persist OpenAI key to database');
    }
    console.log('OpenAI API key updated');
    return true;
  }

  if (provider === 'gemini' || provider === 'google') {
    geminiClient = new GoogleGenerativeAI(apiKey);
    storedKeys.gemini = apiKey;
    // Persist to database
    try {
      setSetting('gemini_api_key', apiKey);
    } catch (e) {
      console.log('Could not persist Gemini key to database');
    }
    console.log('Gemini API key updated');
    return true;
  }

  if (provider === 'kimi' || provider === 'nvidia') {
    kimiApiKey = apiKey;
    storedKeys.kimi = apiKey;
    // Persist to database
    try {
      setSetting('kimi_api_key', apiKey);
    } catch (e) {
      console.log('Could not persist Kimi key to database');
    }
    console.log('Kimi/NVIDIA API key updated');
    return true;
  }

  if (provider === 'groq') {
    groqApiKey = apiKey;
    storedKeys.groq = apiKey;
    // Persist to database
    try {
      setSetting('groq_api_key', apiKey);
    } catch (e) {
      console.log('Could not persist Groq key to database');
    }
    console.log('Groq API key updated (Llama/Qwen now available)');
    return true;
  }

  // For Ollama the "key" is actually the local server base URL.
  if (provider === 'ollama') {
    const url = (apiKey && apiKey.trim()) ? apiKey.trim().replace(/\/+$/, '') : DEFAULT_OLLAMA_URL;
    ollamaBaseUrl = url;
    storedKeys.ollama = url;
    try {
      setSetting('ollama_base_url', url);
    } catch (e) {
      console.log('Could not persist Ollama URL to database');
    }
    console.log(`Ollama URL updated to ${url} (local AI now available)`);
    return true;
  }

  return false;
}

/**
 * Parse a provider error into a user-friendly message and error type
 */
function parseProviderError(provider, error) {
  const msg = error.message || String(error);

  // Authentication errors (401)
  if (msg.includes('401') || msg.includes('authentication_error') || msg.includes('invalid x-api-key') || msg.includes('Unauthorized') || msg.includes('Invalid API')) {
    const providerNames = { claude: 'Anthropic (Claude)', openai: 'OpenAI', gemini: 'Google Gemini', kimi: 'NVIDIA (Kimi)', ollama: 'Ollama (local)' };
    return {
      type: 'auth',
      userMessage: `${providerNames[provider] || provider} API key is invalid or expired. Please update your API key in Settings.`,
      retryable: false
    };
  }

  // Rate limit errors (429)
  if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota') || msg.includes('rate') || msg.includes('Quota exceeded')) {
    return {
      type: 'rate_limit',
      userMessage: `${provider} rate limit or quota exceeded. Trying another provider...`,
      retryable: true
    };
  }

  // Network / timeout errors
  if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed') || msg.includes('network') || msg.includes('AbortError') || msg.includes('timed out')) {
    if (provider === 'ollama') {
      return {
        type: 'network',
        userMessage: 'Could not reach Ollama. Make sure it is running ("ollama serve") and a model is pulled. Falling back to cloud if available...',
        retryable: true
      };
    }
    return {
      type: 'network',
      userMessage: `Could not reach ${provider} API. Check your network connection.`,
      retryable: true
    };
  }

  // Server errors (500+)
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('overloaded')) {
    return {
      type: 'server',
      userMessage: `${provider} service is temporarily unavailable. Trying another provider...`,
      retryable: true
    };
  }

  // Default
  return {
    type: 'unknown',
    userMessage: `${provider} error: ${msg.substring(0, 120)}`,
    retryable: true
  };
}

/**
 * Get fallback provider order (excluding the failed one)
 */
function getFallbackProviders(failedProvider) {
  // Fallback order: LOCAL/FREE first (Ollama runs on-device, zero cost), then free
  // cloud tiers, then paid ones. Claude LAST (most expensive).
  const allProviders = ['ollama', 'groq', 'gemini', 'gemini-cli', 'kimi', 'openai', 'claude-cli', 'claude'];
  const availableMap = {
    ollama: !!ollamaBaseUrl,
    'gemini-cli': !!geminiCliPath,
    'claude-cli': !!claudeCliPath,
    claude: !!anthropicClient, openai: !!openaiClient, gemini: !!geminiClient, kimi: !!kimiApiKey, groq: !!groqApiKey
  };
  return allProviders.filter(p => p !== failedProvider && availableMap[p]);
}

/**
 * Call a specific provider's chat function
 */
async function callProvider(provider, messages, options) {
  if (provider === 'gemini-cli' || provider === 'claude-cli') {
    const response = await chatWithCLI(provider, messages, { ...options, model: options.model || getDefaultModel(provider) });
    return { text: response.text || '', usage: null };
  } else if (provider === 'ollama') {
    const response = await chatWithOllama(messages, { ...options, model: options.model || getDefaultModel('ollama') });
    return { text: response.text || '', usage: response.usage || null };
  } else if (provider === 'openai') {
    const response = await chatWithOpenAI(messages, { ...options, model: options.model || getDefaultModel('openai') });
    return { text: response.choices[0]?.message?.content || '', usage: response.usage || null };
  } else if (provider === 'gemini') {
    const response = await chatWithGemini(messages, { ...options, model: options.model || getDefaultModel('gemini') });
    return { text: response.text || '', usage: response.usage || null };
  } else if (provider === 'kimi') {
    const response = await chatWithKimi(messages, { ...options, model: options.model || getDefaultModel('kimi') });
    return { text: response.text || '', usage: response.usage || null };
  } else if (provider === 'groq') {
    const response = await chatWithGroq(messages, { ...options, model: options.model || getDefaultModel('groq') });
    return { text: response.text || '', usage: response.usage || null };
  } else {
    const response = await chatWithClaude(messages, { ...options, model: options.model || getDefaultModel('claude') });
    return { text: response.content[0]?.text || '', usage: response.usage || null };
  }
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect if a message is code-related (use Claude for code, Gemini for everything else)
 */
function isCodeRelated(messages) {
  const codeKeywords = /\b(code|function|debug|error|bug|compile|syntax|refactor|implement|class|method|api|endpoint|deploy|git|npm|import|export|async|await|promise|typescript|javascript|python|react|node|database|query|sql|schema|migration)\b/i;
  const lastMessage = messages[messages.length - 1]?.content || '';
  // Also check for code blocks
  if (lastMessage.includes('```') || lastMessage.includes('def ') || lastMessage.includes('const ') || lastMessage.includes('function ')) {
    return true;
  }
  return codeKeywords.test(lastMessage);
}

/**
 * Main chat completion function — BULLETPROOF provider routing
 *
 * Priority: groq (free, fast) → gemini (free) → kimi (free) → openai → claude (expensive, last resort)
 * ALWAYS tries every available provider before giving up.
 * Rate limits get exponential backoff retry (15s, then 30s).
 * Never stops at one provider failure.
 */
export async function chat(messages, options = {}) {
  const provider = options.provider || currentProvider;
  const model = options.model || currentModel;
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.7;
  const systemPrompt = options.systemPrompt || null;
  const agentId = options.agentId || null;
  const chatOptions = { model, maxTokens, temperature, systemPrompt };

  // Build the provider chain. Normally: primary first, then all available
  // fallbacks (bulletproof). In strict mode (used by the compare view) we ONLY
  // try the requested provider, so each column reflects that exact engine.
  const primaryProvider = { name: provider, model };
  const fallbacks = options.strictProvider
    ? []
    : getFallbackProviders(provider).map(p => ({ name: p, model: getDefaultModel(p) }));
  const allProviders = [primaryProvider, ...fallbacks];

  const errors = [];

  for (const p of allProviders) {
    // Try this provider with up to 2 retries for rate limits
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await callProvider(p.name, messages, { ...chatOptions, model: p.model });

        if (agentId) {
          try { logAgentInteraction(agentId, 'chat', { messages, options }, { text: result.text, model: p.model, provider: p.name }, '', true); } catch (e) {}
        }

        if (p.name !== provider) {
          console.log(`[AI] Used fallback: ${p.name} (primary ${provider} failed)`);
        }

        return { text: result.text, provider: p.name, model: p.model, usage: result.usage, fallbackFrom: p.name !== provider ? provider : undefined };
      } catch (error) {
        const parsed = parseProviderError(p.name, error);
        const isRateLimit = parsed.type === 'rate_limit' || /rate.?limit|quota|429|too many/i.test(error.message || '');
        const isAuthError = parsed.type === 'auth' || /credit|balance|unauthorized|invalid.*key|api.*key/i.test(error.message || '');

        if (isRateLimit && attempt < 2) {
          // Exponential backoff for rate limits: 15s, then 30s
          const backoffMs = (attempt + 1) * 15000;
          console.log(`[AI] ${p.name} rate limited, waiting ${backoffMs / 1000}s (attempt ${attempt + 1}/3)...`);
          await sleep(backoffMs);
          continue; // Retry same provider
        }

        if (isAuthError) {
          // Don't retry auth errors — provider is dead, move to next
          console.warn(`[AI] ${p.name} auth/billing error: ${parsed.userMessage.substring(0, 100)}`);
          errors.push({ provider: p.name, error: parsed });
          break; // Move to next provider
        }

        // Any other error — log and move on
        console.warn(`[AI] ${p.name} failed (${parsed.type}): ${parsed.userMessage.substring(0, 100)}`);
        errors.push({ provider: p.name, error: parsed });
        break; // Move to next provider
      }
    }
  }

  // ALL providers exhausted
  if (agentId) {
    try { logAgentInteraction(agentId, 'chat', { messages, options }, { error: 'All providers failed' }, '', false); } catch (e) {}
  }

  const triedProviders = errors.map(e => `${e.provider}: ${e.error.userMessage.substring(0, 60)}`).join(' | ');
  throw new Error(`All ${errors.length} AI providers failed. Tried: ${triedProviders}`);
}

/**
 * Chat with Claude (Anthropic)
 */
async function chatWithClaude(messages, options) {
  if (!anthropicClient) {
    throw new Error('Anthropic client not initialized. Add ANTHROPIC_API_KEY to .env');
  }

  const formattedMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const requestParams = {
    model: options.model,
    max_tokens: options.maxTokens,
    messages: formattedMessages
  };

  if (options.systemPrompt) {
    requestParams.system = options.systemPrompt;
  }

  if (options.temperature !== undefined) {
    // Claude uses temperature 0-1
    requestParams.temperature = Math.min(options.temperature, 1);
  }

  return await anthropicClient.messages.create(requestParams);
}

/**
 * Chat with GPT (OpenAI)
 */
async function chatWithOpenAI(messages, options) {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Add OPENAI_API_KEY to .env');
  }

  const formattedMessages = [];

  // Add system prompt if provided
  if (options.systemPrompt) {
    formattedMessages.push({
      role: 'system',
      content: options.systemPrompt
    });
  }

  // Add conversation messages
  for (const m of messages) {
    formattedMessages.push({
      role: m.role,
      content: m.content
    });
  }

  return await openaiClient.chat.completions.create({
    model: options.model,
    messages: formattedMessages,
    max_tokens: options.maxTokens,
    temperature: options.temperature
  });
}

/**
 * Chat with Gemini (Google)
 */
async function chatWithGemini(messages, options) {
  if (!geminiClient) {
    throw new Error('Gemini client not initialized. Add GEMINI_API_KEY to .env or settings');
  }

  const modelConfig = {
    model: options.model || 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature
    }
  };

  // Try native systemInstruction (newer SDK), fall back to prepending
  let systemInstruction = options.systemPrompt || '';
  try {
    if (systemInstruction) {
      modelConfig.systemInstruction = systemInstruction;
    }
  } catch {
    // Older SDK version — will prepend to prompt instead
  }

  const model = geminiClient.getGenerativeModel(modelConfig);

  // Build conversation history
  const history = [];

  for (const m of messages.slice(0, -1)) {
    history.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    });
  }

  // Get the last message as the current prompt
  const lastMessage = messages[messages.length - 1];
  let prompt = lastMessage?.content || '';

  // If systemInstruction wasn't set in config (older SDK), prepend to prompt
  if (systemInstruction && !modelConfig.systemInstruction) {
    prompt = `${systemInstruction}\n\n${prompt}`;
  }

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(prompt);
    const response = await result.response;

    return {
      text: response.text(),
      usage: null
    };
  } catch (error) {
    console.error('Gemini chat error:', error);
    throw error;
  }
}

/**
 * Chat with Kimi/NVIDIA NIM API
 * Uses OpenAI-compatible API endpoint
 */
async function chatWithKimi(messages, options) {
  if (!kimiApiKey) {
    throw new Error('Kimi/NVIDIA API key not initialized. Add KIMI_API_KEY or NVIDIA_API_KEY to .env');
  }

  const formattedMessages = [];

  // Add system prompt if provided
  if (options.systemPrompt) {
    formattedMessages.push({
      role: 'system',
      content: options.systemPrompt
    });
  }

  // Add conversation messages
  for (const m of messages) {
    formattedMessages.push({
      role: m.role,
      content: m.content
    });
  }

  try {
    // NVIDIA NIM API uses OpenAI-compatible endpoint
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kimiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'nvidia/llama-3.1-nemotron-70b-instruct',
        messages: formattedMessages,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`NVIDIA API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage || null
    };
  } catch (error) {
    console.error('Kimi/NVIDIA chat error:', error);
    throw error;
  }
}

/**
 * Chat with Groq API (Llama 3, Qwen, Mixtral, Gemma - free tier available)
 * Uses OpenAI-compatible API endpoint at api.groq.com
 */
async function chatWithGroq(messages, options) {
  if (!groqApiKey) {
    throw new Error('Groq API key not initialized. Get a free key at console.groq.com and add GROQ_API_KEY to .env');
  }

  const formattedMessages = [];

  // Add system prompt if provided
  if (options.systemPrompt) {
    formattedMessages.push({
      role: 'system',
      content: options.systemPrompt
    });
  }

  // Add conversation messages
  for (const m of messages) {
    formattedMessages.push({
      role: m.role,
      content: m.content
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'llama-3.3-70b-versatile',
        messages: formattedMessages,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage || null
    };
  } catch (error) {
    console.error('Groq chat error:', error);
    throw error;
  }
}

/**
 * Chat with Ollama (local, free, on-device — Llama, Qwen, Mistral, Gemma, etc.)
 * Uses Ollama's OpenAI-compatible endpoint at {baseUrl}/v1/chat/completions.
 * Nothing leaves the machine — ideal for privacy/compliance.
 */
async function chatWithOllama(messages, options) {
  if (!ollamaBaseUrl) {
    throw new Error('Ollama not configured. Install from ollama.com and run "ollama serve".');
  }

  const formattedMessages = [];

  if (options.systemPrompt) {
    formattedMessages.push({ role: 'system', content: options.systemPrompt });
  }
  for (const m of messages) {
    formattedMessages.push({ role: m.role, content: m.content });
  }

  // Generous timeout — local models can be slower than cloud APIs on first load.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 120000);

  try {
    const response = await fetch(`${ollamaBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model || 'llama3.1',
        messages: formattedMessages,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature ?? 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      // 404 from Ollama usually means the model isn't pulled yet.
      if (response.status === 404) {
        throw new Error(`Ollama model "${options.model}" not found. Run: ollama pull ${options.model}`);
      }
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage || null
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Ollama request timed out. The local model may still be loading — try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Chat via a local login-based CLI (Gemini CLI or Claude Code) — NO API key.
 * Uses whatever account you logged into the CLI with (e.g. your Anthropic Max
 * plan), so it works without company API keys. The whole conversation is flattened
 * into one prompt and piped to the CLI's non-interactive print mode.
 */
function chatWithCLI(kind, messages, options) {
  return new Promise((resolve, reject) => {
    const bin = kind === 'gemini-cli' ? geminiCliPath : claudeCliPath;
    if (!bin) return reject(new Error(`${kind} not available`));

    // Flatten system prompt + conversation into a single prompt string.
    let prompt = '';
    if (options.systemPrompt) prompt += `${options.systemPrompt}\n\n`;
    for (const m of messages) {
      const who = m.role === 'assistant' ? 'Assistant' : 'User';
      prompt += `${who}: ${m.content}\n`;
    }
    prompt += '\nAssistant:';

    // Build args. Both CLIs read the prompt from stdin in non-interactive mode.
    const args = [];
    if (kind === 'claude-cli') {
      args.push('-p'); // print mode (non-interactive)
      if (options.model) args.push('--model', options.model);
    } else {
      // gemini CLI: -m selects model; prompt comes from stdin when piped
      if (options.model) args.push('-m', options.model);
    }

    const env = { ...process.env, PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin:/usr/bin` };
    let child;
    try {
      child = spawn(bin, args, { env });
    } catch (e) {
      return reject(new Error(`Could not run ${kind}: ${e.message}`));
    }

    let out = '', err = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch (e) {}
      reject(new Error(`${kind} timed out (is it logged in? run "${kind === 'gemini-cli' ? 'gemini' : 'claude'}" once in Terminal).`));
    }, options.timeoutMs || 150000);

    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`${kind} failed: ${e.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = out.trim();
      if (code === 0 && text) {
        resolve({ text });
      } else if (text) {
        // Non-zero exit but we still got output — use it.
        resolve({ text });
      } else {
        reject(new Error(`${kind} exited ${code}: ${(err || 'no output').slice(0, 200)}`));
      }
    });

    try { child.stdin.write(prompt); child.stdin.end(); } catch (e) {}
  });
}

/**
 * Load SOP (Standard Operating Procedures) content for AI context.
 * Cached in memory for 5 minutes to avoid DB reads on every request.
 */
let sopCache = { content: '', loadedAt: 0 };

/**
 * Force the next draft to re-read SOPs immediately. Call this whenever SOPs
 * change (in-app drop, delete, or ClickUp sync) so updates apply in real time.
 */
export function invalidateSOPCache() {
  sopCache = { content: '', loadedAt: 0 };
}

function getSOPContext() {
  const now = Date.now();
  // Refresh cache every 5 minutes
  if (now - sopCache.loadedAt > 5 * 60 * 1000) {
    try {
      const sopsJson = getSetting('sop_documents', '[]');
      const sops = JSON.parse(sopsJson);
      if (sops.length > 0) {
        let combined = '';
        for (const sop of sops) {
          const content = sop.content || '';
          // Limit total SOP context to avoid token overuse
          if (combined.length + content.length < 6000) {
            combined += `\n${content}\n`;
          } else {
            combined += `\n${content.substring(0, 2000)}\n[...truncated]\n`;
            break;
          }
        }
        sopCache = { content: combined.trim(), loadedAt: now };
      } else {
        sopCache = { content: '', loadedAt: now };
      }
    } catch (e) {
      sopCache = { content: '', loadedAt: now };
    }
  }
  return sopCache.content;
}

/**
 * Analyze a support ticket
 */
export async function analyzeTicket(ticket, options = {}) {
  const sopContent = getSOPContext();
  const sopSection = sopContent
    ? `\n\nCOMPANY STANDARD OPERATING PROCEDURES (follow these strictly):\n${sopContent}\n`
    : '';

  // Pre-extract links and IDs from ticket body using regex (fast, no AI needed)
  const fullText = `${ticket.subject || ''} ${ticket.description || ticket.description_text || ''}`;
  const extractedLinks = {
    loom: [...fullText.matchAll(/https?:\/\/(?:www\.)?loom\.com\/share\/[a-zA-Z0-9-]+/g)].map(m => m[0]),
    google_drive: [...fullText.matchAll(/https?:\/\/(?:drive|docs)\.google\.com\/[^\s<"')]+/g)].map(m => m[0]),
    screenshots: [...fullText.matchAll(/https?:\/\/[^\s<"')]+\.(?:png|jpg|jpeg|gif|webp|bmp)/gi)].map(m => m[0]),
    videos: [...fullText.matchAll(/https?:\/\/[^\s<"')]+\.(?:mp4|mov|avi|webm)/gi)].map(m => m[0]),
    any_urls: [...fullText.matchAll(/https?:\/\/[^\s<"')]+/g)].map(m => m[0]),
    location_ids: [...fullText.matchAll(/(?:location[_ ]?id|loc[_ ]?id|locationId)[:\s]*([a-zA-Z0-9_-]{10,})/gi)].map(m => m[1]),
    sub_account_ids: [...fullText.matchAll(/(?:sub[_ ]?account|subaccount)[:\s]*([a-zA-Z0-9_-]{10,})/gi)].map(m => m[1]),
    phone_numbers: [...fullText.matchAll(/(?:\+1|1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g)].map(m => m[0]),
    email_addresses: [...fullText.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)].map(m => m[0]),
  };

  // Build extracted data summary for the AI
  const extractedSummary = Object.entries(extractedLinks)
    .filter(([_, vals]) => vals.length > 0)
    .map(([key, vals]) => `${key}: ${vals.join(', ')}`)
    .join('\n');

  const prompt = `You are a support ticket analyzer for a GoHighLevel SaaS support team. Analyze this support ticket and provide:
1. ESCALATION_TYPE: One of [DEV, TWILIO, BILLING, FEATURE, BUG, SUPPORT, PORTING, API, INTEGRATION]
2. URGENCY_SCORE: 1-10 (10 being most urgent)
3. SUGGESTED_RESPONSE: A brief suggested response to the customer
4. ACTION_ITEMS: List of specific actions to resolve this (be specific — include checking links, reviewing screenshots, looking up location IDs)
5. SUMMARY: One sentence summary of the issue
6. KEY_RESOURCES: List any Loom links, Google Drive links, screenshots, location IDs, or phone numbers found in the ticket
7. QUICK_DIAGNOSIS: Based on the issue type, what is the most likely root cause? What should the agent check first?
8. ESTIMATED_EFFORT: One of [QUICK_FIX, MODERATE, INVESTIGATION_NEEDED, ESCALATION]
${sopSection}
Ticket Subject: ${ticket.subject}
Ticket Description: ${ticket.description || ticket.description_text || 'No description'}
Priority: ${ticket.priority || 'Unknown'}
Status: ${ticket.status || 'Unknown'}
${extractedSummary ? `\nEXTRACTED DATA (auto-parsed from ticket):\n${extractedSummary}` : ''}

Respond in JSON format only. No markdown, just the raw JSON object.`;

  const result = await chat([{ role: 'user', content: prompt }], {
    ...options,
    maxTokens: 1024,
    agentId: options.agentId || 'ticket-analyzer'
  });

  // Parse JSON from response
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const analysis = JSON.parse(jsonMatch[0]);
    return {
      ...analysis,
      // Always include regex-extracted links (even if AI misses them)
      extracted_links: extractedLinks,
      provider: result.provider,
      model: result.model
    };
  }

  throw new Error('Failed to parse AI analysis response');
}

/**
 * Generate a response for a ticket
 */
export async function generateResponse(ticket, options = {}) {
  const { agentName, similarTickets, analysis, conversationThread, agentSignature, cannedResponses } = options;

  const typeGuidelines = {
    porting: `
- Acknowledge the porting request warmly
- Confirm receipt of LOA and billing statement if mentioned
- Explain porting takes 7-14 business days after submission
- List any missing documents needed
- Provide clear next steps`,
    phone_system: `
- Acknowledge the phone/dialer issue with empathy
- Ask for specific error messages or screenshots
- Offer to check their Twilio/LC Phone settings
- Suggest common fixes (clear cache, try different browser)
- Mention escalation to technical team if needed`,
    cancellation: `
- Acknowledge their request professionally
- Express genuine desire to help resolve any issues
- Ask what led to this decision
- Offer alternatives if appropriate`,
    general: `
- Acknowledge their inquiry with a friendly greeting
- Provide clear, helpful information
- Offer to clarify or assist further`
  };

  let similarContext = '';
  if (similarTickets && similarTickets.length > 0) {
    similarContext = `

SIMILAR RESOLVED TICKETS FROM YOUR HISTORY (use these as reference — these are REAL tickets):
${similarTickets.map((s, i) => `
${i + 1}. Ticket #${s.id}: "${s.subject}"
   ${s.resolution ? `Resolution: ${s.resolution}` : ''}
   Keywords: ${(s.keywords || []).slice(0, 5).join(', ')}
   Match Score: ${s.score} keywords matched
`).join('')}

Use the resolutions and insights from these similar tickets to inform your response. Reference their solutions where applicable.`;
  }

  // Search casebook for human-approved responses to similar issues
  let casebookContext = '';
  try {
    const { searchCasebook } = await import('./database.js');
    const searchTerms = ticket.subject.split(/\s+/).filter(w => w.length > 3);
    const casebookMatches = searchCasebook(searchTerms, 3);
    if (casebookMatches.length > 0) {
      casebookContext = `\n\nHUMAN-APPROVED CASEBOOK RESPONSES (these are gold-standard — match their tone and approach):\n` +
        casebookMatches.map((c, i) =>
          `${i + 1}. Issue: "${c.subject}"\n   Approved Response: ${c.approved_response}\n   SOP Refs: ${c.sop_references || 'N/A'}`
        ).join('\n') + '\n';
    }
  } catch (e) {
    // Casebook not available yet
  }

  const ticketType = options.ticketType || 'general';
  const sopContent = getSOPContext();
  const sopSection = sopContent
    ? `\nCOMPANY SOPs (you MUST follow these protocols):\n${sopContent}\n`
    : '';

  // Build conversation thread context
  let threadContext = '';
  if (conversationThread && conversationThread.length > 0) {
    threadContext = `\n\nFULL CONVERSATION THREAD (read carefully — respond to the LATEST message, not just the description):
${conversationThread.map((msg, i) => {
  const label = msg.from === 'Agent' ? `[AGENT]` : `[CUSTOMER: ${msg.from}]`;
  const note = msg.private ? ' (PRIVATE NOTE)' : '';
  const date = msg.date ? ` (${new Date(msg.date).toLocaleString()})` : '';
  // Strip HTML for AI context
  const body = (msg.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1500);
  return `${label}${note}${date}:\n${body}`;
}).join('\n\n---\n\n')}
\nIMPORTANT: Your response should address the MOST RECENT customer message. Acknowledge the full conversation history.\n`;
  }

  // Build canned response examples
  let cannedContext = '';
  if (cannedResponses && cannedResponses.trim()) {
    cannedContext = `\n\nYOUR CANNED RESPONSES (use these as your writing style reference — match this tone, vocabulary, and structure):
${cannedResponses.substring(0, 4000)}
\nIMPORTANT: Write in the SAME style as the canned responses above. Use similar phrases, structure, and tone.\n`;
  }

  // STYLE LEARNING: how YOU actually write. Sources, in priority order:
  //   1) agentStyleExamples — verbatim real replies (from settings / learned)
  //   2) getResolvedDrafts — past approved/sent drafts created in this app
  let styleSamples = [];
  if (options.agentStyleExamples && options.agentStyleExamples.trim()) {
    styleSamples.push(options.agentStyleExamples.trim().substring(0, 4000));
  }
  try {
    const { getResolvedDrafts } = await import('./database.js');
    if (typeof getResolvedDrafts === 'function') {
      const pastResponses = getResolvedDrafts(5);
      for (const r of (pastResponses || [])) {
        if (r.draft_text) styleSamples.push(`(Ticket: "${r.ticket_subject}")\n${r.draft_text.substring(0, 800)}`);
      }
    }
  } catch (e) {
    // Past responses not available yet
  }

  let styleContext = '';
  if (styleSamples.length > 0) {
    styleContext = `\n\nHOW YOU ACTUALLY WRITE (real examples of your replies — mirror this voice, greeting, length, phrasing, and sign-off):
${styleSamples.slice(0, 6).map((s, i) => `--- Example ${i + 1} ---\n${s}\n---`).join('\n')}
\nMatch the tone, structure, contractions, and brevity of the examples above.\n`;
  }

  // Build signature
  const signatureSection = agentSignature && agentSignature.trim()
    ? `\nYOUR EMAIL SIGNATURE (use this EXACTLY at the end of every response):\n${agentSignature}\n`
    : '';

  // PERSONA — the authoritative voice, rules, and templates. Defaults to the
  // configured agent persona but can be overridden via options.agentPersona
  // (loaded from the agent_persona setting). This is sent as the SYSTEM prompt
  // so it governs everything.
  const persona = (options.agentPersona && options.agentPersona.trim())
    ? options.agentPersona.trim()
    : DEFAULT_AGENT_PERSONA;

  const systemPrompt = `${persona}

OUTPUT RULES (this reply will be copy-pasted into Freshdesk by the human):
- Write the reply in YOUR voice, following YOUR rules and templates above exactly.
- Keep it SHORT, to the point, and friendly. Never use quotation marks.
- Use bold (**like this**) only where your persona requires it (e.g. the P.S. lines).
- NEVER invent or guess ticket numbers, IDs, SIDs, dates, or past cases. Use ONLY identifiers explicitly given in the context below. If something needed is missing, ASK for it instead of guessing.
- This is a DRAFT for the human to review and send. Never claim you have already sent or replied.
${sopSection}${signatureSection}`;

  const tags = Array.isArray(ticket.tags) ? ticket.tags.join(', ') : (ticket.tags || '');
  const userPrompt = `Draft the customer response for this ticket now, in your voice and following your templates and rules.

CUSTOMER NAME: ${ticket.requester?.name || ticket.requester_name || 'there'}

TICKET DETAILS:
${ticket.id ? `Ticket ID: #${ticket.id}` : ''}
Subject: ${ticket.subject}
Description: ${ticket.description || ticket.description_text || 'No description provided'}
Ticket Type: ${ticketType}
${tags ? `Tags: ${tags}` : ''}
${analysis?.SUMMARY ? `Issue Summary: ${analysis.SUMMARY}` : ''}
${threadContext}${similarContext}
${casebookContext}${cannedContext}${styleContext}
Write the draft now. If the tags include "L1 Bot", also append the [FEEDBACK-CLASSIFIED] block per your rules.`;

  const result = await chat([{ role: 'user', content: userPrompt }], {
    ...options,
    systemPrompt,
    maxTokens: options.maxTokens || 1500,
    agentId: options.agentId || 'response-generator'
  });

  // Preserve the persona's intended formatting (bold P.S., bullet templates,
  // the [FEEDBACK-CLASSIFIED] block). Only strip stray code fences.
  const text = result.text.replace(/```/g, '').trim();

  return {
    response: text,
    provider: result.provider,
    model: result.model
  };
}

/**
 * Proactive analysis of ticket queue
 */
export async function proactiveAnalysis(tickets, options = {}) {
  if (!tickets || tickets.length === 0) {
    return { summary: 'No tickets to analyze', recommendations: [] };
  }

  const ticketSummary = tickets.map((t, i) =>
    `${i + 1}. [#${t.id || t.freshdesk_id}] ${t.subject} - Priority: ${t.priority}, Status: ${t.status}`
  ).join('\n');

  const prompt = `You are ${options.agentName || 'a support agent'}'s AI assistant analyzing their current ticket queue.

CURRENT OPEN TICKETS:
${ticketSummary}

Provide a proactive analysis in JSON format:
{
  "summary": "Brief overview of current workload and priorities",
  "urgentItems": ["List of tickets needing immediate attention"],
  "recommendations": [
    {"ticketId": 123, "action": "specific recommended action", "priority": "high/medium/low"},
    ...
  ],
  "patterns": ["Any patterns noticed across tickets"],
  "estimatedWorkload": "Estimated time to clear queue"
}

Respond with ONLY the JSON object, no markdown.`;

  const result = await chat([{ role: 'user', content: prompt }], {
    ...options,
    maxTokens: 2048,
    agentId: options.agentId || 'proactive-analyzer'
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const analysis = JSON.parse(jsonMatch[0]);
    return {
      ...analysis,
      provider: result.provider,
      model: result.model
    };
  }

  return {
    summary: 'Analysis complete',
    recommendations: [],
    patterns: [],
    provider: result.provider,
    model: result.model
  };
}

/**
 * Generate a response based on resolved ticket patterns (company standards)
 * Cross-references similar resolved tickets to learn response patterns
 */
export async function generateSmartResponse(ticket, resolvedTickets = [], options = {}) {
  const { agentName, companyStandards } = options;

  // Build context from resolved tickets
  let resolvedContext = '';
  if (resolvedTickets && resolvedTickets.length > 0) {
    resolvedContext = `
LEARN FROM THESE SUCCESSFULLY RESOLVED SIMILAR TICKETS:
${resolvedTickets.slice(0, 5).map((t, i) => `
--- Resolved Ticket ${i + 1} ---
Subject: ${t.subject}
Issue: ${t.description?.substring(0, 200) || 'N/A'}
Resolution/Response Used: ${t.resolution || t.response || 'Standard resolution applied'}
Keywords: ${Array.isArray(t.keywords) ? t.keywords.join(', ') : (t.keywords || 'N/A')}
`).join('\n')}

IMPORTANT: Use the tone, structure, and solutions from these resolved tickets as a template.
Match the company's established response patterns.`;
  }

  // Company standards prompt
  const standardsPrompt = companyStandards || `
COMPANY RESPONSE STANDARDS:
1. Be concise - customers want quick answers, not essays
2. Lead with the solution or next step
3. Use simple, non-technical language when possible
4. Always acknowledge the customer's frustration if expressed
5. Include specific action items or next steps
6. Never blame the customer or other teams
7. End with a clear call-to-action or offer of further help
8. Keep responses under 150 words when possible
9. Use bullet points for multiple steps
10. Always personalize with the customer's name`;

  const prompt = `You are ${agentName || 'a senior support agent'} writing a response to a customer ticket.

CRITICAL: Write a SHORT, DIRECT response following company standards. No fluff.

${standardsPrompt}

CURRENT TICKET TO RESPOND TO:
Subject: ${ticket.subject}
Description: ${ticket.description || ticket.description_text || 'No description'}
Customer: ${ticket.requester?.name || ticket.requester_name || 'Customer'}
Priority: ${ticket.priority || 'Normal'}
${resolvedContext}

FORMATTING RULES:
- Plain text only, NO markdown
- NO asterisks, hashtags, or backticks
- Keep it under 150 words
- Be direct and helpful

Write your response now:`;

  const result = await chat([{ role: 'user', content: prompt }], {
    ...options,
    maxTokens: 800,
    temperature: 0.7,
    agentId: options.agentId || 'smart-response-generator'
  });

  // Clean response
  let response = result.text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s/gm, '')
    .replace(/`/g, '')
    .trim();

  return {
    response,
    basedOnTickets: resolvedTickets.length,
    provider: result.provider,
    model: result.model
  };
}

/**
 * Generate daily report summary with AI
 */
export async function generateDailyReportSummary(reportData, options = {}) {
  const { tickets, urgentCount, typeBreakdown, recentPatterns } = reportData;

  const prompt = `You are an AI assistant generating an executive summary for a daily support report.

TODAY'S METRICS:
- Total Open Tickets: ${tickets?.length || 0}
- Urgent Items: ${urgentCount || 0}
- Ticket Types: ${JSON.stringify(typeBreakdown || {})}

RECENT PATTERNS:
${recentPatterns?.join('\n') || 'No patterns detected'}

Generate a brief (3-4 sentences) executive summary that:
1. Highlights the most critical items needing attention
2. Notes any concerning patterns or trends
3. Provides 1-2 actionable recommendations

Be direct and actionable. No fluff.`;

  const result = await chat([{ role: 'user', content: prompt }], {
    ...options,
    maxTokens: 500,
    agentId: 'report-summarizer'
  });

  return {
    summary: result.text.trim(),
    provider: result.provider
  };
}

/**
 * Learn from a resolved ticket (extract patterns for future use)
 */
export async function extractTicketPatterns(ticket, resolution, options = {}) {
  const prompt = `Analyze this resolved support ticket and extract learnable patterns.

TICKET:
Subject: ${ticket.subject}
Description: ${ticket.description || ticket.description_text || 'N/A'}
Type: ${ticket.escalation_type || 'SUPPORT'}

RESOLUTION PROVIDED:
${resolution}

Extract in JSON format:
{
  "keywords": ["key", "terms", "for", "matching"],
  "category": "main category",
  "problemPattern": "brief description of the problem type",
  "solutionPattern": "brief description of the solution approach",
  "responseTemplate": "a template response that could be reused",
  "escalationNeeded": true/false,
  "commonCauses": ["list", "of", "common", "causes"],
  "preventionTips": ["tips", "to", "prevent", "this", "issue"]
}

Respond with ONLY the JSON object.`;

  const result = await chat([{ role: 'user', content: prompt }], {
    ...options,
    maxTokens: 800,
    agentId: 'pattern-extractor'
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return {
    keywords: [],
    category: 'general',
    problemPattern: 'Unknown',
    solutionPattern: 'Standard resolution'
  };
}

/**
 * Vision analysis - Analyze an image with AI
 * Uses Gemini (free, best vision) > GPT-4o > Claude as fallback
 */
export async function analyzeImage(imageBase64, prompt, options = {}) {
  const systemPrompt = options.systemPrompt || 'You are a vision AI assistant for the LIV8 Command Center. Analyze images concisely. For voice responses, keep it under 3 sentences.';

  // Try Gemini first (free + excellent vision)
  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent([
        { text: prompt || 'What do you see? Be concise and actionable.' },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        },
      ]);

      const response = await result.response;
      return { text: response.text(), provider: 'gemini', model: 'gemini-2.0-flash' };
    } catch (err) {
      console.warn('Gemini vision failed:', err.message);
    }
  }

  // Fallback: GPT-4o (has vision)
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 512,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt || 'What do you see?' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
      });

      return {
        text: response.choices[0]?.message?.content || '',
        provider: 'openai',
        model: 'gpt-4o',
      };
    } catch (err) {
      console.warn('GPT-4o vision failed:', err.message);
    }
  }

  // Fallback: Claude (vision capable)
  if (anthropicClient) {
    try {
      const response = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt || 'What do you see?' },
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
              },
            ],
          },
        ],
      });

      return {
        text: response.content[0]?.text || '',
        provider: 'claude',
        model: 'claude-sonnet-4-20250514',
      };
    } catch (err) {
      console.warn('Claude vision failed:', err.message);
    }
  }

  throw new Error('No vision-capable AI provider available. Add a Gemini, OpenAI, or Claude API key.');
}

export default {
  initAIProviders,
  switchProvider,
  getCurrentProvider,
  getCostEffectiveProvider,
  updateApiKey,
  chat,
  analyzeImage,
  analyzeTicket,
  generateResponse,
  generateSmartResponse,
  proactiveAnalysis,
  generateDailyReportSummary,
  extractTicketPatterns
};
