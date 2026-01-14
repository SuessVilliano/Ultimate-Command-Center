/**
 * Agent Orchestrator
 *
 * Intelligent routing system that:
 * 1. Analyzes user requests using NLP
 * 2. Determines which specialist agent(s) should handle the request
 * 3. Routes queries and collects responses
 * 4. Coordinates multi-agent conversations
 * 5. Maintains context across agent handoffs
 */

import * as agentKnowledge from './agent-knowledge.js';
import * as aiProvider from './ai-provider.js';

// Agent matching keywords for fast routing
const AGENT_KEYWORDS = {
  'highlevel-specialist': [
    'highlevel', 'gohighlevel', 'ghl', 'workflow', 'automation', 'trigger',
    'lc phone', 'twilio', 'porting', 'port number', 'phone number',
    'crm', 'pipeline', 'opportunity', 'contact', 'lead',
    'email campaign', 'sms', 'text message', 'broadcast',
    'calendar', 'appointment', 'booking', 'funnel', 'landing page',
    'snapshot', 'sub-account', 'agency', 'saas mode',
    'webhook', 'api integration', 'zapier', 'stripe', 'payment'
  ],
  'hybrid-grid': [
    'trading', 'trade', 'market', 'stock', 'forex', 'crypto',
    'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol',
    'futures', 'nq', 'es', 'nasdaq', 'spy',
    'eur/usd', 'gbp', 'currency', 'pip',
    'technical analysis', 'chart', 'indicator', 'rsi', 'macd',
    'support', 'resistance', 'trend', 'breakout',
    'day trading', 'swing trading', 'scalping',
    'risk management', 'position size', 'stop loss'
  ],
  'dev-ops': [
    'code', 'coding', 'programming', 'developer', 'development',
    'javascript', 'python', 'react', 'node', 'typescript',
    'git', 'github', 'deploy', 'deployment', 'server',
    'docker', 'container', 'kubernetes', 'aws', 'cloud',
    'database', 'sql', 'mongodb', 'api', 'endpoint',
    'bug', 'debug', 'error', 'fix', 'issue',
    'ci/cd', 'pipeline', 'build', 'test'
  ],
  'content-creator': [
    'content', 'copy', 'copywriting', 'write', 'writing',
    'social media', 'instagram', 'facebook', 'twitter', 'linkedin', 'tiktok',
    'email', 'newsletter', 'subject line',
    'blog', 'article', 'post',
    'seo', 'keyword', 'headline', 'caption',
    'brand', 'voice', 'tone', 'messaging',
    'marketing', 'campaign', 'ad', 'advertisement'
  ],
  'business-analyst': [
    'business', 'strategy', 'planning', 'plan',
    'metrics', 'kpi', 'analytics', 'data',
    'process', 'efficiency', 'optimization', 'improve',
    'revenue', 'profit', 'cost', 'budget', 'forecast',
    'market research', 'competitor', 'analysis',
    'growth', 'scale', 'expand'
  ],
  'legal-contracts': [
    'contract', 'agreement', 'legal', 'terms',
    'clause', 'liability', 'indemnity',
    'nda', 'non-disclosure', 'confidential',
    'compliance', 'regulation', 'gdpr', 'privacy',
    'intellectual property', 'ip', 'copyright', 'trademark',
    'dispute', 'breach', 'termination'
  ]
};

// ============================================
// AGENT ROUTING
// ============================================

/**
 * Determine which agent(s) should handle a request based on content
 */
export function routeRequest(message) {
  const lowerMessage = message.toLowerCase();
  const scores = {};

  // Score each agent based on keyword matches
  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        score += keyword.split(' ').length; // Multi-word keywords score higher
      }
    }
    if (score > 0) {
      scores[agentId] = score;
    }
  }

  // Sort by score descending
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([agentId, score]) => ({ agentId, score }));

  // Return top matches (agents with scores)
  if (ranked.length === 0) {
    return { primary: null, secondary: [], confidence: 0 };
  }

  const primary = ranked[0];
  const secondary = ranked.slice(1, 3).filter(r => r.score >= primary.score * 0.5);

  return {
    primary: primary.agentId,
    secondary: secondary.map(s => s.agentId),
    confidence: Math.min(primary.score / 5, 1), // Normalize to 0-1
    allScores: scores
  };
}

