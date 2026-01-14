/**
 * LIV8 Command Center - Conversational Memory System
 * Provides persistent memory for AI conversations with context awareness
 */

import * as db from './database.js';

// In-memory session cache for fast access
const sessionCache = new Map();

/**
 * Initialize conversation tables
 */
export function initConversationTables() {
  const dbInstance = db.getDb();

  dbInstance.exec(`
    -- Conversation sessions
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default',
      title TEXT,
      summary TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      message_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- Individual messages
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    -- Long-term memory / learned facts
    CREATE TABLE IF NOT EXISTS memory_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      fact TEXT NOT NULL,
      source TEXT,
      confidence REAL DEFAULT 1.0,
      times_referenced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_used TEXT
    );

    -- User preferences and context
    CREATE TABLE IF NOT EXISTS user_context (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON conversation_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_facts_category ON memory_facts(category);
  `);
}

/**
 * Create a new conversation session
 */
export function createConversation(userId = 'default', title = null) {
  const dbInstance = db.getDb();
  const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const stmt = dbInstance.prepare(`
    INSERT INTO conversations (id, user_id, title)
    VALUES (?, ?, ?)
  `);

  stmt.run(id, userId, title || `Conversation ${new Date().toLocaleDateString()}`);

  sessionCache.set(id, { messages: [], created: new Date() });

  return id;
}

/**
 * Get or create active conversation
 */
export function getActiveConversation(userId = 'default') {
  const dbInstance = db.getDb();

  // Try to get existing active conversation from last 24 hours
  const stmt = dbInstance.prepare(`
    SELECT id FROM conversations
    WHERE user_id = ? AND is_active = 1
    AND datetime(updated_at) > datetime('now', '-24 hours')
    ORDER BY updated_at DESC LIMIT 1
  `);

  const existing = stmt.get(userId);

  if (existing) {
    return existing.id;
  }

  return createConversation(userId);
}

/**
 * Add message to conversation
 */
