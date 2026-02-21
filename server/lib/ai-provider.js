/**
 * LIV8 Command Center - AI Provider Module
 * Supports Claude, GPT, Gemini, Groq (Llama/Qwen), and NVIDIA NIM
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSetting, setSetting, logAgentInteraction } from './database.js';

// Provider instances
let anthropicClient = null;
let openaiClient = null;
let geminiClient = null;
let kimiApiKey = null; // NVIDIA NIM API key for Kimi
let groqApiKey = null; // Groq API key for Llama/Qwen (free tier available)

// Current configuration
let currentProvider = 'gemini';
let storedKeys = { anthropic: null, openai: null, gemini: null, kimi: null, groq: null };
let currentModel = null;

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

  storedKeys = { anthropic: anthropicKey || null, openai: openaiKey || null, gemini: geminiKey || null, kimi: kimiKey || null, groq: groqKey || null };

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

  // Set default provider
  let savedProvider = null;
  try { savedProvider = getSetting('ai_provider', null); } catch (e) {}
  currentProvider = savedProvider || config.provider || process.env.AI_PROVIDER || 'gemini';
  currentModel = getDefaultModel(currentProvider);

  console.log(`AI Provider initialized: ${currentProvider} (Claude: ${!!anthropicClient}, OpenAI: ${!!openaiClient}, Gemini: ${!!geminiClient}, Kimi: ${!!kimiApiKey}, Groq: ${!!groqApiKey})`);

  return {
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
  if (provider === 'openai') {
    return process.env.GPT_MODEL || 'gpt-4o';
  }
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20';
  if (provider === 'kimi') return process.env.KIMI_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct';
  if (provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
}

/**
 * Get the cheapest available provider for bulk/routine operations.
 * Priority: Groq (free tier Llama/Qwen) > Gemini (free/cheap) > Kimi (free tier) > OpenAI > Claude (most expensive)
 */