/**
 * AI-powered routing for complex/ambiguous requests
 */
export async function aiRouteRequest(message, conversationHistory = []) {
  const agents = agentKnowledge.getAllAgents().filter(a => a.id !== 'orchestrator');

  const agentList = agents.map(a =>
    `- ${a.id}: ${a.name} - ${a.specialization}`
  ).join('\n');

  const prompt = `You are an AI request router. Based on the user's message, determine which specialist agent(s) should handle this request.

Available Agents:
${agentList}

User Message: "${message}"

Respond in JSON format:
{
  "primary_agent": "agent-id or null if general question",
  "secondary_agents": ["agent-id", ...] or [],
  "reasoning": "Brief explanation of why these agents were selected",
  "is_multi_agent": true/false (whether multiple agents should collaborate)
}`;

  try {
    const response = await aiProvider.chat([{ role: 'user', content: prompt }], {
      maxTokens: 300
    });

    // Parse JSON from response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI routing failed:', error);
  }

  // Fallback to keyword routing
  const keywordRoute = routeRequest(message);
  return {
    primary_agent: keywordRoute.primary,
    secondary_agents: keywordRoute.secondary,
    reasoning: 'Routed based on keyword matching',
    is_multi_agent: keywordRoute.secondary.length > 0
  };
}

// ============================================
// AGENT EXECUTION
// ============================================

/**
 * Execute a request with a specific agent
 */
export async function executeWithAgent(agentId, message, conversationHistory = []) {
  const context = agentKnowledge.getAgentContext(agentId);

  if (!context) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Search agent's knowledge base for relevant context
  const relevantKnowledge = agentKnowledge.searchAgentKnowledge(agentId, message, 5);

  let knowledgeContext = '';
  if (relevantKnowledge.length > 0) {
    knowledgeContext = '\n\nRelevant information from your knowledge base:\n';
    for (const entry of relevantKnowledge) {
      knowledgeContext += `---\n${entry.title}:\n${entry.content?.substring(0, 1000) || entry.summary || ''}\n`;
    }
  }

  const systemPrompt = context.systemPrompt + knowledgeContext;

  // Build messages array
  const messages = [
    ...conversationHistory.slice(-10).map(m => ({
      role: m.role === 'agent' ? 'assistant' : m.role,
      content: m.content
    })),
    { role: 'user', content: message }
  ];

  const response = await aiProvider.chat(messages, {
    systemPrompt,
    agentId
  });

  return {
    agentId,
    agentName: context.agent.name,
    response: response.text,
    knowledgeUsed: relevantKnowledge.length,
    provider: response.provider,
    model: response.model
  };
}

/**
 * Execute a multi-agent request (collaboration)
 */
export async function executeMultiAgent(agentIds, message, conversationHistory = []) {
  const results = [];

  for (const agentId of agentIds) {
    try {
      const result = await executeWithAgent(agentId, message, conversationHistory);
      results.push(result);
    } catch (error) {
      results.push({
        agentId,
        error: error.message
      });
    }
  }

  return results;
}

// ============================================
// ORCHESTRATED CONVERSATION
// ============================================

/**
 * Main orchestration function - handles a user message and routes to appropriate agent(s)
 */
