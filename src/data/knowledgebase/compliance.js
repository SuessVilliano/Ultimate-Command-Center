// Compliance Knowledge Base
// Specialized knowledge for risk monitoring and KYC/compliance

export const COMPLIANCE_KNOWLEDGE = {
  risk: {
    scope: ['Risk monitoring', 'Drawdown alerts', 'Account analysis', 'Violation detection'],
    drawdownRules: {
      daily: {
        description: 'Maximum loss allowed in a single trading day',
        calculation: 'Based on starting daily balance',
        typical: '5% of account balance',
        reset: 'Resets at server rollover time'
      },
      maxTotal: {
        description: 'Maximum total loss allowed on account',
        calculation: 'Based on initial account balance',
        typical: '10% of initial balance',
        trailing: 'May trail with profits depending on program'
      }
    },
    violations: {
      hardBreach: {
        triggers: ['Exceeding max drawdown', 'Exceeding daily drawdown'],
        consequence: 'Immediate account termination',
        appeal: 'Generally not appealable'
      },
      softBreach: {
        triggers: ['News trading restrictions', 'Weekend holding', 'Lot size violations'],
        consequence: 'Warning or profit deduction',
        appeal: 'May be reviewed case by case'
      }
    },
    monitoringMetrics: {
      realtime: ['Current drawdown %', 'Open P&L', 'Margin usage', 'Position sizes'],
      historical: ['Peak-to-trough', 'Drawdown duration', 'Recovery patterns', 'Risk-adjusted returns']
    },
    alertThresholds: {
      warning: '50% of max drawdown reached',
      critical: '75% of max drawdown reached',
      danger: '90% of max drawdown reached'
    },
    riskManagement: {
      recommendations: [
        'Use stop losses on all trades',
        'Limit position sizes to 1-2% risk per trade',
        'Avoid overleveraging',
        'Diversify across instruments',
        'Monitor correlated positions'
      ]
    }
  },

  kyc: {
    scope: ['KYC processing', 'Document verification', 'Compliance checks', 'Regulatory guidance'],
    documentRequirements: {
      identity: {
        accepted: ['Passport', 'National ID card', 'Drivers license'],
        requirements: ['Clear photo', 'All corners visible', 'Not expired', 'Name matches account']
      },
      address: {
        accepted: ['Utility bill', 'Bank statement', 'Government letter'],
        requirements: ['Within last 3 months', 'Full name visible', 'Full address visible']
      },
      payment: {
        accepted: ['Bank statement', 'Card photo (partial)', 'Crypto wallet proof'],
        requirements: ['Matches withdrawal method', 'Name matches account']
      }
    },
    verificationProcess: {
      steps: [
        'Document submission',
        'Initial review (automated)',
        'Manual verification if needed',
        'Approval or rejection with reason'
      ],
      timeline: {
        standard: '24-48 hours',
        expedited: '4-8 hours (when available)',
        complex: 'Up to 5 business days'
      }
    },
    complianceChecks: {
      aml: 'Anti-Money Laundering screening',
      pep: 'Politically Exposed Person check',
      sanctions: 'Sanctions list verification',
      fraud: 'Fraud pattern detection'
    },
    restrictedRegions: {
      note: 'List varies - check current policy',
      commonRestrictions: ['OFAC sanctioned countries', 'High-risk jurisdictions']
    },
    dataProtection: {
      storage: 'Encrypted secure servers',
      retention: 'As required by regulations',
      access: 'Limited to authorized personnel',
      deletion: 'Upon request after retention period'
    },
    rejectionReasons: {
      documents: ['Blurry/unreadable', 'Expired', 'Wrong document type', 'Name mismatch'],
      compliance: ['Failed AML check', 'Restricted region', 'Sanctions match', 'Suspicious activity']
    }
  }
};
