/**
 * LIV8 Command Center - Database Module
 * Handles all persistent storage for tickets, analysis, and knowledge base
 * Supports both SQLite (local) and Supabase (cloud)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as supabaseDb from './supabase-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database singleton
let db = null;
let useSupabase = false;

/**
 * Initialize the database connection and create tables
 * Will use Supabase for cloud persistence if configured, SQLite for local
 */
export function initDatabase(dbPath = null) {
  // Try to initialize Supabase first (for cloud deployments)
  const supabaseClient = supabaseDb.initSupabase();
  if (supabaseClient) {
    useSupabase = true;
    console.log('Using Supabase for cloud persistence');
  }

  // Always initialize SQLite for local fallback and complex queries
  const dataDir = path.join(__dirname, '..', 'data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const finalPath = dbPath || path.join(dataDir, 'liv8.db');

  try {
    db = new Database(finalPath);
    db.pragma('journal_mode = WAL'); // Better performance for concurrent reads

    // Create tables
    createTables();

    console.log(`SQLite database initialized at: ${finalPath}`);
  } catch (error) {
    console.log('SQLite not available (expected in serverless):', error.message);
    if (!useSupabase) {
      console.warn('WARNING: No database backend available!');
    }
  }

  return db;
}

/**
 * Check if Supabase is being used
 */
export function isUsingSupabase() {
  return useSupabase;
}

/**
 * Create all required tables
 */
function createTables() {
  // Tickets table - stores raw ticket data from Freshdesk
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      freshdesk_id INTEGER UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      status INTEGER NOT NULL,
      priority INTEGER,
      requester_name TEXT,
      requester_email TEXT,
      created_at TEXT,
      updated_at TEXT,
      resolved_at TEXT,
      raw_data TEXT,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ticket analysis table - stores AI-generated analysis
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      escalation_type TEXT,
      urgency_score INTEGER,
      summary TEXT,
      suggested_response TEXT,
      action_items TEXT,
      ai_provider TEXT DEFAULT 'claude',
      model_used TEXT,
      analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(freshdesk_id)
    )
  `);

  // Generated responses table - stores AI-generated responses
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      response_text TEXT NOT NULL,
      similar_tickets TEXT,
      extracted_keywords TEXT,
      ai_provider TEXT DEFAULT 'claude',
      model_used TEXT,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      was_used INTEGER DEFAULT 0,
      FOREIGN KEY (ticket_id) REFERENCES tickets(freshdesk_id)
    )
  `);

  // Knowledge base table - stores resolved tickets for learning
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      resolution TEXT,
      keywords TEXT,
      category TEXT,
      embedding_id TEXT,
      indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(freshdesk_id)
    )
  `);

  // Embeddings table - stores vector embeddings for RAG
  db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      metadata TEXT,
      source_type TEXT,
      source_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Scheduled runs log - tracks automated polling runs
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_type TEXT NOT NULL,
      schedule_name TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      status TEXT DEFAULT 'running',
      tickets_fetched INTEGER DEFAULT 0,
      tickets_analyzed INTEGER DEFAULT 0,
      notifications_sent INTEGER DEFAULT 0,
      error_message TEXT,
      summary TEXT
    )
  `);

  // Settings table - stores app configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Agent interactions table - for tracking agent learning
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      interaction_type TEXT NOT NULL,
      input_data TEXT,
      output_data TEXT,
      context TEXT,
      success INTEGER DEFAULT 1,
      feedback TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_freshdesk_id ON tickets(freshdesk_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_ticket_id ON ticket_analysis(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_base(keywords);
    CREATE INDEX IF NOT EXISTS idx_scheduled_runs_type ON scheduled_runs(run_type);
    CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id);
  `);

  console.log('Database tables created successfully');
}

/**
 * Get database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ============================================
// TICKET OPERATIONS
// ============================================

/**
 * Upsert a ticket (insert or update)
 */
export function upsertTicket(ticket) {
  const stmt = db.prepare(`
    INSERT INTO tickets (freshdesk_id, subject, description, status, priority,
                        requester_name, requester_email, created_at, updated_at, raw_data, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(freshdesk_id) DO UPDATE SET
      subject = excluded.subject,
      description = excluded.description,
      status = excluded.status,
      priority = excluded.priority,
      requester_name = excluded.requester_name,
      requester_email = excluded.requester_email,
      updated_at = excluded.updated_at,
      raw_data = excluded.raw_data,
      synced_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(
    ticket.id,
    ticket.subject,
    ticket.description_text || ticket.description || '',
    ticket.status,
    ticket.priority,
    ticket.requester?.name || '',
    ticket.requester?.email || '',
    ticket.created_at,
    ticket.updated_at,
    JSON.stringify(ticket)
  );
}

/**
 * Bulk upsert tickets
 */
export function upsertTickets(tickets) {
  const upsertMany = db.transaction((ticketList) => {
    for (const ticket of ticketList) {
      upsertTicket(ticket);
    }
  });

  upsertMany(tickets);
  return tickets.length;
}

/**
 * Get tickets by status
 */
export function getTicketsByStatus(statuses = [2, 3]) {
  const placeholders = statuses.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT * FROM tickets
    WHERE status IN (${placeholders})
    ORDER BY priority DESC, created_at DESC
  `);

  return stmt.all(...statuses);
}

/**
 * Get ticket with latest analysis
 */
export function getTicketWithAnalysis(freshdeskId) {
  const stmt = db.prepare(`
    SELECT t.*, ta.escalation_type, ta.urgency_score, ta.summary,
           ta.suggested_response, ta.action_items, ta.analyzed_at
    FROM tickets t
    LEFT JOIN ticket_analysis ta ON t.freshdesk_id = ta.ticket_id
    WHERE t.freshdesk_id = ?
    ORDER BY ta.analyzed_at DESC
    LIMIT 1
  `);

  return stmt.get(freshdeskId);
}

/**
 * Get all tickets with their latest analysis
 */
export function getAllTicketsWithAnalysis(statuses = null) {
  let query = `
    SELECT t.*, ta.escalation_type, ta.urgency_score, ta.summary,
           ta.suggested_response, ta.action_items, ta.analyzed_at
    FROM tickets t
    LEFT JOIN (
      SELECT ticket_id, escalation_type, urgency_score, summary,
             suggested_response, action_items, analyzed_at,
             ROW_NUMBER() OVER (PARTITION BY ticket_id ORDER BY analyzed_at DESC) as rn
      FROM ticket_analysis
    ) ta ON t.freshdesk_id = ta.ticket_id AND ta.rn = 1
  `;

  if (statuses && statuses.length > 0) {
    const placeholders = statuses.map(() => '?').join(',');
    query += ` WHERE t.status IN (${placeholders})`;
  }

  query += ' ORDER BY t.priority DESC, t.created_at DESC';

  const stmt = db.prepare(query);
  return statuses ? stmt.all(...statuses) : stmt.all();
}

// ============================================
// ANALYSIS OPERATIONS
// ============================================

/**
 * Save ticket analysis
 */
export function saveAnalysis(ticketId, analysis, provider = 'claude', model = '') {
  const stmt = db.prepare(`
    INSERT INTO ticket_analysis
    (ticket_id, escalation_type, urgency_score, summary, suggested_response, action_items, ai_provider, model_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    ticketId,
    analysis.ESCALATION_TYPE || analysis.escalation_type,
    analysis.URGENCY_SCORE || analysis.urgency_score,
    analysis.SUMMARY || analysis.summary,
    analysis.SUGGESTED_RESPONSE || analysis.suggested_response,
    JSON.stringify(analysis.ACTION_ITEMS || analysis.action_items || []),
    provider,
    model
  );
}

/**
 * Get latest analysis for a ticket
 */
export function getLatestAnalysis(ticketId) {
  const stmt = db.prepare(`
    SELECT * FROM ticket_analysis
    WHERE ticket_id = ?
    ORDER BY analyzed_at DESC
    LIMIT 1
  `);

  const result = stmt.get(ticketId);
  if (result && result.action_items) {
    try {
      result.action_items = JSON.parse(result.action_items);
    } catch (e) {
      result.action_items = [];
    }
  }
  return result;
}

/**
 * Get all analysis for display (keyed by ticket ID)
 */
export function getAllAnalysisMap() {
  const stmt = db.prepare(`
    SELECT ta.* FROM ticket_analysis ta
    INNER JOIN (
      SELECT ticket_id, MAX(analyzed_at) as max_date
      FROM ticket_analysis
      GROUP BY ticket_id
    ) latest ON ta.ticket_id = latest.ticket_id AND ta.analyzed_at = latest.max_date
  `);

  const results = stmt.all();
  const analysisMap = {};

  for (const row of results) {
    try {
      row.action_items = JSON.parse(row.action_items);
    } catch (e) {
      row.action_items = [];
    }
    analysisMap[row.ticket_id] = {
      ESCALATION_TYPE: row.escalation_type,
      URGENCY_SCORE: row.urgency_score,
      SUMMARY: row.summary,
      SUGGESTED_RESPONSE: row.suggested_response,
      ACTION_ITEMS: row.action_items
    };
  }

  return analysisMap;
}

// ============================================
// GENERATED RESPONSES
// ============================================

/**
 * Save generated response
 */
export function saveGeneratedResponse(ticketId, response, similarTickets, keywords, provider = 'claude', model = '') {
  const stmt = db.prepare(`
    INSERT INTO generated_responses
    (ticket_id, response_text, similar_tickets, extracted_keywords, ai_provider, model_used)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    ticketId,
    response,
    JSON.stringify(similarTickets || []),
    JSON.stringify(keywords || []),
    provider,
    model
  );
}

/**
 * Get latest response for a ticket
 */
export function getLatestResponse(ticketId) {
  const stmt = db.prepare(`
    SELECT * FROM generated_responses
    WHERE ticket_id = ?
    ORDER BY generated_at DESC
    LIMIT 1
  `);

  const result = stmt.get(ticketId);
  if (result) {
    try {
      result.similar_tickets = JSON.parse(result.similar_tickets);
      result.extracted_keywords = JSON.parse(result.extracted_keywords);
    } catch (e) {}
  }
  return result;
}

// ============================================
// KNOWLEDGE BASE OPERATIONS
// ============================================

/**
 * Add ticket to knowledge base
 */
export function addToKnowledgeBase(ticket, resolution = '', keywords = [], category = '') {
  const stmt = db.prepare(`
    INSERT INTO knowledge_base (ticket_id, subject, description, resolution, keywords, category)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(ticket_id) DO UPDATE SET
      resolution = excluded.resolution,
      keywords = excluded.keywords,
      category = excluded.category,
      indexed_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(
    ticket.id || ticket.freshdesk_id,
    ticket.subject,
    ticket.description_text || ticket.description || '',
    resolution,
    JSON.stringify(keywords),
    category
  );
}

/**
 * Search knowledge base by keywords
 */
export function searchKnowledgeBase(searchKeywords, limit = 5) {
  // Simple keyword matching - for more advanced, use embeddings
  const stmt = db.prepare(`
    SELECT * FROM knowledge_base
    ORDER BY indexed_at DESC
    LIMIT ?
  `);

  const results = stmt.all(limit * 2); // Get more than needed for filtering

  // Score results by keyword match
  const scored = results.map(row => {
    const rowKeywords = JSON.parse(row.keywords || '[]');
    const score = searchKeywords.filter(k =>
      rowKeywords.some(rk => rk.toLowerCase().includes(k.toLowerCase()))
    ).length;
    return { ...row, score, keywords: rowKeywords };
  });

  return scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get knowledge base stats
 */
export function getKnowledgeBaseStats() {
  const countStmt = db.prepare('SELECT COUNT(*) as total FROM knowledge_base');
  const total = countStmt.get().total;

  const lastUpdatedStmt = db.prepare('SELECT MAX(indexed_at) as last_updated FROM knowledge_base');
  const lastUpdated = lastUpdatedStmt.get().last_updated;

  return { total, lastUpdated };
}

// ============================================
// SCHEDULED RUNS
// ============================================

/**
 * Start a scheduled run
 */
export function startScheduledRun(runType, scheduleName = '') {
  const stmt = db.prepare(`
    INSERT INTO scheduled_runs (run_type, schedule_name)
    VALUES (?, ?)
  `);

  const result = stmt.run(runType, scheduleName);
  return result.lastInsertRowid;
}

/**
 * Complete a scheduled run
 */
export function completeScheduledRun(runId, stats) {
  const stmt = db.prepare(`
    UPDATE scheduled_runs
    SET completed_at = CURRENT_TIMESTAMP,
        status = ?,
        tickets_fetched = ?,
        tickets_analyzed = ?,
        notifications_sent = ?,
        error_message = ?,
        summary = ?
    WHERE id = ?
  `);

  return stmt.run(
    stats.status || 'completed',
    stats.ticketsFetched || 0,
    stats.ticketsAnalyzed || 0,
    stats.notificationsSent || 0,
    stats.errorMessage || null,
    stats.summary || null,
    runId
  );
}

/**
 * Get recent scheduled runs
 */
export function getRecentRuns(limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM scheduled_runs
    ORDER BY started_at DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

// ============================================
// SETTINGS (with Supabase support)
// ============================================

/**
 * Get a setting - uses Supabase if available, falls back to SQLite
 */
export function getSetting(key, defaultValue = null) {
  // For cloud deployments, use Supabase
  if (useSupabase) {
    // Note: This is async in Supabase but sync in SQLite
    // For initialization, we need sync behavior, so we also check SQLite
    try {
      if (db) {
        const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
        const result = stmt.get(key);
        if (result) return result.value;
      }
    } catch (e) {
      // SQLite not available
    }
    return defaultValue;
  }

  // SQLite local
  if (!db) return defaultValue;
  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Get a setting asynchronously (use this when possible)
 */
export async function getSettingAsync(key, defaultValue = null) {
  // Try Supabase first
  if (useSupabase) {
    const value = await supabaseDb.getSetting(key, null);
    if (value !== null) return value;
  }

  // Fall back to SQLite
  if (db) {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const result = stmt.get(key);
      if (result) return result.value;
    } catch (e) {}
  }

  return defaultValue;
}

/**
 * Set a setting - saves to both Supabase and SQLite for redundancy
 */
export function setSetting(key, value) {
  let sqliteSuccess = false;
  let supabaseSuccess = false;

  // Save to SQLite if available
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(key, value);
      sqliteSuccess = true;
    } catch (e) {
      console.log('SQLite setSetting failed:', e.message);
    }
  }

  // Save to Supabase if available (async, fire and forget for sync API)
  if (useSupabase) {
    supabaseDb.setSetting(key, value)
      .then(success => {
        if (success) console.log(`Setting '${key}' saved to Supabase`);
      })
      .catch(e => console.log('Supabase setSetting failed:', e.message));
    supabaseSuccess = true; // Optimistic
  }

  return sqliteSuccess || supabaseSuccess;
}

/**
 * Set a setting asynchronously (preferred method)
 */
export async function setSettingAsync(key, value) {
  const results = { sqlite: false, supabase: false };

  // Save to SQLite if available
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(key, value);
      results.sqlite = true;
    } catch (e) {
      console.log('SQLite setSetting failed:', e.message);
    }
  }

  // Save to Supabase if available
  if (useSupabase) {
    results.supabase = await supabaseDb.setSetting(key, value);
  }

  return results.sqlite || results.supabase;
}

