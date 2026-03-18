/**
 * LIV8 Command Center - External REST API v1
 *
 * Authenticated API endpoints for external platforms to interact with
 * the Command Center. All routes require a valid API key.
 *
 * Base path: /api/v1
 *
 * Used by: Zapier, Make, n8n, GHL workflows, custom integrations
 */

import * as db from '../lib/database.js';
import * as ai from '../lib/ai-provider.js';
import * as rag from '../lib/langchain-rag.js';
import * as memory from '../lib/conversation-memory.js';
import * as pipeline from '../lib/ticket-pipeline.js';
import * as orchestrator from '../lib/agent-orchestrator.js';
import {
  apiKeyAuth,
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  activateApiKey,
  deleteApiKey,
  getApiKeyStats
} from '../lib/api-auth.js';

export function registerExternalApiRoutes(app) {

  // ============================================
  // API KEY MANAGEMENT (protected by master key or internal)
  // ============================================

  // Generate a new API key (admin-only: requires existing key with 'admin' scope)
  app.post('/api/v1/keys', apiKeyAuth('admin'), (req, res) => {
    try {
      const { name, scopes, rate_limit } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }
      const key = generateApiKey(
        name,
        scopes || '*',
        rate_limit || 60
      );
      res.status(201).json({ success: true, ...key });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // List all API keys
  app.get('/api/v1/keys', apiKeyAuth('admin'), (req, res) => {
    try {
      const keys = listApiKeys();
      res.json({ success: true, keys });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get key stats
  app.get('/api/v1/keys/:id/stats', apiKeyAuth('admin'), (req, res) => {
    try {
      const stats = getApiKeyStats(parseInt(req.params.id));
      if (!stats) return res.status(404).json({ error: 'Key not found' });
      res.json({ success: true, ...stats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Revoke a key
  app.post('/api/v1/keys/:id/revoke', apiKeyAuth('admin'), (req, res) => {
    try {
      const revoked = revokeApiKey(parseInt(req.params.id));
      res.json({ success: revoked, message: revoked ? 'Key revoked' : 'Key not found' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reactivate a key
  app.post('/api/v1/keys/:id/activate', apiKeyAuth('admin'), (req, res) => {
    try {
      const activated = activateApiKey(parseInt(req.params.id));
      res.json({ success: activated });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a key
  app.delete('/api/v1/keys/:id', apiKeyAuth('admin'), (req, res) => {
    try {
      const deleted = deleteApiKey(parseInt(req.params.id));
      res.json({ success: deleted });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // TICKETS
  // ============================================

  // Get all tickets (with optional status filter)
  app.get('/api/v1/tickets', apiKeyAuth('tickets'), (req, res) => {
    try {
      const statuses = req.query.status
        ? req.query.status.split(',').map(Number)
        : null;
      const tickets = db.getAllTicketsWithAnalysis(statuses);
      res.json({ success: true, count: tickets.length, tickets });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single ticket with analysis
  app.get('/api/v1/tickets/:ticketId', apiKeyAuth('tickets'), (req, res) => {
    try {
      const ticket = db.getTicketWithAnalysis(req.params.ticketId);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ success: true, ticket });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Triage a ticket (submit for AI analysis)
  app.post('/api/v1/tickets/triage', apiKeyAuth('tickets'), async (req, res) => {
    try {
      const { subject, description, requester_name, requester_email, priority, source } = req.body;
      if (!subject || !description) {
        return res.status(400).json({ error: 'subject and description are required' });
      }

      const ticket = {
        subject,
        description,
        requester_name: requester_name || 'External API',
        requester_email: requester_email || '',
        priority: priority || 1,
        status: 2,
        source: source || 'api'
      };

      // AI triage
      const analysis = await ai.analyzeTicket(ticket);

      res.json({
        success: true,
        triage: {
          escalation_type: analysis.escalation_type,
          urgency_score: analysis.urgency_score,
          category: analysis.category,
          summary: analysis.summary,
          suggested_response: analysis.suggested_response,
          keywords: analysis.keywords
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate a draft response for a ticket
  app.post('/api/v1/tickets/draft', apiKeyAuth('tickets'), async (req, res) => {
    try {
      const { subject, description, requester_name, context } = req.body;
      if (!subject || !description) {
        return res.status(400).json({ error: 'subject and description are required' });
      }

      const ticket = { subject, description, requester_name: requester_name || '' };

      // Find similar tickets for context
      let similarTickets = [];
      try {
        similarTickets = await rag.searchSimilar(`${subject} ${description}`, 3);
      } catch (e) { /* RAG may not be initialized */ }

      const result = await ai.generateResponse(ticket, {
        sopContent: context?.sop || '',
        similarTickets,
        casebookEntries: []
      });

      res.json({
        success: true,
        draft: {
          response: result.response,
          similar_tickets_found: similarTickets.length,
          ai_provider: ai.getCurrentProvider().provider
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Process a ticket through the full pipeline (triage → context → draft → QA)
  app.post('/api/v1/tickets/pipeline', apiKeyAuth('tickets'), async (req, res) => {
    try {
      const { ticket_id } = req.body;
      if (!ticket_id) {
        return res.status(400).json({ error: 'ticket_id is required' });
      }
      const result = await pipeline.processTicket(ticket_id);
      res.json({ success: true, pipeline: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // DRAFTS
  // ============================================

  // Get all drafts (with optional status filter)
  app.get('/api/v1/drafts', apiKeyAuth('drafts'), (req, res) => {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.limit) filters.limit = parseInt(req.query.limit);
      const drafts = db.getAllDrafts(filters);
      res.json({ success: true, count: drafts.length, drafts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get draft for specific ticket
  app.get('/api/v1/drafts/ticket/:ticketId', apiKeyAuth('drafts'), (req, res) => {
    try {
      const draft = db.getDraftForTicket(req.params.ticketId);
      if (!draft) return res.status(404).json({ error: 'No draft found for this ticket' });
      res.json({ success: true, draft });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update draft status (approve, reject, etc.)
  app.patch('/api/v1/drafts/:id/status', apiKeyAuth('drafts'), (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_EDIT', 'ESCALATION_RECOMMENDED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      }
      db.updateDraftStatus(req.params.id, status, req.apiKey.name);
      res.json({ success: true, message: `Draft ${req.params.id} updated to ${status}` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get draft queue stats
  app.get('/api/v1/drafts/stats', apiKeyAuth('drafts'), (req, res) => {
    try {
      const stats = db.getDraftStats();
      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // CHAT & AI
  // ============================================

  // Send a chat message and get an AI response
  app.post('/api/v1/chat', apiKeyAuth('chat'), async (req, res) => {
    try {
      const { message, conversation_id, user_id } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      const userId = user_id || `api_${req.apiKey.prefix}`;

      // Get or create conversation
      let convId = conversation_id;
      if (!convId) {
        const conv = memory.getActiveConversation(userId);
        convId = conv?.id;
        if (!convId) {
          const newConv = memory.createConversation(userId, 'API Conversation');
          convId = newConv.id;
        }
      }

      // Store user message
      memory.addMessage(convId, 'user', message);

      // Get AI response with context
      const result = await ai.chat([
        { role: 'system', content: 'You are the LIV8 Command Center AI assistant. Be concise and helpful.' },
        { role: 'user', content: message }
      ]);

      // Store AI response
      memory.addMessage(convId, 'assistant', result);

      res.json({
        success: true,
        response: result,
        conversation_id: convId
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Route a message to the right specialized agent
  app.post('/api/v1/chat/agent', apiKeyAuth('chat'), async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      const routing = orchestrator.routeRequest(message);
      res.json({
        success: true,
        agent: routing.agent,
        confidence: routing.confidence,
        response: routing.response || 'Routed to agent for processing'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // KNOWLEDGE BASE
  // ============================================

  // Search the knowledge base
  app.post('/api/v1/knowledge/search', apiKeyAuth('knowledge'), async (req, res) => {
    try {
      const { query, limit } = req.body;
      if (!query) return res.status(400).json({ error: 'query is required' });

      const results = await rag.searchSimilar(query, limit || 5);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Ask the knowledge base a question (RAG Q&A)
  app.post('/api/v1/knowledge/ask', apiKeyAuth('knowledge'), async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) return res.status(400).json({ error: 'question is required' });

      const answer = await rag.askKnowledgeBase(question);
      res.json({ success: true, answer });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get knowledge base stats
  app.get('/api/v1/knowledge/stats', apiKeyAuth('knowledge'), (req, res) => {
    try {
      const stats = db.getKnowledgeBaseStats();
      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Search the casebook (gold standard responses)
  app.post('/api/v1/casebook/search', apiKeyAuth('knowledge'), (req, res) => {
    try {
      const { terms, limit } = req.body;
      if (!terms) return res.status(400).json({ error: 'terms is required' });
      const results = db.searchCasebook(terms, limit || 5);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // MEMORY & CONTEXT
  // ============================================

  // Get memory facts
  app.get('/api/v1/memory/facts', apiKeyAuth('memory'), (req, res) => {
    try {
      const category = req.query.category || null;
      const facts = memory.getRelevantFacts(category || 'general');
      res.json({ success: true, facts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Store a new memory fact
  app.post('/api/v1/memory/facts', apiKeyAuth('memory'), (req, res) => {
    try {
      const { category, fact, source } = req.body;
      if (!fact) return res.status(400).json({ error: 'fact is required' });
      memory.storeFact(category || 'general', fact, source || 'external-api');
      res.json({ success: true, message: 'Fact stored' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user context
  app.get('/api/v1/memory/context', apiKeyAuth('memory'), (req, res) => {
    try {
      const ctx = memory.getUserContext(req.query.user_id || `api_${req.apiKey.prefix}`);
      res.json({ success: true, context: ctx });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // WEBHOOKS (Inbound)
  // ============================================

  // Universal inbound webhook - accepts events from external platforms
  app.post('/api/v1/webhook/incoming', apiKeyAuth('webhooks'), async (req, res) => {
    try {
      const { event, source, data } = req.body;
      if (!event || !data) {
        return res.status(400).json({ error: 'event and data are required' });
      }

      let result = { processed: true, action: 'logged' };

      // Route events to appropriate handlers
      switch (event) {
        case 'ticket.created':
        case 'ticket.updated': {
          // Auto-triage incoming ticket
          if (data.subject && data.description) {
            const analysis = await ai.analyzeTicket(data);
            result = {
              processed: true,
              action: 'triaged',
              triage: {
                escalation_type: analysis.escalation_type,
                urgency_score: analysis.urgency_score,
                summary: analysis.summary
              }
            };
          }
          break;
        }

        case 'message.received': {
          // Process incoming message
          if (data.message) {
            const response = await ai.chat([
              { role: 'system', content: 'You are the LIV8 Command Center assistant. Respond helpfully and concisely.' },
              { role: 'user', content: data.message }
            ]);
            result = { processed: true, action: 'responded', response };
          }
          break;
        }

        case 'task.completed':
        case 'task.created': {
          // Store as memory fact
          memory.storeFact('tasks', `${event}: ${data.title || data.name || JSON.stringify(data)}`, source || 'webhook');
          result = { processed: true, action: 'stored' };
          break;
        }

        default: {
          // Store unhandled events as memory for learning
          memory.storeFact('webhook_events', `${source || 'unknown'}: ${event} - ${JSON.stringify(data).substring(0, 200)}`, source || 'webhook');
          result = { processed: true, action: 'logged' };
        }
      }

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // SYSTEM STATUS
  // ============================================

  // Health check (authenticated)
  app.get('/api/v1/status', apiKeyAuth(), (req, res) => {
    try {
      const providerInfo = ai.getCurrentProvider();
      const ragStats = rag.getRAGStats();
      const pipelineStatus = pipeline.getPipelineStatus();

      let dbStats = { tickets: 0, analyses: 0, knowledge: 0, drafts: 0 };
      try {
        dbStats = {
          tickets: db.getTicketsByStatus([2, 3, 4, 5, 6, 7]).length,
          analyses: Object.keys(db.getAllAnalysisMap()).length,
          knowledge: db.getKnowledgeBaseStats().total,
          drafts: db.getDraftStats()
        };
      } catch (e) {}

      res.json({
        success: true,
        status: 'operational',
        service: 'LIV8 Command Center API v1',
        ai: {
          provider: providerInfo.provider,
          model: providerInfo.model,
          available: providerInfo.available
        },
        rag: ragStats,
        pipeline: pipelineStatus,
        database: dbStats,
        api_key: {
          name: req.apiKey.name,
          scopes: req.apiKey.scopes
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

export default { registerExternalApiRoutes };
