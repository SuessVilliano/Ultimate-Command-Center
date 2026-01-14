/**
 * LIV8 Command Center - AI Provider Module
 * Supports Claude (Anthropic) and GPT (OpenAI) with easy switching
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getSetting, setSetting, logAgentInteraction } from './database.js';

// Provider instances
let anthropicClient = null;
let openaiClient = null;

// Current configuration
let currentProvider = 'claude';
let currentModel = null;

/**
 * Initialize AI providers with API keys
 */
export function initAIProviders(config = {}) {
  const anthropicKey = config.anthropicKey || process.env.ANTHROPIC_API_KEY;
  const openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;

  if (anthropicKey) {
    anthropicClient = new Anthropic({ apiKey: anthropicKey });
    console.log('Anthropic (Claude) client initialized');
  }

  if (openaiKey) {
    openaiClient = new OpenAI({ apiKey: openaiKey });
    console.log('OpenAI (GPT) client initialized');
  }

  // Set default provider
  currentProvider = config.provider || process.env.AI_PROVIDER || 'claude';
  currentModel = getDefaultModel(currentProvider);

  return {
    claude: !!anthropicClient,
    openai: !!openaiClient,
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
      openai: !!openaiClient
    }
  };
}

/**
 * Update API key dynamically
 */
export function updateApiKey(provider, apiKey) {
  if (provider === 'claude' || provider === 'anthropic') {
    anthropicClient = new Anthropic({ apiKey });
    console.log('Anthropic API key updated');
    return true;
  }

  if (provider === 'openai' || provider === 'gpt') {
    openaiClient = new OpenAI({ apiKey });
    console.log('OpenAI API key updated');
    return true;
  }

  return false;
}

/**
 * Main chat completion function - works with both providers
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

export default {
  initAIProviders,
  switchProvider,
  getCurrentProvider,
  updateApiKey,
  chat,
  analyzeTicket,
  generateResponse,
  proactiveAnalysis
};
