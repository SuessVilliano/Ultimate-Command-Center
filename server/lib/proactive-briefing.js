/**
 * Proactive AI Briefing Service
 * Generates intelligent daily briefings and manages ADHD-friendly features
 *
 * Features:
 * - Morning/afternoon/evening briefings
 * - Smart task prioritization
 * - Parking lot for random thoughts
 * - Pomodoro timer integration
 * - "What was I doing?" context recovery
 */

import * as db from './database.js';
import * as ai from './ai-provider.js';
import calendarService from './calendar-service.js';
import { marketData } from './market-data.js';

/**
 * Initialize briefing tables
 */
export function initBriefingTables() {
  const dbInstance = db.getDb();

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      acknowledged INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS parking_lot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thought TEXT NOT NULL,
      context TEXT,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      processed INTEGER DEFAULT 0,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_description TEXT,
      task_id TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      duration_minutes INTEGER DEFAULT 25,
      completed INTEGER DEFAULT 0,
      interruptions INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      context TEXT,
      page TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_value TEXT,
      action_type TEXT NOT NULL,
      action_value TEXT,
      enabled INTEGER DEFAULT 1,
      last_triggered TEXT,
      trigger_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Proactive Briefing: Tables initialized');
}

/**
 * Generate daily briefing
 */
export async function generateBriefing(type = 'morning') {
  const dbInstance = db.getDb();

  const [calendarSummary, marketSummary, openTickets, pendingTasks, parkingLotItems] = await Promise.all([
    getCalendarContext(),
    getMarketContext(),
    getTicketContext(),
    getTaskContext(),
    getParkingLotItems(5)
  ]);

  const now = new Date();
  const hour = now.getHours();

  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  if (hour >= 17) greeting = 'Good evening';

  const context = `${greeting}! Here's your ${type} briefing:

**Calendar:**
- ${calendarSummary.todayEventCount} events today
- Next meeting: ${calendarSummary.nextMeeting?.title || 'None scheduled'}
- Free time: ${Math.floor(calendarSummary.freeTimeMinutes / 60)}h ${calendarSummary.freeTimeMinutes % 60}m available

**Markets:**
${marketSummary}

**Tickets:**
${openTickets}

**Tasks:**
${pendingTasks}

**Parking Lot:**
${parkingLotItems.length > 0 ? parkingLotItems.map(p => '- ' + p.thought).join('\n') : 'Empty - your mind is clear!'}`;

  let aiSummary = '';
  try {
    const prompt = `You are an executive assistant for a busy entrepreneur with ADHD who day trades and runs multiple businesses. Based on this context, provide:
1. Top 3 priorities for right now (be specific and actionable)
2. One thing to delegate or defer
3. A motivational nudge

Be concise, direct, and supportive. No fluff.

Context:
${context}`;

    aiSummary = await ai.generateResponse(prompt);
  } catch (e) {
    aiSummary = 'AI summary unavailable';
  }

  const stmt = dbInstance.prepare(`
    INSERT INTO briefings (type, content, summary)
    VALUES (?, ?, ?)
  `);
  stmt.run(type, context, aiSummary);

  return {
    type,
    greeting,
    context,
    aiSummary,
    calendar: calendarSummary,
    generatedAt: new Date().toISOString()
  };
}

async function getCalendarContext() {
  try {
    return calendarService.getCalendarSummary();
  } catch (e) {
    return { todayEventCount: 0, todayEvents: [], freeTimeMinutes: 480, freeBlocks: [], nextMeeting: null, isInMeeting: false };
  }
}

async function getMarketContext() {
  try {
    const overview = await marketData.getMarketOverview();
    if (!overview?.crypto) return 'Market data unavailable';

    const btc = overview.crypto.BTC;
    const sol = overview.crypto.SOL;
    const eth = overview.crypto.ETH;

    return `BTC: $${btc?.price?.toLocaleString() || 'N/A'} (${btc?.change24h?.toFixed(2) || 0}%)
SOL: $${sol?.price?.toLocaleString() || 'N/A'} (${sol?.change24h?.toFixed(2) || 0}%)
ETH: $${eth?.price?.toLocaleString() || 'N/A'} (${eth?.change24h?.toFixed(2) || 0}%)`;
  } catch (e) {
    return 'Market data unavailable';
  }
}

function getTicketContext() {
  try {
    const dbInstance = db.getDb();
    const stmt = dbInstance.prepare(`
      SELECT COUNT(*) as count, status FROM tickets WHERE status IN (2, 3, 6) GROUP BY status
    `);
    const results = stmt.all();
    const open = results.find(r => r.status === 2)?.count || 0;
    const pending = results.find(r => r.status === 3)?.count || 0;
    const waiting = results.find(r => r.status === 6)?.count || 0;
    return `${open} open, ${pending} pending, ${waiting} waiting on customer`;
  } catch (e) {
    return 'Ticket data unavailable';
  }
}

