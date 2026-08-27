/**
 * Persistent agent team workspace.
 * Turns proactive findings and user messages into owned, auditable work items.
 */
import * as db from './database.js';
import * as orchestrator from './agent-orchestrator.js';

const DEFAULT_CHANNELS = [
  ['general', 'General', 'Company-wide coordination'],
  ['agent-ops', 'Agent Operations', 'Autonomous work, handoffs, and blockers'],
  ['development', 'Development', 'Engineering work and code reviews'],
  ['support', 'Support', 'Customer support and escalations'],
  ['approvals', 'Approvals', 'Actions waiting for Jamaur\'s approval']
];

let cycleRunning = false;

export function initTeamWorkspace() {
  const database = db.getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS team_channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS team_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_type TEXT NOT NULL DEFAULT 'agent',
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS agent_work_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      assigned_agent_id TEXT,
      assigned_agent_name TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      priority TEXT NOT NULL DEFAULT 'medium',
      requires_approval INTEGER NOT NULL DEFAULT 0,
      result TEXT,
      error TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      started_at TEXT,
      completed_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_team_messages_channel ON team_messages(channel_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_work_status ON agent_work_items(status, priority);
  `);

  const insert = database.prepare('INSERT OR IGNORE INTO team_channels (id, name, description) VALUES (?, ?, ?)');
  for (const channel of DEFAULT_CHANNELS) insert.run(...channel);

  const count = database.prepare('SELECT COUNT(*) AS count FROM team_messages').get().count;
  if (count === 0) {
    addMessage('agent-ops', {
      authorId: 'liv8-commander',
      authorName: 'LIV8 Commander',
      content: 'Agent workspace online. I will route incoming work, track ownership, report blockers, and place sensitive actions in #approvals.'
    });
  }
  console.log('Agent Team Workspace: Initialized');
}

export function getChannels() {
  return db.getDb().prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM team_messages m WHERE m.channel_id = c.id) AS message_count
    FROM team_channels c ORDER BY c.created_at, c.name
  `).all();
}

export function getMessages(channelId = 'general', limit = 100) {
  return db.getDb().prepare(`
    SELECT * FROM team_messages WHERE channel_id = ? ORDER BY id DESC LIMIT ?
  `).all(channelId, Math.min(Number(limit) || 100, 250)).reverse().map(parseRow);
}

