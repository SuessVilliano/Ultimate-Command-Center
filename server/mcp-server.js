#!/usr/bin/env node
/**
 * LIV8 Command Center - MCP (Model Context Protocol) Server
 *
 * Exposes Command Center capabilities as MCP tools so that AI clients
 * (Claude Desktop, Cursor, Windsurf, custom agents) can interact with
 * tickets, drafts, knowledge base, chat, and more.
 *
 * Transport: stdio (JSON-RPC 2.0, one JSON object per line)
 *
 * Usage:
 *   node server/mcp-server.js
 *
 * In Claude Desktop config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "liv8-command-center": {
 *         "command": "node",
 *         "args": ["path/to/server/mcp-server.js"]
 *       }
 *     }
 *   }
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// ── Lazy-load backend modules ────────────────────────────────

let db, ai, rag, memory, pipeline, orchestrator;

async function initBackend() {
  db = await import('./lib/database.js');
  ai = await import('./lib/ai-provider.js');
  rag = await import('./lib/langchain-rag.js');
  memory = await import('./lib/conversation-memory.js');
  pipeline = await import('./lib/ticket-pipeline.js');
  orchestrator = await import('./lib/agent-orchestrator.js');

  // Initialize
  db.initDatabase();
  memory.initConversationTables();

  ai.initAIProviders({
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    kimiKey: process.env.KIMI_API_KEY || process.env.NVIDIA_API_KEY,
    groqKey: process.env.GROQ_API_KEY,
  });

  try {
    rag.initLangChain({
      anthropicKey: process.env.ANTHROPIC_API_KEY,
      openaiKey: process.env.OPENAI_API_KEY,
    });
  } catch (e) {
    // RAG may fail without embeddings — that's okay
  }

  log('Backend initialized');
}

// ── Logging (stderr only — stdout is for MCP protocol) ───────

function log(...args) {
  process.stderr.write(`[LIV8 MCP] ${args.join(' ')}\n`);
}

// ── MCP Tool Definitions ─────────────────────────────────────

const TOOLS = [
  {
    name: 'search_tickets',
    description: 'Search and list support tickets. Filter by status (2=open, 3=pending, 4=resolved, 5=closed). Returns tickets with AI triage analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Comma-separated status codes to filter (e.g. "2,3"). Default: all open/pending.'
        },
        limit: {
          type: 'number',
          description: 'Max results to return. Default: 20'
        }
      }
    }
  },
  {
    name: 'get_ticket',
    description: 'Get a single ticket by its Freshdesk ID, including AI analysis if available.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The Freshdesk ticket ID' }
      },
      required: ['ticket_id']
    }
  },
  {
    name: 'triage_ticket',
    description: 'Run AI triage on a support ticket. Returns urgency score, escalation type, category, summary, and suggested response.',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Ticket subject line' },
        description: { type: 'string', description: 'Full ticket description/message from customer' },
        requester_name: { type: 'string', description: 'Customer name (optional)' }
      },
      required: ['subject', 'description']
    }
  },
  {
    name: 'generate_draft_response',
    description: 'Generate an AI draft response for a support ticket, using knowledge base context and SOPs.',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Ticket subject' },
        description: { type: 'string', description: 'Ticket description' },
        requester_name: { type: 'string', description: 'Customer name (optional)' }
      },
      required: ['subject', 'description']
    }
  },
  {
    name: 'get_draft_queue',
    description: 'Get the current draft response queue. Filter by status: PENDING_REVIEW, APPROVED, REJECTED, NEEDS_EDIT.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (optional)' },
        limit: { type: 'number', description: 'Max results. Default: 20' }
      }
    }
  },
  {
    name: 'update_draft_status',
    description: 'Approve, reject, or request edits on a draft response.',
    inputSchema: {
      type: 'object',
      properties: {
        draft_id: { type: 'number', description: 'Draft ID' },
        status: {
          type: 'string',
          enum: ['APPROVED', 'REJECTED', 'NEEDS_EDIT', 'ESCALATION_RECOMMENDED'],
          description: 'New status'
        }
      },
      required: ['draft_id', 'status']
    }
  },
  {
    name: 'search_knowledge_base',
    description: 'Search the resolved ticket knowledge base using semantic/keyword search. Finds similar past tickets and their resolutions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results. Default: 5' }
      },
      required: ['query']
    }
  },
  {
    name: 'ask_knowledge_base',
    description: 'Ask a question about past tickets, resolutions, and patterns. Uses RAG (Retrieval Augmented Generation) for accurate answers.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Your question' }
      },
      required: ['question']
    }
  },
  {
    name: 'search_casebook',
    description: 'Search the casebook of human-approved gold-standard responses for similar issues.',
    inputSchema: {
      type: 'object',
      properties: {
        terms: { type: 'string', description: 'Search terms' },
        limit: { type: 'number', description: 'Max results. Default: 5' }
      },
      required: ['terms']
    }
  },
  {
    name: 'chat',
    description: 'Send a message to the LIV8 AI assistant and get a response. Supports conversational context.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Your message' }
      },
      required: ['message']
    }
  },
  {
    name: 'route_to_agent',
    description: 'Route a request to the best specialized agent (highlevel-specialist, hybrid-grid, dev-ops, content-creator, business-analyst, legal-contracts).',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The request to route' }
      },
      required: ['message']
    }
  },
  {
    name: 'get_memory_facts',
    description: 'Retrieve learned facts and context from the Command Center memory system.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Fact category (e.g. general, tasks, preferences). Optional.' }
      }
    }
  },
  {
    name: 'store_memory_fact',
    description: 'Store a new fact in the Command Center long-term memory.',
    inputSchema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'The fact to remember' },
        category: { type: 'string', description: 'Category. Default: general' }
      },
      required: ['fact']
    }
  },
  {
    name: 'get_system_status',
    description: 'Get overall Command Center status: AI provider, database stats, pipeline status, knowledge base size.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'process_ticket_pipeline',
    description: 'Run a ticket through the full processing pipeline: triage → context search → draft generation → QA evaluation.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'number', description: 'The ticket ID to process' }
      },
      required: ['ticket_id']
    }
  }
];

// ── Tool Handlers ────────────────────────────────────────────

async function handleToolCall(name, args) {
  switch (name) {
    case 'search_tickets': {
      const statuses = args.status ? args.status.split(',').map(Number) : null;
      let tickets = db.getAllTicketsWithAnalysis(statuses);
      if (args.limit) tickets = tickets.slice(0, args.limit);
      return JSON.stringify({ count: tickets.length, tickets }, null, 2);
    }

    case 'get_ticket': {
      const ticket = db.getTicketWithAnalysis(args.ticket_id);
      if (!ticket) return JSON.stringify({ error: 'Ticket not found' });
      return JSON.stringify(ticket, null, 2);
    }

    case 'triage_ticket': {
      const analysis = await ai.analyzeTicket({
        subject: args.subject,
        description: args.description,
        requester_name: args.requester_name || ''
      });
      return JSON.stringify({
        escalation_type: analysis.escalation_type,
        urgency_score: analysis.urgency_score,
        category: analysis.category,
        summary: analysis.summary,
        suggested_response: analysis.suggested_response,
        keywords: analysis.keywords
      }, null, 2);
    }

    case 'generate_draft_response': {
      const ticket = {
        subject: args.subject,
        description: args.description,
        requester_name: args.requester_name || ''
      };
      let similarTickets = [];
      try { similarTickets = await rag.searchSimilar(`${args.subject} ${args.description}`, 3); } catch (e) {}
      const result = await ai.generateResponse(ticket, { sopContent: '', similarTickets, casebookEntries: [] });
      return JSON.stringify({ draft: result.response, similar_tickets_used: similarTickets.length }, null, 2);
    }

    case 'get_draft_queue': {
      const filters = {};
      if (args.status) filters.status = args.status;
      if (args.limit) filters.limit = args.limit;
      const drafts = db.getAllDrafts(filters);
      return JSON.stringify({ count: drafts.length, drafts }, null, 2);
    }

    case 'update_draft_status': {
      db.updateDraftStatus(args.draft_id, args.status, 'mcp-client');
      return JSON.stringify({ success: true, message: `Draft ${args.draft_id} → ${args.status}` });
    }

    case 'search_knowledge_base': {
      const results = await rag.searchSimilar(args.query, args.limit || 5);
      return JSON.stringify({ results }, null, 2);
    }

    case 'ask_knowledge_base': {
      const answer = await rag.askKnowledgeBase(args.question);
      return JSON.stringify({ answer }, null, 2);
    }

    case 'search_casebook': {
      const entries = db.searchCasebook(args.terms, args.limit || 5);
      return JSON.stringify({ count: entries.length, entries }, null, 2);
    }

    case 'chat': {
      const response = await ai.chat([
        { role: 'system', content: 'You are the LIV8 Command Center AI assistant. Be concise and helpful.' },
        { role: 'user', content: args.message }
      ]);
      return typeof response === 'string' ? response : JSON.stringify(response);
    }

    case 'route_to_agent': {
      const routing = orchestrator.routeRequest(args.message);
      return JSON.stringify(routing, null, 2);
    }

    case 'get_memory_facts': {
      const facts = memory.getRelevantFacts(args.category || 'general');
      return JSON.stringify({ facts }, null, 2);
    }

    case 'store_memory_fact': {
      memory.storeFact(args.category || 'general', args.fact, 'mcp-client');
      return JSON.stringify({ success: true, message: 'Fact stored' });
    }

    case 'get_system_status': {
      const providerInfo = ai.getCurrentProvider();
      const ragStats = rag.getRAGStats();
      const pipelineStatus = pipeline.getPipelineStatus();
      let dbStats = {};
      try {
        dbStats = {
          tickets: db.getTicketsByStatus([2, 3, 4, 5, 6, 7]).length,
          analyses: Object.keys(db.getAllAnalysisMap()).length,
          knowledge: db.getKnowledgeBaseStats().total,
          drafts: db.getDraftStats()
        };
      } catch (e) {}
      return JSON.stringify({ ai: providerInfo, rag: ragStats, pipeline: pipelineStatus, database: dbStats }, null, 2);
    }

    case 'process_ticket_pipeline': {
      const result = await pipeline.processTicket(args.ticket_id);
      return JSON.stringify(result, null, 2);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ── MCP Protocol Handler (JSON-RPC 2.0 over stdio) ──────────

const SERVER_INFO = {
  name: 'liv8-command-center',
  version: '1.0.0'
};

const SERVER_CAPABILITIES = {
  tools: {}
};

function makeResponse(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function makeError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(makeError(null, -32700, 'Parse error') + '\n');
    return;
  }

  const { id, method, params } = msg;

  switch (method) {
    case 'initialize': {
      process.stdout.write(makeResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: SERVER_CAPABILITIES,
        serverInfo: SERVER_INFO
      }) + '\n');
      break;
    }

    case 'notifications/initialized': {
      // Client acknowledged initialization — no response needed
      log('Client connected and initialized');
      break;
    }

    case 'tools/list': {
      process.stdout.write(makeResponse(id, { tools: TOOLS }) + '\n');
      break;
    }

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      log(`Tool call: ${toolName}`);

      try {
        const result = await handleToolCall(toolName, toolArgs);
        process.stdout.write(makeResponse(id, {
          content: [{ type: 'text', text: result }]
        }) + '\n');
      } catch (error) {
        log(`Tool error: ${error.message}`);
        process.stdout.write(makeResponse(id, {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }],
          isError: true
        }) + '\n');
      }
      break;
    }

    case 'ping': {
      process.stdout.write(makeResponse(id, {}) + '\n');
      break;
    }

    default: {
      if (id !== undefined) {
        process.stdout.write(makeError(id, -32601, `Method not found: ${method}`) + '\n');
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  log('Starting LIV8 Command Center MCP Server...');

  await initBackend();

  log('MCP Server ready — listening on stdio');

  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    handleMessage(trimmed).catch(err => {
      log(`Unhandled error: ${err.message}`);
    });
  });

  rl.on('close', () => {
    log('stdin closed — shutting down');
    process.exit(0);
  });
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
