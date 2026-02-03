/**
 * LIV8 Command Center - AI Provider Module
 * Supports Claude (Anthropic) and GPT (OpenAI) with easy switching
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSetting, setSetting, logAgentInteraction } from './database.js';

// Provider instances
let anthropicClient = null;
let openaiClient = null;
let geminiClient = null;

// Current configuration
let currentProvider = 'gemini';
let storedKeys = { anthropic: null, openai: null, gemini: null };
let currentModel = null;

/**
 * Initialize AI providers with API keys
 */
export function initAIProviders(config = {}) {
  // Try to load persisted keys from database first
  let persistedAnthropicKey = null;
  let persistedOpenaiKey = null;
  let persistedGeminiKey = null;

  try {
    persistedAnthropicKey = getSetting('anthropic_api_key', null);
    persistedOpenaiKey = getSetting('openai_api_key', null);
    persistedGeminiKey = getSetting('gemini_api_key', null);
  } catch (e) {
    // Database might not be ready yet
  }

  // Priority: config > persisted > env var
  const anthropicKey = config.anthropicKey || persistedAnthropicKey || process.env.ANTHROPIC_API_KEY;
  const openaiKey = config.openaiKey || persistedOpenaiKey || process.env.OPENAI_API_KEY;
  const geminiKey = config.geminiKey || persistedGeminiKey || process.env.GEMINI_API_KEY;

  storedKeys = { anthropic: anthropicKey || null, openai: openaiKey || null, gemini: geminiKey || null };

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

  // Set default provider
  let savedProvider = null;
  try { savedProvider = getSetting('ai_provider', null); } catch (e) {}
  currentProvider = savedProvider || config.provider || process.env.AI_PROVIDER || 'gemini';
  currentModel = getDefaultModel(currentProvider);

  console.log(`AI Provider initialized: ${currentProvider} (Claude: ${!!anthropicClient}, OpenAI: ${!!openaiClient}, Gemini: ${!!geminiClient})`);

  return {
    claude: !!anthropicClient,
    openai: !!openaiClient,
    gemini: !!geminiClient,
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
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  return process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
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
      gemini: !!geminiClient
    },
    hasKeys: {
      claude: !!storedKeys.anthropic,
      openai: !!storedKeys.openai,
      gemini: !!storedKeys.gemini
    },
    models: {
      gemini: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', default: true },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' }
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

  return false;
}

/**
 * Main chat completion function - works with all providers
 */
export async function chat(messages, options = {}) {
  const provider = options.provider || currentProvider;
  const model = options.model || currentModel;
  const maxTokens = options.maxTokens || 1024;
  const temperature = options.temperature || 0.7;
  const systemPrompt = options.systemPrompt || null;
  const agentId = options.agentId || null;

  let response;
  let text;

  try {
    if (provider === 'openai') {
      response = await chatWithOpenAI(messages, { model, maxTokens, temperature, systemPrompt });
      text = response.choices[0]?.message?.content || '';
    } else if (provider === 'gemini') {
      response = await chatWithGemini(messages, { model, maxTokens, temperature, systemPrompt });
      text = response.text || '';
    } else {
      response = await chatWithClaude(messages, { model, maxTokens, temperature, systemPrompt });
      text = response.content[0]?.text || '';
    }

    // Log interaction if agent specified
    if (agentId) {
      try {
        logAgentInteraction(agentId, 'chat', { messages, options }, { text, model, provider }, '', true);
      } catch (e) {}
    }

    return {
      text,
      provider,
      model,
      usage: response.usage || null
    };
  } catch (error) {
    // Log failed interaction
    if (agentId) {
      try {
        logAgentInteraction(agentId, 'chat', { messages, options }, { error: error.message }, '', false);
      } catch (e) {}
    }
    throw error;
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
    model: options.model || 'gemini-2.0-flash',
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
 * Analyze a support ticket
 */
export async function analyzeTicket(ticket, options = {}) {
  const prompt = `You are a support ticket analyzer for a SaaS company. Analyze this support ticket and provide:
1. ESCALATION_TYPE: One of [DEV, TWILIO, BILLING, FEATURE, BUG, SUPPORT]
2. URGENCY_SCORE: 1-10 (10 being most urgent)
3. SUGGESTED_RESPONSE: A brief suggested response to the customer
4. ACTION_ITEMS: List of specific actions to resolve this
5. SUMMARY: One sentence summary of the issue

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

  const ticketType = options.ticketType || 'general';
  const prompt = `You are ${agentName || 'a support agent'}, a GoHighLevel Support Agent responding to a customer ticket. Write a professional, helpful response.

CRITICAL FORMATTING RULES:
- Write PLAIN TEXT only - absolutely NO markdown
- NO asterisks (*), NO hashtags (#), NO backticks (\`)
- Use simple line breaks for paragraphs
- Keep it conversational and professional
- The response should be ready to copy and paste directly into Freshdesk

YOUR NAME: ${agentName || 'Support Agent'}
CUSTOMER NAME: ${ticket.requester?.name || ticket.requester_name || 'there'}

TICKET DETAILS:
Subject: ${ticket.subject}
Description: ${ticket.description || ticket.description_text || 'No description provided'}
Ticket Type: ${ticketType}
${analysis?.SUMMARY ? `Issue Summary: ${analysis.SUMMARY}` : ''}
${similarContext}

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
  updateApiKey,
  chat,
  analyzeTicket,
  generateResponse,
  generateSmartResponse,
  proactiveAnalysis,
  generateDailyReportSummary,
  extractTicketPatterns
};
