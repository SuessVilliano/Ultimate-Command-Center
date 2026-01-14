// LIV8 Command Center - Agent Knowledge Base
// Centralized knowledge for specialized AI agents

// Import specialized knowledge bases
import { HIGHLEVEL_KNOWLEDGE } from './highlevel-specialist.js';
import { HYBRID_TRADING_KNOWLEDGE } from './hybrid-trading.js';
import { COMPLIANCE_KNOWLEDGE } from './compliance.js';

export const KNOWLEDGE_BASE = {
  'highlevel-specialist': HIGHLEVEL_KNOWLEDGE,
  'helpbot': HYBRID_TRADING_KNOWLEDGE.support,
  'challenge-coach': HYBRID_TRADING_KNOWLEDGE.sales,
  'drawdown-defender': COMPLIANCE_KNOWLEDGE.risk,
  'policy-pal': COMPLIANCE_KNOWLEDGE.kyc,
  'payout-pilot': HYBRID_TRADING_KNOWLEDGE.finance,
  'trade-tracker': HYBRID_TRADING_KNOWLEDGE.analytics,
};

export const getAgentKnowledge = (agentId) => {
  return KNOWLEDGE_BASE[agentId] || null;
};

export const hasSpecializedKnowledge = (agentId) => {
  return agentId in KNOWLEDGE_BASE;
};
