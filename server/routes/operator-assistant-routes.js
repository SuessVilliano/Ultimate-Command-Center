import * as ai from '../lib/ai-provider.js';
import { highlevel } from '../lib/highlevel-integration.js';

const PORTFOLIO_SIGNALS = {
  'david summer': {
    motion: 'Reactivate',
    currentQuarterTrials: 0,
    previousQuarterTrials: 124,
    lifetimeTrials: 155,
    signal: 'Large recent production drop. Diagnose traffic, offer, tracking, or operational blockers before prescribing a campaign.',
  },
  'james hurst': {
    motion: 'Reactivate / Milestone',
    lifetimeTrials: 985,
    signal: '15 trials from 1,000 lifetime. Strong milestone-based outreach opportunity.',
  },
  'big bear digital': {
    motion: 'Protect',
    currentQuarterTrials: 1,
    lifetimeTrials: 697,
    signal: 'Historically productive but currently weak. Use a cause-finding conversation, not generic reactivation.',
  },
  'corda systems': {
    motion: 'Reactivate',
    lifetimeTrials: 262,
    signal: 'Engaged historical producer with weak current production. Surface blocker and propose the lowest-effort restart.',
  },
  'abigail ogbe': {
    motion: 'Reactivate / Relationship',
    lifetimeTrials: 188,
    signal: 'Transferred relationship with public content channels. Prioritize relationship opening plus a repeatable content/promotion test.',
  },
  'khawajamuntazir22': {
    motion: 'Grow',
    signal: 'Fresh production and one of the clearest active growth signals in the current book. Identify the acquisition motion and repeat it.',
  },
  'jono catliff': {
    motion: 'Grow / Content',
    lifetimeTrials: 311,
    signal: 'Large AI-automation audience. Strong candidate for a specific HighLevel content test rather than generic outreach.',
  },
};

function contactsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.contacts || payload?.data?.contacts || payload?.data || [];
}

function conversationsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.conversations || payload?.data?.conversations || payload?.data || [];
}

function messagesFrom(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.messages || payload?.data?.messages || payload?.data || [];
}

function contactName(contact = {}) {
  return contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '';
}

function extractAffiliateCandidate(message = '') {
  const clean = String(message).replace(/[?.!,]/g, ' ').replace(/\s+/g, ' ').trim();
  const known = Object.keys(PORTFOLIO_SIGNALS).find(name => clean.toLowerCase().includes(name));
  if (known) return known;

  const patterns = [
    /(?:pull up|look up|find|show me|tell me about|what(?:'s| is) going on with|what should we do (?:with|for)|how is)\s+([a-z][a-z0-9.' -]{2,50})/i,
    /(?:affiliate|partner)\s+([a-z][a-z0-9.' -]{2,50})/i,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

async function getAffiliateContext(message) {
  const candidate = extractAffiliateCandidate(message);
  if (!candidate) return { candidate: '', found: false };

  const staffUserId = highlevel.getStaffUserId('company');
  const search = await highlevel.searchContacts(candidate, { account: 'company', limit: 20 });
  const contacts = contactsFrom(search);
  const staffScoped = contacts.filter(contact => !staffUserId || String(contact.assignedTo || contact.assignedUserId || '') === String(staffUserId));
  const exact = staffScoped.find(contact => contactName(contact).toLowerCase() === candidate.toLowerCase());
  const contact = exact || staffScoped[0] || null;

  if (!contact) {
    return {
      candidate,
      found: false,
      portfolio: PORTFOLIO_SIGNALS[candidate.toLowerCase()] || null,
      crm: { searched: true, staffScopedMatches: staffScoped.length },
    };
  }

  const contactId = contact.id || contact.contactId;
  let conversations = [];
  let recentMessages = [];
  try {
    const conversationPayload = await highlevel.searchConversations({ account: 'company', contactId, limit: 20 });
    conversations = conversationsFrom(conversationPayload);
    const newest = conversations[0];
    if (newest?.id) {
      const messagePayload = await highlevel.getConversationMessages(newest.id, { account: 'company', limit: 50 });
      recentMessages = messagesFrom(messagePayload).slice(-20).map(message => ({
        direction: message.direction || message.messageDirection || '',
        type: message.type || message.messageType || '',
        body: message.body || message.message || message.text || '',
        createdAt: message.createdAt || message.dateAdded || message.timestamp || '',
      }));
    }
  } catch (error) {
    recentMessages = [{ error: `Conversation history unavailable: ${error.message}` }];
  }

  return {
    candidate,
    found: true,
    portfolio: PORTFOLIO_SIGNALS[candidate.toLowerCase()] || null,
    contact: {
      id: contactId,
      name: contactName(contact),
      email: contact.email || null,
      phone: contact.phone || null,
      assignedTo: contact.assignedTo || contact.assignedUserId || null,
      tags: contact.tags || [],
      dateAdded: contact.dateAdded || contact.createdAt || null,
    },
    conversationCount: conversations.length,
    recentMessages,
  };
}

function buildSystemPrompt({ affiliateContext, clientTimeZone }) {
  return `You are the LIV8 Command Center Operator, Jamaur's conversational AI operating layer.

Your job is to act like a capable command-center copilot across affiliate management, CRM work, planning, calendar preparation, outreach preparation, and operating decisions.

Rules:
- Be conversational and concise by default because responses may be spoken aloud.
- Never claim you read CRM data unless CRM context is actually present below.
- Distinguish internal portfolio metrics from CRM relationship history.
- For outreach, recommend a specific next action, channel, objective, and message angle.
- If the user asks to plan a calendar event but no calendar-write result is provided, prepare the event details and clearly say it still needs to be placed on the calendar.
- Do not claim an external action happened unless the tool/result confirms it.
- Company CRM data must stay staff-scoped.
- The 398-affiliate dataset is benchmark intelligence; Jamaur's assigned book is the operational focus.
- For performance changes, avoid claiming causation without evidence.

Client timezone: ${clientTimeZone || 'America/New_York'}

Affiliate/CRM context for this turn:
${JSON.stringify(affiliateContext || {}, null, 2)}

When affiliate context is present, answer in this order when useful: current signal, relationship/CRM context, what it means, recommended next move.`;
}

export function registerOperatorAssistantRoutes(app) {
  app.post('/api/operator/chat', async (req, res) => {
    try {
      const { message, clientTimeZone, context, conversationId, userId = 'sv' } = req.body || {};
      if (!String(message || '').trim()) return res.status(400).json({ error: 'message is required' });

      let affiliateContext = null;
      try {
        affiliateContext = await getAffiliateContext(message);
      } catch (error) {
        affiliateContext = {
          found: false,
          crmError: error.message,
          portfolio: PORTFOLIO_SIGNALS[extractAffiliateCandidate(message).toLowerCase()] || null,
        };
      }

      const result = await ai.chat([{ role: 'user', content: String(message).trim() }], {
        systemPrompt: buildSystemPrompt({ affiliateContext, clientTimeZone }),
        maxTokens: 900,
        agentId: 'liv8-operator',
        userId,
        conversationId,
        context,
      });

      const response = result?.text || result?.response || result?.content || String(result || '');
      res.json({
        response,
        operator: true,
        affiliateContext: affiliateContext?.candidate ? affiliateContext : undefined,
      });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, details: error.data || null });
    }
  });

  console.log('LIV8 Operator assistant route registered');
}

export default registerOperatorAssistantRoutes;
