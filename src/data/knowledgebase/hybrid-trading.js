// Hybrid Funding Trading Knowledge Base
// Specialized knowledge for prop trading operations

export const HYBRID_TRADING_KNOWLEDGE = {
  support: {
    scope: ['Customer inquiries', 'Ticket management', 'FAQ responses', 'Escalation handling'],
    commonIssues: {
      accountAccess: ['Password resets', 'Login issues', '2FA problems', 'Account lockouts'],
      tradingPlatform: ['MT4/MT5 connection', 'Platform downloads', 'Chart issues', 'Order execution'],
      payments: ['Deposit pending', 'Withdrawal status', 'Payment methods', 'Refund requests'],
      challenges: ['Challenge rules clarification', 'Profit target questions', 'Drawdown concerns', 'Time limit queries']
    },
    escalationPath: {
      level1: 'General support - FAQ and basic troubleshooting',
      level2: 'Technical support - Platform and account issues',
      level3: 'Compliance/Finance - KYC, payouts, violations'
    },
    responseTemplates: {
      greeting: 'Thank you for contacting Hybrid Funding support. How can I assist you today?',
      acknowledgment: 'I understand your concern and will look into this right away.',
      escalation: 'I am escalating this to our specialized team for further review.',
      closure: 'Is there anything else I can help you with today?'
    }
  },

  sales: {
    scope: ['Challenge guidance', 'Trader onboarding', 'Program selection', 'Success coaching'],
    challengePrograms: {
      evaluation: {
        phases: ['Phase 1 - Profit Target', 'Phase 2 - Verification'],
        rules: ['Daily drawdown limit', 'Max drawdown limit', 'Profit targets', 'Minimum trading days'],
        accountSizes: ['$10K', '$25K', '$50K', '$100K', '$200K']
      },
      instant: {
        description: 'Skip evaluation, start funded immediately',
        requirements: ['Higher fees', 'Stricter risk rules', 'Lower profit split initially']
      }
    },
    onboardingSteps: [
      'Account registration',
      'Program selection',
      'Payment processing',
      'Platform credentials delivery',
      'Rules acknowledgment',
      'Trading commencement'
    ],
    objectionHandling: {
      price: 'Focus on value - potential earnings vs small investment',
      difficulty: 'Highlight success rates and support resources',
      trust: 'Share testimonials and payout proof',
      timing: 'Emphasize flexible deadlines and extensions'
    }
  },

  finance: {
    scope: ['Payout processing', 'Payment verification', 'Transaction tracking', 'Financial reporting'],
    payoutProcess: {
      requirements: ['KYC verified', 'Minimum payout threshold met', 'No active violations', 'Cooling period passed'],
      methods: ['Bank wire', 'Cryptocurrency', 'PayPal', 'Wise'],
      timeline: {
        request: 'Within 24h review',
        processing: '3-5 business days',
        delivery: 'Varies by method'
      }
    },
    profitSplit: {
      initial: '80/20 (Trader/Company)',
      scaled: 'Up to 90/10 based on performance'
    },
    feeStructure: {
      challengeFees: 'One-time, varies by account size',
      monthlyFees: 'None for funded accounts',
      payoutFees: 'Minimal processing fees'
    }
  },

  analytics: {
    scope: ['Performance tracking', 'Trade analysis', 'Report generation', 'Metrics dashboard'],
    keyMetrics: {
      profitability: ['Net P&L', 'Gross profit', 'Gross loss', 'Profit factor'],
      risk: ['Max drawdown', 'Daily drawdown', 'Risk per trade', 'Risk-reward ratio'],
      activity: ['Total trades', 'Win rate', 'Average win/loss', 'Trading frequency'],
      consistency: ['Profit consistency', 'Daily returns', 'Equity curve analysis']
    },
    reportTypes: {
      daily: 'End-of-day summary with key stats',
      weekly: 'Weekly performance review with trends',
      monthly: 'Comprehensive monthly analysis',
      custom: 'Date-range specific reports'
    },
    alerts: {
      drawdownWarning: 'Approaching max drawdown limit',
      profitTarget: 'Close to achieving profit target',
      inactivity: 'No trades for extended period',
      violation: 'Rule breach detected'
    }
  }
};
