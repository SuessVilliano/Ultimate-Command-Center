/**
 * Agent Knowledge Base System
 *
 * Each AI agent has its own individual knowledge base that can be populated with:
 * - URLs (web scraping)
 * - Documents (PDF, Word, Excel, PowerPoint)
 * - Text snippets
 * - File uploads (images, CSVs, JSON, code)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists before creating database
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const dbPath = path.join(dataDir, 'agent-knowledge.db');
const db = new Database(dbPath);

// Create tables for agent knowledge bases
export function initAgentKnowledge() {
  db.exec(`
    -- Individual agent profiles with their specializations
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      specialization TEXT,
      system_prompt TEXT,
      avatar_color TEXT DEFAULT '#8B5CF6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Knowledge entries for each agent
    CREATE TABLE IF NOT EXISTS agent_knowledge (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'url', 'document', 'text', 'file'
      title TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      source_url TEXT,
      file_path TEXT,
      file_type TEXT,
      metadata TEXT, -- JSON for additional info
      embedding TEXT, -- For semantic search
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    -- Conversation history with agents
    CREATE TABLE IF NOT EXISTS agent_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      title TEXT,
      participants TEXT -- JSON array of agent IDs involved
    );

    -- Messages in conversations
    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL, -- 'user', 'assistant', 'agent'
      agent_id TEXT, -- Which agent sent this (null for user)
      content TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON agent_knowledge(agent_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON agent_knowledge(type);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON agent_messages(conversation_id);
  `);

  // Seed default agents if none exist
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get();
  if (agentCount.count === 0) {
    seedDefaultAgents();
  }

  console.log('Agent Knowledge Base: Initialized');
  return true;
}

// Seed default agents based on existing agent definitions
function seedDefaultAgents() {
  const defaultAgents = [
    {
      id: 'highlevel-specialist',
      name: 'HighLevel Specialist',
      description: 'Expert in GoHighLevel CRM, workflows, automations, and integrations',
      specialization: 'GoHighLevel support, workflows, automations, LC Phone, Twilio porting',
      system_prompt: `You are a GoHighLevel expert support specialist. You help with:
- Workflow and automation setup
- LC Phone and Twilio number porting
- CRM configuration and pipelines
- Email/SMS campaigns
- Calendar and appointment settings
- API integrations and webhooks
Be professional, thorough, and provide step-by-step guidance.`,
      avatar_color: '#EF4444'
    },
    {
      id: 'hybrid-grid',
      name: 'Hybrid Grid Analyst',
      description: 'Financial markets analyst for day trading NQ futures, forex, and crypto',
      specialization: 'Day trading, NQ futures, EUR/USD forex, SOL/BTC crypto, technical analysis',
      system_prompt: `You are a financial markets analyst specializing in day trading. You analyze:
- NQ/ES futures and NASDAQ movements
- EUR/USD and major forex pairs
- SOL, BTC, and crypto markets
- Technical indicators and price action
- Risk management strategies
Provide data-driven analysis with specific levels and trade ideas.`,
      avatar_color: '#10B981'
    },
    {
      id: 'dev-ops',
      name: 'DevOps Engineer',
      description: 'Full-stack development, deployments, Git, and infrastructure',
      specialization: 'Node.js, React, Python, Git, Docker, cloud deployments, debugging',
      system_prompt: `You are a senior DevOps engineer and full-stack developer. You help with:
- Code debugging and optimization
- Deployment pipelines and CI/CD
- Docker and containerization
- Cloud infrastructure (AWS, GCP, Railway, Render)
- Database management
- API development
Write clean, efficient code and explain technical concepts clearly.`,
      avatar_color: '#3B82F6'
    },
    {
      id: 'content-creator',
      name: 'Content Creator',
      description: 'Marketing copy, social media, email campaigns, and content strategy',
      specialization: 'Copywriting, social media, email marketing, SEO, brand voice',
      system_prompt: `You are a creative content specialist. You create:
- Compelling marketing copy
- Social media posts and campaigns
- Email sequences and newsletters
- Blog posts and articles
- Brand messaging and voice
Write engaging, conversion-focused content tailored to the target audience.`,
      avatar_color: '#F59E0B'
    },
    {
      id: 'business-analyst',
      name: 'Business Analyst',
      description: 'Business strategy, metrics, processes, and operational efficiency',
      specialization: 'Business analysis, KPIs, process optimization, strategic planning',
      system_prompt: `You are a business analyst and strategist. You help with:
- Business metrics and KPI tracking
- Process optimization and efficiency
- Strategic planning and goal setting
- Market analysis and competitive research
- Financial projections and modeling
Provide actionable insights backed by data and industry best practices.`,
      avatar_color: '#8B5CF6'
    },
    {
      id: 'legal-contracts',
      name: 'Contract Navigator',
      description: 'Contract review, legal terms, compliance, and documentation',
      specialization: 'Contract analysis, legal terms, compliance, business agreements',
      system_prompt: `You are a contract and legal document specialist. You help with:
- Contract review and analysis
- Legal term explanations
- Compliance requirements
- Business agreement structures
- Risk identification in contracts
Note: You provide general guidance, not legal advice. Recommend professional legal counsel for binding decisions.`,
      avatar_color: '#6366F1'
    },
    {
      id: 'orchestrator',
      name: 'Command Center AI',
      description: 'Main orchestrator that routes requests to specialist agents',
      specialization: 'Task routing, agent coordination, multi-agent orchestration',
      system_prompt: `You are the Command Center AI orchestrator. Your role is to:
1. Understand user requests and determine which specialist agent(s) should handle them
2. Route queries to the appropriate agent based on their specialization
3. Coordinate multi-agent responses when needed
4. Synthesize information from multiple agents
5. Maintain conversation context across agent handoffs

Available agents and their specializations will be provided in context.
Always explain which agent you're delegating to and why.`,
      avatar_color: '#EC4899'
    }
  ];

  const insert = db.prepare(`
    INSERT INTO agents (id, name, description, specialization, system_prompt, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const agent of defaultAgents) {
    insert.run(agent.id, agent.name, agent.description, agent.specialization, agent.system_prompt, agent.avatar_color);
  }

  console.log(`Seeded ${defaultAgents.length} default agents`);
}

// ============================================
// AGENT MANAGEMENT
// ============================================

export function getAllAgents() {
  return db.prepare('SELECT * FROM agents ORDER BY name').all();
}

export function getAgent(agentId) {
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
}

export function createAgent(agent) {
  const id = agent.id || `agent-${Date.now()}`;
  db.prepare(`
    INSERT INTO agents (id, name, description, specialization, system_prompt, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, agent.name, agent.description || '', agent.specialization || '', agent.system_prompt || '', agent.avatar_color || '#8B5CF6');
  return getAgent(id);
}

export function updateAgent(agentId, updates) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['name', 'description', 'specialization', 'system_prompt', 'avatar_color'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(agentId);
    db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  return getAgent(agentId);
}

export function deleteAgent(agentId) {
  // Don't allow deleting the orchestrator
  if (agentId === 'orchestrator') {
    throw new Error('Cannot delete the orchestrator agent');
  }

  db.prepare('DELETE FROM agent_knowledge WHERE agent_id = ?').run(agentId);
  db.prepare('DELETE FROM agents WHERE id = ?').run(agentId);
  return true;
}

// ============================================
// KNOWLEDGE MANAGEMENT
// ============================================

export function addKnowledge(agentId, entry) {
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO agent_knowledge (id, agent_id, type, title, content, summary, source_url, file_path, file_type, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    agentId,
    entry.type,
    entry.title,
    entry.content || null,
    entry.summary || null,
    entry.source_url || null,
    entry.file_path || null,
    entry.file_type || null,
    entry.metadata ? JSON.stringify(entry.metadata) : null
  );

  return getKnowledgeEntry(id);
}

export function getKnowledgeEntry(id) {
  const entry = db.prepare('SELECT * FROM agent_knowledge WHERE id = ?').get(id);
  if (entry && entry.metadata) {
    entry.metadata = JSON.parse(entry.metadata);
  }
  return entry;
}

export function getAgentKnowledge(agentId, type = null) {
  let query = 'SELECT * FROM agent_knowledge WHERE agent_id = ?';
  const params = [agentId];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC';

  const entries = db.prepare(query).all(...params);
  return entries.map(e => ({
    ...e,
    metadata: e.metadata ? JSON.parse(e.metadata) : null
  }));
}

export function searchAgentKnowledge(agentId, query, limit = 10) {
  // Simple text search for now - can be enhanced with embeddings
  const searchTerm = `%${query.toLowerCase()}%`;

  const entries = db.prepare(`
    SELECT * FROM agent_knowledge
    WHERE agent_id = ?
    AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(summary) LIKE ?)
    ORDER BY created_at DESC
    LIMIT ?
  `).all(agentId, searchTerm, searchTerm, searchTerm, limit);

  return entries.map(e => ({
    ...e,
    metadata: e.metadata ? JSON.parse(e.metadata) : null
  }));
}

export function deleteKnowledge(id) {
  db.prepare('DELETE FROM agent_knowledge WHERE id = ?').run(id);
  return true;
}

export function getKnowledgeStats(agentId) {
  const stats = db.prepare(`
    SELECT
      type,
      COUNT(*) as count
    FROM agent_knowledge
    WHERE agent_id = ?
    GROUP BY type
  `).all(agentId);

  const total = db.prepare('SELECT COUNT(*) as total FROM agent_knowledge WHERE agent_id = ?').get(agentId);

  return {
    total: total.total,
    byType: stats.reduce((acc, s) => ({ ...acc, [s.type]: s.count }), {})
  };
}

// ============================================
// CONVERSATION MANAGEMENT
// ============================================

export function createConversation(userId = 'default', title = null, participants = []) {
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO agent_conversations (id, user_id, title, participants)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, title, JSON.stringify(participants));

  return id;
}

export function getConversation(conversationId) {
  const conv = db.prepare('SELECT * FROM agent_conversations WHERE id = ?').get(conversationId);
  if (conv) {
    conv.participants = JSON.parse(conv.participants || '[]');
  }
  return conv;
}

export function getConversations(userId = 'default', limit = 20) {
  const convs = db.prepare(`
    SELECT * FROM agent_conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(userId, limit);

  return convs.map(c => ({
    ...c,
    participants: JSON.parse(c.participants || '[]')
  }));
}

export function addMessage(conversationId, role, content, agentId = null, metadata = null) {
  db.prepare(`
    INSERT INTO agent_messages (conversation_id, role, agent_id, content, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(conversationId, role, agentId, content, metadata ? JSON.stringify(metadata) : null);

  // Update conversation timestamp
  db.prepare('UPDATE agent_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);

  // Update participants if new agent
  if (agentId) {
    const conv = getConversation(conversationId);
    if (!conv.participants.includes(agentId)) {
      conv.participants.push(agentId);
      db.prepare('UPDATE agent_conversations SET participants = ? WHERE id = ?')
        .run(JSON.stringify(conv.participants), conversationId);
    }
  }
}

export function getMessages(conversationId, limit = 50) {
  const messages = db.prepare(`
    SELECT m.*, a.name as agent_name, a.avatar_color
    FROM agent_messages m
    LEFT JOIN agents a ON m.agent_id = a.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    LIMIT ?
  `).all(conversationId, limit);

  return messages.map(m => ({
    ...m,
    metadata: m.metadata ? JSON.parse(m.metadata) : null
  }));
}

// ============================================
// ORCHESTRATOR HELPERS
// ============================================

export function getAgentContext(agentId) {
  const agent = getAgent(agentId);
  if (!agent) return null;

  const knowledge = getAgentKnowledge(agentId);
  const stats = getKnowledgeStats(agentId);

  // Build context from knowledge
  let knowledgeContext = '';
  if (knowledge.length > 0) {
    knowledgeContext = '\n\nYour Knowledge Base:\n';
    for (const entry of knowledge.slice(0, 20)) { // Limit to recent 20 entries
      knowledgeContext += `- [${entry.type}] ${entry.title}`;
      if (entry.summary) {
        knowledgeContext += `: ${entry.summary}`;
      }
      knowledgeContext += '\n';
    }
  }

  return {
    agent,
    systemPrompt: agent.system_prompt + knowledgeContext,
    knowledgeCount: stats.total
  };
}

export function getOrchestratorContext() {
  const agents = getAllAgents().filter(a => a.id !== 'orchestrator');

  let agentList = 'Available Specialist Agents:\n\n';
  for (const agent of agents) {
    const stats = getKnowledgeStats(agent.id);
    agentList += `**${agent.name}** (ID: ${agent.id})\n`;
    agentList += `  Specialization: ${agent.specialization}\n`;
    agentList += `  Knowledge items: ${stats.total}\n\n`;
  }

  return agentList;
}

export default {
  initAgentKnowledge,
  getAllAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  addKnowledge,
  getKnowledgeEntry,
  getAgentKnowledge,
  searchAgentKnowledge,
  deleteKnowledge,
  getKnowledgeStats,
  createConversation,
  getConversation,
  getConversations,
  addMessage,
  getMessages,
  getAgentContext,
  getOrchestratorContext
};