export function getCostEffectiveProvider() {
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
      claude: !!anthropicClient,
      openai: !!openaiClient,
      gemini: !!geminiClient,
      kimi: !!kimiApiKey,
      groq: !!groqApiKey
    },
    hasKeys: {
      claude: !!storedKeys.anthropic,
      openai: !!storedKeys.openai,
      gemini: !!storedKeys.gemini,
      kimi: !!storedKeys.kimi,
      groq: !!storedKeys.groq
    },
    models: {
      groq: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Free)', default: true },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Free)' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Free)' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Free)' }
      ],
      gemini: [
        { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', default: true },
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

  return false;
}

/**
 * Parse a provider error into a user-friendly message and error type
 */
function parseProviderError(provider, error) {
  const msg = error.message || String(error);

  // Authentication errors (401)
  if (msg.includes('401') || msg.includes('authentication_error') || msg.includes('invalid x-api-key') || msg.includes('Unauthorized') || msg.includes('Invalid API')) {
    const providerNames = { claude: 'Anthropic (Claude)', openai: 'OpenAI', gemini: 'Google Gemini', kimi: 'NVIDIA (Kimi)' };
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
  if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed') || msg.includes('network')) {
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
  const allProviders = ['groq', 'gemini', 'claude', 'openai', 'kimi'];
  const availableMap = { claude: !!anthropicClient, openai: !!openaiClient, gemini: !!geminiClient, kimi: !!kimiApiKey, groq: !!groqApiKey };
  return allProviders.filter(p => p !== failedProvider && availableMap[p]);
}

/**
 * Call a specific provider's chat function
 */
async function callProvider(provider, messages, options) {
  if (provider === 'openai') {
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
 * Main chat completion function - works with all providers
 * Includes automatic fallback to other available providers on failure
 */
export async function chat(messages, options = {}) {
  const provider = options.provider || currentProvider;
  const model = options.model || currentModel;
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.7;
  const systemPrompt = options.systemPrompt || null;
  const agentId = options.agentId || null;

  const chatOptions = { model, maxTokens, temperature, systemPrompt };
  const errors = [];

  // Try primary provider first (with one retry for rate limits)
  try {
    const result = await callProvider(provider, messages, chatOptions);

    if (agentId) {
      try { logAgentInteraction(agentId, 'chat', { messages, options }, { text: result.text, model, provider }, '', true); } catch (e) {}
    }

    return { text: result.text, provider, model, usage: result.usage };
  } catch (error) {
    const parsed = parseProviderError(provider, error);
    console.warn(`Primary provider ${provider} failed (${parsed.type}): ${parsed.userMessage}`);
    errors.push({ provider, error: parsed });

    // For rate limits, retry once after a short delay
    if (parsed.type === 'rate_limit') {
      try {
        console.log(`Retrying ${provider} after rate limit (2s delay)...`);
        await sleep(2000);
        const result = await callProvider(provider, messages, chatOptions);

        if (agentId) {
          try { logAgentInteraction(agentId, 'chat', { messages, options }, { text: result.text, model, provider }, '', true); } catch (e) {}
        }

        return { text: result.text, provider, model, usage: result.usage };
      } catch (retryError) {
        console.warn(`Retry for ${provider} also failed, trying fallback providers...`);
      }
    }

    // If error is not retryable (bad key), or retry failed, try fallback providers
    if (parsed.retryable || parsed.type === 'auth') {
      const fallbacks = getFallbackProviders(provider);
      for (const fallbackProvider of fallbacks) {
        try {
          console.log(`Trying fallback provider: ${fallbackProvider}`);
          const fallbackModel = getDefaultModel(fallbackProvider);
          const result = await callProvider(fallbackProvider, messages, { ...chatOptions, model: fallbackModel });

          if (agentId) {
            try { logAgentInteraction(agentId, 'chat', { messages, options }, { text: result.text, model: fallbackModel, provider: fallbackProvider }, '', true); } catch (e) {}
          }

          return { text: result.text, provider: fallbackProvider, model: fallbackModel, usage: result.usage, fallbackFrom: provider };
        } catch (fallbackError) {
          const fallbackParsed = parseProviderError(fallbackProvider, fallbackError);
          console.warn(`Fallback provider ${fallbackProvider} also failed: ${fallbackParsed.userMessage}`);
          errors.push({ provider: fallbackProvider, error: fallbackParsed });
        }
      }
    }

    // All providers failed - throw a user-friendly error
    if (agentId) {
      try { logAgentInteraction(agentId, 'chat', { messages, options }, { error: errors[0].error.userMessage }, '', false); } catch (e) {}
    }

    // Build a helpful combined error message
    const primaryError = errors[0].error;
    if (errors.length === 1) {
      throw new Error(primaryError.userMessage);
    }
    throw new Error(`All AI providers failed. ${primaryError.userMessage} ${errors.length - 1} fallback provider(s) also failed.`);
  }
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

  const model = geminiClient.getGenerativeModel({
    model: options.model || 'gemini-2.5-flash-preview-05-20',
    generationConfig: {
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature
    }
  });

  // Build conversation history
  const history = [];
  let systemInstruction = options.systemPrompt || '';

  for (const m of messages.slice(0, -1)) {
    history.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    });
  }

  // Get the last message as the current prompt
  const lastMessage = messages[messages.length - 1];
  let prompt = lastMessage?.content || '';

  // Prepend system prompt to first user message if exists
  if (systemInstruction && history.length === 0) {
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
 * Load SOP (Standard Operating Procedures) content for AI context.
 * Cached in memory for 5 minutes to avoid DB reads on every request.
 */
let sopCache = { content: '', loadedAt: 0 };

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

  const prompt = `You are a support ticket analyzer for a GoHighLevel SaaS support team. Analyze this support ticket and provide:
1. ESCALATION_TYPE: One of [DEV, TWILIO, BILLING, FEATURE, BUG, SUPPORT]
2. URGENCY_SCORE: 1-10 (10 being most urgent)
3. SUGGESTED_RESPONSE: A brief suggested response to the customer
4. ACTION_ITEMS: List of specific actions to resolve this
5. SUMMARY: One sentence summary of the issue
${sopSection}
Ticket Subject: ${ticket.subject}
Ticket Description: ${ticket.description || ticket.description_text || 'No description'}
Priority: ${ticket.priority || 'Unknown'}
Status: ${ticket.status || 'Unknown'}

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
  const { agentName, similarTickets, analysis } = options;

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

SIMILAR RESOLVED TICKETS FROM YOUR HISTORY (use these as reference):
${similarTickets.map((s, i) => `
${i + 1}. Ticket #${s.id}: "${s.subject}"
   Keywords: ${(s.keywords || []).slice(0, 5).join(', ')}
   Match Score: ${s.score} keywords matched
`).join('')}

Use insights from these similar tickets to inform your response.`;
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

  const prompt = `You are ${agentName || 'a support agent'}, a GoHighLevel Support Agent responding to a customer ticket. Write a professional, helpful response.

CRITICAL FORMATTING RULES:
- Write PLAIN TEXT only - absolutely NO markdown
- NO asterisks (*), NO hashtags (#), NO backticks (\`)
- Use simple line breaks for paragraphs
- Keep it conversational and professional
- The response should be ready to copy and paste directly into Freshdesk
${sopSection}
YOUR NAME: ${agentName || 'Support Agent'}
CUSTOMER NAME: ${ticket.requester?.name || ticket.requester_name || 'there'}

TICKET DETAILS:
Subject: ${ticket.subject}
Description: ${ticket.description || ticket.description_text || 'No description provided'}
Ticket Type: ${ticketType}
${analysis?.SUMMARY ? `Issue Summary: ${analysis.SUMMARY}` : ''}
${similarContext}
${casebookContext}
RESPONSE GUIDELINES FOR ${ticketType.toUpperCase()} TICKETS:
${typeGuidelines[ticketType] || typeGuidelines.general}

RESPONSE STRUCTURE:
1. Greeting with customer's name (Hi [Name],)
2. Acknowledge their specific issue
3. Provide solution or next steps
4. Offer further assistance
5. Sign off with: Best regards, ${agentName || 'Support Team'}

Write a warm, professional response. Do NOT use any markdown formatting.`;

  const result = await chat([{ role: 'user', content: prompt }], {
    ...options,
    maxTokens: 1024,
    agentId: options.agentId || 'response-generator'
  });

  // Clean any remaining markdown
  let text = result.text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^- /gm, '- ')
    .replace(/^#{1,6}\s/gm, '')
    .replace(/`/g, '')
    .replace(/\[|\]/g, '')
    .trim();

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

export default {
  initAIProviders,
  switchProvider,
  getCurrentProvider,
  getCostEffectiveProvider,
  updateApiKey,
  chat,
  analyzeTicket,
  generateResponse,
  generateSmartResponse,
  proactiveAnalysis,
  generateDailyReportSummary,
  extractTicketPatterns
};
