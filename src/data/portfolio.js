export const businesses = [
  {
    id: 'hybrid-holdings',
    name: 'Hybrid Holdings LLC',
    type: 'Holding Company',
    status: 'active',
    state: 'Wyoming',
    description: 'Parent holding company for all ventures',
    priority: 1
  },
  {
    id: 'liv8-solar',
    name: 'LIV8 Solar',
    type: 'LLC',
    status: 'active',
    website: 'liv8solar.com',
    description: 'Smart energy consulting - Solar, Storage, Off-grid',
    documents: ['EIN', 'Articles of Org', 'Operating Agreement'],
    priority: 2
  },
  {
    id: 'hybrid-funding',
    name: 'Hybrid Funding',
    type: 'Prop Firm',
    status: 'operating',
    website: 'hybridfunding.co',
    description: 'Proprietary trading firm with challenge programs',
    features: ['One-Step', 'Two-Step', 'Three-Step', 'Instant Funding'],
    priority: 1
  },
  {
    id: 'liv8-health',
    name: 'LIV8 Health',
    type: 'E-Commerce',
    status: 'live',
    website: 'liv8health.com',
    platform: 'Shopify',
    description: 'Health supplements e-commerce store',
    priority: 2
  },
  {
    id: 'trade-hybrid',
    name: 'Trade Hybrid',
    type: 'Education',
    status: 'active',
    website: 'tradehybrid.co',
    description: 'Trading education and community platform',
    priority: 2
  },
  {
    id: 'smart-life-brokers',
    name: 'Smart Life Brokers',
    type: 'Insurance',
    status: 'active',
    website: 'smartlifebrokers.com',
    description: 'Comprehensive insurance & financial services',
    priority: 3
  },
  {
    id: 'liv8-ai',
    name: 'LIV8 AI',
    type: 'AI Services',
    status: 'active',
    website: 'liv8ai.com',
    description: 'AI solutions & machine learning services',
    priority: 2
  }
];

export const softwareProducts = [
  {
    id: 'liv8-credit',
    name: 'LIV8 Credit',
    category: 'SaaS',
    tech: ['React', 'Vite', 'Tailwind'],
    status: 'complete',
    stage: 'Ready to Deploy',
    description: 'Full credit repair platform with dispute management',
    features: 46,
    valueMin: 50000,
    valueMax: 100000,
    github: 'SuessVilliano/liv8-credit',
    priority: 'high'
  },
  {
    id: 'hybrid-journal',
    name: 'Hybrid Journal',
    category: 'SaaS',
    tech: ['React', 'Vite', 'Tailwind'],
    status: 'complete',
    stage: 'Ready to Deploy',
    description: 'Professional trading journal with analytics',
    features: 40,
    valueMin: 40000,
    valueMax: 80000,
    github: 'SuessVilliano/hybrid-journal',
    priority: 'high'
  },
  {
    id: 'trade-hybrid-app',
    name: 'Trade Hybrid App',
    category: 'Mobile',
    tech: ['Flutter', 'Dart', 'Firebase'],
    status: 'complete',
    stage: 'Ready to Deploy',
    description: 'Cross-platform trading app with signals & chat',
    valueMin: 30000,
    valueMax: 60000,
    priority: 'high'
  },
  {
    id: 'mcp-server',
    name: 'MCP Server',
    category: 'Backend',
    tech: ['Node.js', 'Express', 'OpenAI'],
    status: 'complete',
    stage: 'Ready to Deploy',
    description: 'AI-powered trade execution webhook server',
    valueMin: 30000,
    valueMax: 50000,
    priority: 'high'
  },
  {
    id: 'broker-aggregator',
    name: 'Broker Aggregator',
    category: 'API',
    tech: ['Python', 'Flask'],
    status: 'mvp',
    stage: 'MVP Complete',
    description: 'Multi-broker unified API (Ironbeam, OANDA, Alpaca)',
    valueMin: 15000,
    valueMax: 30000,
    priority: 'medium'
  },
  {
    id: 'abatev',
    name: 'ABATEV',
    category: 'AI/Fintech',
    tech: ['Python', 'ML', 'APIs'],
    status: 'spec',
    stage: 'Specification Complete',
    description: 'AI-Driven Broker Aggregator & Trade Execution Validator',
    valueMin: 50000,
    valueMax: 100000,
    patentable: true,
    priority: 'critical'
  },
  {
    id: 'smart-wallet',
    name: 'Smart Wallet Suite',
    category: 'Web3',
    tech: ['Web3Auth', 'Solana', 'Ethereum'],
    status: 'functional',
    stage: 'Testnet Ready',
    description: 'Multi-chain wallet (Ethereum + Solana)',
    valueMin: 15000,
    valueMax: 25000,
    priority: 'medium'
  },
  {
    id: 'liv8-protocol',
    name: 'LIV8 Migration Protocol',
    category: 'AI',
    tech: ['Python', 'Selenium', 'JSON Schema'],
    status: 'complete',
    stage: 'Production Ready',
    description: 'GPT agent extraction and migration framework',
    valueMin: 25000,
    valueMax: 50000,
    priority: 'high'
  }
];