function getTaskContext() {
  try {
    const dbInstance = db.getDb();
    const stmt = dbInstance.prepare(`SELECT COUNT(*) as count FROM task_mappings WHERE sync_enabled = 1`);
    const result = stmt.get();
    return `${result?.count || 0} synced tasks across platforms`;
  } catch (e) {
    return 'Task data unavailable';
  }
}

// ============================================
// PARKING LOT (Quick Capture)
// ============================================

export function addToParkingLot(thought, context = null, priority = 0) {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`INSERT INTO parking_lot (thought, context, priority) VALUES (?, ?, ?)`);
  const result = stmt.run(thought, context, priority);
  return { id: result.lastInsertRowid, thought, context, priority };
}

export function getParkingLotItems(limit = 20) {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`SELECT * FROM parking_lot WHERE processed = 0 ORDER BY priority DESC, created_at DESC LIMIT ?`);
    return stmt.all(limit);
  } catch (e) {
    return [];
  }
}

export function processParkingLotItem(id) {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`UPDATE parking_lot SET processed = 1, processed_at = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(id);
  return { success: true };
}

export function clearParkingLot() {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`UPDATE parking_lot SET processed = 1, processed_at = CURRENT_TIMESTAMP WHERE processed = 0`);
  const result = stmt.run();
  return { cleared: result.changes };
}

// ============================================
// POMODORO TIMER
// ============================================

export function startPomodoro(taskDescription, taskId = null, durationMinutes = 25) {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`INSERT INTO pomodoro_sessions (task_description, task_id, duration_minutes) VALUES (?, ?, ?)`);
  const result = stmt.run(taskDescription, taskId, durationMinutes);
  logActivity('pomodoro_start', { taskDescription, taskId });
  return { id: result.lastInsertRowid, taskDescription, durationMinutes, startedAt: new Date().toISOString() };
}

export function endPomodoro(sessionId, completed = true) {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`UPDATE pomodoro_sessions SET ended_at = CURRENT_TIMESTAMP, completed = ? WHERE id = ?`);
  stmt.run(completed ? 1 : 0, sessionId);
  logActivity('pomodoro_end', { sessionId, completed });
  return { success: true };
}

export function getActivePomodoro() {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`SELECT * FROM pomodoro_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`);
    const session = stmt.get();
    if (session) {
      const startedAt = new Date(session.started_at);
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000 / 60);
      const remaining = Math.max(0, session.duration_minutes - elapsed);
      return { ...session, elapsedMinutes: elapsed, remainingMinutes: remaining, isComplete: remaining === 0 };
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function recordInterruption(sessionId) {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`UPDATE pomodoro_sessions SET interruptions = interruptions + 1 WHERE id = ?`);
  stmt.run(sessionId);
  return { success: true };
}

// ============================================
// ACTIVITY TRACKING ("What Was I Doing?")
// ============================================

export function logActivity(action, context = {}, page = null) {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`INSERT INTO activity_log (action, context, page) VALUES (?, ?, ?)`);
    stmt.run(action, JSON.stringify(context), page);
  } catch (e) {
    console.error('Failed to log activity:', e.message);
  }
}

export function getRecentActivity(limit = 10) {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?`);
    const rows = stmt.all(limit);
    return rows.map(r => ({ ...r, context: JSON.parse(r.context || '{}') }));
  } catch (e) {
    return [];
  }
}

export function getWhatWasIDoing() {
  const activities = getRecentActivity(5);
  const activePomodoro = getActivePomodoro();
  const parkingLot = getParkingLotItems(3);

  const timeAgo = (timestamp) => {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return {
    lastActivities: activities,
    activePomodoro,
    recentThoughts: parkingLot,
    summary: activities.length > 0 ? `Last action: ${activities[0].action} (${timeAgo(activities[0].timestamp)})` : 'No recent activity tracked'
  };
}

// ============================================
// AUTOMATION RULES
// ============================================

export function createAutomationRule(rule) {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`INSERT INTO automation_rules (name, trigger_type, trigger_value, action_type, action_value) VALUES (?, ?, ?, ?, ?)`);
  const result = stmt.run(rule.name, rule.triggerType, rule.triggerValue, rule.actionType, rule.actionValue);
  return { id: result.lastInsertRowid, ...rule };
}

export function getAutomationRules() {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare('SELECT * FROM automation_rules WHERE enabled = 1');
    return stmt.all();
  } catch (e) {
    return [];
  }
}

