/**
 * Agent Orchestrator
 * Intelligent routing, specialist execution, and multi-agent coordination.
 */

import * as agentKnowledge from './agent-knowledge.js';
import * as aiProvider from './ai-provider.js';
import { getCapabilityPrompt, AGENT_JOBS } from './capability-registry.js';

const AGENT_KEYWORDS = {
  'highlevel-specialist': [
    'highlevel', 'gohighlevel', 'ghl', 'workflow', 'automation', 'trigger',
    'lc phone', 'twilio', 'porting', 'port number', 'phone number', 'affiliate',
    'crm', 'pipeline', 'opportunity', 'contact', 'lead', 'partner',
    'email campaign', 'sms', 'text message', 'broadcast', 'calendar',
    'appointment', 'booking', 'funnel', 'landing page', 'snapshot',
    'sub-account', 'agency', 'saas mode', 'webhook', 'api integration', 'zapier', 'stripe', 'payment'
  ],
  'hybrid-grid': [
    'trading', 'trade', 'market', 'signal', 'hybrid journal', 'qqe', 'regime',
    'stock', 'forex', 'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol',
    'futures', 'nq', 'mnq', 'es', 'nasdaq', 'spy', 'gold', 'oil',
    'technical analysis', 'chart', 'indicator', 'rsi', 'macd', 'order block',
    'support', 'resistance', 'trend', 'breakout', 'day trading', 'swing trading',
    'risk management', 'position size', 'stop loss', 'performance review'
  ],
  'dev-ops': [
    'code', 'coding', 'programming', 'developer', 'development', 'javascript',
    'python', 'react', 'node', 'typescript', 'git', 'github', 'deploy', 'deployment',
    'render', 'cloudflare', 'server', 'docker', 'database', 'supabase', 'sql',
    'api', 'endpoint', 'mcp', 'ollama', 'openclaw', 'bug', 'debug', 'error', 'fix',
    'ci/cd', 'pipeline', 'build', 'test'
  ],
  'content-creator': [
    'content', 'copy', 'copywriting', 'write', 'writing', 'social media', 'instagram',
    'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube', 'streaming', 'email',
    'newsletter', 'blog', 'article', 'post', 'seo', 'keyword', 'headline', 'caption',
    'brand', 'voice', 'tone', 'messaging', 'marketing', 'campaign', 'ad', 'advertisement'
  ],
  'business-analyst': [
    'business', 'strategy', 'planning', 'plan', 'metrics', 'kpi', 'analytics', 'data',
    'process', 'efficiency', 'optimization', 'improve', 'revenue', 'profit', 'cost',
    'budget', 'forecast', 'market research', 'competitor', 'analysis', 'growth', 'scale',
    'smart life brokers', 'hybrid funding', 'liv8ai', 'career', 'priority'
  ],
  'legal-contracts': [
    'contract', 'agreement', 'legal', 'terms', 'clause', 'liability', 'indemnity',
    'nda', 'non-disclosure', 'confidential', 'compliance', 'regulation', 'privacy',
    'intellectual property', 'copyright', 'trademark', 'dispute', 'breach', 'termination'
  ]
};

export function routeRequest(message) {
  const lowerMessage = message.toLowerCase();
  const scores = {};
  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) if (lowerMessage.includes(keyword)) score += keyword.split(' ').length;
    if (score > 0) scores[agentId] = score;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([agentId, score]) => ({ agentId, score }));
  if (ranked.length === 0) return { primary: null, secondary: [], confidence: 0 };
  const primary = ranked[0];
  const secondary = ranked.slice(1, 3).filter(r => r.score >= primary.score * 0.5);
  return {
    primary: primary.agentId,
    secondary: secondary.map(s => s.agentId),
    confidence: Math.min(primary.score / 5, 1),
    allScores: scores
  };
}

export async function aiRouteRequest(message, conversationHistory = []) {
  const agents = agentKnowledge.getAllAgents().filter(a => a.id !== 'orchestrator');
  const agentList = agents.map(a => `- ${a.id}: ${a.name} - ${a.specialization}\n  Jobs: ${(AGENT_JOBS[a.id] || []).join('; ')}`).join('\n');
  const prompt = `You are the LIV8 request router. Select the specialist(s) that should handle the user's request.\n\n${getCapabilityPrompt()}\n\nAVAILABLE AGENTS\n${agentList}\n\nUSER MESSAGE\n${message}\n\nReturn JSON only:\n{\n  "primary_agent": "agent-id or null",\n  "secondary_agents": [],\n  "reasoning": "brief reason",\n  "is_multi_agent": false\n}`;
  try {
    const response = await aiProvider.chat([{ role: 'user', content: prompt }], { maxTokens: 400, fast: true });
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.warn('AI routing failed; using keyword routing');
  }
  const keywordRoute = routeRequest(message);
  return {
    primary_agent: keywordRoute.primary,
    secondary_agents: keywordRoute.secondary,
    reasoning: 'Routed using Command Center keyword map',
    is_multi_agent: keywordRoute.secondary.length > 0
  };
}