export function addMessage(conversationId, role, content, metadata = {}) {
  const dbInstance = db.getDb();

  const stmt = dbInstance.prepare(`
    INSERT INTO conversation_messages (conversation_id, role, content, metadata)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(conversationId, role, content, JSON.stringify(metadata));

  // Update conversation
  const updateStmt = dbInstance.prepare(`
    UPDATE conversations
    SET updated_at = CURRENT_TIMESTAMP,
        message_count = message_count + 1
    WHERE id = ?
  `);
  updateStmt.run(conversationId);

  // Update cache
  if (sessionCache.has(conversationId)) {
    sessionCache.get(conversationId).messages.push({ role, content, metadata });
  }

  // Extract and store any facts from user messages
  if (role === 'user') {
    extractAndStoreFacts(content);
  }
}

/**
 * Get conversation history
 */
export function getConversationHistory(conversationId, limit = 50) {
  const dbInstance = db.getDb();

  const stmt = dbInstance.prepare(`
    SELECT role, content, metadata, created_at
    FROM conversation_messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const messages = stmt.all(conversationId, limit).reverse();

  return messages.map(m => ({
    role: m.role,
    content: m.content,
    metadata: m.metadata ? JSON.parse(m.metadata) : {},
    timestamp: m.created_at
  }));
}

/**
 * Get recent context for AI (last N messages across conversations)
 */
export function getRecentContext(userId = 'default', messageCount = 20) {
  const dbInstance = db.getDb();

  const stmt = dbInstance.prepare(`
    SELECT cm.role, cm.content, cm.created_at, c.title
    FROM conversation_messages cm
    JOIN conversations c ON cm.conversation_id = c.id
    WHERE c.user_id = ?
    ORDER BY cm.created_at DESC
    LIMIT ?
  `);

  return stmt.all(userId, messageCount).reverse();
}

/**
 * Extract facts from user messages (simple pattern matching)
 */
function extractAndStoreFacts(content) {
  const dbInstance = db.getDb();
  const lowerContent = content.toLowerCase();

  // Pattern matching for common fact statements
  const patterns = [
    { regex: /my name is (\w+)/i, category: 'personal', template: 'User name is: $1' },
    { regex: /i work at ([^.]+)/i, category: 'work', template: 'Works at: $1' },
    { regex: /i am (?:a|an) ([^.]+)/i, category: 'personal', template: 'User is: $1' },
    { regex: /i prefer ([^.]+)/i, category: 'preferences', template: 'Prefers: $1' },
    { regex: /i like ([^.]+)/i, category: 'preferences', template: 'Likes: $1' },
    { regex: /i don't like ([^.]+)/i, category: 'preferences', template: 'Dislikes: $1' },
    { regex: /my (?:business|company) (?:is|called) ([^.]+)/i, category: 'business', template: 'Business: $1' },
    { regex: /i trade ([^.]+)/i, category: 'trading', template: 'Trades: $1' },
    { regex: /my email is ([^\s]+)/i, category: 'contact', template: 'Email: $1' },
    { regex: /my calendar is ([^\s]+)/i, category: 'contact', template: 'Calendar: $1' },
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern.regex);
    if (match) {
      const fact = pattern.template.replace('$1', match[1].trim());

      // Check if fact already exists
      const existingStmt = dbInstance.prepare(`
        SELECT id FROM memory_facts WHERE fact = ? AND category = ?
      `);
      const existing = existingStmt.get(fact, pattern.category);

      if (!existing) {
        const insertStmt = dbInstance.prepare(`
          INSERT INTO memory_facts (category, fact, source)
          VALUES (?, ?, 'conversation')
        `);
        insertStmt.run(pattern.category, fact);
      }
    }
  }
}

/**
 * Store a specific fact
 */
export function storeFact(category, fact, source = 'manual', confidence = 1.0) {
  const dbInstance = db.getDb();

  const stmt = dbInstance.prepare(`
    INSERT INTO memory_facts (category, fact, source, confidence)
    VALUES (?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `);

  stmt.run(category, fact, source, confidence);
}

/**
 * Get all remembered facts
 */
export function getAllFacts(category = null) {
  const dbInstance = db.getDb();

  let query = 'SELECT * FROM memory_facts';
  if (category) {
    query += ` WHERE category = '${category}'`;
  }
  query += ' ORDER BY times_referenced DESC, created_at DESC';

  const stmt = dbInstance.prepare(query);
  return stmt.all();
}

/**
 * Get facts relevant to a query
 */
export function getRelevantFacts(query, limit = 10) {
  const dbInstance = db.getDb();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (words.length === 0) return [];

  // Simple keyword matching
  const likeConditions = words.map(w => `LOWER(fact) LIKE '%${w}%'`).join(' OR ');

  const stmt = dbInstance.prepare(`
    SELECT * FROM memory_facts
    WHERE ${likeConditions}
    ORDER BY times_referenced DESC
    LIMIT ?
  `);

  const facts = stmt.all(limit);

  // Update reference count
  for (const fact of facts) {
    const updateStmt = dbInstance.prepare(`
      UPDATE memory_facts
      SET times_referenced = times_referenced + 1, last_used = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(fact.id);
  }

  return facts;
}

/**
 * Store user context/preference
 */
export function setUserContext(key, value, category = 'general') {
  const dbInstance = db.getDb();

  const stmt = dbInstance.prepare(`
    INSERT INTO user_context (key, value, category, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      category = excluded.category,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(key, JSON.stringify(value), category);
}

/**
 * Get user context
 */
export function getUserContext(key = null) {
  const dbInstance = db.getDb();

  if (key) {
    const stmt = dbInstance.prepare('SELECT value FROM user_context WHERE key = ?');
    const row = stmt.get(key);
    return row ? JSON.parse(row.value) : null;
  }

  const stmt = dbInstance.prepare('SELECT * FROM user_context');
  const rows = stmt.all();

  const context = {};
  for (const row of rows) {
    context[row.key] = JSON.parse(row.value);
  }
  return context;
}

/**
 * Build context prompt for AI with memory
 */
export function buildMemoryContext(userId = 'default', currentQuery = '') {
  const facts = getAllFacts();
  const recentMessages = getRecentContext(userId, 10);
  const relevantFacts = currentQuery ? getRelevantFacts(currentQuery, 5) : [];
  const userContext = getUserContext();

  let contextPrompt = '';

  // Add user context
  if (Object.keys(userContext).length > 0) {
    contextPrompt += '\n## User Context:\n';
    for (const [key, value] of Object.entries(userContext)) {
      contextPrompt += `- ${key}: ${JSON.stringify(value)}\n`;
    }
  }

  // Add remembered facts
  if (facts.length > 0) {
    contextPrompt += '\n## Things I Remember About the User:\n';
    const grouped = {};
    for (const fact of facts.slice(0, 20)) {
      if (!grouped[fact.category]) grouped[fact.category] = [];
      grouped[fact.category].push(fact.fact);
    }
    for (const [cat, factList] of Object.entries(grouped)) {
      contextPrompt += `\n### ${cat.charAt(0).toUpperCase() + cat.slice(1)}:\n`;
      factList.forEach(f => contextPrompt += `- ${f}\n`);
    }
  }

  // Add relevant facts for current query
  if (relevantFacts.length > 0) {
    contextPrompt += '\n## Relevant Context for This Query:\n';
    relevantFacts.forEach(f => contextPrompt += `- ${f.fact}\n`);
  }

  // Add recent conversation summary
  if (recentMessages.length > 0) {
    contextPrompt += '\n## Recent Conversation:\n';
    recentMessages.slice(-5).forEach(m => {
      contextPrompt += `${m.role}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}\n`;
    });
  }

  return contextPrompt;
}

/**
 * Get conversation list
 */
export function getConversationList(userId = 'default', limit = 20) {
  const dbInstance = db.getDb();

  const stmt = dbInstance.prepare(`
    SELECT id, title, summary, message_count, created_at, updated_at
    FROM conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `);

  return stmt.all(userId, limit);
}

/**
 * Update conversation title/summary
 */
export function updateConversation(conversationId, updates) {
  const dbInstance = db.getDb();

  const { title, summary } = updates;

  if (title) {
    const stmt = dbInstance.prepare('UPDATE conversations SET title = ? WHERE id = ?');
    stmt.run(title, conversationId);
  }

  if (summary) {
    const stmt = dbInstance.prepare('UPDATE conversations SET summary = ? WHERE id = ?');
    stmt.run(summary, conversationId);
  }
}

/**
 * Delete old conversations (cleanup)
 */
export function cleanupOldConversations(daysOld = 30) {
  const dbInstance = db.getDb();

  const stmt = dbInstance.prepare(`
    DELETE FROM conversations
    WHERE datetime(updated_at) < datetime('now', '-' || ? || ' days')
    AND is_active = 0
  `);

  return stmt.run(daysOld);
}

export default {
  initConversationTables,
  createConversation,
  getActiveConversation,
  addMessage,
  getConversationHistory,
  getRecentContext,
  storeFact,
  getAllFacts,
  getRelevantFacts,
  setUserContext,
  getUserContext,
  buildMemoryContext,
  getConversationList,
  updateConversation,
  cleanupOldConversations
};
