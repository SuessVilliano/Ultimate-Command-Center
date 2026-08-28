/**
 * LIV8 Command Center - AI Provider Module
 * Local-first: Ollama/Qwen on the Mac mini. Cloud providers are opt-in fallbacks.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSetting, setSetting, logAgentInteraction } from './database.js';
import * as ollama from './ollama-provider.js';

let anthropicClient = null;
let openaiClient = null;
let geminiClient = null;
let kimiApiKey = null;
let groqApiKey = null;

let currentProvider = 'ollama';
let storedKeys = { anthropic: null, openai: null, gemini: null, kimi: null, groq: null };
let currentModel = null;

const localFirst = () => String(process.env.LOCAL_AI_FIRST ?? 'true').toLowerCase() !== 'false';
const allowCloudFallback = () => String(process.env.ALLOW_PAID_AI_FALLBACK ?? 'false').toLowerCase() === 'true';

function safeErrorMessage(error) {
  let msg = error?.message || String(error || 'Unknown error');
  // Never let provider responses dump credentials into application logs.
  msg = msg
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_GOOGLE_KEY]')
    .replace(/sk-[0-9A-Za-z_-]{16,}/g, '[REDACTED_KEY]')
    .replace(/(?:api[_-]?key|authorization|bearer|token)["'\s:=]+[0-9A-Za-z._-]{12,}/gi, '$1=[REDACTED]');
  return msg.substring(0, 240);
}

export function initAIProviders(config = {}) {
  let persistedAnthropicKey = null;
  let persistedOpenaiKey = null;
  let persistedGeminiKey = null;
  let persistedKimiKey = null;
  let persistedGroqKey = null;

  try {
    persistedAnthropicKey = getSetting('anthropic_api_key', null);
    persistedOpenaiKey = getSetting('openai_api_key', null);
    persistedGeminiKey = getSetting('gemini_api_key', null);
    persistedKimiKey = getSetting('kimi_api_key', null);
    persistedGroqKey = getSetting('groq_api_key', null);
  } catch {}

  const anthropicKey = config.anthropicKey || persistedAnthropicKey || process.env.ANTHROPIC_API_KEY;
  const openaiKey = config.openaiKey || persistedOpenaiKey || process.env.OPENAI_API_KEY;
  const geminiKey = config.geminiKey || persistedGeminiKey || process.env.GEMINI_API_KEY;
  const kimiKey = config.kimiKey || persistedKimiKey || process.env.KIMI_API_KEY || process.env.NVIDIA_API_KEY;
  const groqKey = config.groqKey || persistedGroqKey || process.env.GROQ_API_KEY;

  storedKeys = {
    anthropic: anthropicKey || null,
    openai: openaiKey || null,
    gemini: geminiKey || null,
    kimi: kimiKey || null,
    groq: groqKey || null,
  };

  if (anthropicKey) anthropicClient = new Anthropic({ apiKey: anthropicKey });
  if (openaiKey) openaiClient = new OpenAI({ apiKey: openaiKey });
  if (geminiKey) geminiClient = new GoogleGenerativeAI(geminiKey);
  if (kimiKey) kimiApiKey = kimiKey;
  if (groqKey) groqApiKey = groqKey;

  let savedProvider = null;
  try { savedProvider = getSetting('ai_provider', null); } catch {}

  // Local-first deliberately overrides stale persisted cloud selections unless
  // LOCAL_AI_FIRST=false is explicitly set.
  currentProvider = localFirst()
    ? 'ollama'
    : (config.provider || savedProvider || process.env.AI_PROVIDER || 'ollama');
  currentModel = getDefaultModel(currentProvider);

  console.log(`[AI] Provider: ${currentProvider}/${currentModel} | local-first=${localFirst()} | cloud-fallback=${allowCloudFallback()}`);

  return {
    ollama: true,
    claude: !!anthropicClient,
    openai: !!openaiClient,
    gemini: !!geminiClient,
    kimi: !!kimiApiKey,
    groq: !!groqApiKey,
    currentProvider,
    currentModel,
    localFirst: localFirst(),
    cloudFallback: allowCloudFallback(),
  };
}

function getDefaultModel(provider) {
  if (provider === 'ollama') return process.env.OLLAMA_MODEL || 'qwen3:8b';
  if (provider === 'openai') return process.env.GPT_MODEL || 'gpt-4o';
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  if (provider === 'kimi') return process.env.KIMI_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct';
  if (provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  return process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
}

export function getCostEffectiveProvider() {
  if (localFirst()) return { provider: 'ollama', model: getDefaultModel('ollama'), local: true, cost: '$0' };
  if (groqApiKey) return { provider: 'groq', model: getDefaultModel('groq') };
  if (geminiClient) return { provider: 'gemini', model: getDefaultModel('gemini') };
  if (kimiApiKey) return { provider: 'kimi', model: getDefaultModel('kimi') };
  if (openaiClient) return { provider: 'openai', model: getDefaultModel('openai') };
  if (anthropicClient) return { provider: 'claude', model: getDefaultModel('claude') };
  return { provider: 'ollama', model: getDefaultModel('ollama'), local: true, cost: '$0' };
}

export function switchProvider(provider, model = null) {
  if (provider === 'openai' && !openaiClient) throw new Error('OpenAI API key not configured');
  if (provider === 'claude' && !anthropicClient) throw new Error('Anthropic API key not configured');
  if (provider === 'gemini' && !geminiClient) throw new Error('Gemini API key not configured');
  if (provider === 'kimi' && !kimiApiKey) throw new Error('Kimi/NVIDIA API key not configured');
  if (provider === 'groq' && !groqApiKey) throw new Error('Groq API key not configured');
  if (!['ollama', 'openai', 'claude', 'gemini', 'kimi', 'groq'].includes(provider)) throw new Error('Unknown AI provider');

  currentProvider = provider;
  currentModel = model || getDefaultModel(provider);
  try {
    setSetting('ai_provider', provider);
    setSetting('ai_model', currentModel);
  } catch {}
  return { provider: currentProvider, model: currentModel };
}

export function getCurrentProvider() {
  return {
    provider: currentProvider,
    model: currentModel,
    localFirst: localFirst(),
    cloudFallback: allowCloudFallback(),
    available: {
      ollama: true,
      claude: !!anthropicClient,
      openai: !!openaiClient,
      gemini: !!geminiClient,
      kimi: !!kimiApiKey,
      groq: !!groqApiKey,
    },
    hasKeys: {
      claude: !!storedKeys.anthropic,
      openai: !!storedKeys.openai,
      gemini: !!storedKeys.gemini,
      kimi: !!storedKeys.kimi,
      groq: !!storedKeys.groq,
    },
    models: {
      ollama: [
        { id: process.env.OLLAMA_MODEL || 'qwen3:8b', name: 'Qwen3 8B — Mac mini $0', default: true },
        { id: process.env.OLLAMA_FAST_MODEL || 'gemma3:4b', name: 'Gemma 3 4B — Fast/vision $0' },
      ],
      groq: [
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
      ],
      gemini: [{ id: 'gemini-2.0-flash', name: 'Gemini Flash' }],
      claude: [{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' }],
      openai: [{ id: 'gpt-4o', name: 'GPT-4o' }],
      kimi: [{ id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B' }],
    },
  };
}

export function updateApiKey(provider, apiKey) {
  if (provider === 'claude' || provider === 'anthropic') {
    anthropicClient = new Anthropic({ apiKey }); storedKeys.anthropic = apiKey;
    try { setSetting('anthropic_api_key', apiKey); } catch {}
    return true;
  }
  if (provider === 'openai' || provider === 'gpt') {
    openaiClient = new OpenAI({ apiKey }); storedKeys.openai = apiKey;
    try { setSetting('openai_api_key', apiKey); } catch {}
    return true;
  }
  if (provider === 'gemini' || provider === 'google') {
    geminiClient = new GoogleGenerativeAI(apiKey); storedKeys.gemini = apiKey;
    try { setSetting('gemini_api_key', apiKey); } catch {}
    return true;
  }
  if (provider === 'kimi' || provider === 'nvidia') {
    kimiApiKey = apiKey; storedKeys.kimi = apiKey;
    try { setSetting('kimi_api_key', apiKey); } catch {}
    return true;
  }
  if (provider === 'groq') {
    groqApiKey = apiKey; storedKeys.groq = apiKey;
    try { setSetting('groq_api_key', apiKey); } catch {}
    return true;
  }
  return false;
}

function parseProviderError(provider, error) {
  const msg = safeErrorMessage(error);
  if (/401|403|authentication|unauthorized|invalid.*key|forbidden/i.test(msg)) {
    return { type: 'auth', userMessage: `${provider} authentication/billing failed`, retryable: false };
  }
  if (/429|too many|quota|rate limit/i.test(msg)) {
    return { type: 'rate_limit', userMessage: `${provider} quota/rate limit reached`, retryable: false };
  }
  if (/ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(msg)) {
    return { type: 'network', userMessage: `${provider} is unreachable`, retryable: false };
  }
  return { type: 'unknown', userMessage: `${provider} request failed`, retryable: false };
}

function getFallbackProviders(failedProvider) {
  if (!allowCloudFallback()) return [];
  const allProviders = ['groq', 'gemini', 'kimi', 'openai', 'claude'];
  const availableMap = {
    claude: !!anthropicClient,
    openai: !!openaiClient,
    gemini: !!geminiClient,
    kimi: !!kimiApiKey,
    groq: !!groqApiKey,
  };
  return allProviders.filter(p => p !== failedProvider && availableMap[p]);
}

async function callProvider(provider, messages, options) {
  if (provider === 'ollama') return ollama.chat(messages, { ...options, model: options.model || getDefaultModel('ollama') });
  if (provider === 'openai') {
    const response = await chatWithOpenAI(messages, { ...options, model: options.model || getDefaultModel('openai') });
    return { text: response.choices[0]?.message?.content || '', usage: response.usage || null };
  }
  if (provider === 'gemini') return chatWithGemini(messages, { ...options, model: options.model || getDefaultModel('gemini') });
  if (provider === 'kimi') return chatWithKimi(messages, { ...options, model: options.model || getDefaultModel('kimi') });
  if (provider === 'groq') return chatWithGroq(messages, { ...options, model: options.model || getDefaultModel('groq') });
  const response = await chatWithClaude(messages, { ...options, model: options.model || getDefaultModel('claude') });
  return { text: response.content[0]?.text || '', usage: response.usage || null };
}

export async function chat(messages, options = {}) {
  const requestedProvider = options.provider;
  const provider = requestedProvider || (localFirst() ? 'ollama' : currentProvider);
  const model = options.model || getDefaultModel(provider);
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature ?? 0.7;
  const systemPrompt = options.systemPrompt || null;
  const agentId = options.agentId || null;
  const chatOptions = { model, maxTokens, temperature, systemPrompt, fast: options.fast === true };

  // Explicit cloud selection is respected. Otherwise Ollama is always first.
  const chain = [{ name: provider, model }];
  if (provider === 'ollama') {
    for (const p of getFallbackProviders('ollama')) chain.push({ name: p, model: getDefaultModel(p) });
  }

  const errors = [];
  for (const p of chain) {
    try {
      const result = await callProvider(p.name, messages, { ...chatOptions, model: p.model });
      if (agentId) {
        try { logAgentInteraction(agentId, 'chat', { messages, options }, { text: result.text, model: p.model, provider: p.name }, '', true); } catch {}
      }
      return {
        text: result.text,
        provider: p.name,
        model: p.model,
        usage: result.usage || null,
        local: p.name === 'ollama',
        cost: p.name === 'ollama' ? '$0' : undefined,
        fallbackFrom: p.name !== provider ? provider : undefined,
      };
    } catch (error) {
      const parsed = parseProviderError(p.name, error);
      console.warn(`[AI] ${p.name} failed: ${parsed.userMessage}`);
      errors.push({ provider: p.name, error: parsed });
    }
  }

  if (agentId) {
    try { logAgentInteraction(agentId, 'chat', { messages, options }, { error: 'AI provider unavailable' }, '', false); } catch {}
  }

  if (provider === 'ollama' && !allowCloudFallback()) {
    throw new Error('Local AI is unavailable. Start Ollama on the Mac mini. Paid cloud fallback is disabled.');
  }
  throw new Error(`AI provider unavailable: ${errors.map(e => e.provider).join(', ')}`);
}

async function chatWithClaude(messages, options) {
  if (!anthropicClient) throw new Error('Anthropic client not initialized');
  const formattedMessages = messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  const requestParams = { model: options.model, max_tokens: options.maxTokens, messages: formattedMessages };
  if (options.systemPrompt) requestParams.system = options.systemPrompt;
  if (options.temperature !== undefined) requestParams.temperature = Math.min(options.temperature, 1);
  return anthropicClient.messages.create(requestParams);
}

async function chatWithOpenAI(messages, options) {
  if (!openaiClient) throw new Error('OpenAI client not initialized');
  const formattedMessages = [];
  if (options.systemPrompt) formattedMessages.push({ role: 'system', content: options.systemPrompt });
  for (const m of messages) formattedMessages.push({ role: m.role, content: m.content });
  return openaiClient.chat.completions.create({
    model: options.model,
    messages: formattedMessages,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
  });
}

async function chatWithGemini(messages, options) {
  if (!geminiClient) throw new Error('Gemini client not initialized');
  const modelConfig = {
    model: options.model || 'gemini-2.0-flash',
    generationConfig: { maxOutputTokens: options.maxTokens, temperature: options.temperature },
  };
  if (options.systemPrompt) modelConfig.systemInstruction = options.systemPrompt;
  const model = geminiClient.getGenerativeModel(modelConfig);
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const prompt = messages[messages.length - 1]?.content || '';
  const chatSession = model.startChat({ history });
  const result = await chatSession.sendMessage(prompt);
  const response = await result.response;
  return { text: response.text(), usage: null };
}

async function chatWithKimi(messages, options) {
  if (!kimiApiKey) throw new Error('Kimi/NVIDIA API key not initialized');
  const formattedMessages = [];
  if (options.systemPrompt) formattedMessages.push({ role: 'system', content: options.systemPrompt });
  for (const m of messages) formattedMessages.push({ role: m.role, content: m.content });
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kimiApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || getDefaultModel('kimi'),
      messages: formattedMessages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`NVIDIA request failed (HTTP ${response.status})`);
  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || '', usage: data.usage || null };
}

async function chatWithGroq(messages, options) {
  if (!groqApiKey) throw new Error('Groq API key not initialized');
  const formattedMessages = [];
  if (options.systemPrompt) formattedMessages.push({ role: 'system', content: options.systemPrompt });
  for (const m of messages) formattedMessages.push({ role: m.role, content: m.content });
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || getDefaultModel('groq'),
      messages: formattedMessages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(`Groq request failed (HTTP ${response.status})`);
  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || '', usage: data.usage || null };
}

let sopCache = { content: '', loadedAt: 0 };
function getSOPContext() {
  const now = Date.now();
  if (now - sopCache.loadedAt > 5 * 60 * 1000) {
    try {
      const sops = JSON.parse(getSetting('sop_documents', '[]'));
      let combined = '';
      for (const sop of sops) {
        const content = sop.content || '';
        if (combined.length + content.length < 6000) combined += `\n${content}\n`;
        else { combined += `\n${content.substring(0, 2000)}\n[...truncated]\n`; break; }
      }
      sopCache = { content: combined.trim(), loadedAt: now };
    } catch { sopCache = { content: '', loadedAt: now }; }
  }
  return sopCache.content;
}

export async function analyzeTicket(ticket, options = {}) {
  const sopContent = getSOPContext();
  const fullText = `${ticket.subject || ''} ${ticket.description || ticket.description_text || ''}`;
  const extractedLinks = {
    loom: [...fullText.matchAll(/https?:\/\/(?:www\.)?loom\.com\/share\/[a-zA-Z0-9-]+/g)].map(m => m[0]),
    google_drive: [...fullText.matchAll(/https?:\/\/(?:drive|docs)\.google\.com\/[^\s<"')]+/g)].map(m => m[0]),
    screenshots: [...fullText.matchAll(/https?:\/\/[^\s<"')]+\.(?:png|jpg|jpeg|gif|webp|bmp)/gi)].map(m => m[0]),
    any_urls: [...fullText.matchAll(/https?:\/\/[^\s<"')]+/g)].map(m => m[0]),
    location_ids: [...fullText.matchAll(/(?:location[_ ]?id|loc[_ ]?id|locationId)[:\s]*([a-zA-Z0-9_-]{10,})/gi)].map(m => m[1]),
    phone_numbers: [...fullText.matchAll(/(?:\+1|1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g)].map(m => m[0]),
    email_addresses: [...fullText.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)].map(m => m[0]),
  };
  const prompt = `Analyze this GoHighLevel support ticket. Return JSON only with ESCALATION_TYPE, URGENCY_SCORE, SUGGESTED_RESPONSE, ACTION_ITEMS, SUMMARY, KEY_RESOURCES, QUICK_DIAGNOSIS, ESTIMATED_EFFORT.\n${sopContent ? `SOPs:\n${sopContent}\n` : ''}Subject: ${ticket.subject}\nDescription: ${ticket.description || ticket.description_text || 'No description'}\nPriority: ${ticket.priority || 'Unknown'}\nStatus: ${ticket.status || 'Unknown'}\nAuto-extracted: ${JSON.stringify(extractedLinks)}`;
  const result = await chat([{ role: 'user', content: prompt }], { ...options, maxTokens: 1200, agentId: options.agentId || 'ticket-analyzer' });
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI analysis response');
  return { ...JSON.parse(jsonMatch[0]), extracted_links: extractedLinks, provider: result.provider, model: result.model };
}

export async function generateResponse(ticket, options = {}) {
  const name = ticket.requester?.name || ticket.requester_name || 'there';
  const prompt = `Write a concise, professional GoHighLevel support reply in plain text only. Do not invent facts, IDs, or policies.\nCustomer: ${name}\nSubject: ${ticket.subject}\nDescription: ${ticket.description || ticket.description_text || 'No description'}\n${options.analysis?.SUMMARY ? `Summary: ${options.analysis.SUMMARY}\n` : ''}${options.cannedResponses ? `Style examples:\n${options.cannedResponses.substring(0, 3000)}\n` : ''}${options.agentSignature ? `Use this exact signature:\n${options.agentSignature}\n` : ''}`;
  const result = await chat([{ role: 'user', content: prompt }], { ...options, maxTokens: 1024, agentId: options.agentId || 'response-generator' });
  const text = result.text.replace(/\*\*/g, '').replace(/^#{1,6}\s/gm, '').replace(/`/g, '').trim();
  return { response: text, provider: result.provider, model: result.model };
}