export function addMessage(channelId, message) {
  const result = db.getDb().prepare(`
    INSERT INTO team_messages (channel_id, author_id, author_name, author_type, content, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    channelId,
    message.authorId || 'system',
    message.authorName || 'System',
    message.authorType || 'agent',
    message.content,
    JSON.stringify(message.metadata || {})
  );
  return getMessage(result.lastInsertRowid);
}

function getMessage(id) {
  return parseRow(db.getDb().prepare('SELECT * FROM team_messages WHERE id = ?').get(id));
}

export function getWorkItems(options = {}) {
  const { status = null, limit = 100 } = options;
  const database = db.getDb();
  const rows = status
    ? database.prepare('SELECT * FROM agent_work_items WHERE status = ? ORDER BY id DESC LIMIT ?').all(status, Math.min(Number(limit) || 100, 250))
    : database.prepare('SELECT * FROM agent_work_items ORDER BY id DESC LIMIT ?').all(Math.min(Number(limit) || 100, 250));
  return rows.map(parseRow);
}

export function createWorkItem(item) {
  const fingerprint = item.fingerprint || null;
  const result = db.getDb().prepare(`
    INSERT OR IGNORE INTO agent_work_items
      (fingerprint, title, description, source, assigned_agent_id, assigned_agent_name, status, priority, requires_approval, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    fingerprint,
    item.title,
    item.description || '',
    item.source || 'manual',
    item.assignedAgentId || null,
    item.assignedAgentName || null,
    item.status || 'queued',
    item.priority || 'medium',
    item.requiresApproval ? 1 : 0,
    JSON.stringify(item.metadata || {})
  );
  if (!result.changes && fingerprint) {
    return parseRow(db.getDb().prepare('SELECT * FROM agent_work_items WHERE fingerprint = ?').get(fingerprint));
  }
  return parseRow(db.getDb().prepare('SELECT * FROM agent_work_items WHERE id = ?').get(result.lastInsertRowid));
}

export async function handleUserMessage({ content, channelId = 'general', userId = 'jamaur' }) {
  const userMessage = addMessage(channelId, {
    authorId: userId,
    authorName: 'Jamaur',
    authorType: 'user',
    content
  });

  const routed = await orchestrator.orchestrate(content, null, userId);
  const responseText = routed.response?.content || routed.response || 'I received the request but could not produce a response.';
  const agentName = routed.agentName || routed.response?.agent?.name || 'LIV8 Commander';
  const agentId = routed.agentId || routed.response?.agent?.id || 'liv8-commander';
  const agentMessage = addMessage(channelId, {
    authorId: agentId,
    authorName: agentName,
    content: responseText,
    metadata: { routing: routed.response?.routing || routed.routing, conversationId: routed.conversationId }
  });

  return { userMessage, agentMessage, routing: routed.response?.routing || routed.routing };
}

export async function processProactiveFindings(findings = {}) {
  if (cycleRunning) return { skipped: true, reason: 'cycle_already_running' };
  cycleRunning = true;
  const created = [];
  try {
    const candidates = [
      ...(findings.issues || []).map(issue => ({
        title: issue.message || issue.title || 'Proactive issue',
        description: JSON.stringify(issue.item || issue),
        priority: issue.priority || 'high',
        kind: 'issue'
      })),
      ...(findings.suggestions || []).map(suggestion => ({
        title: suggestion.title || suggestion.action || suggestion.suggestion || 'Agent suggestion',
        description: suggestion.description || suggestion.reasoning || JSON.stringify(suggestion),
        priority: suggestion.priority || 'medium',
        kind: 'suggestion'
      }))
    ].slice(0, 3);

    for (const candidate of candidates) {
      const fingerprint = `${candidate.kind}:${candidate.title.toLowerCase().replace(/\s+/g, ' ').slice(0, 180)}`;
      const existing = db.getDb().prepare('SELECT * FROM agent_work_items WHERE fingerprint = ?').get(fingerprint);
      if (existing) continue;

      const route = orchestrator.routeRequest(`${candidate.title}\n${candidate.description}`);
      const agentId = route.primary || 'business-analyst';
      const item = createWorkItem({
        ...candidate,
        fingerprint,
        source: 'proactive-engine',
        assignedAgentId: agentId,
        status: 'working',
        requiresApproval: true,
        metadata: { route }
      });
      created.push(item);
      addMessage('agent-ops', {
        authorId: 'liv8-commander',
        authorName: 'LIV8 Commander',
        content: `Assigned #${item.id} to ${agentId}: ${candidate.title}`,
        metadata: { workItemId: item.id, status: 'working' }
      });

      await executeWorkItem(item.id);
    }
    return { created };
  } finally {
    cycleRunning = false;
  }
}

export async function executeWorkItem(id) {
  const database = db.getDb();
  const item = database.prepare('SELECT * FROM agent_work_items WHERE id = ?').get(id);
  if (!item) throw new Error('Work item not found');
  database.prepare(`UPDATE agent_work_items SET status = 'working', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  try {
    const result = await orchestrator.executeWithAgent(
      item.assigned_agent_id || 'business-analyst',
      `Work this assignment proactively. Produce concrete findings, completed preparation, blockers, and the exact next action. Do not claim external actions were completed unless verified.\n\n${item.title}\n${item.description || ''}`
    );
    const nextStatus = item.requires_approval ? 'awaiting_approval' : 'completed';
    database.prepare(`
      UPDATE agent_work_items SET status = ?, assigned_agent_name = ?, result = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(nextStatus, result.agentName, result.response, id);
    const channel = nextStatus === 'awaiting_approval' ? 'approvals' : 'agent-ops';
    addMessage(channel, {
      authorId: result.agentId,
      authorName: result.agentName,
      content: `Work item #${id}: ${item.title}\n\n${result.response}`,
      metadata: { workItemId: id, status: nextStatus }
    });
    return parseRow(database.prepare('SELECT * FROM agent_work_items WHERE id = ?').get(id));
  } catch (error) {
    database.prepare(`UPDATE agent_work_items SET status = 'blocked', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(error.message, id);
    addMessage('agent-ops', {
      authorId: item.assigned_agent_id || 'liv8-commander',
      authorName: item.assigned_agent_name || 'LIV8 Commander',
      content: `Blocked on work item #${id}: ${error.message}`,
      metadata: { workItemId: id, status: 'blocked' }
    });
    return parseRow(database.prepare('SELECT * FROM agent_work_items WHERE id = ?').get(id));
  }
}

export function approveWorkItem(id) {
  const result = db.getDb().prepare(`
    UPDATE agent_work_items SET status = 'approved', requires_approval = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'awaiting_approval'
  `).run(id);
  if (!result.changes) return { success: false, error: 'Item is not awaiting approval' };
  addMessage('agent-ops', {
    authorId: 'jamaur', authorName: 'Jamaur', authorType: 'user',
    content: `Approved work item #${id}.`, metadata: { workItemId: Number(id), status: 'approved' }
  });
  return { success: true };
}

export function getTeamStatus() {
  const rows = db.getDb().prepare('SELECT status, COUNT(*) AS count FROM agent_work_items GROUP BY status').all();
  return {
    cycleRunning,
    counts: Object.fromEntries(rows.map(row => [row.status, row.count])),
    recent: getWorkItems({ limit: 10 })
  };
}

function parseRow(row) {
  if (!row) return row;
  return {
    ...row,
    metadata: row.metadata ? safeJson(row.metadata) : {},
    requires_approval: Boolean(row.requires_approval)
  };
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return {}; }
}

export default {
  initTeamWorkspace, getChannels, getMessages, addMessage, getWorkItems,
  createWorkItem, handleUserMessage, processProactiveFindings, executeWorkItem,
  approveWorkItem, getTeamStatus
};