export const aiAgents = [
  { id: 'hybrid-core', name: 'HybridCore', role: 'AI Director', status: 'deployed', platform: 'Taskade' },
  { id: 'helpbot', name: 'Hybrid Helpbot', role: 'Support Commander', status: 'deployed', platform: 'Taskade' },
  { id: 'challenge-coach', name: 'Challenge Coach', role: 'Sales & Onboarding', status: 'deployed', platform: 'Taskade' },
  { id: 'flow-manager', name: 'Flow Manager', role: 'Automation Engineer', status: 'deployed', platform: 'Taskade' },
  { id: 'drawdown-defender', name: 'Drawdown Defender', role: 'Risk Monitor', status: 'deployed', platform: 'Taskade' },
  { id: 'policy-pal', name: 'PolicyPal', role: 'KYC/Compliance', status: 'deployed', platform: 'Taskade' },
  { id: 'payout-pilot', name: 'PayoutPilot', role: 'Payment Handler', status: 'deployed', platform: 'Taskade' },
  { id: 'promo-pilot', name: 'PromoPilot', role: 'Marketing Lead', status: 'deployed', platform: 'Taskade' },
  { id: 'tribe-builder', name: 'TribeBuilder', role: 'Community Manager', status: 'deployed', platform: 'Taskade' },
  { id: 'trade-tracker', name: 'TradeTracker', role: 'Performance Analyst', status: 'deployed', platform: 'Taskade' },
  { id: 'skill-designer', name: 'Skill Designer', role: 'Agent Creator', status: 'deployed', platform: 'Claude Code' },
  { id: 'skill-installer', name: 'Skill Installer', role: 'Plugin Manager', status: 'deployed', platform: 'Claude Code' }
];

export const domains = [
  { domain: 'liv8.co', status: 'live', purpose: 'Main Portal' },
  { domain: 'liv8ai.com', status: 'live', purpose: 'AI Services' },
  { domain: 'liv8solar.com', status: 'live', purpose: 'Solar Business' },
  { domain: 'liv8health.com', status: 'live', purpose: 'E-Commerce (Shopify)' },
  { domain: 'tradehybrid.co', status: 'live', purpose: 'Trading Education' },
  { domain: 'hybridfunding.co', status: 'live', purpose: 'Prop Firm' },
  { domain: 'hybridjournal.co', status: 'parked', purpose: 'Trading Journal SaaS' },
  { domain: 'smartlifebrokers.com', status: 'live', purpose: 'Insurance Services' },
  { domain: 'builtinminutes.com', status: 'parked', purpose: 'AI Building Platform' }
];

export const actionItems = [
  {
    id: 1,
    category: 'Legal/IP',
    task: 'File ABATEV Provisional Patent',
    priority: 'critical',
    status: 'pending',
    timeframe: 'This Week',
    estimatedCost: '$2,000 - $5,000',
    impact: 'Protects $100K+ IP - Critical for valuation'
  },
  {
    id: 2,
    category: 'Security',
    task: 'Move API credentials to environment variables',
    priority: 'critical',
    status: 'pending',
    timeframe: 'This Week',
    files: ['Broker Aggregator', 'MCP Server'],
    impact: 'Security hardening - Required for production'
  },
  {
    id: 3,
    category: 'Version Control',
    task: 'Push all code to GitHub repos',
    priority: 'critical',
    status: 'pending',
    timeframe: 'This Week',
    impact: 'IP protection and institutional visibility'
  },
  {
    id: 4,
    category: 'Deployment',
    task: 'Deploy LIV8 Credit to production',
    priority: 'high',
    status: 'pending',
    timeframe: 'Next 2 Weeks',
    impact: 'Revenue generation - $50K+ value'
  },
  {
    id: 5,
    category: 'Deployment',
    task: 'Deploy Hybrid Journal to production',
    priority: 'high',
    status: 'pending',
    timeframe: 'Next 2 Weeks',
    impact: 'Revenue generation - $40K+ value'
  },
  {
    id: 7,
    category: 'Documentation',
    task: 'Create investor pitch deck',
    priority: 'high',
    status: 'pending',
    timeframe: 'Next 2 Weeks',
    impact: 'Fundraising ready'
  },
  {
    id: 8,
    category: 'Operations',
    task: 'Set up data room structure',
    priority: 'medium',
    status: 'pending',
    timeframe: 'Month 1',
    impact: 'Due diligence ready'
  },
  {
    id: 9,
    category: 'Version Control',
    task: 'Make GitHub repos public for portfolio',
    priority: 'medium',
    status: 'pending',
    timeframe: 'Month 1',
    repos: 9,
    impact: 'Credibility and visibility'
  }
];

export const tradingMetrics = {
  aiSystem: {
    winRate: 65.12,
    totalTrades: 43,
    netPoints: 892.5,
    profitFactor: 2.13,
    avgWin: 38.5,
    avgLoss: 24.75,
    largestWin: 121.25,
    largestLoss: 52.75
  }
};

export const valuationSummary = {
  conservative: {
    software: { min: 135000, max: 260000 },
    trading: { min: 60000, max: 120000 },
    agents: { min: 50000, max: 100000 },
    brand: { min: 25000, max: 50000 },
    total: { min: 420000, max: 830000 }
  },
  aggressive: {
    software: { min: 250000, max: 450000 },
    trading: { min: 100000, max: 200000 },
    agents: { min: 100000, max: 250000 },
    brand: { min: 50000, max: 100000 },
    total: { min: 750000, max: 1600000 }
  }
};
