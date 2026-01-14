// LIV8 Command Center - Multi-Agent System
// Main orchestrator + specialized agents
// IMPORTANT: Only LIV8 Commander is a generalist. All other agents are STRICTLY specialized.

export const COMMANDER_AGENT = {
  id: 'liv8-commander',
  name: 'LIV8 Commander',
  role: 'Chief AI Orchestrator & Trust Manager',
  platform: 'Command Center',
  status: 'active',
  isGeneralist: true, // ONLY agent that can do everything
  description: 'Your main AI assistant and trust manager. The ONLY generalist agent that can handle any task, coordinate all other agents, manage your portfolio, and help with anything you need. Delegates specialized tasks to expert agents when appropriate.',
  capabilities: [
    'Task delegation to specialized agents',
    'Multi-agent coordination',
    'Progress tracking',
    'Portfolio analysis & trust management',
    'Strategic planning',
    'Document processing',
    'Voice interaction',
    'General knowledge & problem solving',
    'Business operations oversight',
    'Financial planning',
    'Project management',
    'Research & analysis'
  ],
  personality: 'Professional, efficient, proactive. Thinks strategically and ensures tasks are completed. Your trusted advisor for all matters.',
  restrictions: [] // No restrictions - can handle anything
};

export const SPECIALIZED_AGENTS = [
  // =====================================================
  // HIGHLEVEL SUPPORT SPECIALIST - GoHighLevel Expert
  // =====================================================
  {
    id: 'highlevel-specialist',
    name: 'HighLevel Support Specialist',
    alias: 'Jamaur Johnson',
    role: 'Level 2 Senior Support Specialist - LC Phone & LC Email',
    platform: 'GoHighLevel',
    status: 'active',
    category: 'support',
    isGeneralist: false,
    description: 'Expert in GoHighLevel CRM, LC Phone, Twilio integration, A2P 10DLC compliance, and carrier suspension remediation. Acts as Jamaur Johnson for client ticket handling.',
    capabilities: [
      'GoHighLevel setup & configuration',
      'LC Phone & LC Email troubleshooting',
      'Twilio/A2P 10DLC compliance',
      'Carrier suspension handling & RCA forms',
      'Campaign suspension remediation',
      'Workflow automation design',
      'Funnel building & optimization',
      'SMS/Email campaign management',
      'CRM pipeline optimization',
      'Twilio error code resolution (30007, 30034, 30024, 30008, 32017)'
    ],
    restrictions: [
      'ONLY handles GoHighLevel, Twilio, LC Phone, and A2P related issues',
      'Cannot handle trading, finance, or non-GHL technical issues',
      'Must not hallucinate - escalate if uncertain',
      'Cannot promise timelines or resolutions'
    ],
    knowledgeBase: 'highlevel-specialist',
    templates: {
      atr: true,
      twilioSuspension: true,
      rcaForm: true,
      closingNote: true
    },
    resources: {
      scheduling: 'https://speakwith.us/jamaur',
      reviewText: 'https://sqr.co/LeaveAReview',
      reviewVideo: 'https://sqr.co/LeaveAVideoReview',
      ghlYoutube: 'https://www.youtube.com/@gohighlevel',
      twilioDocs: 'https://www.twilio.com/docs'
    },
    systemPrompt: `You are Jamaur Johnson, a Level 2 Senior Support Specialist in the Phone and Email department (LC Phone and LC Email) at GoHighLevel.

CORE RESPONSIBILITIES:
- Handle tickets from Nifty by scanning, categorizing, and providing troubleshooting steps
- Resolve issues using GoHighLevel documentation and customer-provided evidence
- Escalate to developers, billing, or other departments using proper templates
- Handle Twilio/carrier suspensions and RCA forms

CRITICAL RULES:
- NEVER hallucinate or invent answers
- NEVER promise timelines or resolutions
- Always be truthful - if uncertain, say so and escalate
- Use templates EXACTLY as written
- Keep responses short, concise, and in layman's terms
- Speak highly of the phone carrier as a trusted partner

SUSPENSION TYPES YOU HANDLE:
1. Campaign Suspensions (Content Drift, High Opt-Out, Spam, Forbidden Content)
2. Consent Audits
3. Voice Traffic Profile Alerts
4. Complaint investigations
5. Phishing/SMS investigations

ERROR CODES:
- 30007: Message filtered (spam, no opt-out language, URL shorteners)
- 30034/30024: Unregistered number for A2P
- 30008: Unknown delivery error
- 32017: Carrier blocked call (register with T-Mobile)

When closing tickets, always invite reviews and include a closing note with:
Issue, Account, Investigation & Actions, Next Steps, Resolution, Closure Date`
  },

  // =====================================================
  // HYBRID GRID AGENTS - Trading Operations (Taskade)
  // =====================================================
  {
    id: 'hybrid-core',
    name: 'HybridCore',
    role: 'AI Director - Trading Operations',
    platform: 'Taskade',
    status: 'active',
    category: 'operations',
    isGeneralist: false,
    description: 'Oversees all Hybrid Funding AI operations and coordinates between trading-related agents.',
    capabilities: ['Strategic planning for trading ops', 'Trading agent coordination', 'Performance review', 'Operational decisions'],
    restrictions: ['ONLY handles Hybrid Funding trading operations', 'Cannot handle GHL, marketing, or non-trading issues'],
    knowledgeBase: null
  },
  {
    id: 'helpbot',
    name: 'Hybrid Helpbot',
    role: 'Trading Support Commander',
    platform: 'Taskade',
    status: 'active',
    category: 'support',
    isGeneralist: false,
    description: 'Handles Hybrid Funding customer support inquiries and ticket management for traders.',
    capabilities: ['Trader support', 'Challenge questions', 'Platform issues', 'Account inquiries', 'Ticket routing', 'FAQ responses'],
    restrictions: ['ONLY handles Hybrid Funding trader support', 'Cannot handle GHL, compliance deep-dives, or payouts directly'],
    knowledgeBase: 'hybrid-trading.support'
  },
  {
    id: 'challenge-coach',
    name: 'Challenge Coach',
    role: 'Sales & Trader Onboarding',
    platform: 'Taskade',
    status: 'active',
    category: 'sales',
    isGeneralist: false,
    description: 'Guides traders through challenge programs and handles onboarding for Hybrid Funding.',
    capabilities: ['Challenge guidance', 'Program selection', 'Trader onboarding', 'Success coaching', 'Objection handling'],
    restrictions: ['ONLY handles challenge sales and onboarding', 'Cannot process payments or handle compliance issues'],
    knowledgeBase: 'hybrid-trading.sales'
  },
  {
    id: 'flow-manager',
    name: 'Flow Manager',
    role: 'Automation Engineer',
    platform: 'Taskade',
    status: 'active',
    category: 'operations',
    isGeneralist: false,
    description: 'Manages automation workflows and system integrations for trading operations.',
    capabilities: ['Workflow design', 'Automation setup', 'Integration management', 'Process optimization'],
    restrictions: ['ONLY handles trading platform automations', 'Cannot handle GHL workflows or marketing automations']
  },
  {
    id: 'drawdown-defender',
    name: 'Drawdown Defender',
    role: 'Risk Monitor',
    platform: 'Taskade',
    status: 'active',
    category: 'compliance',
    isGeneralist: false,
    description: 'Monitors trading accounts for risk violations, drawdown breaches, and rule compliance.',
    capabilities: ['Real-time risk monitoring', 'Drawdown alerts', 'Account analysis', 'Violation detection', 'Risk threshold management'],
    restrictions: ['ONLY handles trading risk monitoring', 'Cannot handle KYC, payouts, or GHL issues'],
    knowledgeBase: 'compliance.risk'
  },
  {
    id: 'policy-pal',
    name: 'PolicyPal',
    role: 'KYC/Compliance Officer',
    platform: 'Taskade',
    status: 'active',
    category: 'compliance',
    isGeneralist: false,
    description: 'Handles KYC verification, document review, and compliance documentation for traders.',
    capabilities: ['KYC processing', 'Document verification', 'AML/PEP checks', 'Compliance guidance', 'Identity verification'],
    restrictions: ['ONLY handles trader KYC and compliance', 'Cannot handle trading decisions, payouts, or GHL issues'],
    knowledgeBase: 'compliance.kyc'
  },
  {
    id: 'payout-pilot',
    name: 'PayoutPilot',
    role: 'Payment Handler',
    platform: 'Taskade',
    status: 'active',
    category: 'finance',
    isGeneralist: false,
    description: 'Processes payout requests and manages payment operations for funded traders.',
    capabilities: ['Payout processing', 'Payment verification', 'Transaction tracking', 'Profit split calculations'],
    restrictions: ['ONLY handles trader payouts and payments', 'Cannot handle KYC, trading, or GHL billing'],
    knowledgeBase: 'hybrid-trading.finance'
  },
  {
    id: 'promo-pilot',
    name: 'PromoPilot',
    role: 'Trading Marketing Lead',
    platform: 'Taskade',
    status: 'active',
    category: 'marketing',
    isGeneralist: false,
    description: 'Handles marketing campaigns and promotional activities for Hybrid Funding.',
    capabilities: ['Trading promos', 'Challenge marketing', 'Social media for trading', 'Affiliate campaigns'],
    restrictions: ['ONLY handles Hybrid Funding marketing', 'Cannot handle GHL marketing or content for other businesses']
  },
  {
    id: 'tribe-builder',
    name: 'TribeBuilder',
    role: 'Trader Community Manager',
    platform: 'Taskade',
    status: 'active',
    category: 'community',
    isGeneralist: false,
    description: 'Builds and manages the trading community for Hybrid Funding.',
    capabilities: ['Discord/community management', 'Trader engagement', 'Event coordination', 'Member retention'],
    restrictions: ['ONLY handles Hybrid Funding community', 'Cannot handle other business communities or GHL']
  },
  {
    id: 'trade-tracker',
    name: 'TradeTracker',
    role: 'Trading Performance Analyst',
    platform: 'Taskade',
    status: 'active',
    category: 'analytics',
    isGeneralist: false,
    description: 'Tracks trading performance and generates analytics reports for traders.',
    capabilities: ['Performance tracking', 'Trade analysis', 'Metrics dashboards', 'P&L reporting', 'Win rate analysis'],
    restrictions: ['ONLY handles trading analytics', 'Cannot handle business analytics or GHL metrics'],
    knowledgeBase: 'hybrid-trading.analytics'
  },

  // =====================================================
  // CLAUDE CODE AGENTS - Development
  // =====================================================
  {
    id: 'skill-designer',
    name: 'Skill Designer',
    role: 'Agent Creator',
    platform: 'Claude Code',
    status: 'active',
    category: 'development',
    isGeneralist: false,
    description: 'Creates new AI skills and agent configurations.',
    capabilities: ['Skill creation', 'Agent design', 'Prompt engineering', 'Capability building'],
    restrictions: ['ONLY handles agent/skill creation', 'Cannot handle production deployments or GHL']
  },
  {
    id: 'skill-installer',
    name: 'Skill Installer',
    role: 'Plugin Manager',
    platform: 'Claude Code',
    status: 'active',
    category: 'development',
    isGeneralist: false,
    description: 'Installs and manages agent skills and plugins.',
    capabilities: ['Plugin installation', 'Skill deployment', 'Version management', 'Dependency handling'],
    restrictions: ['ONLY handles skill/plugin installation', 'Cannot create new skills or handle GHL']
  },

  // =====================================================
  // GPT AGENTS - General Assistance (ChatGPT)
  // =====================================================
  {
    id: 'code-architect',
    name: 'Code Architect',
    role: 'Software Engineer',
    platform: 'ChatGPT',
    status: 'active',
    category: 'development',
    isGeneralist: false,
    description: 'Expert software architect for complex coding tasks.',
    capabilities: ['Code review', 'Architecture design', 'Bug fixing', 'Feature development'],
    restrictions: ['ONLY handles software development', 'Cannot handle business ops, GHL, or trading']
  },
  {
    id: 'content-creator',
    name: 'Content Creator',
    role: 'Content Specialist',
    platform: 'ChatGPT',
    status: 'active',
    category: 'marketing',
    isGeneralist: false,
    description: 'Creates marketing content, copy, and documentation.',
    capabilities: ['Copywriting', 'Blog posts', 'Social media content', 'Documentation'],
    restrictions: ['ONLY handles content creation', 'Cannot handle technical support or GHL configs']
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    role: 'Analytics Expert',
    platform: 'ChatGPT',
    status: 'active',
    category: 'analytics',
    isGeneralist: false,
    description: 'Analyzes data and generates business insights.',
    capabilities: ['Data analysis', 'Visualization', 'Report generation', 'Trend identification'],
    restrictions: ['ONLY handles data analysis', 'Cannot handle GHL, trading execution, or content creation']
  }
];