export async function proactiveAnalysis(tickets, options = {}) {
  if (!tickets?.length) return { summary: 'No tickets to analyze', recommendations: [] };
  const ticketSummary = tickets.map((t, i) => `${i + 1}. [#${t.id || t.freshdesk_id}] ${t.subject} - Priority: ${t.priority}, Status: ${t.status}`).join('\n');
  const prompt = `Analyze this support queue and return JSON only with summary, urgentItems, recommendations, patterns, estimatedWorkload.\n${ticketSummary}`;
  const result = await chat([{ role: 'user', content: prompt }], { ...options, maxTokens: 1600, agentId: options.agentId || 'proactive-analyzer', fast: true });
  const m = result.text.match(/\{[\s\S]*\}/);
  return m ? { ...JSON.parse(m[0]), provider: result.provider, model: result.model } : { summary: result.text, recommendations: [], provider: result.provider, model: result.model };
}

export async function generateSmartResponse(ticket, resolvedTickets = [], options = {}) {
  const examples = resolvedTickets.slice(0, 5).map(t => `Subject: ${t.subject}\nResolution: ${t.resolution || t.response || ''}`).join('\n---\n');
  const prompt = `Write a short, direct plain-text support response under 150 words. Learn from these approved examples when relevant:\n${examples}\nCURRENT:\nSubject: ${ticket.subject}\nDescription: ${ticket.description || ticket.description_text || ''}\nCustomer: ${ticket.requester?.name || ticket.requester_name || 'Customer'}`;
  const result = await chat([{ role: 'user', content: prompt }], { ...options, maxTokens: 800, agentId: options.agentId || 'smart-response-generator' });
  return { response: result.text.replace(/\*\*/g, '').replace(/`/g, '').trim(), basedOnTickets: resolvedTickets.length, provider: result.provider, model: result.model };
}

export async function generateDailyReportSummary(reportData, options = {}) {
  const prompt = `Create a 3-4 sentence executive support summary. Open tickets: ${reportData.tickets?.length || 0}. Urgent: ${reportData.urgentCount || 0}. Types: ${JSON.stringify(reportData.typeBreakdown || {})}. Patterns: ${(reportData.recentPatterns || []).join('; ')}. Include concrete next actions.`;
  const result = await chat([{ role: 'user', content: prompt }], { ...options, maxTokens: 500, agentId: 'report-summarizer', fast: true });
  return { summary: result.text.trim(), provider: result.provider };
}

export async function extractTicketPatterns(ticket, resolution, options = {}) {
  const prompt = `Return JSON only with keywords, category, problemPattern, solutionPattern, responseTemplate, escalationNeeded, commonCauses, preventionTips.\nTicket: ${ticket.subject}\n${ticket.description || ticket.description_text || ''}\nResolution: ${resolution}`;
  const result = await chat([{ role: 'user', content: prompt }], { ...options, maxTokens: 900, agentId: 'pattern-extractor', fast: true });
  const m = result.text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : { keywords: [], category: 'general', problemPattern: 'Unknown', solutionPattern: 'Standard resolution' };
}

export async function analyzeImage(imageBase64, prompt, options = {}) {
  const systemPrompt = options.systemPrompt || 'You are a concise visual assistant for LIV8 Command Center.';

  // Gemma 3 is multimodal in Ollama and is the free/local vision default.
  if (localFirst()) {
    try {
      const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
      const model = process.env.OLLAMA_FAST_MODEL || 'gemma3:4b';
      const response = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt || 'What do you see? Be concise and actionable.', images: [imageBase64] },
          ],
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error(`Local vision HTTP ${response.status}`);
      const data = await response.json();
      return { text: data?.message?.content || '', provider: 'ollama', model, local: true, cost: '$0' };
    } catch (error) {
      console.warn(`[AI] Local vision unavailable: ${safeErrorMessage(error)}`);
      if (!allowCloudFallback()) throw new Error('Local vision is unavailable and paid cloud fallback is disabled.');
    }
  }

  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: systemPrompt });
      const result = await model.generateContent([{ text: prompt || 'What do you see?' }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }]);
      const response = await result.response;
      return { text: response.text(), provider: 'gemini', model: 'gemini-2.0-flash' };
    } catch (error) { console.warn('[AI] Gemini vision failed'); }
  }
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o', max_tokens: 512,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: [{ type: 'text', text: prompt || 'What do you see?' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }] }],
      });
      return { text: response.choices[0]?.message?.content || '', provider: 'openai', model: 'gpt-4o' };
    } catch { console.warn('[AI] OpenAI vision failed'); }
  }
  if (anthropicClient) {
    try {
      const response = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 512, system: systemPrompt,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt || 'What do you see?' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } }] }],
      });
      return { text: response.content[0]?.text || '', provider: 'claude', model: 'claude-sonnet-4-20250514' };
    } catch { console.warn('[AI] Claude vision failed'); }
  }
  throw new Error('No vision provider available');
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
  extractTicketPatterns,
};
