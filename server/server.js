/**
 * LIV8 Command Center - AI Server v2.0
 *
 * Features:
 * - Multi-model support (Claude + GPT)
 * - SQLite database for persistence
 * - Scheduled ticket polling (8 AM, 12 PM, 4 PM, 12 AM EST)
 * - LangChain RAG for intelligent assistance
 * - n8n webhook integration for notifications
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Local modules
import * as db from './lib/database.js';
import * as ai from './lib/ai-provider.js';
import * as scheduler from './lib/scheduler.js';
import * as rag from './lib/langchain-rag.js';
import * as knowledgeBuilder from './lib/knowledge-builder.js';
import * as calendarService from './lib/calendar-service.js';
import * as newsService from './lib/news-service.js';
import * as memory from './lib/conversation-memory.js';
import * as integrations from './lib/integrations.js';
import * as agentKnowledge from './lib/agent-knowledge.js';
import * as contentIngestion from './lib/content-ingestion.js';
import * as orchestrator from './lib/agent-orchestrator.js';
import { registerNiftyRoutes } from './routes/nifty-routes.js';
import { taskmagicMCP } from './lib/taskmagic-mcp.js';
import { unifiedTasks } from './lib/unified-tasks.js';
import * as githubPortfolio from './lib/github-portfolio.js';
import { marketData } from './lib/market-data.js';
import * as taskSync from './lib/task-sync-service.js';
import * as briefing from './lib/proactive-briefing.js';
import * as unifiedInbox from './lib/unified-inbox.js';
import * as proactiveEngine from './lib/proactive-ai-engine.js';
import * as eventBus from './lib/cross-platform-event-bus.js';
import * as workflowOrchestrator from './lib/unified-workflow-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3005;

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow all file types
    cb(null, true);
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================
// INITIALIZATION
// ============================================

// Initialize database
console.log('\nInitializing LIV8 Command Center v2.0...\n');

try {
  db.initDatabase();
  memory.initConversationTables();
  agentKnowledge.initAgentKnowledge();
  taskSync.initSyncTables();
  briefing.initBriefingTables();
  unifiedInbox.initUnifiedInboxTables();
  console.log('Database: Initialized');
  console.log('Conversation Memory: Initialized');
  console.log('Task Sync: Initialized');
  console.log('Proactive Briefing: Initialized');
  console.log('Unified Inbox: Initialized');
} catch (e) {
  console.error('Database initialization failed:', e.message);
}

// Initialize AI providers
const aiStatus = ai.initAIProviders({
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  openaiKey: process.env.OPENAI_API_KEY,
  geminiKey: process.env.GEMINI_API_KEY,
  provider: process.env.AI_PROVIDER || 'gemini'
});
console.log('AI Providers:', aiStatus);

// Initialize LangChain
const langchainStatus = rag.initLangChain({
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  openaiKey: process.env.OPENAI_API_KEY
});
console.log('LangChain RAG:', langchainStatus);

// Initialize scheduler with TaskMagic webhook
scheduler.initScheduler({
  freshdeskDomain: process.env.FRESHDESK_DOMAIN,
  freshdeskApiKey: process.env.FRESHDESK_API_KEY,
  freshdeskAgentId: process.env.FRESHDESK_AGENT_ID,
  n8nWebhookUrl: process.env.TASKMAGIC_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL
});

// Initialize calendar service
calendarService.initCalendarService({
  email: process.env.GOOGLE_CALENDAR_EMAIL
});
console.log('Calendar: Initialized for', process.env.GOOGLE_CALENDAR_EMAIL || 'not configured');

// Start scheduled jobs if enabled
const scheduleEnabled = process.env.SCHEDULE_ENABLED === 'true';
if (scheduleEnabled) {
  scheduler.startScheduledJobs(true);
} else {
  console.log('Scheduled jobs: Disabled (set SCHEDULE_ENABLED=true to enable)');
}

// Initialize Proactive AI Engine
const proactiveEnabled = process.env.PROACTIVE_AI_ENABLED !== 'false';
if (proactiveEnabled) {
  proactiveEngine.initProactiveEngine({
    checkIntervalMinutes: parseInt(process.env.PROACTIVE_CHECK_INTERVAL) || 5,
    enableAutoActions: process.env.PROACTIVE_AUTO_ACTIONS !== 'false'
  });
  console.log('Proactive AI Engine: Enabled');
} else {
  console.log('Proactive AI Engine: Disabled (set PROACTIVE_AI_ENABLED=true to enable)');
}

// Initialize Cross-Platform Event Bus
eventBus.initializeDefaultChains();
console.log('Cross-Platform Event Bus: Initialized');

// Initialize Workflow Orchestrator
workflowOrchestrator.initWorkflowOrchestrator();
console.log('Workflow Orchestrator: Initialized');

// ============================================
// HEALTH & STATUS ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
  const providerInfo = ai.getCurrentProvider();
  const ragStats = rag.getRAGStats();
  const scheduleStatus = scheduler.getScheduleStatus();
  let dbStats = { tickets: 0, analyses: 0, knowledge: 0 };

  try {
    dbStats = {
      tickets: db.getTicketsByStatus([2, 3, 4, 5, 6, 7]).length,
      analyses: Object.keys(db.getAllAnalysisMap()).length,
      knowledge: db.getKnowledgeBaseStats().total
    };
  } catch (e) {}

  res.json({
    status: 'ok',
    service: 'LIV8 AI Server v2.0',
    ai: {
      provider: providerInfo.provider,
      model: providerInfo.model,
      available: providerInfo.available
    },
    rag: ragStats,
    schedule: scheduleStatus,
    database: dbStats
  });
});

// ============================================
// AI PROVIDER ENDPOINTS
// ============================================

// Get current AI provider info
app.get('/api/ai/provider', (req, res) => {
  res.json(ai.getCurrentProvider());
});

// Switch AI provider
app.post('/api/ai/switch', (req, res) => {
  try {
    const { provider, model } = req.body;
    const result = ai.switchProvider(provider, model);
    rag.switchLangChainModel(provider);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update API key
app.post('/api/ai/key', (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    const success = ai.updateApiKey(provider, apiKey);

    if (success) {
      // Re-initialize LangChain with new key
      if (provider === 'claude' || provider === 'anthropic') {
        rag.initLangChain({ anthropicKey: apiKey });
      } else if (provider === 'openai' || provider === 'gpt') {
        rag.initLangChain({ openaiKey: apiKey });
      }
    }

    res.json({ success });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// TICKET ANALYSIS ENDPOINTS
// ============================================

// Analyze ticket
app.post('/api/analyze-ticket', async (req, res) => {
  try {
    const { subject, description, priority, status, ticketId } = req.body;

    const analysis = await ai.analyzeTicket({
      subject,
      description,
      priority,
      status
    });

    // Store in database
    if (ticketId) {
      try {
        db.saveAnalysis(ticketId, analysis, analysis.provider, analysis.model);
      } catch (e) {}
    }

    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate response
app.post('/api/generate-response', async (req, res) => {
  try {
    const {
      subject,
      description,
      requesterName,
      agentName,
      ticketType,
      ticketId,
      analysis
    } = req.body;

    // Find similar tickets from RAG
    const query = `${subject} ${description || ''}`;
    const similarDocs = rag.searchSimilar(query, 3);

    const result = await ai.generateResponse({
      subject,
      description,
      requester: { name: requesterName }
    }, {
      agentName,
      ticketType,
      analysis,
      similarTickets: similarDocs.map(d => ({
        id: d.metadata?.ticketId,
        subject: d.metadata?.subject,
        score: d.score,
        keywords: []
      }))
    });

    // Store generated response
    if (ticketId) {
      try {
        db.saveGeneratedResponse(
          ticketId,
          result.response,
          similarDocs,
          [],
          result.provider,
          result.model
        );
      } catch (e) {}
    }

    res.json({
      response: result.response,
      similarTickets: similarDocs.map(d => ({
        id: d.metadata?.ticketId,
        subject: d.metadata?.subject,
        matchScore: Math.round(d.score * 100)
      })),
      provider: result.provider,
      model: result.model
    });
  } catch (error) {
    console.error('Generate response error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proactive analysis
app.post('/api/proactive-analysis', async (req, res) => {
  try {
    const { tickets, agentName } = req.body;
    const analysis = await ai.proactiveAnalysis(tickets, { agentName });
    res.json(analysis);
  } catch (error) {
    console.error('Proactive analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// General chat with memory
app.post('/api/chat', async (req, res) => {
  try {
    const { message, systemPrompt, context, agentId, userId, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation
    const convId = conversationId || memory.getActiveConversation(userId || 'default');

    // Get conversation history and memory context
    const history = memory.getConversationHistory(convId, 10);
    const memoryContext = memory.buildMemoryContext(userId || 'default', message);

    // Build messages array with history
    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const defaultSystemPrompt = `You are a helpful AI assistant for the LIV8 Command Center. You help manage businesses, support tickets, projects, and tasks. You have access to Taskade, TaskMagic, GoHighLevel, and Supabase integrations.

You remember things about the user and their preferences. Use the context below to personalize your responses.

${memoryContext}

Be concise, professional, and helpful. If the user asks you to remember something, acknowledge that you will remember it.`;

    // Store user message
    memory.addMessage(convId, 'user', message, { agentId, context });

    const result = await ai.chat(messages, {
      systemPrompt: systemPrompt || defaultSystemPrompt,
      agentId
    });

    // Store assistant response
    memory.addMessage(convId, 'assistant', result.text, {
      provider: result.provider,
      model: result.model
    });

    res.json({
      response: result.text,
      provider: result.provider,
      model: result.model,
      conversationId: convId,
      context
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DATABASE ENDPOINTS
// ============================================

// Get all tickets with analysis
app.get('/api/tickets', (req, res) => {
  try {
    const statuses = req.query.statuses
      ? req.query.statuses.split(',').map(Number)
      : null;

    const tickets = db.getAllTicketsWithAnalysis(statuses);
    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store tickets from frontend
app.post('/api/tickets/sync', (req, res) => {
  try {
    const { tickets } = req.body;
    const count = db.upsertTickets(tickets);

    // Index resolved tickets to RAG
    const resolved = tickets.filter(t => t.status === 4 || t.status === 5);
    for (const ticket of resolved) {
      rag.indexTicketForRAG(ticket);
    }

    res.json({ success: true, synced: count, indexed: resolved.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all cached analyses
app.get('/api/analyses', (req, res) => {
  try {
    const analyses = db.getAllAnalysisMap();
    res.json({ analyses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get analysis for specific ticket
app.get('/api/analysis/:ticketId', (req, res) => {
  try {
    const analysis = db.getLatestAnalysis(parseInt(req.params.ticketId));
    if (analysis) {
      res.json(analysis);
    } else {
      res.status(404).json({ error: 'Analysis not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest generated response for ticket
app.get('/api/response/:ticketId', (req, res) => {
  try {
    const response = db.getLatestResponse(parseInt(req.params.ticketId));
    if (response) {
      res.json(response);
    } else {
      res.status(404).json({ error: 'Response not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// KNOWLEDGE BASE ENDPOINTS
// ============================================

// Index tickets to knowledge base
app.post('/api/index-tickets', (req, res) => {
  try {
    const { tickets } = req.body;
    let indexed = 0;

    for (const ticket of tickets) {
      if (ticket.status === 4 || ticket.status === 5) {
        try {
          db.addToKnowledgeBase(ticket, '', extractKeywords(
            `${ticket.subject} ${ticket.description_text || ticket.description || ''}`
          ));
          rag.indexTicketForRAG(ticket);
          indexed++;
        } catch (e) {}
      }
    }

    res.json({
      success: true,
      indexed,
      totalInKnowledgeBase: db.getKnowledgeBaseStats().total,
      ragDocuments: rag.getRAGStats().totalDocuments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find similar tickets
app.post('/api/find-similar', (req, res) => {
  try {
    const { subject, description, ticketId, limit = 3 } = req.body;
    const query = `${subject} ${description || ''}`;

    // Use RAG for similarity search
    const similar = rag.searchSimilar(query, limit);

    res.json({
      keywords: extractKeywords(query),
      similar: similar.map(s => ({
        id: s.metadata?.ticketId,
        subject: s.metadata?.subject,
        matchScore: Math.round(s.score * 100),
        relevance: s.score
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Knowledge base stats
app.get('/api/knowledge-stats', (req, res) => {
  try {
    const dbStats = db.getKnowledgeBaseStats();
    const ragStats = rag.getRAGStats();

    res.json({
      ...dbStats,
      ragDocuments: ragStats.totalDocuments,
      models: ragStats.models
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ask knowledge base (RAG Q&A)
app.post('/api/knowledge/ask', async (req, res) => {
  try {
    const { question } = req.body;
    const answer = await rag.askKnowledgeBase(question);
    res.json(answer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SCHEDULER ENDPOINTS
// ============================================

// Get schedule status
app.get('/api/schedule/status', (req, res) => {
  res.json(scheduler.getScheduleStatus());
});

// Run manual analysis
app.post('/api/schedule/run', async (req, res) => {
  try {
    const result = await scheduler.runManualAnalysis();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent scheduled runs
app.get('/api/schedule/history', (req, res) => {
  try {
    const runs = db.getRecentRuns(20);
    res.json({ runs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle schedule
app.post('/api/schedule/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    if (enabled) {
      scheduler.startScheduledJobs(true);
    } else {
      scheduler.stopScheduledJobs();
    }
    res.json({ enabled, status: scheduler.getScheduleStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SETTINGS ENDPOINTS
// ============================================

// Get all settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.getAllSettings();
    const providerInfo = ai.getCurrentProvider();

    res.json({
      ...settings,
      ai_provider: providerInfo.provider,
      ai_model: providerInfo.model,
      ai_available: providerInfo.available
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update setting
app.post('/api/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    db.setSetting(key, value);
    res.json({ success: true, key, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update settings
app.post('/api/settings/bulk', (req, res) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      db.setSetting(key, String(value));
    }
    res.json({ success: true, updated: Object.keys(settings).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AGENT ENDPOINTS
// ============================================

// Run agent chain
app.post('/api/agents/chain', async (req, res) => {
  try {
    const { task, agents } = req.body;
    const result = await rag.runAgentChain(task, agents);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent history
app.get('/api/agents/:agentId/history', (req, res) => {
  try {
    const history = db.getAgentHistory(req.params.agentId);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// KNOWLEDGE BUILDER ENDPOINTS
// ============================================

// Build knowledge base from all historical tickets
app.post('/api/knowledge/build', async (req, res) => {
  try {
    const config = {
      domain: process.env.FRESHDESK_DOMAIN,
      apiKey: process.env.FRESHDESK_API_KEY,
      agentId: process.env.FRESHDESK_AGENT_ID
    };

    // Start building in background
    res.json({ status: 'started', message: 'Knowledge base build started. This may take several minutes.' });

    // Run async
    knowledgeBuilder.buildKnowledgeBase(config).then(result => {
      console.log('Knowledge base build complete:', result);
    }).catch(err => {
      console.error('Knowledge base build failed:', err);
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get knowledge base insights
app.get('/api/knowledge/insights', (req, res) => {
  try {
    const insights = knowledgeBuilder.getKnowledgeInsights();
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart search knowledge base
app.post('/api/knowledge/search', (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    const results = knowledgeBuilder.smartSearch(query, limit);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process a single resolved ticket for learning
app.post('/api/knowledge/learn', async (req, res) => {
  try {
    const { ticket } = req.body;
    const config = {
      domain: process.env.FRESHDESK_DOMAIN,
      apiKey: process.env.FRESHDESK_API_KEY
    };

    const summary = await knowledgeBuilder.processResolvedTicket(ticket, config);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ticket categories
app.get('/api/knowledge/categories', (req, res) => {
  res.json({ categories: knowledgeBuilder.TICKET_CATEGORIES });
});

// ============================================
// CALENDAR ENDPOINTS
// ============================================

// Fetch calendar events (requires OAuth token from frontend)
app.post('/api/calendar/fetch', async (req, res) => {
  try {
    const { accessToken, calendarId, maxResults, timeMin, timeMax } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token required. Please authenticate with Google.' });
    }

    const events = await calendarService.fetchCalendarEvents(accessToken, {
      calendarId,
      maxResults,
      timeMin,
      timeMax
    });

    res.json({ events: events.map(e => calendarService.formatEventForDisplay(e)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cached calendar events
app.get('/api/calendar/events', (req, res) => {
  try {
    const { upcoming, limit } = req.query;
    const events = calendarService.getCachedEvents({
      upcoming: upcoming !== 'false',
      limit: parseInt(limit) || 20
    });
    res.json({ events: events.map(e => calendarService.formatEventForDisplay(e)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get today's events
app.get('/api/calendar/today', (req, res) => {
  try {
    const events = calendarService.getTodaysEvents();
    res.json({ events: events.map(e => calendarService.formatEventForDisplay(e)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming events (next N hours)
app.get('/api/calendar/upcoming', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const events = calendarService.getUpcomingEvents(hours);
    res.json({ events: events.map(e => calendarService.formatEventForDisplay(e)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get events needing reminders
app.get('/api/calendar/reminders', (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 15;
    const events = calendarService.getEventsNeedingReminder(minutes);
    res.json({ events: events.map(e => calendarService.formatEventForDisplay(e)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get OAuth URL for Google Calendar
app.get('/api/calendar/oauth-url', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = req.query.redirect_uri || `${req.protocol}://${req.get('host')}/auth/google/callback`;

  if (!clientId) {
    return res.status(400).json({
      error: 'Google Client ID not configured',
      instructions: 'Add GOOGLE_CLIENT_ID to server/.env'
    });
  }

  const url = calendarService.getOAuthUrl(clientId, redirectUri);
  res.json({ url });
});

// ============================================
// NEWS ENDPOINTS
// ============================================

// Fetch financial news
app.get('/api/news/financial', async (req, res) => {
  try {
    const { topics, limit } = req.query;
    const topicList = topics ? topics.split(',') : ['NASDAQ', 'CRYPTO_BTC', 'CRYPTO_SOL'];

    const news = await newsService.fetchFinancialNews({
      topics: topicList,
      limit: parseInt(limit) || 20
    });

    res.json({ news });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cached financial news
app.get('/api/news/financial/cached', (req, res) => {
  try {
    const { limit, category } = req.query;
    const news = newsService.getCachedFinancialNews({
      limit: parseInt(limit) || 20,
      category
    });
    res.json({ news });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get personal updates (tickets, projects, agent activity)
app.get('/api/news/personal', (req, res) => {
  try {
    const { limit } = req.query;
    const updates = newsService.getPersonalUpdates({
      limit: parseInt(limit) || 20
    });
    res.json({ updates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get market summary (crypto prices)
app.get('/api/news/market', async (req, res) => {
  try {
    const summary = await newsService.getMarketSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all news topics
app.get('/api/news/topics', (req, res) => {
  res.json({ topics: newsService.FINANCIAL_TOPICS });
});

// ============================================
// MARKET DATA ENDPOINTS (RapidAPI + Benzinga)
// ============================================

// Get full market overview (crypto, movers, stats)
app.get('/api/market/overview', async (req, res) => {
  try {
    const overview = await marketData.getMarketOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get aggregated financial news from multiple sources
app.get('/api/market/news', async (req, res) => {
  try {
    const { topics, limit } = req.query;
    const news = await marketData.getFinancialNews(
      topics || 'NASDAQ,CRYPTO_BTC',
      parseInt(limit) || 20
    );
    res.json({ news });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get crypto stats from Coinranking
app.get('/api/market/crypto/stats', async (req, res) => {
  try {
    const stats = await marketData.getCryptoStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top coins from Coinranking
app.get('/api/market/crypto/coins', async (req, res) => {
  try {
    const { limit } = req.query;
    const coins = await marketData.getTopCoins(parseInt(limit) || 10);
    res.json({ coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Binance tickers
app.get('/api/market/crypto/binance', async (req, res) => {
  try {
    const { symbols } = req.query;
    const symbolList = symbols ? symbols.split(',') : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const tickers = await marketData.getBinanceTickers(symbolList);
    res.json({ tickers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stock quote
app.get('/api/market/stock/:symbol', async (req, res) => {
  try {
    const quote = await marketData.getStockQuote(req.params.symbol);
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get market movers from TradingView
app.get('/api/market/movers', async (req, res) => {
  try {
    const { exchange, type } = req.query;
    const movers = await marketData.getMarketMovers(
      exchange || 'US',
      type || 'volume_gainers'
    );
    res.json(movers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Benzinga news
app.get('/api/market/benzinga', async (req, res) => {
  try {
    const { tickers, limit } = req.query;
    const news = await marketData.getBenzingaNews(
      tickers || 'AAPL,TSLA,MSFT',
      parseInt(limit) || 20
    );
    res.json({ news });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get market data API status
app.get('/api/market/status', (req, res) => {
  res.json(marketData.getStatus());
});

// ============================================
// WEBHOOK ENDPOINTS (TaskMagic/n8n)
// ============================================

// Send notification via webhook
app.post('/api/webhook/notify', async (req, res) => {
  try {
    const webhookUrl = process.env.TASKMAGIC_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'No webhook URL configured' });
    }

    const { type, data } = req.body;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: type || 'notification',
        timestamp: new Date().toISOString(),
        source: 'LIV8 Command Center',
        ...data
      })
    });

    res.json({ success: response.ok, status: response.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test webhook connection
app.post('/api/webhook/test', async (req, res) => {
  try {
    const webhookUrl = req.body.url || process.env.TASKMAGIC_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'No webhook URL provided' });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'test',
        message: 'Test notification from LIV8 Command Center',
        timestamp: new Date().toISOString()
      })
    });

    res.json({
      success: response.ok,
      status: response.status,
      message: response.ok ? 'Webhook test successful!' : 'Webhook test failed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONVERSATION MEMORY ENDPOINTS
// ============================================

// Get conversation list
app.get('/api/conversations', (req, res) => {
  try {
    const { userId, limit } = req.query;
    const conversations = memory.getConversationList(userId || 'default', parseInt(limit) || 20);
    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation history
app.get('/api/conversations/:conversationId', (req, res) => {
  try {
    const { limit } = req.query;
    const messages = memory.getConversationHistory(req.params.conversationId, parseInt(limit) || 50);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new conversation
app.post('/api/conversations', (req, res) => {
  try {
    const { userId, title } = req.body;
    const id = memory.createConversation(userId || 'default', title);
    res.json({ id, title });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update conversation
app.put('/api/conversations/:conversationId', (req, res) => {
  try {
    const { title, summary } = req.body;
    memory.updateConversation(req.params.conversationId, { title, summary });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all remembered facts
app.get('/api/memory/facts', (req, res) => {
  try {
    const { category } = req.query;
    const facts = memory.getAllFacts(category);
    res.json({ facts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store a fact manually
app.post('/api/memory/facts', (req, res) => {
  try {
    const { category, fact, source } = req.body;
    memory.storeFact(category, fact, source || 'manual');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search facts relevant to query
app.post('/api/memory/search', (req, res) => {
  try {
    const { query, limit } = req.body;
    const facts = memory.getRelevantFacts(query, limit || 10);
    res.json({ facts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get/set user context
app.get('/api/memory/context', (req, res) => {
  try {
    const { key } = req.query;
    const context = memory.getUserContext(key);
    res.json({ context });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/context', (req, res) => {
  try {
    const { key, value, category } = req.body;
    memory.setUserContext(key, value, category);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a fact
app.delete('/api/memory/facts/:id', (req, res) => {
  try {
    const dbInstance = db.getDb();
    const stmt = dbInstance.prepare('DELETE FROM memory_facts WHERE id = ?');
    stmt.run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get memory summary (for dashboard)
app.get('/api/memory/summary', (req, res) => {
  try {
    const dbInstance = db.getDb();

    // Get fact counts by category
    const categoryStmt = dbInstance.prepare(`
      SELECT category, COUNT(*) as count
      FROM memory_facts
      GROUP BY category
    `);
    const categories = categoryStmt.all();

    // Get total facts
    const totalStmt = dbInstance.prepare('SELECT COUNT(*) as total FROM memory_facts');
    const total = totalStmt.get();

    // Get recent facts
    const recentStmt = dbInstance.prepare(`
      SELECT * FROM memory_facts
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const recent = recentStmt.all();

    // Get most referenced facts
    const topStmt = dbInstance.prepare(`
      SELECT * FROM memory_facts
      WHERE times_referenced > 0
      ORDER BY times_referenced DESC
      LIMIT 5
    `);
    const topReferenced = topStmt.all();

    res.json({
      total: total.total,
      byCategory: categories,
      recent,
      topReferenced
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// INTEGRATION ENDPOINTS
// ============================================

// Check all integration statuses
app.get('/api/integrations/status', async (req, res) => {
  try {
    const status = await integrations.checkIntegrationStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Store integration credential
app.post('/api/integrations/credential', (req, res) => {
  try {
    const { service, key, value } = req.body;
    integrations.setIntegrationCredential(service, key, value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TASKADE INTEGRATION ENDPOINTS
// ============================================

// Get Taskade workspaces
app.get('/api/taskade/workspaces', async (req, res) => {
  try {
    const result = await integrations.taskade.getWorkspaces();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Taskade folders
app.get('/api/taskade/workspaces/:workspaceId/folders', async (req, res) => {
  try {
    const result = await integrations.taskade.getFolders(req.params.workspaceId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Taskade projects from workspace (gets all folders and their projects)
app.get('/api/taskade/workspaces/:workspaceId/projects', async (req, res) => {
  try {
    const foldersResult = await integrations.taskade.getFolders(req.params.workspaceId);
    const folders = foldersResult.items || [];
    const allProjects = [];
    for (const folder of folders) {
      try {
        const projectsResult = await integrations.taskade.getProjects(folder.id);
        const projects = projectsResult.items || [];
        allProjects.push(...projects.map(p => ({ ...p, folderId: folder.id, folderName: folder.name })));
      } catch (e) {
        console.warn('Failed to get projects for folder:', folder.id);
      }
    }
    res.json({ items: allProjects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Taskade projects from folder
app.get('/api/taskade/folders/:folderId/projects', async (req, res) => {
  try {
    const result = await integrations.taskade.getProjects(req.params.folderId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Taskade project
app.get('/api/taskade/projects/:projectId', async (req, res) => {
  try {
    const result = await integrations.taskade.getProject(req.params.projectId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Taskade tasks
app.get('/api/taskade/projects/:projectId/tasks', async (req, res) => {
  try {
    const result = await integrations.taskade.getTasks(req.params.projectId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Taskade task
app.post('/api/taskade/projects/:projectId/tasks', async (req, res) => {
  try {
    const { content, placement, taskId } = req.body;
    const result = await integrations.taskade.createTask(req.params.projectId, content, { placement, taskId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete Taskade task
app.post('/api/taskade/projects/:projectId/tasks/:taskId/complete', async (req, res) => {
  try {
    const result = await integrations.taskade.completeTask(req.params.projectId, req.params.taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Taskade task
app.put('/api/taskade/projects/:projectId/tasks/:taskId', async (req, res) => {
  try {
    const { content } = req.body;
    const result = await integrations.taskade.updateTask(req.params.projectId, req.params.taskId, content);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TASKMAGIC INTEGRATION ENDPOINTS
// ============================================

// Trigger TaskMagic automation
app.post('/api/taskmagic/automation', async (req, res) => {
  try {
    const { automationName, payload } = req.body;
    const result = await integrations.taskmagic.triggerAutomation(automationName, payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send TaskMagic notification
app.post('/api/taskmagic/notify', async (req, res) => {
  try {
    const { message, channel } = req.body;
    const result = await integrations.taskmagic.sendNotification(message, channel);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute TaskMagic task
app.post('/api/taskmagic/task', async (req, res) => {
  try {
    const { taskName, parameters } = req.body;
    const result = await integrations.taskmagic.executeTask(taskName, parameters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GOHIGHLEVEL (GHL) INTEGRATION ENDPOINTS
// ============================================

// Get GHL contacts
app.get('/api/ghl/contacts', async (req, res) => {
  try {
    const { query, limit } = req.query;
    const result = await integrations.ghl.getContacts(query, parseInt(limit) || 20);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get GHL contact
app.get('/api/ghl/contacts/:contactId', async (req, res) => {
  try {
    const result = await integrations.ghl.getContact(req.params.contactId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create GHL contact
app.post('/api/ghl/contacts', async (req, res) => {
  try {
    const result = await integrations.ghl.createContact(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update GHL contact
app.put('/api/ghl/contacts/:contactId', async (req, res) => {
  try {
    const result = await integrations.ghl.updateContact(req.params.contactId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add tag to GHL contact
app.post('/api/ghl/contacts/:contactId/tags', async (req, res) => {
  try {
    const { tag } = req.body;
    const result = await integrations.ghl.addTag(req.params.contactId, tag);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get GHL pipelines
app.get('/api/ghl/pipelines', async (req, res) => {
  try {
    const result = await integrations.ghl.getPipelines();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get GHL opportunities
app.get('/api/ghl/opportunities', async (req, res) => {
  try {
    const { pipelineId } = req.query;
    const result = await integrations.ghl.getOpportunities(pipelineId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create GHL opportunity
app.post('/api/ghl/opportunities', async (req, res) => {
  try {
    const { pipelineId, stageId, contactId, ...data } = req.body;
    const result = await integrations.ghl.createOpportunity(pipelineId, stageId, contactId, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get GHL calendars
app.get('/api/ghl/calendars', async (req, res) => {
  try {
    const result = await integrations.ghl.getCalendars();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send GHL SMS
app.post('/api/ghl/sms', async (req, res) => {
  try {
    const { contactId, message } = req.body;
    const result = await integrations.ghl.sendSMS(contactId, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send GHL Email
app.post('/api/ghl/email', async (req, res) => {
  try {
    const { contactId, subject, body } = req.body;
    const result = await integrations.ghl.sendEmail(contactId, subject, body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get GHL workflows
app.get('/api/ghl/workflows', async (req, res) => {
  try {
    const result = await integrations.ghl.getWorkflows();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add contact to GHL workflow
app.post('/api/ghl/workflows/:workflowId/contacts', async (req, res) => {
  try {
    const { contactId } = req.body;
    const result = await integrations.ghl.addToWorkflow(req.params.workflowId, contactId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUPABASE INTEGRATION ENDPOINTS
// ============================================

// Query Supabase table
app.post('/api/supabase/query', async (req, res) => {
  try {
    const { table, columns, filter, order, limit } = req.body;
    const result = await integrations.supabase.select(table, { columns, filter, order, limit });
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Insert into Supabase
app.post('/api/supabase/insert', async (req, res) => {
  try {
    const { table, data } = req.body;
    const result = await integrations.supabase.insert(table, data);
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Supabase records
app.post('/api/supabase/update', async (req, res) => {
  try {
    const { table, filter, data } = req.body;
    const result = await integrations.supabase.update(table, filter, data);
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Supabase records
app.post('/api/supabase/delete', async (req, res) => {
  try {
    const { table, filter } = req.body;
    const result = await integrations.supabase.delete(table, filter);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Call Supabase RPC function
app.post('/api/supabase/rpc', async (req, res) => {
  try {
    const { functionName, params } = req.body;
    const result = await integrations.supabase.rpc(functionName, params);
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractKeywords(text) {
  if (!text) return [];

  const importantTerms = [
    'port', 'porting', 'loa', 'number', 'phone', 'twilio', 'lc phone',
    'workflow', 'automation', 'trigger', 'action', 'email', 'smtp',
    'calendar', 'appointment', 'booking', 'funnel', 'landing page',
    'sms', 'text', 'message', 'campaign', 'broadcast', 'pipeline',
    'opportunity', 'contact', 'lead', 'tag', 'custom field',
    'integration', 'api', 'webhook', 'zapier', 'stripe', 'payment',
    'invoice', 'subscription', 'billing', 'cancel', 'refund',
    'login', 'password', 'access', '2fa', 'mfa', 'authentication',
    'whitelabel', 'white label', 'domain', 'dns', 'ssl', 'cname',
    'cnam', 'caller id', 'call tracking', 'missed call',
    'error', 'bug', 'issue', 'not working', 'broken', 'failed'
  ];

  const lowerText = text.toLowerCase();
  const foundTerms = importantTerms.filter(term => lowerText.includes(term));

  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'would', 'could', 'there', 'their', 'will', 'when', 'who', 'make', 'like', 'time', 'just', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'this', 'that', 'with', 'from', 'they', 'what', 'about', 'which', 'get', 'help', 'please', 'thanks', 'thank', 'hello', 'here']);

  const words = lowerText.match(/\b[a-z]{3,}\b/g) || [];
  const significantWords = words
    .filter(w => w.length > 3 && !stopWords.has(w))
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

  const topWords = Object.entries(significantWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return [...new Set([...foundTerms, ...topWords])];
}

// ============================================
// FULL CONTEXT CHAT ENDPOINT
// ============================================

// Chat with full app context (tickets, analyses, agents, etc.)
app.post('/api/commander/chat', async (req, res) => {
  try {
    const { message, includeTickets, includeAnalyses } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Gather full context
    let context = '';

    // Get all cached tickets with analyses
    const ticketsWithAnalysis = db.getAllTicketsWithAnalysis();
    const tickets = ticketsWithAnalysis.map(t => t.ticket ? JSON.parse(t.ticket) : t);
    const analysisMap = db.getAllAnalysisMap();

    if (tickets.length > 0) {
      context += `\n\n=== CURRENT SUPPORT TICKETS (${tickets.length} total) ===\n`;

      // Group by status
      const statusGroups = {
        'Open': tickets.filter(t => t.status === 2),
        'Pending': tickets.filter(t => t.status === 3),
        'Waiting on Customer': tickets.filter(t => t.status === 6),
        'On Hold': tickets.filter(t => t.status === 7),
        'Resolved': tickets.filter(t => t.status === 4)
      };

      for (const [status, group] of Object.entries(statusGroups)) {
        if (group.length > 0) {
          context += `\n${status} (${group.length}):\n`;
          for (const ticket of group) {
            const analysis = analysisMap[String(ticket.id)];
            context += `  - #${ticket.id}: ${ticket.subject}\n`;
            context += `    Requester: ${ticket.requester?.name || 'Unknown'}\n`;
            context += `    Priority: ${['Low', 'Medium', 'High', 'Urgent'][ticket.priority - 1] || 'Unknown'}\n`;
            if (analysis) {
              const parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
              context += `    AI Analysis: ${parsed.ESCALATION_TYPE || 'SUPPORT'} - Urgency ${parsed.URGENCY_SCORE || 5}/10\n`;
              context += `    Issue: ${parsed.ISSUE_CATEGORY || 'General'}\n`;
              if (parsed.ROOT_CAUSE) context += `    Root Cause: ${parsed.ROOT_CAUSE}\n`;
            }
            if (ticket.custom_fields) {
              const cf = ticket.custom_fields;
              if (cf.cf_relationship_id) context += `    Relationship ID: ${cf.cf_relationship_id}\n`;
              if (cf.cf_location_id) context += `    Location ID: ${cf.cf_location_id}\n`;
            }
          }
        }
      }

      // Summary stats
      let urgentCount = 0;
      let escalationCount = 0;
      for (const [ticketId, analysis] of Object.entries(analysisMap)) {
        const p = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
        if (p?.URGENCY_SCORE >= 8) urgentCount++;
        if (['DEV', 'TWILIO', 'BUG'].includes(p?.ESCALATION_TYPE)) escalationCount++;
      }

      context += `\n=== TICKET SUMMARY ===\n`;
      context += `Total Active: ${tickets.filter(t => [2,3,6,7].includes(t.status)).length}\n`;
      context += `Urgent (8+ urgency): ${urgentCount}\n`;
      context += `Needs Escalation: ${escalationCount}\n`;
    }

    // Get AI agents
    const agents = agentKnowledge.getAllAgents();
    context += `\n=== AI AGENTS AVAILABLE (${agents.length}) ===\n`;
    for (const agent of agents.filter(a => a.id !== 'orchestrator')) {
      const stats = agentKnowledge.getKnowledgeStats(agent.id);
      context += `- ${agent.name}: ${agent.specialization} (${stats.total} knowledge items)\n`;
    }

    // System prompt for commander with full context
    const systemPrompt = `You are the LIV8 Command Center AI - a powerful executive assistant with FULL ACCESS to the user's business systems.

You have access to:
1. All support tickets and AI analyses
2. All AI agents and their knowledge bases
3. System integrations (Freshdesk, GoHighLevel, Taskade, etc.)

Your capabilities:
- Summarize tickets into actionable execution plans
- Identify urgent issues and priorities
- Route tasks to the right AI agents
- Provide strategic recommendations

Current App Context:
${context}

Be concise, actionable, and executive-focused. When creating plans, use clear formatting with priorities and owners.`;

    // Generate response
    const response = await ai.chat([{ role: 'user', content: message }], {
      systemPrompt,
      maxTokens: 2000
    });

    res.json({
      response: response.text,
      context: {
        ticketCount: tickets.length,
        analysisCount: Object.keys(analysisMap).length,
        agentCount: agents.length
      }
    });

  } catch (error) {
    console.error('Commander chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get execution plan from tickets
app.get('/api/commander/execution-plan', async (req, res) => {
  try {
    // Use correct database functions
    const ticketsWithAnalysis = db.getAllTicketsWithAnalysis();
    const tickets = ticketsWithAnalysis.map(t => t.ticket ? JSON.parse(t.ticket) : t);
    const analysisMap = db.getAllAnalysisMap();

    // Build context
    let ticketContext = '';
    const activeTickets = tickets.filter(t => [2, 3, 6, 7].includes(t.status));

    for (const ticket of activeTickets) {
      const analysis = analysisMap[String(ticket.id)];
      const parsed = analysis ? (typeof analysis === 'string' ? JSON.parse(analysis) : analysis) : null;

      ticketContext += `\nTicket #${ticket.id}: ${ticket.subject}
  Status: ${['Open', 'Pending', 'Waiting', 'On Hold'][ticket.status - 2] || 'Unknown'}
  Priority: ${['Low', 'Medium', 'High', 'Urgent'][ticket.priority - 1] || 'Unknown'}
  Requester: ${ticket.requester?.name || 'Unknown'}
  Created: ${ticket.created_at}`;

      if (parsed) {
        ticketContext += `
  AI Analysis:
    - Category: ${parsed.ISSUE_CATEGORY || 'General'}
    - Urgency: ${parsed.URGENCY_SCORE || 5}/10
    - Escalation: ${parsed.ESCALATION_TYPE || 'SUPPORT'}
    - Root Cause: ${parsed.ROOT_CAUSE || 'Unknown'}
    - Recommended Action: ${parsed.RECOMMENDED_ACTION || 'Review and respond'}`;
      }
      ticketContext += '\n';
    }

    const prompt = `Based on the following ${activeTickets.length} support tickets, create a ONE-PAGE EXECUTION PLAN.

${ticketContext}

Create a structured execution plan with:

1. **IMMEDIATE PRIORITIES** (Do Today)
   - List tickets that need immediate attention (urgency 8+, escalations)
   - Include ticket # and specific action needed

2. **SHORT-TERM ACTIONS** (This Week)
   - Group similar issues together
   - Identify patterns and batch solutions

3. **PROCESS IMPROVEMENTS**
   - Recurring issues that need systemic fixes
   - Knowledge base articles to create

4. **DELEGATION MATRIX**
   - What can be handled by AI agents
   - What needs human escalation

Format as a clean, actionable executive summary.`;

    const response = await ai.chat([{ role: 'user', content: prompt }], {
      systemPrompt: 'You are an executive operations consultant creating actionable execution plans. Be concise and prioritize ruthlessly.',
      maxTokens: 2000
    });

    res.json({
      plan: response.text,
      ticketCount: activeTickets.length,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Execution plan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AGENT MANAGEMENT ENDPOINTS
// ============================================

// Get all agents
app.get('/api/agents', (req, res) => {
  try {
    const agents = agentKnowledge.getAllAgents();
    res.json({ agents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single agent
app.get('/api/agents/:agentId', (req, res) => {
  try {
    const agent = agentKnowledge.getAgent(req.params.agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const stats = agentKnowledge.getKnowledgeStats(req.params.agentId);
    res.json({ agent, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new agent
app.post('/api/agents', (req, res) => {
  try {
    const agent = agentKnowledge.createAgent(req.body);
    res.json({ agent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update agent
app.put('/api/agents/:agentId', (req, res) => {
  try {
    const agent = agentKnowledge.updateAgent(req.params.agentId, req.body);
    res.json({ agent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete agent
app.delete('/api/agents/:agentId', (req, res) => {
  try {
    agentKnowledge.deleteAgent(req.params.agentId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// AGENT KNOWLEDGE BASE ENDPOINTS
// ============================================

// Get agent's knowledge entries
app.get('/api/agents/:agentId/knowledge', (req, res) => {
  try {
    const { type } = req.query;
    const entries = agentKnowledge.getAgentKnowledge(req.params.agentId, type || null);
    const stats = agentKnowledge.getKnowledgeStats(req.params.agentId);
    res.json({ entries, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add URL to agent's knowledge
app.post('/api/agents/:agentId/knowledge/url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const content = await contentIngestion.extractUrlContent(url);
    const entry = agentKnowledge.addKnowledge(req.params.agentId, content);

    res.json({ success: true, entry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add multiple URLs to agent's knowledge
app.post('/api/agents/:agentId/knowledge/urls', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs array is required' });
    }

    const results = await contentIngestion.batchIngestUrls(urls);
    const entries = [];

    for (const result of results) {
      if (result.success) {
        const entry = agentKnowledge.addKnowledge(req.params.agentId, result.content);
        entries.push(entry);
      }
    }

    res.json({
      success: true,
      total: urls.length,
      ingested: entries.length,
      entries,
      errors: results.filter(r => !r.success).map(r => ({ url: r.url, error: r.error }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add text snippet to agent's knowledge
app.post('/api/agents/:agentId/knowledge/text', (req, res) => {
  try {
    const { title, content, metadata } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const processed = contentIngestion.processTextSnippet(title, content, metadata);
    const entry = agentKnowledge.addKnowledge(req.params.agentId, processed);

    res.json({ success: true, entry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file to agent's knowledge
app.post('/api/agents/:agentId/knowledge/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const parsed = await contentIngestion.handleFileUpload(req.file, req.params.agentId);
    const entry = agentKnowledge.addKnowledge(req.params.agentId, parsed);

    res.json({ success: true, entry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload multiple files
app.post('/api/agents/:agentId/knowledge/uploads', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Files are required' });
    }

    const entries = [];
    for (const file of req.files) {
      try {
        const parsed = await contentIngestion.handleFileUpload(file, req.params.agentId);
        const entry = agentKnowledge.addKnowledge(req.params.agentId, parsed);
        entries.push(entry);
      } catch (e) {
        console.error(`Failed to process ${file.originalname}:`, e.message);
      }
    }

    res.json({
      success: true,
      total: req.files.length,
      processed: entries.length,
      entries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search agent's knowledge
app.post('/api/agents/:agentId/knowledge/search', (req, res) => {
  try {
    const { query, limit } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = agentKnowledge.searchAgentKnowledge(req.params.agentId, query, limit || 10);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete knowledge entry
app.delete('/api/knowledge/:entryId', (req, res) => {
  try {
    agentKnowledge.deleteKnowledge(req.params.entryId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ORCHESTRATOR & CHAT ENDPOINTS
// ============================================

// Orchestrated chat (auto-routes to best agent)
app.post('/api/orchestrator/chat', async (req, res) => {
  try {
    const { message, conversationId, userId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await orchestrator.orchestrate(message, conversationId, userId || 'default');
    res.json(result);
  } catch (error) {
    console.error('Orchestrator error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Direct chat with specific agent
app.post('/api/agents/:agentId/chat', async (req, res) => {
  try {
    const { message, conversationId, userId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await orchestrator.chatWithAgent(
      req.params.agentId,
      message,
      conversationId,
      userId || 'default'
    );
    res.json(result);
  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route a message (just get routing info, don't execute)
app.post('/api/orchestrator/route', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const routing = await orchestrator.aiRouteRequest(message);
    res.json({ routing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AGENT CONVERSATION ENDPOINTS
// ============================================

// Get conversations
app.get('/api/agent-conversations', (req, res) => {
  try {
    const { userId, limit } = req.query;
    const conversations = agentKnowledge.getConversations(userId || 'default', parseInt(limit) || 20);
    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation with messages
app.get('/api/agent-conversations/:conversationId', (req, res) => {
  try {
    const conversation = agentKnowledge.getConversation(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = agentKnowledge.getMessages(req.params.conversationId);
    res.json({ conversation, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new conversation
app.post('/api/agent-conversations', (req, res) => {
  try {
    const { userId, title, participants } = req.body;
    const id = agentKnowledge.createConversation(userId || 'default', title, participants || []);
    res.json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ============================================
// PORTFOLIO - Live GitHub Sync
// ============================================

// Get full portfolio with live GitHub data
app.get('/api/portfolio', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const portfolio = await githubPortfolio.getPortfolio(forceRefresh);
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get quick stats for dashboard
app.get('/api/portfolio/stats', async (req, res) => {
  try {
    const stats = await githubPortfolio.getQuickStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force sync GitHub portfolio
app.post('/api/portfolio/sync', async (req, res) => {
  try {
    const portfolio = await githubPortfolio.syncGitHubPortfolio();
    res.json({
      success: true,
      repoCount: portfolio.repoCount,
      totalValue: portfolio.totals,
      lastSync: portfolio.lastSync
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// ============================================
// TASKMAGIC MCP - Full Bot Control
// ============================================

app.get('/api/taskmagic/mcp/status', async (req, res) => {
  try {
    const status = await taskmagicMCP.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/taskmagic/mcp/bots', async (req, res) => {
  try {
    const bots = await taskmagicMCP.getBots();
    res.json(bots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/taskmagic/mcp/bots/:botId/run', async (req, res) => {
  try {
    const { botId } = req.params;
    const result = await taskmagicMCP.runBot(botId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UNIFIED TASKS - Cross-Platform Sync
// ============================================

app.get('/api/unified/tasks', async (req, res) => {
  try {
    const tasks = await unifiedTasks.getAllTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/unified/projects', async (req, res) => {
  try {
    const projects = await unifiedTasks.getProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/unified/command', async (req, res) => {
  try {
    const { command, context } = req.body;
    const parsed = unifiedTasks.parseCommand(command);
    const result = await unifiedTasks.executeCommand(parsed, context || {});
    res.json({ parsed, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TASK SYNC - Bidirectional Platform Sync
// ============================================

// Get sync status overview
app.get('/api/sync/status', (req, res) => {
  try {
    const status = taskSync.getSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all sync configurations
app.get('/api/sync/configs', (req, res) => {
  try {
    const configs = taskSync.getSyncConfigs();
    res.json({ configs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create sync configuration between two projects
app.post('/api/sync/configs', (req, res) => {
  try {
    const result = taskSync.createSyncConfig(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sync history
app.get('/api/sync/history', (req, res) => {
  try {
    const { limit } = req.query;
    const history = taskSync.getSyncHistory(parseInt(limit) || 50);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Full project sync (one-time)
app.post('/api/sync/projects', async (req, res) => {
  try {
    const { sourcePlatform, sourceProjectId, targetPlatform, targetProjectId } = req.body;

    if (!sourcePlatform || !sourceProjectId || !targetPlatform || !targetProjectId) {
      return res.status(400).json({ error: 'All parameters required: sourcePlatform, sourceProjectId, targetPlatform, targetProjectId' });
    }

    const result = await taskSync.fullProjectSync(sourcePlatform, sourceProjectId, targetPlatform, targetProjectId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync task creation (called after creating a task)
app.post('/api/sync/task/create', async (req, res) => {
  try {
    const { platform, projectId, task } = req.body;
    const result = await taskSync.syncTaskCreate(platform, projectId, task);
    res.json({ synced: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync task completion
app.post('/api/sync/task/complete', async (req, res) => {
  try {
    const { platform, taskId } = req.body;
    const result = await taskSync.syncTaskComplete(platform, taskId);
    res.json({ synced: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync task update
app.post('/api/sync/task/update', async (req, res) => {
  try {
    const { platform, taskId, updates } = req.body;
    const result = await taskSync.syncTaskUpdate(platform, taskId, updates);
    res.json({ synced: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task mappings
app.get('/api/sync/mappings/:platform/:taskId', (req, res) => {
  try {
    const { platform, taskId } = req.params;
    const mappings = taskSync.getTaskMappings(platform, taskId);
    res.json({ mappings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual task mapping
app.post('/api/sync/mappings', (req, res) => {
  try {
    const result = taskSync.createTaskMapping(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROACTIVE BRIEFING & ADHD FEATURES
// ============================================

// Generate daily briefing
app.get('/api/briefing', async (req, res) => {
  try {
    const { type = 'morning' } = req.query;
    const result = await briefing.generateBriefing(type);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart Daily Report - Comprehensive ticket analysis
app.get('/api/briefing/smart-report', async (req, res) => {
  try {
    const report = await briefing.generateSmartDailyReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart Ticket Queue - Prioritized ticket view
app.get('/api/briefing/ticket-queue', (req, res) => {
  try {
    const queue = briefing.getSmartTicketQueue();
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Parking Lot - Quick capture
app.post('/api/parking-lot', (req, res) => {
  try {
    const { thought, context, priority } = req.body;
    const result = briefing.addToParkingLot(thought, context, priority);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/parking-lot', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const items = briefing.getParkingLotItems(parseInt(limit));
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parking-lot/:id/process', (req, res) => {
  try {
    const result = briefing.processParkingLotItem(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/parking-lot', (req, res) => {
  try {
    const result = briefing.clearParkingLot();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pomodoro Timer
app.post('/api/pomodoro/start', (req, res) => {
  try {
    const { taskDescription, taskId, duration = 25 } = req.body;
    const result = briefing.startPomodoro(taskDescription, taskId, duration);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pomodoro/end', (req, res) => {
  try {
    const { sessionId, completed = true } = req.body;
    const result = briefing.endPomodoro(sessionId, completed);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pomodoro/active', (req, res) => {
  try {
    const session = briefing.getActivePomodoro();
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pomodoro/interrupt', (req, res) => {
  try {
    const { sessionId } = req.body;
    const result = briefing.recordInterruption(sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Activity tracking - "What was I doing?"
app.post('/api/activity', (req, res) => {
  try {
    const { action, context, page } = req.body;
    briefing.logActivity(action, context, page);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/activity/recent', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const activities = briefing.getRecentActivity(parseInt(limit));
    res.json({ activities });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/activity/what-was-i-doing', (req, res) => {
  try {
    const summary = briefing.getWhatWasIDoing();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Automation Rules
app.post('/api/automation/rules', (req, res) => {
  try {
    const result = briefing.createAutomationRule(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/automation/rules', (req, res) => {
  try {
    const rules = briefing.getAutomationRules();
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calendar endpoints
app.get('/api/calendar/today', (req, res) => {
  try {
    const events = calendarService.getTodaysEvents();
    res.json({ events: events.map(calendarService.formatEventForDisplay) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calendar/summary', (req, res) => {
  try {
    const summary = calendarService.getCalendarSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calendar/free-time', (req, res) => {
  try {
    const freeBlocks = calendarService.getFreeTimeBlocks();
    res.json({ freeBlocks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UNIFIED INBOX ROUTES
// ============================================

// Get unified inbox items
app.get('/api/inbox', (req, res) => {
  try {
    const { limit, status, type } = req.query;
    const items = unifiedInbox.getInboxItems({
      limit: parseInt(limit) || 50,
      status: status || null,
      type: type || null
    });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread counts
app.get('/api/inbox/counts', (req, res) => {
  try {
    const counts = unifiedInbox.getUnreadCounts();
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add item to inbox
app.post('/api/inbox', (req, res) => {
  try {
    const result = unifiedInbox.addToInbox(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark item as read
app.post('/api/inbox/:id/read', (req, res) => {
  try {
    const { feedType } = req.body;
    const result = unifiedInbox.markAsRead(parseInt(req.params.id), feedType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Snooze item
app.post('/api/inbox/:id/snooze', (req, res) => {
  try {
    const { minutes } = req.body;
    const result = unifiedInbox.snoozeItem(parseInt(req.params.id), minutes || 60);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dismiss item
app.post('/api/inbox/:id/dismiss', (req, res) => {
  try {
    const { feedType } = req.body;
    const result = unifiedInbox.dismissItem(parseInt(req.params.id), feedType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add notification
app.post('/api/inbox/notification', (req, res) => {
  try {
    const result = unifiedInbox.addNotification(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh/sync inbox
app.post('/api/inbox/refresh', async (req, res) => {
  try {
    const result = await unifiedInbox.refreshInbox();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROACTIVE AI ENGINE ROUTES
// ============================================

// Get proactive engine state
app.get('/api/proactive/state', (req, res) => {
  try {
    const state = proactiveEngine.getProactiveState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual proactive check
app.post('/api/proactive/check', async (req, res) => {
  try {
    const result = await proactiveEngine.triggerProactiveCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get proactive action plan
app.get('/api/proactive/plan', async (req, res) => {
  try {
    const plan = await proactiveEngine.getProactiveActionPlan();
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute a specific AI suggestion
app.post('/api/proactive/execute-suggestion', async (req, res) => {
  try {
    const { suggestionIndex } = req.body;
    const result = await proactiveEngine.executeSuggestion(suggestionIndex);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start/stop proactive engine
app.post('/api/proactive/toggle', (req, res) => {
  try {
    const { enabled, checkIntervalMinutes } = req.body;
    if (enabled) {
      proactiveEngine.initProactiveEngine({ checkIntervalMinutes: checkIntervalMinutes || 5 });
    } else {
      proactiveEngine.stopProactiveEngine();
    }
    res.json({ enabled, status: proactiveEngine.getProactiveState() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear pending actions
app.post('/api/proactive/clear-actions', (req, res) => {
  try {
    proactiveEngine.clearPendingActions();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CROSS-PLATFORM EVENT BUS ROUTES
// ============================================

// Get event bus status
app.get('/api/events/status', (req, res) => {
  try {
    const status = eventBus.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get event history
app.get('/api/events/history', (req, res) => {
  try {
    const { eventType, platform, limit } = req.query;
    const history = eventBus.getEventHistory({
      eventType,
      platform,
      limit: parseInt(limit) || 50
    });
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Emit a manual event
app.post('/api/events/emit', async (req, res) => {
  try {
    const { event, data, source } = req.body;
    const result = await eventBus.emit(event, data, { source: source || 'api' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get registered chains
app.get('/api/events/chains', (req, res) => {
  try {
    const chains = eventBus.getChains();
    res.json({ chains });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle a chain
app.post('/api/events/chains/:chainId/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    const success = eventBus.toggleChain(req.params.chainId, enabled);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register a new chain
app.post('/api/events/chains', (req, res) => {
  try {
    const chainId = eventBus.registerChain(req.body);
    res.json({ chainId, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a chain
app.delete('/api/events/chains/:chainId', (req, res) => {
  try {
    eventBus.removeChain(req.params.chainId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for external platforms
app.post('/api/events/webhook/:platform', async (req, res) => {
  try {
    const result = await eventBus.handleWebhook(req.params.platform, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WORKFLOW ORCHESTRATOR ROUTES
// ============================================

// Get all workflow templates
app.get('/api/workflows/templates', (req, res) => {
  try {
    const templates = workflowOrchestrator.getWorkflowTemplates();
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute a workflow
app.post('/api/workflows/execute', async (req, res) => {
  try {
    const { templateId, inputs } = req.body;
    const result = await workflowOrchestrator.executeWorkflow(templateId, inputs || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a custom workflow
app.post('/api/workflows', (req, res) => {
  try {
    const workflow = workflowOrchestrator.createWorkflow(req.body);
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflow execution history
app.get('/api/workflows/history', (req, res) => {
  try {
    const { limit } = req.query;
    const history = workflowOrchestrator.getWorkflowHistory(parseInt(limit) || 20);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active workflows
app.get('/api/workflows/active', (req, res) => {
  try {
    const active = workflowOrchestrator.getActiveWorkflows();
    res.json({ active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get AI workflow suggestion
app.post('/api/workflows/suggest', async (req, res) => {
  try {
    const { description } = req.body;
    const suggestion = await workflowOrchestrator.suggestWorkflow(description);
    res.json(suggestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quick action: Create task everywhere
app.post('/api/workflows/quick/task-everywhere', async (req, res) => {
  try {
    const result = await workflowOrchestrator.createTaskEverywhere(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quick action: Complete task everywhere
app.post('/api/workflows/quick/complete-everywhere', async (req, res) => {
  try {
    const result = await workflowOrchestrator.completeTaskEverywhere(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UNIFIED COMMAND ENDPOINT
// ============================================

// Natural language command processor for cross-platform actions
app.post('/api/command', async (req, res) => {
  try {
    const { command, context } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Use AI to parse and route the command
    const prompt = `Parse this command and determine what action to take:

Command: "${command}"

Available actions:
1. create_task - Create a task (platforms: taskade, nifty, or both)
2. complete_task - Complete a task
3. sync_tasks - Sync tasks between platforms
4. trigger_workflow - Run a predefined workflow
5. search - Search across platforms
6. briefing - Get daily briefing
7. status - Check system status

Respond with JSON:
{
  "action": "action_name",
  "platforms": ["platform1", "platform2"],
  "params": { "key": "value" },
  "confidence": 0-100
}`;

    const response = await ai.chat([{ role: 'user', content: prompt }], {
      systemPrompt: 'You are a command parser. Return only valid JSON.',
      maxTokens: 500
    });

    let parsed;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      parsed = { action: 'unknown', confidence: 0 };
    }

    // Execute the parsed command
    let result;
    switch (parsed.action) {
      case 'create_task':
        if (parsed.platforms?.length > 1 || parsed.platforms?.includes('both')) {
          result = await workflowOrchestrator.createTaskEverywhere(parsed.params);
        } else {
          result = await unifiedTasks.createTask(
            parsed.platforms?.[0] || 'taskade',
            parsed.params?.projectId,
            parsed.params
          );
        }
        break;

      case 'sync_tasks':
        result = await taskSync.fullProjectSync(
          parsed.params?.sourcePlatform || 'taskade',
          parsed.params?.sourceProjectId,
          parsed.params?.targetPlatform || 'nifty',
          parsed.params?.targetProjectId
        );
        break;

      case 'trigger_workflow':
        result = await workflowOrchestrator.executeWorkflow(
          parsed.params?.workflowId || 'multi_platform_task',
          parsed.params
        );
        break;

      case 'briefing':
        result = await briefing.generateBriefing(parsed.params?.type || 'morning');
        break;

      case 'status':
        result = {
          proactive: proactiveEngine.getProactiveState(),
          events: eventBus.getStatus(),
          sync: taskSync.getSyncStatus()
        };
        break;

      default:
        result = { message: 'Command understood but not implemented', parsed };
    }

    res.json({
      command,
      parsed,
      result
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

// Register Nifty routes
registerNiftyRoutes(app);

app.listen(PORT, () => {
  const providerInfo = ai.getCurrentProvider();
  const scheduleStatus = scheduler.getScheduleStatus();

  console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║        LIV8 AI Server v2.0 Running on port ${PORT}              ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  AI Provider: ${(providerInfo.provider || 'none').padEnd(10)} Model: ${(providerInfo.model || 'none').substring(0, 25).padEnd(25)} ║
  ║  Claude: ${providerInfo.available.claude ? 'Ready' : 'Not configured'.padEnd(15)}  OpenAI: ${providerInfo.available.openai ? 'Ready' : 'Not configured'.padEnd(15)}       ║
  ║                                                               ║
  ║  Scheduled Polling: ${scheduleStatus.enabled ? 'ENABLED' : 'DISABLED'}                                  ║
  ║  Schedule: 8 AM, 12 PM, 4 PM, 12 AM EST                       ║
  ║                                                               ║
  ║  Endpoints:                                                   ║
  ║   POST /api/analyze-ticket      - Analyze support ticket      ║
  ║   POST /api/generate-response   - Generate ticket response    ║
  ║   POST /api/chat                - General AI chat             ║
  ║   GET  /api/tickets             - Get cached tickets          ║
  ║   GET  /api/analyses            - Get all cached analyses     ║
  ║   POST /api/ai/switch           - Switch AI provider          ║
  ║   POST /api/ai/key              - Update API key              ║
  ║   GET  /api/schedule/status     - Get schedule status         ║
  ║   POST /api/schedule/run        - Run manual analysis         ║
  ║   GET  /api/settings            - Get all settings            ║
  ║   GET  /health                  - Health check                ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
  `);

  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log('\n  WARNING: No AI API keys configured!');
    console.log('  Add ANTHROPIC_API_KEY or OPENAI_API_KEY to server/.env\n');
  }
});