export async function executeWithAgent(agentId, message, conversationHistory = []) {
  const context = agentKnowledge.getAgentContext(agentId);
  if (!context) throw new Error(`Agent not found: ${agentId}`);

  const relevantKnowledge = agentKnowledge.searchAgentKnowledge(agentId, message, 5);
  let knowledgeContext = '';
  if (relevantKnowledge.length > 0) {
    knowledgeContext = '\n\nRELEVANT SPECIALIST KNOWLEDGE\n';
    for (const entry of relevantKnowledge) {
      knowledgeContext += `---\n${entry.title}:\n${entry.content?.substring(0, 1000) || entry.summary || ''}\n`;
    }
  }

  const jobContext = (AGENT_JOBS[agentId] || []).length
    ? `\n\nYOUR ASSIGNED JOBS\n- ${(AGENT_JOBS[agentId] || []).join('\n- ')}`
    : '';
  const systemPrompt = `${context.systemPrompt}\n\n${getCapabilityPrompt()}${jobContext}${knowledgeContext}`;
  const messages = [
    ...conversationHistory.slice(-10).map(m => ({ role: m.role === 'agent' ? 'assistant' : m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  const response = await aiProvider.chat(messages, { systemPrompt, agentId });
  return {
    agentId,
    agentName: context.agent.name,
    response: response.text,
    knowledgeUsed: relevantKnowledge.length,
    provider: response.provider,
    model: response.model
  };
}

export async function executeMultiAgent(agentIds, message, conversationHistory = []) {
  const results = [];
  for (const agentId of agentIds) {
    try { results.push(await executeWithAgent(agentId, message, conversationHistory)); }
    catch (error) { results.push({ agentId, error: error.message }); }
  }
  return results;
}

export async function orchestrate(message, conversationId = null, userId = 'default') {
  let convId = conversationId;
  if (!convId) convId = agentKnowledge.createConversation(userId, message.substring(0, 50));
  agentKnowledge.addMessage(convId, 'user', message);
  const routing = await aiRouteRequest(message);

  let response;
  let agentsUsed = [];
  if (!routing.primary_agent) {
    const orchestratorContext = agentKnowledge.getOrchestratorContext();
    const orchestrator = agentKnowledge.getAgent('orchestrator');
    const aiResponse = await aiProvider.chat([{ role: 'user', content: message }], {
      systemPrompt: `${orchestrator.system_prompt}\n\n${getCapabilityPrompt()}\n\n${orchestratorContext}`
    });
    response = { type: 'orchestrator', content: aiResponse.text, routing };
    agentsUsed = ['orchestrator'];
  } else if (routing.is_multi_agent && routing.secondary_agents.length > 0) {
    const allAgents = [routing.primary_agent, ...routing.secondary_agents];
    const agentResponses = await executeMultiAgent(allAgents, message);
    const synthesis = await synthesizeResponses(message, agentResponses);
    response = { type: 'multi-agent', content: synthesis, agentResponses, routing };
    agentsUsed = allAgents;
  } else {
    const result = await executeWithAgent(routing.primary_agent, message);
    response = {
      type: 'single-agent',
      content: result.response,
      agent: { id: result.agentId, name: result.agentName },
      knowledgeUsed: result.knowledgeUsed,
      routing
    };
    agentsUsed = [routing.primary_agent];
  }

  if (response.type === 'multi-agent') {
    for (const agentResp of response.agentResponses) if (agentResp.response) agentKnowledge.addMessage(convId, 'agent', agentResp.response, agentResp.agentId);
    agentKnowledge.addMessage(convId, 'assistant', response.content, 'orchestrator', { synthesized: true, agents: agentsUsed });
  } else {
    const agentId = response.type === 'orchestrator' ? 'orchestrator' : response.agent?.id;
    agentKnowledge.addMessage(convId, 'agent', response.content, agentId);
  }

  return { conversationId: convId, response, agentsUsed };
}

async function synthesizeResponses(originalMessage, agentResponses) {
  const validResponses = agentResponses.filter(r => r.response);
  if (validResponses.length === 0) return "I couldn't get a usable specialist response. Check the agent/tool connections and try again.";
  if (validResponses.length === 1) return validResponses[0].response;
  const responsesSummary = validResponses.map(r => `**${r.agentName}:**\n${r.response}`).join('\n\n---\n\n');
  const synthesisPrompt = `The user asked: "${originalMessage}"\n\nSPECIALIST OUTPUTS\n${responsesSummary}\n\nSynthesize one clear, actionable answer. Resolve contradictions. Distinguish confirmed tool data from analysis/proposals. End with the single best next action when appropriate.`;
  try {
    const response = await aiProvider.chat([{ role: 'user', content: synthesisPrompt }], {
      systemPrompt: `${getCapabilityPrompt()}\n\nYou synthesize specialist outputs without inventing missing facts.`
    });
    return response.text;
  } catch {
    return validResponses.map(r => `**From ${r.agentName}:**\n${r.response}`).join('\n\n');
  }
}

export async function chatWithAgent(agentId, message, conversationId = null, userId = 'default') {
  let convId = conversationId;
  if (!convId) convId = agentKnowledge.createConversation(userId, `Chat with ${agentId}`, [agentId]);
  const history = agentKnowledge.getMessages(convId, 20);
  agentKnowledge.addMessage(convId, 'user', message);
  const result = await executeWithAgent(agentId, message, history);
  agentKnowledge.addMessage(convId, 'agent', result.response, agentId);
  return {
    conversationId: convId,
    agentId: result.agentId,
    agentName: result.agentName,
    response: result.response,
    knowledgeUsed: result.knowledgeUsed
  };
}

export default { routeRequest, aiRouteRequest, executeWithAgent, executeMultiAgent, orchestrate, chatWithAgent };
