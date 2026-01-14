// HighLevel Support Specialist Knowledge Base
// Specialized for GoHighLevel CRM, LC Phone, Twilio, and A2P compliance

export const HIGHLEVEL_KNOWLEDGE = {
  identity: {
    name: 'Jamaur Johnson',
    role: 'Level 2 Senior Support Specialist',
    department: 'LC Phone and LC Email',
    company: 'GoHighLevel',
    schedulingLink: 'https://speakwith.us/jamaur',
    reviewLinks: {
      text: 'https://sqr.co/LeaveAReview',
      video: 'https://sqr.co/LeaveAVideoReview'
    }
  },

  personality: {
    style: 'Professional but human and approachable',
    tone: 'Short, sweet, helpful with light humor',
    approach: 'De-escalate with understanding while maintaining confidence',
    rules: [
      'Never hallucinate or invent answers',
      'Never promise results, resolutions, or timelines',
      'Break down technical issues into layman terms',
      'Speak highly of phone carrier as trusted partner',
      'Always identify as Jamaur Johnson'
    ]
  },

  templates: {
    atr: `I'm Jamaur!
I'm a specialist on {PRODUCT_FEATURE}, and I've been assigned to resolve this ticket for you. I'm reviewing all the notes for the ticket and it looks like the issue has to do with {DETAILED_ISSUE}. This ticket number is #{TICKET_NUMBER}, and it came from {AGENT_NAME} on {DATE}.
Give me a little time to dig into this further, and I'll get back to you as soon as possible!
Feel free to reply to this email if there's any additional info.`,

    pendingClose: `I will wait for your reply.
Please note, if we don't get a response within 48hrs, the ticket will auto-resolve. I want to get this resolved for you ASAP
**P.S. If the ticket AUTO-RESOLVED or CLOSED and the issue wasn't resolved, Please Reply to the auto-resolved email and the ticket will RE-OPEN.**`,

    twilioSuspension: `The LC Phone account has been suspended with the Carrier due to {SUSPENSION_REASON} rate of {PERCENTAGE}.
The Carriers have reviewed your SMS activity for the past 30 or more days. Due to the subaccount's high metrics Carriers are investigating your phone account.

Your account may be under review for any of the following reasons:
- Sending sms to leads that have not given you direct consent
- Buying/selling/trading leads (violation of Carrier and TCR policies)
- Uploading previously opted-in lead list where leads are opting out
- Customers marking messaging as spam directly to carrier
- Carrier filtering (Error Code 30007)

We will need to reach out to the Carrier to attempt reinstatement. Please provide:
1. Website URL where leads opt-in to receive SMS
2. First text message sent to leads after opt-in

Note: We have 2 attempts at account reinstatement.`,

    appealSubmitted: `Thank you for providing your information. I've submitted your information to the party involved. They review dozens of suspended account submissions. Please allow their Compliance Department anywhere up to 2-5 business days to conduct the review but please understand this could take longer.
Please ensure that your site is accessible and no information is changed. If the site is down or Changes are made to the opt-in form, this could result in a rejection.
This ticket will be placed on-hold until the Carrier provides feedback. We will surely follow up with you as soon as we receive updates!`,

    canadaA2P: `I hope you're doing well, and thank you for your patience.
To proceed with the appeal, we'll need a document that includes the Canadian Business Number (CBN) issued by the Canada Revenue Agency (CRA). Please note that the carrier will not accept a Canadian Identification Number (CIN).

Acceptable CRA-issued documents:
- CRA Confirmation of Business Registration
- Notice of Assessment for GST/HST
- RC1 Form (Request for a Business Number)`,

    closingNote: `Issue: {SHORT_DESCRIPTION}
Account: {NAME_EMAIL}
Investigation & Actions: {STEPS_TAKEN}
Next Steps: {AGENT_CUSTOMER_PENDING}
Resolution: {OUTCOME}
Closure Date: {DATE}
Notes: {OPTIONAL_REMARKS}`
  },

  suspensionTypes: {
    campaign: {
      types: ['Content Drift', 'High opt-out rates', 'High Carrier spam (7726)', 'Known Spam', 'Forbidden Content'],
      forbiddenCategories: ['Gambling', 'Sports betting', 'High-risk loans', 'Fast cash loans', 'Shady lead lists'],
      remediable: ['Content drift', 'High opt-outs', 'High spam (otherwise compliant)', 'Internal notification phishing'],
      notRemediable: ['Forbidden content', 'Persistent phishing by customer', 'Repeated non-compliance']
    },
    consentAudit: {
      required: ['How consent was obtained (URL/form)', 'Date of consent', 'Time of consent', 'IP address (optional)', 'Any other opt-in details']
    },
    voiceTrafficAlert: {
      metrics: {
        asr: { description: 'Answer Seizure Ratio', unhealthyThreshold: '< 40%' },
        sip404: { description: 'Calls to invalid numbers', unhealthyThreshold: '> 1%' },
        sip603_608: { description: 'Declined/Rejected calls', unhealthyThreshold: '> 5%' },
        shortDuration: { description: 'Calls 1-6 seconds', unhealthyThreshold: '> 15%' }
      }
    }
  },

  errorCodes: {
    30007: {
      name: 'Message filtered',
      causes: ['Spam messaging', 'No sender ID', 'No opt-out language', 'Forbidden messaging', 'URL shorteners'],
      actions: ['Review Messaging Insights', 'Check Opt-Out rate (over 1.5% is problematic)', 'Verify content matches use case', 'Remove URL shorteners like Bitly/TinyUrl']
    },
    30034: {
      name: 'US A2P 10DLC - Message from Unregistered Number',
      causes: ['Sole Prop campaigns limited to 1 number', 'Number moved between accounts', 'Number added before porting complete'],
      actions: ['Validate registered numbers', 'Wait 24h after adding number to Messaging Service']
    },
    30024: {
      name: 'Numeric Sender ID Not Provisioned on Carrier',
      causes: ['Same as 30034'],
      actions: ['Check A2P registration status in Twilio Console']
    },
    30008: {
      name: 'Message Delivery - Unknown error',
      actions: ['Check if traffic sent to Twilio number', 'Have end-user validate their configuration']
    },
    32017: {
      name: 'Carrier blocked call due to calling number',
      solution: 'Register number with T-Mobile',
      links: ['www.freecallerregistry.com', 'https://portal.firstorion.com', 'https://callreporting.t-mobile.com/']
    }
  },

  a2p10dlc: {
    brandIssues: {
      standardLowVolume: {
        required: ['Account SID', 'Brand SID', 'FULL PDF with EIN/CP575 or LTR 147C (W9 not supported)'],
        notes: ['International brands need English version of TAX ID', 'Date of notice must be 15+ days old', 'Puerto Rico uses US as Issue Country']
      },
      soleProprietorship: {
        notes: ['Email must not have extra blank spaces', 'Address must be valid US/CA', 'LLC/Co/INC must register as Low Volume or Standard', 'Use valid US/CA mobile for OTP (no VoIP)']
      }
    },
    campaignIssues: {
      requirements: ['Privacy Policy and Terms & Conditions on website', 'Checkbox for explicit SMS consent', 'Privacy Policy must state no sharing with third parties for marketing']
    },
    trustScoreAppeal: {
      standard: { cost: '$11-$40', timeline: '24-48 hours' },
      enhanced: { cost: '$95', timeline: '2-3 months' }
    }
  },

  rcaForm: {
    fields: {
      contentProvider: 'Brand/company name from A2P registration',
      website: 'URL where customer collects opt-in',
      applicantAddress: 'Address from brand registration',
      campaignId: 'External Campaign ID (7-digit number)',
      campaignDescription: 'Copy verbatim from campaign details',
      onboardingDate: 'Campaign created/approved date',
      optOutCount: 'From Monitor > Insights > Messages > Responses > Opt-Out',
      helpCount: 'From Monitor > Insights > Messages > Responses > Help'
    },
    carrierFills: ['Aggregator fields', 'Past 6 months traffic volume', 'Past violations', 'Phone number lists']
  },

  resources: {
    gohighlevel: {
      youtube: 'https://www.youtube.com/@gohighlevel',
      termsOfService: 'https://www.gohighlevel.com/terms-of-service',
      affiliatePolicy: 'https://www.gohighlevel.com/affiliate-policy',
      hipaaCompliance: 'https://help.gohighlevel.com/support/solutions/articles/48000983084-hipaa-compliance-with-highlevel',
      subAccountTransfer: 'https://help.gohighlevel.com/support/solutions/articles/155000003465-sub-account-transfers-eject-sub-account-to-a-new-agency'
    },
    twilio: {
      docs: 'https://www.twilio.com/docs',
      portingGuide: 'https://help.twilio.com/articles/223179348-Porting-a-Phone-Number-to-Twilio',
      errorCodes: 'https://www.twilio.com/docs/api/errors',
      smsPricing: 'https://www.twilio.com/en-us/sms/pricing/us',
      voicePricing: 'https://www.twilio.com/en-us/voice/pricing/us',
      priorityLevels: 'https://support.twilio.com/hc/en-us/articles/223136087-Support-ticket-priority-levels-explained'
    }
  },

  ticketPriority: {
    p1: 'Business critical - Complete loss of service, no workaround',
    p2: 'Degraded service - Intermittent issues, workaround may exist',
    p3: 'General issue - Product questions, feature requests, development'
  },

  voiceTicketRequirements: {
    detailed: [
      'Clear description of symptom',
      '2-3 example SIDs within past 24 hours',
      'Is issue reproducible?',
      'When did issue begin?',
      'Scope of issue (specific numbers/prefixes/agents/locations)',
      'Business impact percentage'
    ],
    abridged: ['Call SID within 24 hours', 'Type and time of issue during call']
  },

  messagingTicketRequirements: {
    general: [
      'Clear issue description',
      '2-3 example SIDs within past 72 hours',
      'Is issue reproducible?',
      'When did issue begin?',
      'Scope of issue',
      'Business impact percentage'
    ],
    filtering: ['Use Case', 'Opt-in process', 'Website URL', 'Privacy Policy', 'Terms of Service', 'Opt-Out Rate', 'Spam Complaint Rate', 'Error Rate']
  },

  bestPractices: {
    messaging: [
      'Only message contacts with explicit SMS opt-in',
      'Include STOP/opt-out language in messages',
      'Identify business name in messages',
      'Match content to registered campaign use case',
      'No purchased/rented contact lists',
      'Keep opt-out rate below 1.5%'
    ],
    voice: [
      'Enable Voice Trace for quality troubleshooting',
      'Register numbers with T-Mobile analytic providers',
      'Monitor ASR, SIP 404, SIP 603/608 metrics',
      'Provide recent examples (within 24h) for escalations'
    ]
  }
};
