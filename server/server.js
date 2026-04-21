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
import * as streamRelay from './lib/stream-relay.js';
import * as telegram from './lib/telegram-bridge.js';
import { getTelegramPrompt } from './lib/system-prompt.js';
import { getVoicePrompt, getChatPrompt, getCommanderPrompt } from './lib/system-prompt.js';
import * as dailyReport from './lib/daily-report.js';
import * as emailService from './lib/email-service.js';
import * as orchestrator from './lib/agent-orchestrator.js';
import { registerNiftyRoutes } from './routes/nifty-routes.js';
import { registerScraperRoutes } from './routes/scraper-routes.js';
import * as scrapers from './lib/scrapers.js';
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
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import * as ttsService from './lib/tts-service.js';

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

// Guard for mutation endpoints that write secrets or server settings.
// Set ADMIN_TOKEN in the server environment and the client sends it as
// `X-Admin-Token` (or `Authorization: Bearer …`). If ADMIN_TOKEN is unset the
// server refuses to open these endpoints at all rather than silently allowing
// everyone, so a missing config fails closed.
function requireAdminToken(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return res.status(503).json({
      error: 'ADMIN_TOKEN not configured on server. Refusing to expose privileged endpoint.'
    });
  }
  const header = req.get('x-admin-token') || '';
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const provided = header || bearer;
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

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
  telegram.initTelegram();
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
  kimiKey: process.env.KIMI_API_KEY || process.env.NVIDIA_API_KEY,
  groqKey: process.env.GROQ_API_KEY,
  provider: process.env.AI_PROVIDER || 'gemini'
});
console.log('AI Providers:', aiStatus);

// Initialize Scrapers (RapidAPI + Apify)
const scraperStatus = scrapers.initScrapers({
  rapidApiKey: process.env.RAPIDAPI_KEY,
  apifyApiKey: process.env.APIFY_API_KEY
});
console.log('Scrapers:', scraperStatus);

// Initialize LangChain
const langchainStatus = rag.initLangChain({
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  openaiKey: process.env.OPENAI_API_KEY
});
console.log('LangChain RAG:', langchainStatus);

// Initialize TTS (OpenAI → Kokoro → Edge fallback)
const ttsStatus = ttsService.initTTS();
console.log('TTS Providers:', ttsStatus);

// Sync resolved tickets from DB into RAG vector store on startup
rag.syncKnowledgeBase().then(result => {
  console.log(`RAG Knowledge Sync: ${result.indexed} new tickets indexed, ${result.total} total in vector store`);
}).catch(e => console.log('RAG sync skipped:', e.message));

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