export async function orchestrate(message, conversationId = null, userId = 'default') {
  // Create or get conversation
  let convId = conversationId;
  if (!convId) {
    convId = agentKnowledge.createConversation(userId, message.substring(0, 50));
  }

  // Store user message
  agentKnowledge.addMessage(convId, 'user', message);

  // Route the request
  const routing = await aiRouteRequest(message);

  let response;
  let agentsUsed = [];

  if (!routing.primary_agent) {
    // General question - use orchestrator
    const orchestratorContext = agentKnowledge.getOrchestratorContext();
    const orchestrator = agentKnowledge.getAgent('orchestrator');

    const messages = [{ role: 'user', content: message }];
    const aiResponse = await aiProvider.chat(messages, {
      systemPrompt: orchestrator.system_prompt + '\n\n' + orchestratorContext
    });

    response = {
      type: 'orchestrator',
      content: aiResponse.text,
      routing
    };
    agentsUsed = ['orchestrator'];

  } else if (routing.is_multi_agent && routing.secondary_agents.length > 0) {
    // Multi-agent collaboration
    const allAgents = [routing.primary_agent, ...routing.secondary_agents];
    const agentResponses = await executeMultiAgent(allAgents, message);

    // Synthesize responses
    const synthesis = await synthesizeResponses(message, agentResponses);

    response = {
      type: 'multi-agent',
      content: synthesis,
      agentResponses,
      routing
    };
    agentsUsed = allAgents;

  } else {
    // Single agent response
    const result = await executeWithAgent(routing.primary_agent, message);

    response = {
      type: 'single-agent',
      content: result.response,
      agent: {
        id: result.agentId,
        name: result.agentName
      },
      knowledgeUsed: result.knowledgeUsed,
      routing
    };
    agentsUsed = [routing.primary_agent];
  }

  // Store agent response(s)
  if (response.type === 'multi-agent') {
    for (const agentResp of response.agentResponses) {
      if (agentResp.response) {
        agentKnowledge.addMessage(convId, 'agent', agentResp.response, agentResp.agentId);
      }
    }
    // Also store synthesized response
    agentKnowledge.addMessage(convId, 'assistant', response.content, 'orchestrator', {
      synthesized: true,
      agents: agentsUsed
    });
  } else {
    const agentId = response.type === 'orchestrator' ? 'orchestrator' : response.agent?.id;
    agentKnowledge.addMessage(convId, 'agent', response.content, agentId);
  }

  return {
    conversationId: convId,
    response,
    agentsUsed
  };
}

/**
 * Synthesize multiple agent responses into a cohesive answer
 */
async function synthesizeResponses(originalMessage, agentResponses) {
  const validResponses = agentResponses.filter(r => r.response);

  if (validResponses.length === 0) {
    return "I apologize, but I couldn't get a response from the specialist agents. Please try rephrasing your question.";
  }

  if (validResponses.length === 1) {
    return validResponses[0].response;
  }

  // Use AI to synthesize multiple responses
  const responsesSummary = validResponses.map(r =>
    `**${r.agentName}:**\n${r.response}`
  ).join('\n\n---\n\n');

  const synthesisPrompt = `The user asked: "${originalMessage}"

Multiple specialist agents provided the following responses:

${responsesSummary}

Please synthesize these responses into a single, cohesive answer that:
1. Combines the key insights from each agent
2. Resolves any contradictions
3. Provides a clear, actionable response
4. Credits which agent provided which insight when relevant`;

  try {
    const response = await aiProvider.chat([{ role: 'user', content: synthesisPrompt }], {
      systemPrompt: 'You are a response synthesizer. Combine multiple expert responses into one clear, helpful answer.'
    });

    return response.text;
  } catch {
    // Fallback: just concatenate responses
    return validResponses.map(r =>
      `**From ${r.agentName}:**\n${r.response}`
    ).join('\n\n');
  }
}

// ============================================
// DIRECT AGENT CHAT
// ============================================

/**
 * Chat directly with a specific agent (bypassing orchestration)
 */
export async function chatWithAgent(agentId, message, conversationId = null, userId = 'default') {
  // Create or get conversation
  let convId = conversationId;
  if (!convId) {
    convId = agentKnowledge.createConversation(userId, `Chat with ${agentId}`, [agentId]);
  }

  // Get conversation history
  const history = agentKnowledge.getMessages(convId, 20);

  // Store user message
  agentKnowledge.addMessage(convId, 'user', message);

  // Execute with agent
  const result = await executeWithAgent(agentId, message, history);

  // Store agent response
  agentKnowledge.addMessage(convId, 'agent', result.response, agentId);

  return {
    conversationId: convId,
    agentId: result.agentId,
    agentName: result.agentName,
    response: result.response,
    knowledgeUsed: result.knowledgeUsed
  };
}

export default {
  routeRequest,
  aiRouteRequest,
  executeWithAgent,
  executeMultiAgent,
  orchestrate,
  chatWithAgent
};