/**
 * Get all settings
 */
export async function getAllSettings() {
  const settings = {};

  // Get from SQLite first
  if (db) {
    try {
      const stmt = db.prepare('SELECT key, value FROM settings');
      const results = stmt.all();
      for (const row of results) {
        settings[row.key] = row.value;
      }
    } catch (e) {}
  }

  // Merge with Supabase settings (Supabase takes precedence)
  if (useSupabase) {
    const supabaseSettings = await supabaseDb.getAllSettings();
    Object.assign(settings, supabaseSettings);
  }

  return settings;
}

// ============================================
// AGENT INTERACTIONS
// ============================================

/**
 * Log an agent interaction
 */
export function logAgentInteraction(agentId, type, input, output, context = '', success = true) {
  const stmt = db.prepare(`
    INSERT INTO agent_interactions
    (agent_id, interaction_type, input_data, output_data, context, success)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    agentId,
    type,
    JSON.stringify(input),
    JSON.stringify(output),
    context,
    success ? 1 : 0
  );
}

/**
 * Get agent interaction history
 */
export function getAgentHistory(agentId, limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM agent_interactions
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(agentId, limit);
}

// ============================================
// EMBEDDINGS (for RAG)
// ============================================

/**
 * Store an embedding
 */
export function storeEmbedding(id, content, embedding, metadata = {}, sourceType = '', sourceId = null) {
  const stmt = db.prepare(`
    INSERT INTO embeddings (id, content, embedding, metadata, source_type, source_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      embedding = excluded.embedding,
      metadata = excluded.metadata,
      created_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(
    id,
    content,
    JSON.stringify(embedding),
    JSON.stringify(metadata),
    sourceType,
    sourceId
  );
}

/**
 * Get embeddings by source
 */
export function getEmbeddingsBySource(sourceType, sourceId = null) {
  let query = 'SELECT * FROM embeddings WHERE source_type = ?';
  const params = [sourceType];

  if (sourceId) {
    query += ' AND source_id = ?';
    params.push(sourceId);
  }

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

export default {
  initDatabase,
  isUsingSupabase,
  getDb,
  upsertTicket,
  upsertTickets,
  getTicketsByStatus,
  getTicketWithAnalysis,
  getAllTicketsWithAnalysis,
  saveAnalysis,
  getLatestAnalysis,
  getAllAnalysisMap,
  saveGeneratedResponse,
  getLatestResponse,
  addToKnowledgeBase,
  searchKnowledgeBase,
  getKnowledgeBaseStats,
  startScheduledRun,
  completeScheduledRun,
  getRecentRuns,
  getSetting,
  getSettingAsync,
  setSetting,
  setSettingAsync,
  getAllSettings,
  logAgentInteraction,
  getAgentHistory,
  storeEmbedding,
  getEmbeddingsBySource
};