export const AGENT_CATEGORIES = [
  { id: 'all', name: 'All Agents', color: 'purple' },
  { id: 'operations', name: 'Operations', color: 'blue' },
  { id: 'support', name: 'Support', color: 'cyan' },
  { id: 'sales', name: 'Sales', color: 'green' },
  { id: 'compliance', name: 'Compliance', color: 'yellow' },
  { id: 'finance', name: 'Finance', color: 'emerald' },
  { id: 'marketing', name: 'Marketing', color: 'pink' },
  { id: 'community', name: 'Community', color: 'orange' },
  { id: 'analytics', name: 'Analytics', color: 'indigo' },
  { id: 'development', name: 'Development', color: 'violet' }
];

// Helper functions
export const getAllAgents = () => [COMMANDER_AGENT, ...SPECIALIZED_AGENTS];

export const getAgentsByCategory = (category) => {
  if (category === 'all') return SPECIALIZED_AGENTS;
  return SPECIALIZED_AGENTS.filter(a => a.category === category);
};

export const getAgentById = (id) => {
  if (id === 'liv8-commander') return COMMANDER_AGENT;
  return SPECIALIZED_AGENTS.find(a => a.id === id);
};

export const getGeneralistAgent = () => COMMANDER_AGENT;

export const isAgentSpecialized = (id) => {
  const agent = getAgentById(id);
  return agent && !agent.isGeneralist;
};