// Initialize Proactive AI Engine — DISABLED by default to save API quota
// Set PROACTIVE_AI_ENABLED=true in .env to enable (runs AI calls every 5 min)
const proactiveEnabled = process.env.PROACTIVE_AI_ENABLED === 'true';
if (proactiveEnabled) {
  proactiveEngine.initProactiveEngine({
    checkIntervalMinutes: parseInt(process.env.PROACTIVE_CHECK_INTERVAL) || 15,
    enableAutoActions: process.env.PROACTIVE_AUTO_ACTIONS === 'true'
  });
  console.log('Proactive AI Engine: Enabled (every', process.env.PROACTIVE_CHECK_INTERVAL || '15', 'min)');
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
  const info = ai.getCurrentProvider();
  info.costEffective = ai.getCostEffectiveProvider();
  res.json(info);
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
app.post('/api/ai/key', requireAdminToken, (req, res) => {
  try {
    const { provider, apiKey } = req.body;

    if (!apiKey || apiKey.trim().length === 0) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const success = ai.updateApiKey(provider, apiKey);

    if (success) {
      // Re-initialize LangChain with new key
      if (provider === 'claude' || provider === 'anthropic') {
        rag.initLangChain({ anthropicKey: apiKey });
      } else if (provider === 'openai' || provider === 'gpt') {
        rag.initLangChain({ openaiKey: apiKey });
      } else if (provider === 'gemini' || provider === 'google') {
        rag.initLangChain({ geminiKey: apiKey });
      } else if (provider === 'groq') {
        // Groq uses its own API, no LangChain re-init needed
        console.log('Groq key saved - Llama/Qwen models now available for cost-effective operations');
      }
      console.log(`API key updated for provider: ${provider}`);
    }

    res.json({ success, message: success ? `${provider} API key saved successfully` : 'Failed to save key' });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// SOP (Standard Operating Procedures) ENDPOINTS
// ============================================

// Upload SOP document (PDF, TXT, etc.)
app.post('/api/sop/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Parse the file content
    const parsed = await contentIngestion.handleFileUpload(req.file, 'sop');

    // Store SOP content in settings for quick access by AI prompts
    const sopTitle = req.body.title || req.file.originalname;
    try {
      // Get existing SOPs
      const existingSops = db.getSetting('sop_documents', '[]');
      const sops = JSON.parse(existingSops);
      sops.push({
        id: Date.now().toString(),
        title: sopTitle,
        fileName: req.file.originalname,
        content: parsed.content,
        summary: parsed.summary,
        uploadedAt: new Date().toISOString()
      });
      db.setSetting('sop_documents', JSON.stringify(sops));

      // Also inject into all relevant agent knowledge bases
      const agentIds = ['highlevel-specialist', 'business-analyst', 'dev-ops'];
      for (const agentId of agentIds) {
        try {
          agentKnowledge.addKnowledge(agentId, {
            type: 'document',
            title: `SOP: ${sopTitle}`,
            content: parsed.content,
            summary: parsed.summary || `Standard Operating Procedures: ${sopTitle}`,
            file_path: parsed.file_path,
            file_type: 'pdf',
            metadata: { source: 'sop_upload', originalName: req.file.originalname }
          });
        } catch (e) {
          console.log(`Could not add SOP to agent ${agentId}:`, e.message);
        }
      }
    } catch (e) {
      console.error('Could not persist SOP:', e.message);
    }

    res.json({
      success: true,
      title: sopTitle,
      contentLength: parsed.content?.length || 0,
      summary: parsed.summary
    });
  } catch (error) {
    console.error('SOP upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload SOP as raw text (for pasting content directly)
app.post('/api/sop/text', (req, res) => {
  try {
    const { title, content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const existingSops = db.getSetting('sop_documents', '[]');
    const sops = JSON.parse(existingSops);
    sops.push({
      id: Date.now().toString(),
      title: title || 'Support SOP',
      content,
      summary: content.substring(0, 500),
      uploadedAt: new Date().toISOString()
    });
    db.setSetting('sop_documents', JSON.stringify(sops));

    // Inject into agent knowledge bases
    const agentIds = ['highlevel-specialist', 'business-analyst', 'dev-ops'];
    for (const agentId of agentIds) {
      try {
        agentKnowledge.addKnowledge(agentId, {
          type: 'text',
          title: `SOP: ${title || 'Support SOP'}`,
          content,
          summary: content.substring(0, 500)
        });
      } catch (e) {}
    }

    res.json({ success: true, title: title || 'Support SOP', contentLength: content.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all SOPs
app.get('/api/sop', (req, res) => {
  try {
    const sops = JSON.parse(db.getSetting('sop_documents', '[]'));
    res.json({ sops: sops.map(s => ({ id: s.id, title: s.title, fileName: s.fileName, uploadedAt: s.uploadedAt, contentLength: s.content?.length || 0 })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get SOP content (for injection into prompts)
app.get('/api/sop/content', (req, res) => {
  try {
    const sops = JSON.parse(db.getSetting('sop_documents', '[]'));
    // Combine all SOP content for AI context (limit to 8000 chars total)
    let combined = '';
    for (const sop of sops) {
      const sopContent = sop.content || '';
      if (combined.length + sopContent.length < 8000) {
        combined += `\n--- ${sop.title} ---\n${sopContent}\n`;
      } else {
        combined += `\n--- ${sop.title} (truncated) ---\n${sopContent.substring(0, 2000)}\n`;
        break;
      }
    }
    res.json({ content: combined, sopCount: sops.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an SOP
app.delete('/api/sop/:sopId', (req, res) => {
  try {
    const sops = JSON.parse(db.getSetting('sop_documents', '[]'));
    const filtered = sops.filter(s => s.id !== req.params.sopId);
    db.setSetting('sop_documents', JSON.stringify(filtered));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CASEBOOK ENDPOINTS (human-approved gold responses)
// ============================================

// Save an approved response to casebook
app.post('/api/casebook', async (req, res) => {
  try {
    const { ticket_id, subject, issue_type, customer_message, approved_response, sop_references, keywords, resolution_notes } = req.body;
    if (!approved_response || !subject) {
      return res.status(400).json({ error: 'subject and approved_response are required' });
    }

    const id = db.addToCasebook({
      ticket_id, subject, issue_type, customer_message,
      approved_response, sop_references, keywords, resolution_notes
    });

    // Index in RAG for vector search
    try {
      const rag = await import('./lib/langchain-rag.js');
      rag.indexCasebookEntry({ id, subject, customer_message, approved_response, sop_references, issue_type });
    } catch (e) {}

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List casebook entries
app.get('/api/casebook', (req, res) => {
  try {
    const entries = db.getCasebookEntries({
      issue_type: req.query.type || null,
      limit: parseInt(req.query.limit) || 100
    });
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search casebook
app.post('/api/casebook/search', (req, res) => {
  try {
    const { query, limit } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const terms = query.split(/\s+/).filter(w => w.length > 2);
    const results = db.searchCasebook(terms, limit || 5);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete casebook entry
app.delete('/api/casebook/:id', (req, res) => {
  try {
    db.deleteCasebookEntry(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Casebook stats
app.get('/api/casebook/stats', (req, res) => {
  try {
    const stats = db.getCasebookStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DRAFT QUEUE ENDPOINTS
// ============================================

// List drafts (with optional status filter)
app.get('/api/drafts', (req, res) => {
  try {
    const drafts = db.getAllDrafts({
      status: req.query.status || null,
      ticket_id: req.query.ticket_id ? parseInt(req.query.ticket_id) : null,
      limit: parseInt(req.query.limit) || 50
    });
    res.json({ drafts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single draft
app.get('/api/drafts/:id', (req, res) => {
  try {
    const dbInstance = db.getDb();
    const draft = dbInstance.prepare('SELECT * FROM drafts WHERE id = ?').get(parseInt(req.params.id));
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    // Parse JSON fields
    try { draft.qa_result = JSON.parse(draft.qa_result); } catch (e) {}
    try { draft.sop_citations = JSON.parse(draft.sop_citations); } catch (e) {}
    try { draft.pipeline_metadata = JSON.parse(draft.pipeline_metadata); } catch (e) {}

    res.json(draft);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a draft manually
app.post('/api/drafts', (req, res) => {
  try {
    const { ticket_id, ticket_subject, draft_text, status } = req.body;
    if (!ticket_id || !draft_text) {
      return res.status(400).json({ error: 'ticket_id and draft_text are required' });
    }
    const id = db.saveDraft({ ticket_id, ticket_subject, draft_text, status: status || 'PENDING_REVIEW' });
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update draft status (approve/reject/needs-edit)
app.patch('/api/drafts/:id/status', async (req, res) => {
  try {
    const { status, reviewed_by } = req.body;
    const validStatuses = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_EDIT', 'ESCALATION_RECOMMENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    db.updateDraftStatus(parseInt(req.params.id), status, reviewed_by || 'human');

    // Emit event
    try {
      const eventBus = await import('./lib/cross-platform-event-bus.js');
      const eventType = status === 'APPROVED' ? eventBus.EVENTS.DRAFT_APPROVED
        : status === 'REJECTED' ? eventBus.EVENTS.DRAFT_REJECTED
        : eventBus.EVENTS.DRAFT_CREATED;
      eventBus.emit(eventType, { draftId: parseInt(req.params.id), status });
    } catch (e) {}

    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Draft stats
app.get('/api/drafts/stats', (req, res) => {
  try {
    const stats = db.getDraftStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a draft
app.delete('/api/drafts/:id', (req, res) => {
  try {
    db.deleteDraft(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TICKET PIPELINE + QA ENDPOINTS
// ============================================

// Process a single ticket through the full pipeline
app.post('/api/pipeline/process', async (req, res) => {
  try {
    const { ticketId, agentName, skipQA } = req.body;
    if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

    const pipeline = await import('./lib/ticket-pipeline.js');
    const result = await pipeline.processTicket(ticketId, { agentName, skipQA });
    res.json(result);
  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process multiple tickets in batch
app.post('/api/pipeline/batch', async (req, res) => {
  try {
    const { ticketIds, agentName, skipQA } = req.body;
    if (!ticketIds || !Array.isArray(ticketIds)) {
      return res.status(400).json({ error: 'ticketIds array is required' });
    }

    const pipeline = await import('./lib/ticket-pipeline.js');
    const results = await pipeline.processMultipleTickets(ticketIds, { agentName, skipQA });
    res.json({
      processed: results.length,
      successful: results.filter(r => r.draftId).length,
      failed: results.filter(r => r.error).length,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pipeline status
app.get('/api/pipeline/status', (req, res) => {
  try {
    const draftStats = db.getDraftStats();
    const casebookStats = db.getCasebookStats();
    res.json({
      drafts: draftStats,
      casebook: casebookStats,
      pipeline: { active: true, mode: 'draft-only', safety: 'read-only' }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// QA evaluate a draft
app.post('/api/qa/evaluate', async (req, res) => {
  try {
    const { draftId, draftText, ticketSubject, ticketDescription } = req.body;

    let draft, ticket;
    if (draftId) {
      const dbInstance = db.getDb();
      draft = dbInstance.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      ticket = db.getTicketWithAnalysis(draft.ticket_id) || { subject: draft.ticket_subject, description: '' };
    } else {
      if (!draftText) return res.status(400).json({ error: 'draftId or draftText is required' });
      draft = { draft_text: draftText };
      ticket = { subject: ticketSubject || '', description: ticketDescription || '' };
    }

    const qa = await import('./lib/qa-evaluator.js');
    const result = await qa.evaluateDraft(draft, ticket);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GOD MODE BRIEF + VOICE INTENT ENDPOINTS
// ============================================

// God Mode Brief - unified briefing across all systems
app.get('/api/briefing/god-mode', async (req, res) => {
  try {
    // Gather data from all systems in parallel
    const [draftStats, casebookStats, recentDrafts] = await Promise.all([
      Promise.resolve(db.getDraftStats()),
      Promise.resolve(db.getCasebookStats()),
      Promise.resolve(db.getDraftsByStatus('PENDING_REVIEW', 10))
    ]);

    // Get ticket queue from DB
    const openTickets = db.getTicketsByStatus([2, 3, 6, 7]);
    const urgentTickets = openTickets.filter(t => t.priority >= 3);

    // Get proactive state if available
    let proactiveState = { detectedIssues: [], suggestions: [] };
    try {
      const proactive = await import('./lib/proactive-ai-engine.js');
      proactiveState = proactive.getProactiveState();
    } catch (e) {}

    // Get standard briefing if available
    let standardBriefing = null;
    try {
      const briefing = await import('./lib/proactive-briefing.js');
      standardBriefing = await briefing.generateBriefing('morning');
    } catch (e) {}

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const godModeBrief = {
      generatedAt: now.toISOString(),
      greeting: `${greeting}, Commander.`,
      mode: 'GOD MODE - READ-ONLY + DRAFT-ONLY',

      priorities: [],

      ticketQueue: {
        total: openTickets.length,
        urgent: urgentTickets.length,
        byStatus: {
          open: openTickets.filter(t => t.status === 2).length,
          pending: openTickets.filter(t => t.status === 3).length,
          waiting: openTickets.filter(t => t.status === 6 || t.status === 7).length
        }
      },

      draftQueue: {
        ...draftStats,
        pendingDrafts: recentDrafts.map(d => ({
          id: d.id,
          ticketId: d.ticket_id,
          subject: d.ticket_subject,
          status: d.status,
          qaPasssed: d.qa_passed,
          createdAt: d.created_at
        }))
      },

      casebook: casebookStats,

      proactiveAI: {
        issues: proactiveState.detectedIssues?.length || 0,
        suggestions: proactiveState.suggestions?.length || 0,
        lastCheck: proactiveState.lastCheck
      },

      standardBriefing: standardBriefing ? {
        summary: standardBriefing.summary || standardBriefing.content,
        type: standardBriefing.type
      } : null
    };

    // Build priority list
    if (urgentTickets.length > 0) {
      godModeBrief.priorities.push(`${urgentTickets.length} urgent ticket(s) need attention`);
    }
    if (draftStats.PENDING_REVIEW > 0) {
      godModeBrief.priorities.push(`${draftStats.PENDING_REVIEW} draft(s) ready for review`);
    }
    if (draftStats.ESCALATION_RECOMMENDED > 0) {
      godModeBrief.priorities.push(`${draftStats.ESCALATION_RECOMMENDED} ticket(s) recommended for escalation`);
    }
    if ((proactiveState.detectedIssues?.length || 0) > 0) {
      godModeBrief.priorities.push(`${proactiveState.detectedIssues.length} proactive issue(s) detected`);
    }
    if (godModeBrief.priorities.length === 0) {
      godModeBrief.priorities.push('All clear - no urgent items');
    }

    res.json(godModeBrief);
  } catch (error) {
    console.error('God Mode Brief error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GLASSES ALERTS ENDPOINT
// Returns only new, speakable alerts for the glasses companion
// ============================================
app.get('/api/alerts/glasses', async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    const alerts = [];

    // Check tickets
    const ticketsWithAnalysis = db.getAllTicketsWithAnalysis();
    const tickets = ticketsWithAnalysis.map(t => t.ticket ? JSON.parse(t.ticket) : t);
    const analysisMap = db.getAllAnalysisMap();

    // Urgent tickets (urgency >= 8)
    let urgentCount = 0;
    const urgentTickets = [];
    for (const [ticketId, analysis] of Object.entries(analysisMap)) {
      const parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
      if (parsed?.URGENCY_SCORE >= 8) {
        urgentCount++;
        const ticket = tickets.find(t => String(t.id) === ticketId);
        if (ticket) urgentTickets.push(ticket.subject);
      }
    }

    if (urgentCount > 0) {
      alerts.push({
        priority: 'urgent',
        text: `${urgentCount} urgent ticket${urgentCount > 1 ? 's' : ''}: ${urgentTickets.slice(0, 2).join(', ')}${urgentTickets.length > 2 ? ' and more' : ''}.`,
      });
    }

    // Pending drafts
    try {
      const draftStats = db.getDraftStats();
      if (draftStats?.PENDING_REVIEW > 0) {
        alerts.push({
          priority: 'info',
          text: `${draftStats.PENDING_REVIEW} draft response${draftStats.PENDING_REVIEW > 1 ? 's' : ''} ready for review.`,
        });
      }
    } catch {}

    // Proactive engine issues
    try {
      const { getProactiveState } = await import('./lib/proactive-ai-engine.js');
      const state = getProactiveState();
      if (state?.issues?.length > 0) {
        alerts.push({
          priority: 'warning',
          text: `${state.issues.length} proactive issue${state.issues.length > 1 ? 's' : ''} detected.`,
        });
      }
    } catch {}

    // Open ticket count
    const openTickets = tickets.filter(t => t.status === 2);
    if (openTickets.length > 5) {
      alerts.push({
        priority: 'info',
        text: `You have ${openTickets.length} open tickets in the queue.`,
      });
    }

    res.json({
      alerts,
      count: alerts.length,
      checkedAt: new Date().toISOString(),
      summary: alerts.length > 0
        ? alerts.map(a => a.text).join(' ')
        : 'All clear. No urgent items.',
    });
  } catch (error) {
    console.error('Glasses alerts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Voice Intent Handler - accepts JSON intents from iPhone Shortcuts
app.post('/api/intent', async (req, res) => {
  try {
    const { intent, params = {}, constraints = {} } = req.body;
    if (!intent) return res.status(400).json({ error: 'intent is required' });

    // All intents enforce read-only + draft-only
    const safeConstraints = { no_send: true, draft_only: true, ...constraints };

    let data;
    switch (intent) {
      case 'god_brief': {
        // Fetch the god mode brief internally
        const briefResponse = await new Promise((resolve, reject) => {
          const mockRes = {
            json: (d) => resolve(d),
            status: () => ({ json: (d) => reject(new Error(d.error)) })
          };
          // Just gather the data directly
          const draftStats = db.getDraftStats();
          const openTickets = db.getTicketsByStatus([2, 3, 6, 7]);
          resolve({
            type: 'god_brief',
            priorities: [],
            ticketCount: openTickets.length,
            urgentCount: openTickets.filter(t => t.priority >= 3).length,
            drafts: draftStats,
            casebook: db.getCasebookStats(),
            constraints: safeConstraints,
            spoken: `You have ${openTickets.length} open tickets, ${draftStats.PENDING_REVIEW || 0} drafts pending review, and ${openTickets.filter(t => t.priority >= 3).length} urgent items.`
          });
        });
        data = briefResponse;
        break;
      }

      case 'tickets_focus': {
        const statuses = params.new_only ? [2] : [2, 3, 6, 7];
        const tickets = db.getTicketsByStatus(statuses);
        const filtered = params.sla_risk === 'high'
          ? tickets.filter(t => t.priority >= 3)
          : tickets;
        data = {
          type: 'tickets_focus',
          count: filtered.length,
          tickets: filtered.slice(0, 10).map(t => ({
            id: t.freshdesk_id, subject: t.subject, status: t.status, priority: t.priority
          })),
          constraints: safeConstraints,
          spoken: `You have ${filtered.length} tickets matching your filter. Top ticket: ${filtered[0]?.subject || 'none'}.`
        };
        break;
      }

      case 'draft_status': {
        const draftStats = db.getDraftStats();
        const pending = db.getDraftsByStatus('PENDING_REVIEW', 5);
        data = {
          type: 'draft_status',
          stats: draftStats,
          pendingDrafts: pending.map(d => ({
            id: d.id, ticketId: d.ticket_id, subject: d.ticket_subject, status: d.status
          })),
          constraints: safeConstraints,
          spoken: `You have ${draftStats.PENDING_REVIEW || 0} drafts pending review, ${draftStats.APPROVED || 0} approved, and ${draftStats.ESCALATION_RECOMMENDED || 0} escalations recommended.`
        };
        break;
      }

      case 'repo_focus': {
        try {
          const portfolio = await import('./lib/github-portfolio.js');
          const repoData = await portfolio.getPortfolioData(params.repo);
          data = { type: 'repo_focus', ...repoData, constraints: safeConstraints };
        } catch (e) {
          data = { type: 'repo_focus', error: 'GitHub portfolio not available', constraints: safeConstraints };
        }
        break;
      }

      default:
        data = { type: 'unknown', message: `Unknown intent: ${intent}`, constraints: safeConstraints };
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      analysis,
      conversationThread,
      agentSignature,
      cannedResponses,
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
      conversationThread,
      agentSignature,
      cannedResponses,
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

// ============================================
// TEXT-TO-SPEECH (Edge TTS — free, natural voices)
// ============================================

// List available voices (all providers)
app.get('/api/tts/voices', async (req, res) => {
  try {
    const voices = await ttsService.getAvailableVoices();
    const status = ttsService.getTTSStatus();
    res.json({
      voices,
      recommended: [
        'commander', 'support', 'analyst',                // VoxCPM (free, studio quality)
        'nova', 'coral', 'sage', 'shimmer', 'alloy',     // OpenAI (premium)
        'kokoro_af_nova', 'kokoro_af_heart',              // Kokoro (free)
        'en-US-AvaMultilingualNeural',                    // Edge (fallback)
        'en-US-AndrewMultilingualNeural',
      ],
      providers: status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate speech audio (OpenAI → Kokoro → Edge TTS)
app.post('/api/tts/speak', async (req, res) => {
  try {
    const { text, voice, provider } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const result = await ttsService.generateSpeech(text, { voice: voice || 'juno', provider });

    res.set({
      'Content-Type': result.format,
      'Content-Length': result.audio.length,
      'Cache-Control': 'public, max-age=3600',
      'X-TTS-Provider': result.provider,
    });
    res.send(result.audio);
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// VOXCPM VOICE CLONING & DESIGN
// Free, self-hosted TTS with voice cloning
// ============================================

// Clone a voice from audio sample
app.post('/api/tts/clone', async (req, res) => {
  try {
    const { text, referenceAudioUrl, referenceText, emotion, speed } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (!referenceAudioUrl) return res.status(400).json({ error: 'referenceAudioUrl is required (URL to voice sample)' });

    const result = await ttsService.cloneVoice(referenceAudioUrl, text, { referenceText, emotion, speed });

    res.set({
      'Content-Type': result.format,
      'Content-Length': result.audio.length,
      'X-TTS-Provider': 'voxcpm',
      'X-Clone-Mode': referenceText ? 'ultimate' : 'standard',
    });
    res.send(result.audio);
  } catch (error) {
    console.error('Voice clone error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Design a voice from text description
app.post('/api/tts/design', async (req, res) => {
  try {
    const { text, description, speed } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (!description) return res.status(400).json({ error: 'description is required (e.g. "young confident male, deep tone")' });

    const result = await ttsService.designVoice(description, text, { speed });

    res.set({
      'Content-Type': result.format,
      'Content-Length': result.audio.length,
      'X-TTS-Provider': 'voxcpm',
    });
    res.send(result.audio);
  } catch (error) {
    console.error('Voice design error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check VoxCPM server health
app.get('/api/tts/voxcpm/health', async (req, res) => {
  try {
    const health = await ttsService.checkVoxCPMHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Speak with voice cloning (shortcut: text + voice sample → audio)
app.post('/api/tts/speak-as', async (req, res) => {
  try {
    const { text, referenceAudioUrl, voice, voiceDescription, emotion, speed } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const result = await ttsService.generateSpeech(text, {
      voice: voice || 'commander',
      referenceAudioUrl,
      voiceDescription,
      emotion,
      speed
    });

    res.set({
      'Content-Type': result.format,
      'Content-Length': result.audio.length,
      'X-TTS-Provider': result.provider,
    });
    res.send(result.audio);
  } catch (error) {
    console.error('Speak-as error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// VOICE ENDPOINT (Meta Glasses / Wearables)
// Single call: text in → AI response + audio out
// ============================================
app.post('/api/voice', async (req, res) => {
  try {
    const { message, conversationId: reqConvId, userId, voice } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const uid = userId || 'default';
    const convId = reqConvId || memory.getActiveConversation(uid);

    // Get conversation history and memory
    const history = memory.getConversationHistory(convId, 10);
    const memoryContext = memory.buildMemoryContext(uid, message);

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Store user message
    memory.addMessage(convId, 'user', message);

    // Build real-time context for voice responses
    let liveContext = memoryContext || '';
    try {
      const ticketsWithAnalysis = db.getAllTicketsWithAnalysis();
      const tickets = ticketsWithAnalysis.map(t => t.ticket ? JSON.parse(t.ticket) : t);
      const active = tickets.filter(t => [2, 3, 6, 7].includes(t.status));
      if (active.length > 0) {
        const statusLabels = { 2: 'Open', 3: 'Pending', 6: 'Waiting on Customer', 7: 'On Hold' };
        const ticketList = active.slice(0, 15).map(t =>
          `#${t.id}: ${t.subject} (${statusLabels[t.status] || 'Unknown'}) - ${t.source || 'Freshdesk'}`
        ).join('\n');
        liveContext += `\n\nREAL TICKET DATA (from Freshdesk/GHL — use ONLY this data, never invent ticket numbers):\n${active.length} active tickets:\n${ticketList}`;
      } else {
        liveContext += '\n\nTICKET STATUS: No active tickets in the queue right now.';
      }
    } catch (e) {
      console.warn('Could not load ticket context for voice:', e.message);
    }

    // Include real trading signal data
    try {
      const signals = telegram.getSignalHistory(10);
      if (signals.length > 0) {
        const signalList = signals.slice(-10).map(s => {
          const sig = s.signal || {};
          const time = s.date ? new Date(s.date).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown time';
          return `[${time}] ${sig.direction || '?'} ${sig.instrument || '?'}${sig.entry ? ` @ ${sig.entry}` : ''}${sig.stopLoss ? ` SL: ${sig.stopLoss}` : ''}${sig.targets?.length ? ` TP: ${sig.targets.join(', ')}` : ''} — Raw: "${(s.text || s.signal?.raw || '').substring(0, 120)}"`;
        }).join('\n');
        liveContext += `\n\nREAL TRADING SIGNALS (from TradingView via Copygram → Telegram — use ONLY this data, NEVER invent signals, prices, or trade setups):\n${signals.length} signals tracked:\n${signalList}`;
      } else {
        liveContext += '\n\nTRADING SIGNALS: No signals have been received yet. Do NOT make up any signal data.';
      }
    } catch (e) {
      console.warn('Could not load signal context for voice:', e.message);
    }

    // Use voice-optimized prompt (short answers)
    const systemPrompt = getVoicePrompt(liveContext);

    const result = await ai.chat(messages, { systemPrompt, maxTokens: 512 });

    // Store assistant response
    memory.addMessage(convId, 'assistant', result.text, {
      provider: result.provider,
      model: result.model
    });

    // Generate TTS audio (OpenAI → Kokoro → Edge)
    let audioBase64 = null;
    let audioFormat = 'audio/mp3';
    let ttsProvider = null;
    try {
      const ttsResult = await ttsService.generateSpeechBase64(result.text, { voice: voice || 'juno' });
      audioBase64 = ttsResult.audio;
      audioFormat = ttsResult.format;
      ttsProvider = ttsResult.provider;
    } catch (ttsErr) {
      console.warn('Voice TTS failed, returning text only:', ttsErr.message);
    }

    res.json({
      response: result.text,
      audio: audioBase64,
      audioFormat,
      provider: result.provider,
      model: result.model,
      ttsProvider,
      conversationId: convId
    });
  } catch (error) {
    console.error('Voice endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// VISION ENDPOINT (Camera / VisionClaw)
// Analyze images with AI vision models
// ============================================
app.post('/api/vision', async (req, res) => {
  try {
    const { image, prompt, conversationId: reqConvId, userId, voice } = req.body;
    if (!image) return res.status(400).json({ error: 'Image (base64) is required' });

    const uid = userId || 'default';
    const convId = reqConvId || memory.getActiveConversation(uid);

    // Analyze the image
    const visionPrompt = prompt || 'What do you see? Be concise and actionable.';
    const result = await ai.analyzeImage(image, visionPrompt, {
      systemPrompt: getVoicePrompt('You are analyzing an image captured by the user\'s smart glasses. Be concise — they are listening, not reading. Describe what\'s relevant and actionable.'),
    });

    // Store in conversation memory
    memory.addMessage(convId, 'user', `[Image captured] ${visionPrompt}`);
    memory.addMessage(convId, 'assistant', result.text, {
      provider: result.provider,
      model: result.model,
    });

    // Generate TTS audio (OpenAI → Kokoro → Edge)
    let audioBase64 = null;
    let audioFormat = 'audio/mp3';
    try {
      const ttsResult = await ttsService.generateSpeechBase64(result.text, { voice: voice || 'juno' });
      audioBase64 = ttsResult.audio;
      audioFormat = ttsResult.format;
    } catch (ttsErr) {
      console.warn('Vision TTS failed:', ttsErr.message);
    }

    res.json({
      response: result.text,
      audio: audioBase64,
      audioFormat: 'audio/mp3',
      provider: result.provider,
      model: result.model,
      conversationId: convId,
    });
  } catch (error) {
    console.error('Vision endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// VISION MONITOR ENDPOINT (Screen Monitoring Copilot)
// Periodic screen captures → detect tool → cross-reference data → decide if to speak
// ============================================

// In-memory state for monitor to avoid repeating itself
const monitorState = {
  lastSpokenTopics: [], // What we already told the user about
  lastDetectedTool: null,
  lastAnalysis: null,
  lastSpokeAt: 0,
};

app.post('/api/vision/monitor', async (req, res) => {
  try {
    const { image, conversationId: reqConvId, userId, voice } = req.body;
    if (!image) return res.status(400).json({ error: 'Image required' });

    const uid = userId || 'default';
    const convId = reqConvId || memory.getActiveConversation(uid);

    // Gather live context data in parallel
    let marketContext = '';
    let ticketContext = '';

    const [marketResult, ticketResult] = await Promise.allSettled([
      // Get live market data
      (async () => {
        try {
          const tickers = await marketData.getBinanceTickers(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
          if (tickers?.length) {
            return tickers.map(t =>
              `${t.symbol}: $${parseFloat(t.lastPrice).toFixed(2)} (${parseFloat(t.priceChangePercent) > 0 ? '+' : ''}${parseFloat(t.priceChangePercent).toFixed(1)}%)`
            ).join(', ');
          }
        } catch {}
        return '';
      })(),
      // Get ticket summary
      (async () => {
        try {
          const ticketsWithAnalysis = db.getAllTicketsWithAnalysis();
          const tickets = ticketsWithAnalysis.map(t => t.ticket ? JSON.parse(t.ticket) : t);
          const open = tickets.filter(t => t.status === 2);
          const pending = tickets.filter(t => t.status === 3);
          return `Open tickets: ${open.length}, Pending: ${pending.length}`;
        } catch {}
        return '';
      })(),
    ]);

    if (marketResult.status === 'fulfilled' && marketResult.value) {
      marketContext = `Live prices: ${marketResult.value}`;
    }
    if (ticketResult.status === 'fulfilled' && ticketResult.value) {
      ticketContext = ticketResult.value;
    }

    // Build the monitor prompt — tell AI to detect what's on screen and decide importance
    const monitorPrompt = `You are a proactive AI copilot monitoring the user's computer screen through their Meta Ray-Ban glasses.

WHAT YOU ALREADY TOLD THEM (don't repeat):
${monitorState.lastSpokenTopics.slice(-5).join('\n') || 'Nothing yet.'}

LIVE DATA:
${marketContext}
${ticketContext}

USER'S WATCHED INSTRUMENTS: NQ (Nasdaq futures), MNQ (Micro Nasdaq), NAS100, SOL, Oil, Gold, Forex

YOUR JOB:
1. Identify what tool/app is on screen (TradingView, Freshdesk, Gmail, code editor, etc.)
2. Analyze what's happening — look for: price levels, chart patterns, ticket details, errors, notifications
3. Decide: is there something WORTH INTERRUPTING the user about?

SPEAK ONLY IF you see:
- A significant price move or chart pattern on a watched instrument
- A new urgent ticket or important notification
- An error or problem that needs attention
- Something the user would want to know RIGHT NOW

RESPOND IN THIS JSON FORMAT:
{"detectedTool": "TradingView|Freshdesk|Gmail|CodeEditor|Browser|Other|Unknown", "shouldSpeak": true/false, "insight": "What you'd say to the user (1-2 sentences, conversational)", "reason": "Why this is worth mentioning"}

If nothing noteworthy, respond: {"detectedTool": "...", "shouldSpeak": false, "insight": "", "reason": "nothing notable"}`;

    // Send to vision AI
    const result = await ai.analyzeImage(image, monitorPrompt);

    // Parse the AI response
    let parsed = { detectedTool: 'Unknown', shouldSpeak: false, insight: '', reason: '' };
    try {
      // Extract JSON from response (AI might wrap it in markdown)
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If JSON parsing fails, check if AI just gave a plain response
      if (result.text.length > 10 && !result.text.includes('"shouldSpeak": false')) {
        parsed.shouldSpeak = true;
        parsed.insight = result.text.substring(0, 200);
      }
    }

    // Update monitor state
    monitorState.lastDetectedTool = parsed.detectedTool;
    monitorState.lastAnalysis = parsed;

    let audioBase64 = null;

    if (parsed.shouldSpeak && parsed.insight) {
      // Track what we told them to avoid repeating
      monitorState.lastSpokenTopics.push(parsed.insight);
      if (monitorState.lastSpokenTopics.length > 10) {
        monitorState.lastSpokenTopics = monitorState.lastSpokenTopics.slice(-5);
      }
      monitorState.lastSpokeAt = Date.now();

      // Store in conversation
      memory.addMessage(convId, 'user', `[Screen monitor: ${parsed.detectedTool}]`);
      memory.addMessage(convId, 'assistant', parsed.insight, {
        provider: result.provider,
        model: result.model,
      });

      // Generate TTS (OpenAI → Kokoro → Edge)
      try {
        const ttsResult = await ttsService.generateSpeechBase64(parsed.insight, { voice: voice || 'juno' });
        audioBase64 = ttsResult.audio;
      } catch {}
    }

    res.json({
      shouldSpeak: parsed.shouldSpeak,
      response: parsed.insight || '',
      detectedTool: parsed.detectedTool || 'Unknown',
      reason: parsed.reason || '',
      audio: audioBase64,
      audioFormat: 'audio/mp3',
      provider: result.provider,
      model: result.model,
      conversationId: convId,
    });
  } catch (error) {
    console.error('Vision monitor error:', error);
    res.status(500).json({ error: error.message, shouldSpeak: false });
  }
});

// ============================================
// LIVE STREAMING ENDPOINTS
// ============================================

// Get streaming destinations
app.get('/api/stream/destinations', (req, res) => {
  try {
    res.json({ destinations: streamRelay.getDestinations() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle a destination on/off
app.post('/api/stream/destinations/:id/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    const result = streamRelay.toggleDestination(req.params.id, enabled);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get stream status
app.get('/api/stream/status', (req, res) => {
  res.json(streamRelay.getStreamStatus());
});

// Start streaming
app.post('/api/stream/start', (req, res) => {
  try {
    const result = streamRelay.startStream(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Stop streaming
app.post('/api/stream/stop', (req, res) => {
  try {
    const result = streamRelay.stopStream();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TELEGRAM BRIDGE ENDPOINTS
// ============================================

// Get configured Telegram channels
app.get('/api/telegram/channels', (req, res) => {
  res.json({ channels: telegram.getChannels() });
});

// Update a channel's chat ID
app.post('/api/telegram/channels/:key', (req, res) => {
  try {
    const result = telegram.setChannelId(req.params.key, req.body.chatId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Send a message to a Telegram channel
app.post('/api/telegram/send', async (req, res) => {
  try {
    const { channel, message } = req.body;
    if (!channel || !message) return res.status(400).json({ error: 'channel and message required' });

    const result = await telegram.sendMessage(channel, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get new Telegram messages (for glasses readback)
app.get('/api/telegram/updates', async (req, res) => {
  try {
    const messages = await telegram.getUpdates();
    res.json({ messages, count: messages.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get signal history
app.get('/api/telegram/signals', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({ signals: telegram.getSignalHistory(limit) });
});

// Voice → Telegram: spoken words get sent as a message, then poll for reply and return audio
app.post('/api/telegram/voice', async (req, res) => {
  try {
    const { message, channel, voice, conversationId: reqConvId, userId } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const targetChannel = channel || 'juno';
    const uid = userId || 'default';
    const convId = reqConvId || memory.getActiveConversation(uid);

    // Clean up spoken words into a proper text message using AI
    let cleanedMessage = message;
    try {
      const cleanResult = await ai.chat(
        [{ role: 'user', content: message }],
        {
          systemPrompt: getTelegramPrompt(`Target channel: ${targetChannel}`),
          maxTokens: 256,
        }
      );
      cleanedMessage = cleanResult.text || message;
    } catch {
      // Use raw speech if AI cleanup fails
    }

    // Send to Telegram
    const sendResult = await telegram.sendMessage(targetChannel, cleanedMessage);

    // Store in conversation
    memory.addMessage(convId, 'user', `[Telegram → ${targetChannel}] ${cleanedMessage}`);

    // Wait briefly for a reply (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));
    const updates = await telegram.getUpdates();

    let replyText = `Message sent to ${sendResult.chat}.`;
    let audioBase64 = null;

    // Check if we got a reply from the target channel
    const reply = updates.find(u => u.channelKey === targetChannel);
    if (reply) {
      replyText = `${reply.from} says: ${reply.text}`;
      memory.addMessage(convId, 'assistant', `[Telegram ← ${targetChannel}] ${reply.text}`);

      // Check if reply contains a signal
      if (reply.isSignal && reply.signal) {
        const sig = reply.signal;
        replyText += ` Signal detected: ${sig.direction || ''} ${sig.instrument || ''}.`;
      }
    }

    // Generate TTS (OpenAI → Kokoro → Edge)
    try {
      const ttsResult = await ttsService.generateSpeechBase64(replyText, { voice: voice || 'juno' });
      audioBase64 = ttsResult.audio;
    } catch {}

    res.json({
      response: replyText,
      sent: sendResult,
      reply: reply || null,
      audio: audioBase64,
      audioFormat: 'audio/mp3',
      conversationId: convId,
    });
  } catch (error) {
    console.error('Telegram voice error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze a signal and optionally forward to Kraken
app.post('/api/telegram/signal/analyze', async (req, res) => {
  try {
    const { signal, autoForward } = req.body;
    if (!signal) return res.status(400).json({ error: 'signal required' });

    // Get market context
    let marketContext = '';
    try {
      const tickers = await marketData.getBinanceTickers(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      if (tickers?.length) {
        marketContext = tickers.map(t =>
          `${t.symbol}: $${parseFloat(t.lastPrice).toFixed(2)} (${parseFloat(t.priceChangePercent) > 0 ? '+' : ''}${parseFloat(t.priceChangePercent).toFixed(1)}%)`
        ).join(', ');
      }
    } catch {}

    // AI analysis of the signal
    const analysisResult = await ai.chat(
      [{ role: 'user', content: `Analyze this trading signal:\n\n${signal.raw || JSON.stringify(signal)}\n\nCurrent market: ${marketContext}\n\nGive a quick risk assessment and whether to take this trade. Be concise.` }],
      {
        systemPrompt: 'You are Juno, a trading AI assistant. Analyze signals for risk/reward, confluence with market conditions, and give a clear YES/NO/WAIT recommendation with reasoning in 2-3 sentences.',
        maxTokens: 256,
      }
    );

    const analysis = analysisResult.text;

    // Format for Kraken if requested
    let krakenResult = null;
    if (autoForward) {
      const krakenFormat = telegram.formatForKraken(signal);
      if (krakenFormat) {
        try {
          krakenResult = await telegram.forwardToKraken(krakenFormat.text);
        } catch (err) {
          krakenResult = { error: err.message };
        }
      }
    }

    res.json({
      analysis,
      signal,
      krakenFormat: telegram.formatForKraken(signal),
      forwarded: krakenResult,
    });
  } catch (error) {
    console.error('Signal analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HYBRID JOURNAL iOS SHORTCUTS BRIDGE
// Simple endpoints that iOS Shortcuts can call easily
// ============================================

const HJ_API = 'https://hybridjournal.base44.app/api/functions';
const HJ_API_KEY = process.env.HYBRID_JOURNAL_API_KEY;

// Helper to call Hybrid Journal API
async function callHJ(endpoint, body = {}) {
  const response = await fetch(`${HJ_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_key': HJ_API_KEY || '',
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

// Morning Brief — call from iOS Shortcut or Siri
app.get('/api/journal/brief', async (req, res) => {
  try {
    const data = await callHJ('apiData?entity=Trade&action=list&limit=10');
    const trades = Array.isArray(data) ? data : [];

    // Summarize with AI
    const stats = {
      total: trades.length,
      winners: trades.filter(t => t.pnl > 0).length,
      losers: trades.filter(t => t.pnl < 0).length,
      totalPnl: trades.reduce((s, t) => s + (t.pnl || 0), 0),
    };

    const briefResult = await ai.chat(
      [{ role: 'user', content: `My recent trading stats: ${JSON.stringify(stats)}. Recent trades: ${JSON.stringify(trades.slice(0, 5).map(t => ({ instrument: t.instrument, pnl: t.pnl, entry_date: t.entry_date })))}. Give me a quick morning brief — what should I focus on today? 2-3 sentences.` }],
      { systemPrompt: 'You are Juno, a trading coach. Be concise and actionable.', maxTokens: 256 }
    );

    res.json({
      brief: briefResult.text,
      stats,
      speak: briefResult.text, // For Siri to read aloud
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quick Journal Entry — dictate via Siri, posted to Hybrid Journal
app.post('/api/journal/entry', async (req, res) => {
  try {
    const { text, mood, type } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const result = await callHJ('apiData?entity=JournalEntry&action=create', {
      content: text,
      mood_tags: mood ? [mood] : [],
      entry_type: type || 'thought',
    });

    res.json({ success: true, entry: result, speak: 'Journal entry saved.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Performance Check — "How am I doing?"
app.get('/api/journal/performance', async (req, res) => {
  try {
    const period = req.query.period || '7'; // days
    const data = await callHJ('apiData?entity=Trade&action=list&limit=200');
    const trades = Array.isArray(data) ? data : [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(period));
    const recent = trades.filter(t => new Date(t.entry_date) >= cutoff);

    const stats = {
      period: `${period} days`,
      trades: recent.length,
      winners: recent.filter(t => t.pnl > 0).length,
      losers: recent.filter(t => t.pnl < 0).length,
      winRate: recent.length > 0 ? Math.round((recent.filter(t => t.pnl > 0).length / recent.length) * 100) : 0,
      totalPnl: Math.round(recent.reduce((s, t) => s + (t.pnl || 0), 0) * 100) / 100,
      bestTrade: recent.length > 0 ? Math.max(...recent.map(t => t.pnl || 0)) : 0,
      worstTrade: recent.length > 0 ? Math.min(...recent.map(t => t.pnl || 0)) : 0,
    };

    const speak = `In the last ${period} days: ${stats.trades} trades, ${stats.winRate}% win rate, total P&L ${stats.totalPnl > 0 ? 'plus' : 'minus'} ${Math.abs(stats.totalPnl)} dollars.`;

    res.json({ ...stats, speak });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recent Signals
app.get('/api/journal/signals', async (req, res) => {
  try {
    const data = await callHJ('apiData?entity=Signal&action=list&limit=10');
    const signals = Array.isArray(data) ? data : [];

    const summary = signals.slice(0, 3).map(s =>
      `${s.action || 'SIGNAL'} ${s.symbol || 'Unknown'} at ${s.entry_price || '?'}`
    ).join('. ');

    res.json({
      signals,
      count: signals.length,
      speak: signals.length > 0 ? `${signals.length} recent signals. ${summary}.` : 'No recent signals.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Log Quick Trade — "I just took a long on NQ at 18500"
app.post('/api/journal/trade', async (req, res) => {
  try {
    const { instrument, direction, entry_price, stop_loss, take_profit, notes } = req.body;
    if (!instrument) return res.status(400).json({ error: 'instrument required' });

    const result = await callHJ('apiData?entity=Trade&action=create', {
      instrument,
      direction: direction || 'LONG',
      entry_price: parseFloat(entry_price) || 0,
      stop_loss: stop_loss ? parseFloat(stop_loss) : undefined,
      take_profit: take_profit ? parseFloat(take_profit) : undefined,
      notes: notes || '',
      entry_date: new Date().toISOString(),
    });

    res.json({
      success: true,
      trade: result,
      speak: `Trade logged: ${direction || 'LONG'} ${instrument} at ${entry_price || 'market'}.`,
    });
  } catch (error) {
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

    let defaultSystemPrompt = getChatPrompt(memoryContext);

    // Inject real ticket data when user asks about tickets
    const ticketKeywords = /ticket|freshdesk|open.*ticket|pending|support.*queue|how many|escalat/i;
    if (ticketKeywords.test(message)) {
      try {
        const ticketsWithAnalysis = db.getAllTicketsWithAnalysis([2, 3, 6, 7]);
        if (ticketsWithAnalysis && ticketsWithAnalysis.length > 0) {
          let ticketContext = `\n\nREAL FRESHDESK TICKET DATA (use ONLY these real ticket numbers — NEVER make up ticket IDs):\n`;
          ticketContext += `Active tickets: ${ticketsWithAnalysis.length}\n`;
          for (const t of ticketsWithAnalysis.slice(0, 20)) {
            const statusName = { 2: 'Open', 3: 'Pending', 6: 'Waiting on Customer', 7: 'Waiting on Third Party' }[t.status] || 'Unknown';
            ticketContext += `- #${t.freshdesk_id}: "${t.subject}" | Status: ${statusName} | Requester: ${t.requester_name || 'Unknown'}\n`;
          }
          defaultSystemPrompt += ticketContext;
        }
      } catch (e) {
        console.log('Could not inject ticket context:', e.message);
      }
    }

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

// Ticket Summary — for Siri/Shortcuts/Glasses voice
app.get('/api/tickets/summary', async (req, res) => {
  try {
    const ticketsWithAnalysis = db.getAllTicketsWithAnalysis();
    const tickets = ticketsWithAnalysis.map(t => t.ticket ? JSON.parse(t.ticket) : t);
    const analysisMap = db.getAllAnalysisMap();

    const open = tickets.filter(t => t.status === 2);
    const pending = tickets.filter(t => t.status === 3);
    const waiting = tickets.filter(t => t.status === 6);

    // Count urgent
    let urgentCount = 0;
    const urgentSubjects = [];
    for (const [ticketId, analysis] of Object.entries(analysisMap)) {
      const parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
      if (parsed?.URGENCY_SCORE >= 8) {
        urgentCount++;
        const ticket = tickets.find(t => String(t.id) === ticketId);
        if (ticket) urgentSubjects.push(ticket.subject);
      }
    }

    const stats = {
      total: tickets.filter(t => [2, 3, 6, 7].includes(t.status)).length,
      open: open.length,
      pending: pending.length,
      waiting: waiting.length,
      urgent: urgentCount,
    };

    // Build spoken summary
    let speak = '';
    if (stats.total === 0) {
      speak = 'No active tickets. Queue is clear.';
    } else {
      speak = `You have ${stats.total} active ticket${stats.total !== 1 ? 's' : ''}. `;
      if (stats.open > 0) speak += `${stats.open} open. `;
      if (stats.pending > 0) speak += `${stats.pending} pending. `;
      if (stats.waiting > 0) speak += `${stats.waiting} waiting on customer. `;
      if (urgentCount > 0) {
        speak += `${urgentCount} urgent: ${urgentSubjects.slice(0, 2).join(', ')}${urgentSubjects.length > 2 ? ' and more' : ''}.`;
      }
    }

    // If AI summary requested
    if (req.query.ai === 'true' && stats.total > 0) {
      try {
        const ticketList = tickets
          .filter(t => [2, 3, 6].includes(t.status))
          .slice(0, 10)
          .map(t => `#${t.id}: ${t.subject} (${['','','Open','Pending','Resolved','Closed','Waiting'][t.status] || 'Unknown'})`);

        const aiResult = await ai.chat(
          [{ role: 'user', content: `Summarize these GHL/Freshdesk support tickets in 2-3 sentences. What should I prioritize?\n\n${ticketList.join('\n')}` }],
          { systemPrompt: 'You are Juno. Be concise — this will be spoken aloud.', maxTokens: 200 }
        );
        speak = aiResult.text;
        stats.aiSummary = aiResult.text;
      } catch {}
    }

    res.json({ ...stats, speak });
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
// DAILY REPORT ENDPOINTS
// ============================================

// Generate daily report (manual trigger)
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await scheduler.generateAndSendDailyReport(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of generated reports
app.get('/api/reports', (req, res) => {
  try {
    const reports = dailyReport.getReportsList();
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download a specific report
app.get('/api/reports/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const reports = dailyReport.getReportsList();
    const report = reports.find(r => r.filename === filename);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.download(report.filepath, report.filename);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get report data (JSON) without generating PDF
app.get('/api/reports/data', async (req, res) => {
  try {
    const data = await dailyReport.generateReportData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test email configuration
app.post('/api/email/test', async (req, res) => {
  try {
    const { email } = req.body;

    if (!emailService.isEmailEnabled()) {
      return res.status(400).json({
        error: 'Email not configured',
        config: emailService.getEmailConfig()
      });
    }

    const verification = await emailService.verifyConnection();
    if (!verification.success) {
      return res.status(400).json({
        error: 'SMTP connection failed',
        details: verification.error
      });
    }

    await emailService.sendNotification(
      'Test Email from LIV8 Command Center',
      'This is a test email to verify your email configuration is working correctly.\n\nIf you receive this, your daily reports will be delivered successfully!',
      email
    );

    res.json({ success: true, message: 'Test email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get email configuration status
app.get('/api/email/status', (req, res) => {
  res.json(emailService.getEmailConfig());
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
app.post('/api/settings', requireAdminToken, (req, res) => {
  try {
    const { key, value } = req.body;
    db.setSetting(key, value);
    res.json({ success: true, key, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update settings
app.post('/api/settings/bulk', requireAdminToken, (req, res) => {
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
// FRESHDESK PROXY — keeps the API key server-side
// ============================================

// List tickets assigned to the configured agent across all active statuses.
// This is what the Tickets page calls on load; the API key never touches the
// browser.
app.get('/api/freshdesk/my-tickets', async (req, res) => {
  const domain = process.env.FRESHDESK_DOMAIN;
  const apiKey = process.env.FRESHDESK_API_KEY;
  const agentId = process.env.FRESHDESK_AGENT_ID;
  if (!domain || !apiKey || !agentId) {
    return res.status(503).json({ error: 'Freshdesk not configured on server' });
  }
  const baseUrl = `https://${domain}.freshdesk.com/api/v2`;
  const auth = Buffer.from(`${apiKey}:X`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
  const statuses = [2, 3, 6, 7, 4, 5]; // open, pending, waiting-customer, waiting-3p, resolved, closed

  const fetchAllPages = async (status) => {
    const all = [];
    for (let page = 1; page <= 5; page++) {
      try {
        const query = encodeURIComponent(`"agent_id:${agentId} AND status:${status}"`);
        const r = await fetch(`${baseUrl}/search/tickets?query=${query}&page=${page}`, { headers });
        if (!r.ok) break;
        const data = await r.json();
        const results = data.results || [];
        all.push(...results);
        if (results.length < 30) break;
      } catch {
        break;
      }
    }
    return all;
  };

  try {
    const batches = await Promise.all(statuses.map(fetchAllPages));
    const unique = Array.from(new Map(batches.flat().map(t => [t.id, t])).values());
    unique.sort((a, b) =>
      (b.priority - a.priority) ||
      (a.status - b.status) ||
      (new Date(b.created_at) - new Date(a.created_at))
    );
    res.json({ tickets: unique, domain });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Fetch the conversation thread for a single ticket.
app.get('/api/freshdesk/tickets/:id/conversations', async (req, res) => {
  const domain = process.env.FRESHDESK_DOMAIN;
  const apiKey = process.env.FRESHDESK_API_KEY;
  if (!domain || !apiKey) {
    return res.status(503).json({ error: 'Freshdesk not configured on server' });
  }
  const auth = Buffer.from(`${apiKey}:X`).toString('base64');
  try {
    const r = await fetch(
      `https://${domain}.freshdesk.com/api/v2/tickets/${req.params.id}/conversations`,
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } }
    );
    if (!r.ok) return res.status(r.status).json({ error: `Freshdesk ${r.status}` });
    res.json(await r.json());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ============================================
// FRESHDESK DEBUG / TEST ENDPOINT
// ============================================
app.get('/api/freshdesk/test', async (req, res) => {
  const domain = process.env.FRESHDESK_DOMAIN;
  const apiKey = process.env.FRESHDESK_API_KEY;
  const agentId = process.env.FRESHDESK_AGENT_ID;

  if (!domain || !apiKey) {
    return res.json({ error: 'FRESHDESK_DOMAIN or FRESHDESK_API_KEY not set', domain: !!domain, apiKey: !!apiKey, agentId });
  }

  const baseUrl = `https://${domain}.freshdesk.com/api/v2`;
  const auth = Buffer.from(`${apiKey}:X`).toString('base64');
  const results = {};

  try {
    // Test 1: Fetch all open tickets (no agent filter)
    const allOpenQuery = `"status:2"`;
    const allOpenResp = await fetch(`${baseUrl}/search/tickets?query=${encodeURIComponent(allOpenQuery)}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
    });
    results.allOpen = { status: allOpenResp.status, count: 0 };
    if (allOpenResp.ok) {
      const data = await allOpenResp.json();
      results.allOpen.count = (data.results || []).length;
      results.allOpen.total = data.total;
      results.allOpen.sampleIds = (data.results || []).slice(0, 3).map(t => ({ id: t.id, subject: t.subject?.substring(0, 50), agent: t.responder_id }));
    } else {
      results.allOpen.body = await allOpenResp.text();
    }

    // Test 2: Fetch with agent filter
    if (agentId) {
      const agentQuery = `"agent_id:${agentId} AND status:2"`;
      const agentResp = await fetch(`${baseUrl}/search/tickets?query=${encodeURIComponent(agentQuery)}`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
      });
      results.agentOpen = { status: agentResp.status, count: 0, agentId };
      if (agentResp.ok) {
        const data = await agentResp.json();
        results.agentOpen.count = (data.results || []).length;
        results.agentOpen.total = data.total;
      } else {
        results.agentOpen.body = await agentResp.text();
      }
    }

    // Test 3: List all tickets (non-search endpoint)
    const listResp = await fetch(`${baseUrl}/tickets?per_page=5&order_by=updated_at&order_type=desc`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
    });
    results.listAll = { status: listResp.status };
    if (listResp.ok) {
      const tickets = await listResp.json();
      results.listAll.count = tickets.length;
      results.listAll.samples = tickets.slice(0, 3).map(t => ({ id: t.id, subject: t.subject?.substring(0, 50), status: t.status, agent: t.responder_id }));
    } else {
      results.listAll.body = await listResp.text();
    }

    res.json({ domain, agentId, results });
  } catch (error) {
    res.status(500).json({ error: error.message, domain, agentId });
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
app.post('/api/integrations/credential', requireAdminToken, (req, res) => {
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

// Get Taskade project blocks
app.get('/api/taskade/projects/:projectId/blocks', async (req, res) => {
  try {
    const result = await integrations.taskade.getProjectBlocks(req.params.projectId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single Taskade task
app.get('/api/taskade/projects/:projectId/tasks/:taskId', async (req, res) => {
  try {
    const result = await integrations.taskade.getTask(req.params.projectId, req.params.taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move Taskade task
app.post('/api/taskade/projects/:projectId/tasks/:taskId/move', async (req, res) => {
  try {
    const { targetTaskId, placement } = req.body;
    const result = await integrations.taskade.moveTask(req.params.projectId, req.params.taskId, targetTaskId, placement);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task assignees
app.get('/api/taskade/projects/:projectId/tasks/:taskId/assignees', async (req, res) => {
  try {
    const result = await integrations.taskade.getTaskAssignees(req.params.projectId, req.params.taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set task assignees
app.put('/api/taskade/projects/:projectId/tasks/:taskId/assignees', async (req, res) => {
  try {
    const { handles } = req.body;
    const result = await integrations.taskade.setTaskAssignees(req.params.projectId, req.params.taskId, handles);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove task assignee
app.delete('/api/taskade/projects/:projectId/tasks/:taskId/assignees', async (req, res) => {
  try {
    const { handle } = req.body;
    const result = await integrations.taskade.removeTaskAssignee(req.params.projectId, req.params.taskId, handle);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task date
app.get('/api/taskade/projects/:projectId/tasks/:taskId/date', async (req, res) => {
  try {
    const result = await integrations.taskade.getTaskDate(req.params.projectId, req.params.taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set task due date
app.put('/api/taskade/projects/:projectId/tasks/:taskId/date', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const result = await integrations.taskade.setDueDate(req.params.projectId, req.params.taskId, startDate, endDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task date
app.delete('/api/taskade/projects/:projectId/tasks/:taskId/date', async (req, res) => {
  try {
    const result = await integrations.taskade.deleteTaskDate(req.params.projectId, req.params.taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add note to task
app.put('/api/taskade/projects/:projectId/tasks/:taskId/note', async (req, res) => {
  try {
    const { note } = req.body;
    const result = await integrations.taskade.addNote(req.params.projectId, req.params.taskId, note);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project in folder
app.post('/api/taskade/folders/:folderId/projects', async (req, res) => {
  try {
    const { content } = req.body;
    const result = await integrations.taskade.createProject(req.params.folderId, content);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project in workspace
app.post('/api/taskade/workspaces/:workspaceId/projects', async (req, res) => {
  try {
    const { content } = req.body;
    const result = await integrations.taskade.createProjectInWorkspace(req.params.workspaceId, content);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Copy project
app.post('/api/taskade/projects/:projectId/copy', async (req, res) => {
  try {
    const { folderId } = req.body;
    const result = await integrations.taskade.copyProject(req.params.projectId, folderId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Taskade status check
app.get('/api/taskade/status', async (req, res) => {
  try {
    const configured = integrations.taskade.isConfigured();
    if (!configured) {
      return res.json({ configured: false, connected: false, message: 'TASKADE_API_KEY not set' });
    }
    // Test connection by fetching workspaces
    const workspaces = await integrations.taskade.getWorkspaces();
    res.json({
      configured: true,
      connected: true,
      workspaceCount: workspaces.items?.length || 0
    });
  } catch (error) {
    res.json({ configured: true, connected: false, error: error.message });
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
      // Only include ACTIVE tickets in context to stay within token limits
      const activeTickets = tickets.filter(t => [2, 3, 6, 7].includes(t.status));
      const resolvedCount = tickets.filter(t => [4, 5].includes(t.status)).length;

      context += `\n\n=== SUPPORT QUEUE (${activeTickets.length} active, ${resolvedCount} resolved/closed) ===\n`;

      // Group by status
      const statusGroups = {
        'Open': activeTickets.filter(t => t.status === 2),
        'Pending': activeTickets.filter(t => t.status === 3),
        'Waiting on Customer': activeTickets.filter(t => t.status === 6),
        'On Hold': activeTickets.filter(t => t.status === 7)
      };

      for (const [status, group] of Object.entries(statusGroups)) {
        if (group.length > 0) {
          context += `\n${status} (${group.length}):\n`;
          for (const ticket of group.slice(0, 20)) { // Cap at 20 per status to limit tokens
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
    const systemPrompt = getCommanderPrompt(context);

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

// ============================================
// PROJECTS CRUD ENDPOINTS
// ============================================

// In-memory projects storage (will use DB in production)
let projectsStore = [];

// Initialize from DB or use default
try {
  const savedProjects = db.getSetting('projects');
  if (savedProjects) {
    projectsStore = JSON.parse(savedProjects);
  }
} catch (e) {
  console.log('No saved projects, starting fresh');
}

// Get all projects
app.get('/api/projects', (req, res) => {
  res.json({ projects: projectsStore });
});

// Add new project
app.post('/api/projects', (req, res) => {
  try {
    const project = {
      id: Date.now(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    projectsStore.push(project);
    db.setSetting('projects', JSON.stringify(projectsStore));
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project
app.put('/api/projects/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const index = projectsStore.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }
    projectsStore[index] = {
      ...projectsStore[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    db.setSetting('projects', JSON.stringify(projectsStore));
    res.json(projectsStore[index]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    projectsStore = projectsStore.filter(p => p.id !== id);
    db.setSetting('projects', JSON.stringify(projectsStore));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ACTION FEED / INBOX ENDPOINTS
// ============================================

// In-memory action feed
let actionFeedStore = [];

// Initialize from DB
try {
  const savedFeed = db.getSetting('action_feed');
  if (savedFeed) {
    actionFeedStore = JSON.parse(savedFeed);
  }
} catch (e) {
  console.log('No saved action feed');
}

// Get action feed items
app.get('/api/action-feed', async (req, res) => {
  try {
    // Aggregate from multiple sources
    const tickets = db.getTicketsByStatus([2, 3]) || [];
    const ticketItems = tickets.slice(0, 10).map(t => ({
      id: `ticket-${t.id}`,
      type: 'ticket',
      source: 'freshdesk',
      title: t.subject,
      description: t.description_text?.substring(0, 100) || '',
      priority: t.priority === 4 ? 'urgent' : t.priority === 3 ? 'high' : t.priority === 2 ? 'medium' : 'low',
      status: 'unread',
      timestamp: t.created_at,
      metadata: { ticketId: t.id, requester: t.requester_email }
    }));

    // Combine with stored items
    const allItems = [...ticketItems, ...actionFeedStore]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);

    res.json({ items: allItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add action feed item
app.post('/api/action-feed', (req, res) => {
  try {
    const item = {
      id: `custom-${Date.now()}`,
      ...req.body,
      timestamp: new Date().toISOString(),
      status: 'unread'
    };
    actionFeedStore.unshift(item);
    db.setSetting('action_feed', JSON.stringify(actionFeedStore.slice(0, 100)));
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update action feed item status
app.patch('/api/action-feed/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const index = actionFeedStore.findIndex(item => item.id === id);
    if (index !== -1) {
      actionFeedStore[index] = { ...actionFeedStore[index], status };
      db.setSetting('action_feed', JSON.stringify(actionFeedStore.slice(0, 100)));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENHANCED COMMANDER ENDPOINT (Full Context)
// ============================================

app.post('/api/commander/full-context', async (req, res) => {
  try {
    const { message, userId = 'sv' } = req.body;

    // Gather full context from the command center
    const tickets = db.getTicketsByStatus([2, 3, 4, 5, 6, 7]) || [];
    const analyses = db.getAllAnalysisMap() || {};
    const conversations = memory.getConversations(userId, 10) || [];

    // Build comprehensive context
    const context = {
      ticketSummary: {
        total: tickets.length,
        open: tickets.filter(t => t.status === 2).length,
        pending: tickets.filter(t => t.status === 3).length,
        urgent: tickets.filter(t => t.priority === 4).length,
        high: tickets.filter(t => t.priority === 3).length,
        recentTickets: tickets.slice(0, 10).map(t => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          type: t.type
        }))
      },
      projectSummary: {
        total: projectsStore.length,
        byStatus: projectsStore.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {}),
        totalValue: projectsStore.reduce((acc, p) => ({
          min: acc.min + (p.valueMin || 0),
          max: acc.max + (p.valueMax || 0)
        }), { min: 0, max: 0 })
      },
      recentConversations: conversations.length,
      timestamp: new Date().toISOString()
    };

    // Generate AI response with full context
    const systemPrompt = `You are the LIV8 Command Center AI Assistant. You have access to the following context about the user's work:

TICKETS: ${context.ticketSummary.total} total (${context.ticketSummary.open} open, ${context.ticketSummary.pending} pending, ${context.ticketSummary.urgent} urgent)
PROJECTS: ${context.projectSummary.total} software projects worth $${context.projectSummary.totalValue.min.toLocaleString()}-$${context.projectSummary.totalValue.max.toLocaleString()}
RECENT CONVERSATIONS: ${context.recentConversations}

Recent Tickets:
${context.ticketSummary.recentTickets.map(t => `- #${t.id}: ${t.subject} (Priority: ${t.priority}, Status: ${t.status})`).join('\n')}

Based on this context, help the user with their request. Be specific, actionable, and reference actual data when relevant.`;

    const response = await ai.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]);

    res.json({
      response: response,
      context: context
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ACTION ITEMS ENDPOINTS
// ============================================

let actionItemsStore = [];

try {
  const saved = db.getSetting('action_items');
  if (saved) actionItemsStore = JSON.parse(saved);
} catch (e) {}

app.get('/api/action-items', (req, res) => {
  res.json({ items: actionItemsStore });
});

app.post('/api/action-items', (req, res) => {
  try {
    const item = {
      id: Date.now(),
      ...req.body,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    actionItemsStore.push(item);
    db.setSetting('action_items', JSON.stringify(actionItemsStore));
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/action-items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const index = actionItemsStore.findIndex(item => item.id === id);
    if (index !== -1) {
      actionItemsStore[index] = { ...actionItemsStore[index], ...req.body };
      db.setSetting('action_items', JSON.stringify(actionItemsStore));
      res.json(actionItemsStore[index]);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/action-items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    actionItemsStore = actionItemsStore.filter(item => item.id !== id);
    db.setSetting('action_items', JSON.stringify(actionItemsStore));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CLOUDFLARE INTEGRATION ENDPOINTS
// ============================================

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// Get Cloudflare domains
app.get('/api/cloudflare/domains', async (req, res) => {
  try {
    const apiKey = process.env.CLOUDFLARE_API_KEY;
    const email = process.env.CLOUDFLARE_EMAIL;

    if (!apiKey || !email) {
      return res.json({ domains: [], configured: false });
    }

    const response = await fetch(`${CF_API_BASE}/zones`, {
      headers: {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (data.success) {
      res.json({
        configured: true,
        domains: data.result.map(z => ({
          id: z.id,
          name: z.name,
          status: z.status,
          nameServers: z.name_servers,
          plan: z.plan?.name
        }))
      });
    } else {
      res.json({ domains: [], configured: true, error: data.errors });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Cloudflare Workers
app.get('/api/cloudflare/workers', async (req, res) => {
  try {
    const apiKey = process.env.CLOUDFLARE_API_KEY;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiKey || !accountId) {
      return res.json({ workers: [], configured: false });
    }

    const response = await fetch(`${CF_API_BASE}/accounts/${accountId}/workers/scripts`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (data.success) {
      res.json({
        configured: true,
        workers: data.result.map(w => ({
          id: w.id,
          name: w.id,
          modified: w.modified_on,
          created: w.created_on
        }))
      });
    } else {
      res.json({ workers: [], configured: true, error: data.errors });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TELEGRAM PERSONAL ASSISTANT ENDPOINTS
// ============================================

const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '8301866763:AAG_449bdRcxGSlH-YiN-feMCBfmRYXu5Kw',
  chatId: process.env.TELEGRAM_CHAT_ID || '364565164'
};

// Send message to personal assistant via Telegram
async function sendToTelegram(message, parseMode = 'HTML') {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CONFIG.chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || 'Failed to send Telegram message');
    }
    return { success: true, messageId: data.result.message_id };
  } catch (error) {
    console.error('Telegram send error:', error);
    return { success: false, error: error.message };
  }
}

// Generic send to PA endpoint
app.post('/api/telegram/send', async (req, res) => {
  try {
    const { message, type, data } = req.body;

    let formattedMessage = '';
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    switch (type) {
      case 'ticket':
        // Format ticket for Telegram
        const t = data;
        formattedMessage = `🎫 <b>TICKET ALERT</b>\n\n` +
          `<b>${t.subject || 'No Subject'}</b>\n\n` +
          `📊 Status: ${t.status || 'Unknown'}\n` +
          `⚡ Priority: ${t.priority || 'Normal'}\n` +
          `👤 Requester: ${t.requester || 'Unknown'}\n` +
          (t.company ? `🏢 Company: ${t.company}\n` : '') +
          `\n📝 <b>Summary:</b>\n${t.summary || t.description || 'No description'}\n` +
          (t.aiAnalysis ? `\n🤖 <b>AI Analysis:</b>\n${t.aiAnalysis}\n` : '') +
          (t.suggestedAction ? `\n💡 <b>Suggested Action:</b>\n${t.suggestedAction}\n` : '') +
          (t.url ? `\n🔗 ${t.url}\n` : '') +
          `\n⏰ Sent: ${timestamp}`;
        break;

      case 'task':
        // Format task for Telegram
        const task = data;
        formattedMessage = `✅ <b>TASK REMINDER</b>\n\n` +
          `<b>${task.title || task.name}</b>\n\n` +
          (task.description ? `📝 ${task.description}\n\n` : '') +
          (task.priority ? `⚡ Priority: ${task.priority}\n` : '') +
          (task.dueDate ? `📅 Due: ${task.dueDate}\n` : '') +
          (task.assignedTo ? `👤 Assigned: ${task.assignedTo}\n` : '') +
          (task.project ? `📁 Project: ${task.project}\n` : '') +
          `\n⏰ Sent: ${timestamp}`;
        break;

      case 'reminder':
        // Simple reminder
        formattedMessage = `⏰ <b>REMINDER</b>\n\n${message}\n\n📅 ${timestamp}`;
        break;

      case 'note':
        // Quick note to self
        formattedMessage = `📝 <b>NOTE TO SELF</b>\n\n${message}\n\n⏰ ${timestamp}`;
        break;

      case 'ai_summary':
        // AI-generated summary
        formattedMessage = `🤖 <b>AI SUMMARY</b>\n\n${message}\n\n⏰ ${timestamp}`;
        break;

      case 'action_item':
        // Action item from meeting/discussion
        const action = data || {};
        formattedMessage = `🎯 <b>ACTION ITEM</b>\n\n` +
          `<b>${action.title || message}</b>\n\n` +
          (action.context ? `📋 Context: ${action.context}\n` : '') +
          (action.deadline ? `⏳ Deadline: ${action.deadline}\n` : '') +
          (action.steps ? `\n📌 Steps:\n${action.steps}\n` : '') +
          `\n⏰ ${timestamp}`;
        break;

      default:
        // Raw message
        formattedMessage = message || 'Empty message';
    }

    const result = await sendToTelegram(formattedMessage);

    if (result.success) {
      // Log to action feed
      try {
        const actionFeed = db.prepare('SELECT actions FROM settings WHERE key = ?').get('action_feed');
        const actions = actionFeed?.actions ? JSON.parse(actionFeed.actions) : [];
        actions.unshift({
          id: Date.now().toString(),
          type: 'telegram_sent',
          title: `Sent to PA: ${type || 'message'}`,
          description: (message || data?.subject || data?.title || '').substring(0, 100),
          timestamp: new Date().toISOString(),
          source: 'telegram'
        });
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('action_feed', JSON.stringify(actions.slice(0, 100)));
      } catch (e) { /* ignore logging errors */ }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Quick send endpoints for convenience
app.post('/api/telegram/ticket', async (req, res) => {
  req.body.type = 'ticket';
  req.body.data = req.body.ticket || req.body.data;
  return app._router.handle({ ...req, url: '/api/telegram/send', method: 'POST' }, res, () => {});
});

app.post('/api/telegram/reminder', async (req, res) => {
  const { message } = req.body;
  const result = await sendToTelegram(`⏰ <b>REMINDER</b>\n\n${message}\n\n📅 ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
  res.json(result);
});

app.post('/api/telegram/note', async (req, res) => {
  const { message } = req.body;
  const result = await sendToTelegram(`📝 <b>NOTE</b>\n\n${message}\n\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
  res.json(result);
});

// Get telegram config status
app.get('/api/telegram/status', (req, res) => {
  res.json({
    configured: !!TELEGRAM_CONFIG.botToken && !!TELEGRAM_CONFIG.chatId,
    chatId: TELEGRAM_CONFIG.chatId ? '***' + TELEGRAM_CONFIG.chatId.slice(-4) : null
  });
});

// Send daily report to PA via Telegram
app.post('/api/telegram/daily-report', async (req, res) => {
  try {
    const result = await dailyReport.sendReportToTelegram();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send quick status update to PA
app.post('/api/telegram/quick-status', async (req, res) => {
  try {
    const result = await dailyReport.sendQuickStatusToTelegram();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send any Command Center context to PA
app.post('/api/telegram/command-center', async (req, res) => {
  try {
    const { section, data, message } = req.body;
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    let formattedMessage = '';

    switch (section) {
      case 'project':
        const p = data;
        formattedMessage = `📁 <b>PROJECT UPDATE</b>\n\n` +
          `<b>${p.name}</b>\n` +
          (p.status ? `Status: ${p.status}\n` : '') +
          (p.description ? `\n${p.description}\n` : '') +
          (p.nextSteps ? `\n📋 Next Steps:\n${p.nextSteps}\n` : '') +
          `\n⏰ ${timestamp}`;
        break;

      case 'action_item':
        const a = data;
        formattedMessage = `🎯 <b>ACTION ITEM</b>\n\n` +
          `<b>${a.title || a.name}</b>\n\n` +
          (a.description ? `${a.description}\n\n` : '') +
          (a.priority ? `⚡ Priority: ${a.priority}\n` : '') +
          (a.dueDate ? `📅 Due: ${a.dueDate}\n` : '') +
          (a.assignedTo ? `👤 Assigned: ${a.assignedTo}\n` : '') +
          `\n⏰ ${timestamp}`;
        break;

      case 'domain':
        const d = data;
        formattedMessage = `🌐 <b>DOMAIN UPDATE</b>\n\n` +
          `<b>${d.name}</b>\n` +
          (d.status ? `Status: ${d.status}\n` : '') +
          (d.value ? `💰 Value: $${d.value}\n` : '') +
          (d.notes ? `\n📝 ${d.notes}\n` : '') +
          `\n⏰ ${timestamp}`;
        break;

      case 'agent':
        const ag = data;
        formattedMessage = `🤖 <b>AGENT UPDATE</b>\n\n` +
          `<b>${ag.name}</b>\n` +
          (ag.role ? `Role: ${ag.role}\n` : '') +
          (ag.status ? `Status: ${ag.status}\n` : '') +
          (ag.lastTask ? `\nLast Task: ${ag.lastTask}\n` : '') +
          `\n⏰ ${timestamp}`;
        break;

      case 'github':
        const g = data;
        formattedMessage = `📦 <b>GITHUB UPDATE</b>\n\n` +
          `<b>${g.repo || g.name}</b>\n` +
          (g.action ? `Action: ${g.action}\n` : '') +
          (g.branch ? `Branch: ${g.branch}\n` : '') +
          (g.description ? `\n${g.description}\n` : '') +
          (g.url ? `\n🔗 ${g.url}\n` : '') +
          `\n⏰ ${timestamp}`;
        break;

      case 'summary':
        formattedMessage = `📊 <b>COMMAND CENTER SUMMARY</b>\n\n` +
          `${message || 'No summary provided'}\n\n` +
          `⏰ ${timestamp}`;
        break;

      default:
        formattedMessage = message || (data ? JSON.stringify(data, null, 2) : 'Empty message');
    }

    const result = await sendToTelegram(formattedMessage);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLICKUP SOP INTEGRATION
// ============================================
import * as clickupSop from './lib/clickup-sop.js';

// Webhook receiver — ClickUp sends events here
app.post('/api/clickup/webhook', async (req, res) => {
  // Acknowledge immediately (ClickUp retries if no 200 within 30s)
  res.sendStatus(200);

  try {
    const payload = req.body;
    console.log(`[ClickUp Webhook] Event: ${payload.event}, Task: ${payload.task_id || payload.page_id || 'N/A'}`);

    // Process the event
    const entry = await clickupSop.processWebhookEvent(payload);

    // Check if this is an SOP (filter by space/folder/list if configured)
    const sopFilter = process.env.CLICKUP_SOP_SPACE || process.env.CLICKUP_SOP_FOLDER || process.env.CLICKUP_SOP_LIST;
    if (sopFilter) {
      const matchSpace = !process.env.CLICKUP_SOP_SPACE || (entry.space_name || '').toLowerCase().includes(process.env.CLICKUP_SOP_SPACE.toLowerCase());
      const matchFolder = !process.env.CLICKUP_SOP_FOLDER || (entry.folder_name || '').toLowerCase().includes(process.env.CLICKUP_SOP_FOLDER.toLowerCase());
      const matchList = !process.env.CLICKUP_SOP_LIST || (entry.list_name || '').toLowerCase().includes(process.env.CLICKUP_SOP_LIST.toLowerCase());
      if (!matchSpace && !matchFolder && !matchList) {
        console.log(`[ClickUp] Skipping non-SOP event: ${entry.title}`);
        return;
      }
    }

    // Get notification recipients from env or request
    const notifyCC = process.env.CLICKUP_NOTIFY_CC || '';
    const notifyBCC = process.env.CLICKUP_NOTIFY_BCC || '';

    // Send email notification
    const emailResult = await clickupSop.notifyViaEmail(entry, {
      cc: notifyCC,
      bcc: notifyBCC
    });
    entry.notified_emails = emailResult.success ? emailResult.notified : null;

    // Send Slack notification
    const slackResult = await clickupSop.notifyViaSlack(entry);
    entry.notified_slack = slackResult.success;

    // Sync content to AI knowledge base
    const synced = clickupSop.syncToKnowledgeBase(entry);
    entry.synced_to_kb = synced;

    // Log to database
    db.logSOPChange(entry);

    console.log(`[ClickUp SOP] Logged: "${entry.title}" | Email: ${emailResult.success} | Slack: ${slackResult.success} | KB: ${synced}`);
  } catch (error) {
    console.error('[ClickUp Webhook Error]', error.message);
  }
});

// Get SOP change log
app.get('/api/clickup/sop-log', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const log = db.getSOPLog(limit, offset);
    res.json({ success: true, log, count: log.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single SOP log entry
app.get('/api/clickup/sop-log/:id', (req, res) => {
  try {
    const entry = db.getSOPLogEntry(parseInt(req.params.id));
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, entry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Setup ClickUp webhook (one-time setup helper)
app.post('/api/clickup/setup-webhook', async (req, res) => {
  try {
    if (!clickupSop.isConfigured()) {
      return res.status(400).json({ error: 'CLICKUP_API_TOKEN not set. Add it in Render env vars.' });
    }

    const { teamId, events } = req.body;

    // If no teamId, fetch teams first
    let targetTeamId = teamId;
    if (!targetTeamId) {
      const teams = await clickupSop.getTeams();
      if (!teams.teams || teams.teams.length === 0) {
        return res.status(400).json({ error: 'No teams found in your ClickUp workspace' });
      }
      targetTeamId = teams.teams[0].id;
    }

    const callbackUrl = `${process.env.APP_URL || 'https://liv8-command-center-api.onrender.com'}/api/clickup/webhook`;
    const result = await clickupSop.createWebhook(targetTeamId, callbackUrl, events);

    res.json({
      success: true,
      webhook: result,
      callbackUrl,
      teamId: targetTeamId,
      message: 'Webhook created! ClickUp will now send SOP updates to your Command Center.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List existing ClickUp webhooks
app.get('/api/clickup/webhooks', async (req, res) => {
  try {
    if (!clickupSop.isConfigured()) {
      return res.json({ configured: false, error: 'CLICKUP_API_TOKEN not set' });
    }
    const { teamId } = req.query;
    let targetTeamId = teamId;
    if (!targetTeamId) {
      const teams = await clickupSop.getTeams();
      targetTeamId = teams.teams?.[0]?.id;
    }
    if (!targetTeamId) return res.json({ webhooks: [] });

    const result = await clickupSop.listWebhooks(targetTeamId);
    res.json({ success: true, webhooks: result.webhooks || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a ClickUp webhook
app.delete('/api/clickup/webhooks/:id', async (req, res) => {
  try {
    const success = await clickupSop.deleteWebhook(req.params.id);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update notification settings (CC/BCC emails, Slack URL)
app.post('/api/clickup/notification-settings', (req, res) => {
  try {
    const { ccEmails, bccEmails, slackWebhookUrl } = req.body;

    // Save to settings in DB
    if (ccEmails !== undefined) db.setSetting('clickup_notify_cc', ccEmails);
    if (bccEmails !== undefined) db.setSetting('clickup_notify_bcc', bccEmails);
    if (slackWebhookUrl !== undefined) db.setSetting('clickup_slack_webhook', slackWebhookUrl);

    res.json({
      success: true,
      settings: {
        ccEmails: ccEmails || db.getSetting('clickup_notify_cc') || '',
        bccEmails: bccEmails || db.getSetting('clickup_notify_bcc') || '',
        slackWebhookUrl: slackWebhookUrl ? '***configured***' : db.getSetting('clickup_slack_webhook') ? '***configured***' : 'not set'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test SOP notification (send a test email/slack)
app.post('/api/clickup/test-notification', async (req, res) => {
  try {
    const { cc, bcc } = req.body;
    const testEntry = {
      clickup_doc_id: 'test-123',
      event_type: 'taskUpdated',
      title: 'TEST — SOP Notification Check',
      url: 'https://app.clickup.com',
      space_name: 'Support SOPs',
      folder_name: 'Test',
      changed_by: 'AutoPort Test',
      change_summary: 'This is a test notification to verify your SOP alert pipeline is working.',
      content_snapshot: 'If you received this, your ClickUp SOP notifications are configured correctly! Email, Slack, and knowledge base sync are all active.'
    };

    const emailResult = await clickupSop.notifyViaEmail(testEntry, {
      cc: cc || process.env.CLICKUP_NOTIFY_CC || '',
      bcc: bcc || process.env.CLICKUP_NOTIFY_BCC || ''
    });
    const slackResult = await clickupSop.notifyViaSlack(testEntry);

    res.json({
      success: true,
      email: emailResult,
      slack: slackResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ClickUp integration status
app.get('/api/clickup/status', (req, res) => {
  res.json({
    configured: clickupSop.isConfigured(),
    hasSlack: !!process.env.SLACK_WEBHOOK_URL,
    hasEmail: emailService.isEmailEnabled(),
    sopFilter: {
      space: process.env.CLICKUP_SOP_SPACE || null,
      folder: process.env.CLICKUP_SOP_FOLDER || null,
      list: process.env.CLICKUP_SOP_LIST || null
    },
    notifyCC: process.env.CLICKUP_NOTIFY_CC || db.getSetting('clickup_notify_cc') || '',
    notifyBCC: process.env.CLICKUP_NOTIFY_BCC || db.getSetting('clickup_notify_bcc') || ''
  });
});

// Register Nifty routes
registerNiftyRoutes(app);

// Register Scraper routes (RapidAPI + Apify)
registerScraperRoutes(app);

// ═══════════════════════════════════════════════════════════
//  DAILY NEWS DIGEST — Morning briefing email
// ═══════════════════════════════════════════════════════════
app.post('/api/news/send-digest', async (req, res) => {
  try {
    const { email } = req.body;
    const targetEmail = email || process.env.REPORT_EMAIL;
    if (!targetEmail) {
      return res.status(400).json({ error: 'No email configured. Set REPORT_EMAIL env var or pass email in body.' });
    }

    // Gather news from multiple categories
    const categories = [
      { label: 'Markets & Trading', query: 'stock market nasdaq futures trading' },
      { label: 'Crypto', query: 'cryptocurrency bitcoin solana ethereum' },
      { label: 'Tech & AI', query: 'technology AI artificial intelligence' },
      { label: 'World News', query: 'world news economy geopolitics' },
      { label: 'Investing', query: 'investing portfolio wealth management' }
    ];

    const allNews = {};
    for (const cat of categories) {
      try {
        const news = await newsService.fetchFinancialNews({ topics: [cat.query], limit: 5 });
        allNews[cat.label] = news || [];
      } catch {
        allNews[cat.label] = [];
      }
    }

    // Get crypto prices
    let cryptoPrices = '';
    try {
      const cryptoResp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true');
      if (cryptoResp.ok) {
        const data = await cryptoResp.json();
        const fmt = (coin) => data[coin] ? `$${data[coin].usd.toLocaleString()} (${data[coin].usd_24h_change >= 0 ? '+' : ''}${data[coin].usd_24h_change.toFixed(2)}%)` : 'N/A';
        cryptoPrices = `BTC: ${fmt('bitcoin')} | ETH: ${fmt('ethereum')} | SOL: ${fmt('solana')}`;
      }
    } catch { /* ignore */ }

    // Build HTML email
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let newsHtml = '';
    for (const [category, items] of Object.entries(allNews)) {
      if (items.length === 0) continue;
      newsHtml += `<h3 style="color:#6366f1;margin:24px 0 12px;font-size:16px;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">${category}</h3>`;
      for (const item of items) {
        newsHtml += `
          <div style="margin-bottom:16px;">
            <a href="${item.url || '#'}" style="color:#111827;text-decoration:none;font-weight:600;font-size:14px;">${item.title || 'Untitled'}</a>
            ${item.description ? `<p style="color:#6b7280;font-size:13px;margin:4px 0 0;">${item.description.substring(0, 200)}${item.description.length > 200 ? '...' : ''}</p>` : ''}
            <p style="color:#9ca3af;font-size:11px;margin:4px 0 0;">${item.source || ''} · ${item.publishedAt ? new Date(item.publishedAt).toLocaleString() : ''}</p>
          </div>`;
      }
    }

    const html = `
      <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Daily News Digest</h1>
          <p style="color:#a5b4fc;margin:8px 0 0;font-size:13px;">${dateStr}</p>
        </div>
        ${cryptoPrices ? `
        <div style="background:#f0fdf4;padding:14px 20px;border:1px solid #86efac;">
          <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">Market Snapshot</p>
          <p style="margin:4px 0 0;font-size:14px;color:#065f46;font-family:monospace;">${cryptoPrices}</p>
        </div>` : ''}
        <div style="padding:20px;background:#fff;border:1px solid #e5e7eb;border-top:none;">
          ${newsHtml || '<p style="color:#6b7280;">No news available today. Check back later.</p>'}
        </div>
        <div style="background:#f9fafb;padding:16px 20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
          <a href="${process.env.APP_URL || 'https://command.liv8.co'}" style="color:#6366f1;font-size:13px;text-decoration:none;">Open Command Center</a>
          <p style="color:#9ca3af;font-size:11px;margin:8px 0 0;">Powered by LIV8 Command Center</p>
        </div>
      </div>`;

    const plainText = Object.entries(allNews).map(([cat, items]) =>
      `--- ${cat} ---\n` + items.map(i => `• ${i.title}\n  ${i.url || ''}`).join('\n')
    ).join('\n\n');

    // Send via existing email service
    if (!emailService.isEmailEnabled()) {
      return res.status(400).json({ error: 'Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.' });
    }

    await emailService.sendEmail({
      to: targetEmail,
      subject: `Daily News Digest — ${dateStr}`,
      html,
      text: `Daily News Digest - ${dateStr}\n\n${cryptoPrices}\n\n${plainText}`
    });

    res.json({ success: true, sentTo: targetEmail, categories: Object.keys(allNews).length });
  } catch (error) {
    console.error('News digest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// News digest scheduling happens in app.listen callback below

// ═══════════════════════════════════════════════════════════
//  TRADE SIGNALS — TradingView Webhook Receiver + Signal API
// ═══════════════════════════════════════════════════════════

// In-memory signal store (persists to DB when available)
const tradeSignals = [];
const MAX_SIGNALS = 200;

// POST /api/trade-signals/webhook — Receive TradingView alerts
app.post('/api/trade-signals/webhook', (req, res) => {
  try {
    const payload = req.body;
    console.log('[TRADE SIGNAL] Received webhook:', JSON.stringify(payload).substring(0, 500));

    // Parse flexible TradingView alert format
    const signal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      symbol: payload.symbol || payload.ticker || payload.pair || 'UNKNOWN',
      action: (payload.action || payload.side || payload.direction || payload.order || 'INFO').toUpperCase(),
      entry: parseFloat(payload.entry || payload.price || payload.entry_price || payload.close || 0),
      stopLoss: parseFloat(payload.stop_loss || payload.sl || payload.stoploss || 0),
      tp1: parseFloat(payload.tp1 || payload.take_profit_1 || payload.target1 || 0),
      tp2: parseFloat(payload.tp2 || payload.take_profit_2 || payload.target2 || 0),
      tp3: parseFloat(payload.tp3 || payload.take_profit_3 || payload.target3 || 0),
      source: payload.source || payload.strategy || payload.indicator || 'TradingView',
      channel: payload.channel || 'Webhook',
      timeframe: payload.timeframe || payload.interval || '',
      message: payload.message || payload.comment || payload.text || '',
      status: 'NEW',
      viewedAt: null,
      executedAt: null,
      receivedAt: new Date().toISOString(),
      raw: payload
    };

    // Store signal
    tradeSignals.unshift(signal);
    if (tradeSignals.length > MAX_SIGNALS) tradeSignals.length = MAX_SIGNALS;

    // Try to persist to DB
    try {
      db.saveSetting(`trade_signal_${signal.id}`, JSON.stringify(signal));
    } catch (e) { /* non-critical */ }

    console.log(`[TRADE SIGNAL] ${signal.symbol} ${signal.action} @ ${signal.entry} | SL: ${signal.stopLoss} | TP1: ${signal.tp1}`);

    // Forward to TaskMagic if configured
    const taskmagicUrl = process.env.TASKMAGIC_WEBHOOK_URL;
    if (taskmagicUrl) {
      fetch(taskmagicUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      }).catch(e => console.log('TaskMagic forward error:', e.message));
    }

    res.json({ success: true, signalId: signal.id });
  } catch (error) {
    console.error('Trade signal webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trade-signals — Get all signals
app.get('/api/trade-signals', (req, res) => {
  const { status, symbol, limit } = req.query;
  let filtered = [...tradeSignals];
  if (status) filtered = filtered.filter(s => s.status === status.toUpperCase());
  if (symbol) filtered = filtered.filter(s => s.symbol.toUpperCase().includes(symbol.toUpperCase()));
  const max = parseInt(limit) || 50;
  res.json({ signals: filtered.slice(0, max), total: filtered.length });
});

// PATCH /api/trade-signals/:id — Update signal status
app.patch('/api/trade-signals/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const signal = tradeSignals.find(s => s.id === id);
  if (!signal) return res.status(404).json({ error: 'Signal not found' });
  signal.status = status || signal.status;
  if (status === 'VIEWED') signal.viewedAt = new Date().toISOString();
  if (status === 'EXECUTED') signal.executedAt = new Date().toISOString();
  res.json({ success: true, signal });
});

// GET /api/trade-signals/prices — Free market prices (CoinGecko + proxy)
app.get('/api/trade-signals/prices', async (req, res) => {
  try {
    // Fetch from CoinGecko (free, no key needed)
    const cryptoResp = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true'
    );
    const cryptoData = cryptoResp.ok ? await cryptoResp.json() : {};

    // Fetch futures/forex from free sources
    // Using TradingView mini-chart data (publicly accessible)
    const prices = {
      crypto: {
        BTC: cryptoData.bitcoin ? {
          price: cryptoData.bitcoin.usd, change24h: cryptoData.bitcoin.usd_24h_change,
          volume24h: cryptoData.bitcoin.usd_24h_vol, marketCap: cryptoData.bitcoin.usd_market_cap, name: 'Bitcoin'
        } : null,
        ETH: cryptoData.ethereum ? {
          price: cryptoData.ethereum.usd, change24h: cryptoData.ethereum.usd_24h_change,
          volume24h: cryptoData.ethereum.usd_24h_vol, marketCap: cryptoData.ethereum.usd_market_cap, name: 'Ethereum'
        } : null,
        SOL: cryptoData.solana ? {
          price: cryptoData.solana.usd, change24h: cryptoData.solana.usd_24h_change,
          volume24h: cryptoData.solana.usd_24h_vol, marketCap: cryptoData.solana.usd_market_cap, name: 'Solana'
        } : null,
        BNB: cryptoData.binancecoin ? {
          price: cryptoData.binancecoin.usd, change24h: cryptoData.binancecoin.usd_24h_change,
          volume24h: cryptoData.binancecoin.usd_24h_vol, marketCap: cryptoData.binancecoin.usd_market_cap, name: 'BNB'
        } : null
      },
      // Futures/Forex - these will be populated by TradingView widgets on frontend
      // Server provides what's freely available
      futures: {
        NQ: { name: 'NASDAQ 100 Futures', symbol: 'NQ1!', exchange: 'CME' },
        MNQ: { name: 'Micro NASDAQ Futures', symbol: 'MNQ1!', exchange: 'CME' },
        ES: { name: 'S&P 500 Futures', symbol: 'ES1!', exchange: 'CME' },
        CL: { name: 'Crude Oil Futures', symbol: 'CL1!', exchange: 'NYMEX' },
        GC: { name: 'Gold Futures', symbol: 'GC1!', exchange: 'COMEX' },
      },
      forex: {
        'NAS100': { name: 'NAS100 (CFD)', symbol: 'OANDA:NAS100USD' },
        'XAUUSD': { name: 'Gold Spot', symbol: 'OANDA:XAUUSD' },
        'USOIL': { name: 'US Oil', symbol: 'TVC:USOIL' },
        'EURUSD': { name: 'EUR/USD', symbol: 'FX:EURUSD' },
        'GBPUSD': { name: 'GBP/USD', symbol: 'FX:GBPUSD' },
      },
      updatedAt: new Date().toISOString()
    };

    res.json(prices);
  } catch (error) {
    console.error('Price fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  AUTOPORT — Phone Number Porting Tool (embedded from AutoPort)
// ═══════════════════════════════════════════════════════════

// POST /api/porting/extract — Smart paste AI extraction
app.post('/api/porting/extract', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Please paste ticket content (at least 10 characters)' });
    }

    let extracted;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      extracted = await portingExtractGemini(text, geminiKey);
    } else if (openaiKey) {
      extracted = await portingExtractOpenAI(text, openaiKey);
    } else {
      extracted = portingExtractRegex(text);
    }

    res.json({ success: true, extracted, method: geminiKey ? 'gemini' : openaiKey ? 'openai' : 'regex' });
  } catch (err) {
    console.error('Porting extract error:', err);
    try {
      const extracted = portingExtractRegex(req.body.text || '');
      res.json({ success: true, extracted, method: 'regex-fallback' });
    } catch (e) {
      res.status(500).json({ error: err.message });
    }
  }
});

async function portingExtractGemini(text, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const prompt = `Extract porting information from this support ticket text. Return ONLY valid JSON with these fields:
{
  "firstName": "",
  "lastName": "",
  "businessName": "",
  "email": "",
  "phone_numbers": [{"number": "+1XXXXXXXXXX", "type": "LOCAL or MOBILE", "carrier": "", "account_number": "", "pin": ""}],
  "address": {"street": "", "city": "", "state": "", "zip": ""},
  "customerType": "individual or business",
  "notes": "any other relevant context"
}
Leave fields empty string if not found. Normalize phone numbers to +1XXXXXXXXXX format. Here's the ticket:\n\n${text}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    })
  });
  const data = await resp.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');
  return JSON.parse(jsonMatch[0]);
}

async function portingExtractOpenAI(text, apiKey) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [{
        role: 'system',
        content: 'Extract porting info from ticket text. Return ONLY JSON: {firstName, lastName, businessName, email, phone_numbers: [{number: "+1XXXXXXXXXX", type, carrier, account_number, pin}], address: {street, city, state, zip}, customerType: "individual"|"business", notes}'
      }, { role: 'user', content: text }]
    })
  });
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON');
  return JSON.parse(jsonMatch[0]);
}

function portingExtractRegex(text) {
  const result = {
    firstName: '', lastName: '', businessName: '', email: '',
    phone_numbers: [], address: { street: '', city: '', state: '', zip: '' },
    customerType: 'individual', notes: ''
  };
  // Phone numbers
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
  let match;
  const seen = new Set();
  while ((match = phoneRegex.exec(text)) !== null) {
    const num = `+1${match[1]}${match[2]}${match[3]}`;
    if (!seen.has(num)) {
      seen.add(num);
      result.phone_numbers.push({ number: num, type: 'LOCAL', carrier: '', account_number: '', pin: '' });
    }
  }
  // Email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) result.email = emailMatch[0];
  // Name
  const nameMatch = text.match(/(?:name|customer|account holder|authorized)[:\s]*([A-Z][a-z]+)\s+([A-Z][a-z]+)/i);
  if (nameMatch) { result.firstName = nameMatch[1]; result.lastName = nameMatch[2]; }
  // Business
  const bizMatch = text.match(/(?:business|company|org)[:\s]*([A-Z][\w\s&.',-]+?)(?:\n|$|,)/i);
  if (bizMatch) { result.businessName = bizMatch[1].trim(); result.customerType = 'business'; }
  // ZIP
  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) result.address.zip = zipMatch[1];
  // State
  const stateAbbrevs = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
  const states = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
  for (let i = 0; i < states.length; i++) {
    if (text.includes(states[i]) || new RegExp(`\\b${stateAbbrevs[i]}\\b`).test(text)) {
      result.address.state = states[i];
      break;
    }
  }
  // Account/PIN
  const acctMatch = text.match(/(?:account|acct)\s*#?\s*:?\s*(\w+)/i);
  const pinMatch = text.match(/(?:pin|passcode|last 4)\s*:?\s*(\d{4,})/i);
  if (result.phone_numbers.length > 0) {
    if (acctMatch) result.phone_numbers[0].account_number = acctMatch[1];
    if (pinMatch) result.phone_numbers[0].pin = pinMatch[1];
  }
  return result;
}

// POST /api/porting/eligibility — Check number portability
app.post('/api/porting/eligibility', async (req, res) => {
  try {
    const { phoneNumbers, locationId } = req.body;
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ error: 'phoneNumbers array is required' });
    }

    const results = await Promise.all(
      phoneNumbers.map(async (number) => {
        // Normalize
        const digits = number.replace(/\D/g, '');
        const normalized = digits.length === 11 && digits.startsWith('1') ? `+${digits}` : digits.length === 10 ? `+1${digits}` : number;

        // Detect type
        const isTollFree = /^\+1(800|888|877|866|855|844|833)/.test(normalized);
        if (isTollFree) {
          return { number: normalized, portable: false, reason: 'Toll-free numbers require manual porting', type: 'TOLL_FREE' };
        }

        // For now, simulate portability (real Twilio integration can be added)
        return {
          number: normalized,
          portable: true,
          pinRequired: true,
          type: /^\+1(2[0-9]{2}|3[0-9]{2}|4[0-9]{2}|5[0-9]{2}|6[0-9]{2}|7[0-9]{2}|8[0-9]{2}|9[0-9]{2})/.test(normalized) ? 'LOCAL' : 'MOBILE',
          reason: null
        };
      })
    );

    res.json({ results });
  } catch (err) {
    console.error('Eligibility error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/porting/requests — Create port request
app.post('/api/porting/requests', upload.single('billingStatement'), async (req, res) => {
  try {
    let data;
    try {
      data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
    } catch { data = req.body; }

    // Validate required fields
    if (!data.customerName && !(data.firstName && data.lastName)) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    if (!data.phoneNumbers || data.phoneNumbers.length === 0) {
      return res.status(400).json({ error: 'At least one phone number is required' });
    }

    // Generate a simulated port SID (real Twilio can be added later)
    const portSid = 'KW' + Math.random().toString(36).substr(2, 30).toUpperCase();

    // Document SID (simulated)
    let documentSid = null;
    if (req.file) {
      documentSid = 'ME' + Math.random().toString(36).substr(2, 30).toUpperCase();
    }

    // Log to database
    const requestRecord = {
      id: portSid,
      portInSid: portSid,
      locationId: data.locationId || 'unknown',
      customerName: data.customerName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      businessName: data.businessName || null,
      email: data.authorizedRepresentativeEmail || data.email,
      address: data.address,
      phoneNumbers: data.phoneNumbers,
      status: 'waiting_for_signature',
      documentSid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to Supabase if available
    try {
      db.saveSetting(`port_request_${portSid}`, JSON.stringify(requestRecord));
    } catch (e) {
      console.log('Could not save port request to DB:', e.message);
    }

    res.status(201).json({
      success: true,
      portInRequestSid: portSid,
      status: 'waiting_for_signature',
      message: 'Port request created. Check your email to sign the LOA.',
      estimatedCompletionDays: '5-15 business days'
    });
  } catch (err) {
    console.error('Create port request error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/porting/chat — Conversational AI for porting
app.post('/api/porting/chat', async (req, res) => {
  try {
    let { message, history } = req.body;
    if (typeof history === 'string') {
      try { history = JSON.parse(history); } catch { history = []; }
    }
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const systemPrompt = `You are AutoPort AI, an internal porting assistant for a GoHighLevel support agent. You help with:
- Extracting porting details from ticket text (names, addresses, phone numbers, carrier info, account numbers, PINs)
- Explaining porting processes, timelines (2-4 weeks for <50 numbers, 6-8 weeks for larger)
- Troubleshooting port rejections (common causes: wrong name, wrong address, wrong account#/PIN, unauthorized user)
- LOA requirements (must match carrier records exactly)
- Twilio porting API specifics
- CSV formatting for bulk imports

When extracting info from pasted text, output it clearly formatted so the agent can copy it.
When you see phone numbers, always normalize to +1XXXXXXXXXX format.
Be concise and action-oriented — this is an internal tool, not customer-facing.
If the user pastes ticket content, extract ALL porting-relevant fields and present them clearly.`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    let reply;

    if (geminiKey) {
      const historyParts = (history || []).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [...historyParts, { role: 'user', parts: [{ text: message }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
        })
      });
      const data = await resp.json();
      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not process that.';
    } else if (openaiKey) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.3, max_tokens: 2000 })
      });
      const data = await resp.json();
      reply = data.choices?.[0]?.message?.content || 'Sorry, I could not process that.';
    } else {
      // Fallback to main AI provider
      try {
        const result = await ai.generateResponse(message, { systemPrompt, conversationHistory: history || [] });
        reply = result.response || result;
      } catch {
        reply = 'AI not configured for porting chat. Set GEMINI_API_KEY or OPENAI_API_KEY.';
      }
    }

    res.json({ success: true, reply });
  } catch (err) {
    console.error('Porting chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/porting/generate-loa — Generate LOA PDF
app.post('/api/porting/generate-loa', async (req, res) => {
  try {
    const { default: PDFDocument } = await import('pdfkit');
    const { firstName, lastName, businessName, address, phoneNumbers, loaMode } = req.body;

    if (!firstName || !lastName || !phoneNumbers?.length) {
      return res.status(400).json({ error: 'firstName, lastName, and phoneNumbers required' });
    }

    // Group numbers based on LOA mode
    let loaGroups;
    if (loaMode === 'per-number') {
      loaGroups = phoneNumbers.map(n => [n]);
    } else if (loaMode === 'per-carrier') {
      const byCarrier = {};
      phoneNumbers.forEach(n => {
        const carrier = n.carrier || 'Unknown';
        if (!byCarrier[carrier]) byCarrier[carrier] = [];
        byCarrier[carrier].push(n);
      });
      loaGroups = Object.values(byCarrier);
    } else {
      loaGroups = [phoneNumbers];
    }

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="LOA-${firstName}-${lastName}-${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    });

    loaGroups.forEach((group, groupIdx) => {
      if (groupIdx > 0) doc.addPage();

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text('Porting Letter of Authorization (LOA)', { align: 'center' });
      doc.moveDown(1.5);

      // 1. Customer Name
      doc.fontSize(11).font('Helvetica-Bold').text('1. Customer Name (must appear exactly as it does on your telephone bill):');
      doc.moveDown(0.5);
      doc.rect(50, doc.y, 250, 28).stroke('#999');
      doc.rect(310, doc.y, 252, 28).stroke('#999');
      doc.fontSize(8).font('Helvetica').fillColor('#666')
        .text('First Name', 55, doc.y + 3)
        .text('Last Name', 315, doc.y - 8);
      doc.fontSize(12).font('Helvetica').fillColor('#000')
        .text(firstName, 55, doc.y + 4)
        .text(lastName, 315, doc.y - 16);
      doc.y += 22;
      doc.moveDown(0.5);

      if (businessName) {
        doc.rect(50, doc.y, 512, 28).stroke('#999');
        doc.fontSize(8).fillColor('#666').text('Business Name', 55, doc.y + 3);
        doc.fontSize(12).fillColor('#000').text(businessName, 55, doc.y + 4);
        doc.y += 22;
      }
      doc.moveDown(1);

      // 2. Service Address
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
        .text('2. Service Address on file with your current carrier:');
      doc.moveDown(0.5);
      const addr = address || {};
      doc.rect(50, doc.y, 512, 28).stroke('#999');
      doc.fontSize(8).fillColor('#666').text('Address', 55, doc.y + 3);
      doc.fontSize(11).fillColor('#000').text(addr.street || '', 55, doc.y + 4);
      doc.y += 32;

      const addrY = doc.y;
      doc.rect(50, addrY, 200, 28).stroke('#999');
      doc.rect(258, addrY, 150, 28).stroke('#999');
      doc.rect(416, addrY, 146, 28).stroke('#999');
      doc.fontSize(8).fillColor('#666')
        .text('City', 55, addrY + 3)
        .text('State/Province', 263, addrY + 3)
        .text('Zip/Postal Code', 421, addrY + 3);
      doc.fontSize(11).fillColor('#000')
        .text(addr.city || '', 55, addrY + 14)
        .text(addr.state || '', 263, addrY + 14)
        .text(addr.zip || '', 421, addrY + 14);
      doc.y = addrY + 36;
      doc.moveDown(1);

      // 3. Phone Numbers table
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
        .text('3. Telephone Number(s) authorized to change to the Company:');
      doc.moveDown(0.5);

      const tblY = doc.y;
      const colWidths = [140, 130, 130, 112];
      const colX = [50, 190, 320, 450];
      const headers = ['Phone Number*', 'Service Provider', 'Account Number', 'PIN (if applicable)'];

      doc.rect(50, tblY, 512, 22).fill('#e5e5e5').stroke('#999');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
      headers.forEach((h, i) => doc.text(h, colX[i] + 5, tblY + 6, { width: colWidths[i] - 10 }));

      let rowY = tblY + 22;
      for (let j = 0; j < Math.min(group.length, 20); j++) {
        if (rowY > 650) { doc.addPage(); rowY = 50; }
        const n = group[j];
        doc.rect(50, rowY, 512, 26).stroke('#999');
        doc.fontSize(10).font('Helvetica').fillColor('#000');
        const digits = (n.number || '').replace(/\D/g, '');
        const display = digits.length >= 10 ? `(${digits.slice(-10,-7)}) ${digits.slice(-7,-4)}-${digits.slice(-4)}` : n.number;
        doc.text(display, colX[0] + 5, rowY + 7, { width: colWidths[0] - 10 });
        doc.text(n.carrier || '', colX[1] + 5, rowY + 7, { width: colWidths[1] - 10 });
        doc.text(n.account_number || n.account || '', colX[2] + 5, rowY + 7, { width: colWidths[2] - 10 });
        doc.text(n.pin || '', colX[3] + 5, rowY + 7, { width: colWidths[3] - 10 });
        rowY += 26;
      }

      // Authorization text
      const authY = Math.max(rowY + 25, doc.y);
      if (authY > 580) { doc.addPage(); doc.y = 50; } else { doc.y = authY; }

      doc.fontSize(9).font('Helvetica').fillColor('#333')
        .text('By signing the below, I verify that I am, or represent (for a business), the above-named service customer, authorized to change the primary carrier(s) for the telephone number(s) listed, and am at least 18 years of age. The name and address I have provided is the name and address on record with my local telephone company for each telephone number listed. I authorize Twilio (the "Company") or its designated agent to act on my behalf and notify my current carrier(s) to change my preferred carrier(s) for the listed number(s) and service(s).', {
          width: 512, lineGap: 3
        });
      doc.moveDown(2);

      // Signature lines
      const sigY = doc.y;
      doc.strokeColor('#333')
        .moveTo(50, sigY).lineTo(220, sigY).stroke()
        .moveTo(240, sigY).lineTo(420, sigY).stroke()
        .moveTo(440, sigY).lineTo(562, sigY).stroke();
      doc.fontSize(8).fillColor('#666')
        .text('Authorized Signature', 50, sigY + 4)
        .text('Print Name', 240, sigY + 4)
        .text('Date', 440, sigY + 4);

      doc.moveDown(2);
      doc.fontSize(8).fillColor('#999')
        .text('For toll free numbers, please change RespOrg to TWI01.', { align: 'center' })
        .text('Please do not end service on the number for 10 days after RespOrg change.', { align: 'center' });
    });

    doc.end();
  } catch (err) {
    console.error('LOA generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create HTTP server and attach WebSocket for streaming
import { createServer } from 'http';
const httpServer = createServer(app);
streamRelay.initStreamWebSocket(httpServer);

httpServer.listen(PORT, () => {
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

  // Schedule daily news digest at 7 AM EST
  if (process.env.SCHEDULE_ENABLED === 'true' && process.env.REPORT_EMAIL) {
    import('node-cron').then(nodeCron => {
      nodeCron.default.schedule('0 7 * * 2-6', async () => {
        console.log('[NEWS DIGEST] Sending daily morning digest...');
        try {
          const resp = await fetch(`http://localhost:${PORT}/api/news/send-digest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: process.env.REPORT_EMAIL })
          });
          const data = await resp.json();
          console.log('[NEWS DIGEST] Sent:', data);
        } catch (e) {
          console.error('[NEWS DIGEST] Failed:', e.message);
        }
      }, { timezone: process.env.SCHEDULE_TIMEZONE || 'America/New_York' });
      console.log('  [NEWS DIGEST] Daily digest scheduled at 7:00 AM EST');
    });
  }
});
