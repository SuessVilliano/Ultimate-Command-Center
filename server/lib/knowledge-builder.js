/**
 * LIV8 Command Center - Smart Knowledge Base Builder
 * Automatically learns from resolved tickets to make agents smarter
 */

import * as db from './database.js';
import * as ai from './ai-provider.js';

// Common ticket categories for GoHighLevel support
const TICKET_CATEGORIES = {
  PORTING: ['port', 'porting', 'loa', 'transfer number', 'phone number transfer'],
  PHONE_SYSTEM: ['phone', 'call', 'dialer', 'twilio', 'lc phone', 'missed call', 'voicemail'],
  AUTOMATION: ['workflow', 'automation', 'trigger', 'action', 'if/else', 'wait step'],
  EMAIL: ['email', 'smtp', 'deliverability', 'bounce', 'mailgun', 'sendgrid'],
  CALENDAR: ['calendar', 'appointment', 'booking', 'scheduling', 'availability'],
  BILLING: ['billing', 'invoice', 'payment', 'subscription', 'charge', 'refund', 'cancel'],
  ACCESS: ['login', 'password', 'access', '2fa', 'mfa', 'locked out', 'reset'],
  INTEGRATION: ['integration', 'api', 'webhook', 'zapier', 'connect', 'sync'],
  WHITELABEL: ['whitelabel', 'white label', 'custom domain', 'branding', 'dns', 'cname'],
  SMS: ['sms', 'text message', 'a2p', '10dlc', 'campaign', 'opt-out'],
  FUNNEL: ['funnel', 'landing page', 'form', 'survey', 'website'],
  CRM: ['contact', 'lead', 'opportunity', 'pipeline', 'tag', 'custom field'],
  REPUTATION: ['review', 'reputation', 'google reviews', 'facebook reviews'],
  REPORTING: ['report', 'analytics', 'dashboard', 'metrics', 'stats']
};

/**
 * Categorize a ticket based on its content
 */
export function categorizeTicket(subject, description) {
  const text = `${subject} ${description || ''}`.toLowerCase();
  const matches = [];

  for (const [category, keywords] of Object.entries(TICKET_CATEGORIES)) {
    const matchCount = keywords.filter(keyword => text.includes(keyword)).length;
    if (matchCount > 0) {
      matches.push({ category, score: matchCount });
    }
  }

  // Sort by score and return top category
  matches.sort((a, b) => b.score - a.score);
  return matches.length > 0 ? matches[0].category : 'GENERAL';
}

/**
 * Fetch ALL historical tickets from Freshdesk
 */