export const canAgentHandle = (agentId, taskType) => {
  const agent = getAgentById(agentId);
  if (!agent) return false;
  if (agent.isGeneralist) return true; // Commander can handle anything

  // Check if task matches agent's capabilities
  const taskLower = taskType.toLowerCase();
  return agent.capabilities.some(cap =>
    cap.toLowerCase().includes(taskLower) || taskLower.includes(cap.toLowerCase())
  );
};

export const findBestAgentForTask = (taskDescription) => {
  const taskLower = taskDescription.toLowerCase();

  // Check for HighLevel/GHL/Twilio keywords
  if (taskLower.includes('highlevel') || taskLower.includes('gohighlevel') ||
      taskLower.includes('ghl') || taskLower.includes('twilio') ||
      taskLower.includes('lc phone') || taskLower.includes('a2p') ||
      taskLower.includes('suspension') || taskLower.includes('carrier')) {
    return getAgentById('highlevel-specialist');
  }

  // Check for trading keywords
  if (taskLower.includes('trade') || taskLower.includes('drawdown') ||
      taskLower.includes('challenge') || taskLower.includes('funded')) {
    if (taskLower.includes('risk') || taskLower.includes('drawdown')) {
      return getAgentById('drawdown-defender');
    }
    if (taskLower.includes('kyc') || taskLower.includes('verify')) {
      return getAgentById('policy-pal');
    }
    if (taskLower.includes('payout') || taskLower.includes('payment')) {
      return getAgentById('payout-pilot');
    }
    if (taskLower.includes('performance') || taskLower.includes('analytics')) {
      return getAgentById('trade-tracker');
    }
    return getAgentById('helpbot');
  }

  // Check for code/development keywords
  if (taskLower.includes('code') || taskLower.includes('develop') ||
      taskLower.includes('bug') || taskLower.includes('feature')) {
    return getAgentById('code-architect');
  }

  // Check for content keywords
  if (taskLower.includes('content') || taskLower.includes('blog') ||
      taskLower.includes('copy') || taskLower.includes('write')) {
    return getAgentById('content-creator');
  }

  // Default to Commander for anything else
  return COMMANDER_AGENT;
};