export async function checkAutomationRules(triggerType, triggerData) {
  const rules = getAutomationRules().filter(r => r.trigger_type === triggerType);
  for (const rule of rules) {
    if (shouldTriggerRule(rule, triggerData)) {
      await executeRule(rule, triggerData);
    }
  }
}

function shouldTriggerRule(rule, data) {
  if (!rule.trigger_value) return true;
  const triggerValue = JSON.parse(rule.trigger_value);
  return Object.entries(triggerValue).every(([key, value]) => {
    return data[key] === value || (typeof value === 'string' && data[key]?.includes?.(value));
  });
}

async function executeRule(rule, data) {
  const dbInstance = db.getDb();
  try {
    const actionValue = JSON.parse(rule.action_value || '{}');
    switch (rule.action_type) {
      case 'notify':
        console.log(`[Automation] ${rule.name}: ${actionValue.message || 'Triggered'}`);
        break;
      case 'tag':
        break;
      case 'assign':
        break;
      case 'create_task':
        break;
    }
    const stmt = dbInstance.prepare(`UPDATE automation_rules SET last_triggered = CURRENT_TIMESTAMP, trigger_count = trigger_count + 1 WHERE id = ?`);
    stmt.run(rule.id);
  } catch (e) {
    console.error(`Automation rule ${rule.name} failed:`, e.message);
  }
}


// ============================================
// SMART DAILY REPORT
// ============================================

export async function generateSmartDailyReport() {
  const dbInstance = db.getDb();
  let tickets = [];
  try {
    const stmt = dbInstance.prepare(`
      SELECT t.*, a.escalation_type, a.urgency_score, a.summary as ai_summary
      FROM tickets t LEFT JOIN ticket_analysis a ON t.id = a.ticket_id
      WHERE t.status IN (2, 3, 6, 7)
      ORDER BY a.urgency_score DESC NULLS LAST
    `);
    tickets = stmt.all();
  } catch (e) {}

  const critical = tickets.filter(t => t.urgency_score >= 8);
  const high = tickets.filter(t => t.urgency_score >= 5 && t.urgency_score < 8);
  const medium = tickets.filter(t => t.urgency_score >= 3 && t.urgency_score < 5);
  const low = tickets.filter(t => !t.urgency_score || t.urgency_score < 3);

  const byType = {};
  tickets.forEach(t => {
    const type = t.escalation_type || 'UNANALYZED';
    if (!byType[type]) byType[type] = [];
    byType[type].push(t);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    summary: { totalTickets: tickets.length, critical: critical.length, high: high.length, medium: medium.length, low: low.length },
    byType,
    attackPlan: [],
    quickWins: low.slice(0, 3).map(t => ({ id: t.id, subject: t.subject })),
  };

  if (critical.length > 0) {
    report.attackPlan.push({ priority: 'CRITICAL', action: 'Handle immediately', tickets: critical.slice(0, 3).map(t => ({ id: t.id, subject: t.subject, urgency: t.urgency_score })) });
  }
  if (high.length > 0) {
    report.attackPlan.push({ priority: 'HIGH', action: 'Address next', tickets: high.slice(0, 5).map(t => ({ id: t.id, subject: t.subject, urgency: t.urgency_score })) });
  }

  try {
    const result = await ai.chat([{ role: 'user', content: 'Give 3 quick tips for handling ' + tickets.length + ' support tickets with ' + critical.length + ' critical.' }], { maxTokens: 200 });
    report.aiInsights = result.text;
  } catch (e) { report.aiInsights = 'unavailable'; }

  return report;
}

export function getSmartTicketQueue() {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`
      SELECT t.*, a.escalation_type, a.urgency_score, a.summary as ai_summary
      FROM tickets t LEFT JOIN ticket_analysis a ON t.id = a.ticket_id
      WHERE t.status IN (2, 3, 6, 7)
      ORDER BY a.urgency_score DESC NULLS LAST
    `);
    const tickets = stmt.all();
    return {
      total: tickets.length,
      critical: tickets.filter(t => t.urgency_score >= 8),
      high: tickets.filter(t => t.urgency_score >= 5 && t.urgency_score < 8),
      other: tickets.filter(t => !t.urgency_score || t.urgency_score < 5),
      nextUp: tickets.slice(0, 5)
    };
  } catch (e) { return { total: 0, critical: [], high: [], other: [], nextUp: [] }; }
}

export default {
  initBriefingTables,
  generateSmartDailyReport,
  getSmartTicketQueue,
  generateBriefing,
  addToParkingLot,
  getParkingLotItems,
  processParkingLotItem,
  clearParkingLot,
  startPomodoro,
  endPomodoro,
  getActivePomodoro,
  recordInterruption,
  logActivity,
  getRecentActivity,
  getWhatWasIDoing,
  createAutomationRule,
  getAutomationRules,
  checkAutomationRules
};