export async function fetchAllHistoricalTickets(config) {
  const { domain, apiKey, agentId } = config;

  if (!domain || !apiKey) {
    throw new Error('Freshdesk not configured');
  }

  console.log('Fetching all historical tickets...');

  const allTickets = [];
  const authHeader = Buffer.from(`${apiKey}:X`).toString('base64');

  // Fetch tickets page by page (Freshdesk API paginates at 30 per page)
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 50) { // Max 50 pages = 1500 tickets
    try {
      // Use list endpoint for historical data (search has date limits)
      let url = `https://${domain}.freshdesk.com/api/v2/tickets?per_page=100&page=${page}`;

      if (agentId) {
        // Filter by agent if specified
        url = `https://${domain}.freshdesk.com/api/v2/search/tickets?query="agent_id:${agentId}"&page=${page}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`Fetch stopped at page ${page}: ${response.status}`);
        break;
      }

      const data = await response.json();
      const tickets = data.results || data || [];

      if (tickets.length === 0) {
        hasMore = false;
      } else {
        allTickets.push(...tickets);
        console.log(`Fetched page ${page}: ${tickets.length} tickets (total: ${allTickets.length})`);
        page++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error.message);
      hasMore = false;
    }
  }

  console.log(`Total tickets fetched: ${allTickets.length}`);
  return allTickets;
}

/**
 * Fetch ticket conversations (to get agent responses)
 */
export async function fetchTicketConversations(ticketId, config) {
  const { domain, apiKey } = config;
  const authHeader = Buffer.from(`${apiKey}:X`).toString('base64');

  try {
    const response = await fetch(
      `https://${domain}.freshdesk.com/api/v2/tickets/${ticketId}/conversations`,
      {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log(`Could not fetch conversations for ticket ${ticketId}`);
  }

  return [];
}

/**
 * Extract agent responses from conversations
 */
function extractAgentResponses(conversations, agentEmail = null) {
  const agentReplies = conversations.filter(c =>
    c.incoming === false || // Outgoing = agent reply
    (agentEmail && c.from_email === agentEmail)
  );

  return agentReplies.map(r => ({
    body: r.body_text || r.body || '',
    createdAt: r.created_at
  }));
}

/**
 * Create a smart summary of a resolved ticket for learning
 */
export async function createTicketSummary(ticket, conversations) {
  const category = categorizeTicket(ticket.subject, ticket.description_text || ticket.description);

  // Extract the key information
  const customerIssue = ticket.description_text || ticket.description || ticket.subject;
  const agentResponses = extractAgentResponses(conversations);
  const finalResponse = agentResponses.length > 0
    ? agentResponses[agentResponses.length - 1].body
    : '';

  // Try to use AI for smart summarization
  try {
    const prompt = `Summarize this resolved support ticket for a knowledge base. Extract:
1. ISSUE: What was the customer's problem (1-2 sentences)
2. SOLUTION: How it was resolved (1-2 sentences)
3. KEY_STEPS: Bullet points of resolution steps
4. KEYWORDS: 5-10 keywords for searching

TICKET:
Subject: ${ticket.subject}
Customer Issue: ${customerIssue.substring(0, 1000)}
Agent Response: ${finalResponse.substring(0, 1000)}

Respond in JSON format only.`;

    const result = await ai.chat([{ role: 'user', content: prompt }], {
      maxTokens: 500,
      agentId: 'knowledge-builder'
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const summary = JSON.parse(jsonMatch[0]);
      return {
        ticketId: ticket.id,
        category,
        issue: summary.ISSUE || customerIssue.substring(0, 500),
        solution: summary.SOLUTION || finalResponse.substring(0, 500),
        keySteps: summary.KEY_STEPS || [],
        keywords: summary.KEYWORDS || [],
        subject: ticket.subject,
        customerName: ticket.requester?.name || 'Unknown',
        resolvedAt: ticket.updated_at,
        aiSummarized: true
      };
    }
  } catch (e) {
    console.log(`AI summarization failed for ticket ${ticket.id}, using basic summary`);
  }

  // Fallback: basic summary without AI
  return {
    ticketId: ticket.id,
    category,
    issue: customerIssue.substring(0, 500),
    solution: finalResponse.substring(0, 500),
    keySteps: [],
    keywords: extractBasicKeywords(ticket.subject + ' ' + customerIssue),
    subject: ticket.subject,
    customerName: ticket.requester?.name || 'Unknown',
    resolvedAt: ticket.updated_at,
    aiSummarized: false
  };
}

/**
 * Extract basic keywords without AI
 */
function extractBasicKeywords(text) {
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'would', 'could', 'there', 'their', 'will', 'when', 'who', 'make', 'like', 'time', 'just', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'this', 'that', 'with', 'from', 'they', 'what', 'about', 'which', 'get', 'help', 'please', 'thanks', 'thank', 'hello', 'here', 'need', 'able', 'issue', 'problem']);

  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const wordFreq = {};

  words.forEach(word => {
    if (!stopWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Build the knowledge base from historical tickets
 */
export async function buildKnowledgeBase(config, options = {}) {
  const { onProgress } = options;

  console.log('\n========================================');
  console.log('BUILDING SMART KNOWLEDGE BASE');
  console.log('========================================\n');

  // 1. Fetch all historical tickets
  const allTickets = await fetchAllHistoricalTickets(config);

  // 2. Filter to resolved/closed tickets
  const resolvedTickets = allTickets.filter(t => t.status === 4 || t.status === 5);
  console.log(`Found ${resolvedTickets.length} resolved/closed tickets`);

  // 3. Process each ticket
  const summaries = [];
  const categoryStats = {};

  for (let i = 0; i < resolvedTickets.length; i++) {
    const ticket = resolvedTickets[i];

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: resolvedTickets.length,
        ticket: ticket.subject
      });
    }

    try {
      // Check if already processed
      const existing = db.searchKnowledgeBase([String(ticket.id)], 1);
      if (existing.length > 0 && existing[0].ticket_id === ticket.id) {
        console.log(`Skipping ticket ${ticket.id} (already indexed)`);
        continue;
      }

      // Fetch conversations for this ticket
      const conversations = await fetchTicketConversations(ticket.id, config);

      // Create smart summary
      const summary = await createTicketSummary(ticket, conversations);
      summaries.push(summary);

      // Track category stats
      categoryStats[summary.category] = (categoryStats[summary.category] || 0) + 1;

      // Store in database
      db.addToKnowledgeBase(
        { id: ticket.id, subject: ticket.subject, description: summary.issue },
        summary.solution,
        summary.keywords,
        summary.category
      );

      console.log(`Indexed ticket ${ticket.id}: ${summary.category} - ${ticket.subject.substring(0, 50)}...`);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`Error processing ticket ${ticket.id}:`, error.message);
    }
  }

  // 4. Generate category insights
  console.log('\n--- Knowledge Base Stats ---');
  console.log(`Total indexed: ${summaries.length}`);
  console.log('By category:');
  Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} tickets`);
    });

  return {
    indexed: summaries.length,
    categories: categoryStats,
    summaries
  };
}

/**
 * Process a single newly resolved ticket (for auto-updates)
 */
export async function processResolvedTicket(ticket, config) {
  console.log(`Processing newly resolved ticket: ${ticket.id}`);

  try {
    const conversations = await fetchTicketConversations(ticket.id, config);
    const summary = await createTicketSummary(ticket, conversations);

    db.addToKnowledgeBase(
      { id: ticket.id, subject: ticket.subject, description: summary.issue },
      summary.solution,
      summary.keywords,
      summary.category
    );

    // Log for agent learning
    db.logAgentInteraction('knowledge-builder', 'ticket_learned', {
      ticketId: ticket.id,
      category: summary.category
    }, summary, '', true);

    return summary;
  } catch (error) {
    console.error(`Failed to process ticket ${ticket.id}:`, error.message);
    return null;
  }
}

/**
 * Get knowledge base insights
 */
export function getKnowledgeInsights() {
  try {
    const stats = db.getKnowledgeBaseStats();

    // Get category distribution from database
    const dbInstance = db.getDb();
    const categoryStmt = dbInstance.prepare(`
      SELECT category, COUNT(*) as count
      FROM knowledge_base
      GROUP BY category
      ORDER BY count DESC
    `);
    const categories = categoryStmt.all();

    // Get recent additions
    const recentStmt = dbInstance.prepare(`
      SELECT ticket_id, subject, category, indexed_at
      FROM knowledge_base
      ORDER BY indexed_at DESC
      LIMIT 10
    `);
    const recent = recentStmt.all();

    return {
      total: stats.total,
      lastUpdated: stats.lastUpdated,
      categories,
      recent
    };
  } catch (e) {
    return { total: 0, categories: [], recent: [] };
  }
}

/**
 * Search knowledge base with smart matching
 */
export function smartSearch(query, limit = 5) {
  // Extract keywords from query
  const keywords = extractBasicKeywords(query);

  // Determine likely category
  const category = categorizeTicket(query, '');

  // Search database
  const results = db.searchKnowledgeBase(keywords, limit * 2);

  // Boost results that match the category
  const scored = results.map(r => ({
    ...r,
    categoryMatch: r.category === category,
    finalScore: r.score + (r.category === category ? 2 : 0)
  }));

  return scored
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);
}

export default {
  categorizeTicket,
  fetchAllHistoricalTickets,
  fetchTicketConversations,
  createTicketSummary,
  buildKnowledgeBase,
  processResolvedTicket,
  getKnowledgeInsights,
  smartSearch,
  TICKET_CATEGORIES
};
