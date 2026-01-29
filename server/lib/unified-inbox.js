/**
 * Unified Inbox Service
 * Aggregates tickets, tasks, notifications into a single feed
 *
 * Features:
 * - Unified view of all action items
 * - Smart prioritization
 * - Quick actions from inbox
 * - Snooze and dismiss
 */

import * as db from './database.js';

/**
 * Initialize unified inbox tables
 */
export function initUnifiedInboxTables() {
  const dbInstance = db.getDb();

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS unified_inbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      preview TEXT,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'unread',
      metadata TEXT,
      snoozed_until TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_type, item_id, source)
    );

    CREATE TABLE IF NOT EXISTS inbox_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      source TEXT,
      link TEXT,
      read INTEGER DEFAULT 0,
      dismissed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_inbox_status ON unified_inbox(status);
    CREATE INDEX IF NOT EXISTS idx_inbox_priority ON unified_inbox(priority DESC);
    CREATE INDEX IF NOT EXISTS idx_inbox_type ON unified_inbox(item_type);
  `);

  console.log('Unified Inbox: Tables initialized');
}

/**
 * Get all inbox items (unified feed)
 */
export function getInboxItems(options = {}) {
  const dbInstance = db.getDb();
  const { limit = 50, status = null, type = null, includeNotifications = true } = options;

  try {
    let query = `
      SELECT
        id, item_type, item_id, source, title, preview, priority, status,
        metadata, snoozed_until, created_at, updated_at,
        'inbox_item' as feed_type
      FROM unified_inbox
      WHERE (snoozed_until IS NULL OR snoozed_until < datetime('now'))
    `;

    if (status) {
      query += ` AND status = '${status}'`;
    }
    if (type) {
      query += ` AND item_type = '${type}'`;
    }

    // Add notifications if requested
    if (includeNotifications) {
      query = `
        ${query}
        UNION ALL
        SELECT
          id, 'notification' as item_type, CAST(id AS TEXT) as item_id,
          COALESCE(source, 'system') as source, title, message as preview,
          0 as priority,
          CASE WHEN read = 1 THEN 'read' ELSE 'unread' END as status,
          NULL as metadata, NULL as snoozed_until,
          created_at, created_at as updated_at,
          'notification' as feed_type
        FROM inbox_notifications
        WHERE dismissed = 0
      `;
    }

    query += ` ORDER BY priority DESC, created_at DESC LIMIT ${limit}`;

    const stmt = dbInstance.prepare(query);
    const items = stmt.all();

    return items.map(item => ({
      ...item,
      metadata: item.metadata ? JSON.parse(item.metadata) : null
    }));
  } catch (e) {
    console.error('Error fetching inbox items:', e.message);
    return [];
  }
}

/**
 * Add item to unified inbox
 */
export function addToInbox(item) {
  const dbInstance = db.getDb();
  const { type, itemId, source, title, preview = null, priority = 0, metadata = null } = item;

  try {
    const stmt = dbInstance.prepare(`
      INSERT INTO unified_inbox (item_type, item_id, source, title, preview, priority, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_type, item_id, source) DO UPDATE SET
        title = excluded.title,
        preview = excluded.preview,
        priority = excluded.priority,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(type, itemId, source, title, preview, priority, metadata ? JSON.stringify(metadata) : null);
    return { success: true };
  } catch (e) {
    console.error('Error adding to inbox:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Mark inbox item as read
 */
export function markAsRead(id, feedType = 'inbox_item') {
  const dbInstance = db.getDb();

  try {
    if (feedType === 'notification') {
      const stmt = dbInstance.prepare(`UPDATE inbox_notifications SET read = 1 WHERE id = ?`);
      stmt.run(id);
    } else {
      const stmt = dbInstance.prepare(`UPDATE unified_inbox SET status = 'read', updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
      stmt.run(id);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Snooze inbox item
 */
export function snoozeItem(id, minutes = 60) {
  const dbInstance = db.getDb();

  try {
    const stmt = dbInstance.prepare(`
      UPDATE unified_inbox
      SET snoozed_until = datetime('now', '+${minutes} minutes'), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Dismiss/archive inbox item
 */
export function dismissItem(id, feedType = 'inbox_item') {
  const dbInstance = db.getDb();

  try {
    if (feedType === 'notification') {
      const stmt = dbInstance.prepare(`UPDATE inbox_notifications SET dismissed = 1 WHERE id = ?`);
      stmt.run(id);
    } else {
      const stmt = dbInstance.prepare(`UPDATE unified_inbox SET status = 'dismissed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
      stmt.run(id);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Add notification
 */
export function addNotification(notification) {
  const dbInstance = db.getDb();
  const { type, title, message = null, source = 'system', link = null } = notification;

  try {
    const stmt = dbInstance.prepare(`
      INSERT INTO inbox_notifications (type, title, message, source, link)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(type, title, message, source, link);
    return { success: true, id: result.lastInsertRowid };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get unread counts by type
 */
export function getUnreadCounts() {
  const dbInstance = db.getDb();

  try {
    const inboxStmt = dbInstance.prepare(`
      SELECT item_type, COUNT(*) as count
      FROM unified_inbox
      WHERE status = 'unread' AND (snoozed_until IS NULL OR snoozed_until < datetime('now'))
      GROUP BY item_type
    `);
    const inboxCounts = inboxStmt.all();

    const notifStmt = dbInstance.prepare(`
      SELECT COUNT(*) as count FROM inbox_notifications WHERE read = 0 AND dismissed = 0
    `);
    const notifCount = notifStmt.get();

    const counts = {
      total: 0,
      notifications: notifCount?.count || 0,
      tickets: 0,
      tasks: 0,
      mentions: 0
    };

    for (const item of inboxCounts) {
      counts[item.item_type] = item.count;
      counts.total += item.count;
    }
    counts.total += counts.notifications;

    return counts;
  } catch (e) {
    return { total: 0, notifications: 0, tickets: 0, tasks: 0, mentions: 0 };
  }
}

/**
 * Sync tickets to inbox
 */
export function syncTicketsToInbox() {
  const dbInstance = db.getDb();

  try {
    // Get open/pending tickets and add them to unified inbox
    const ticketStmt = dbInstance.prepare(`
      SELECT id, subject, description, status, priority, created_at
      FROM tickets
      WHERE status IN (2, 3, 6)
    `);
    const tickets = ticketStmt.all();

    let synced = 0;
    for (const ticket of tickets) {
      const priorityMap = { 1: 1, 2: 2, 3: 3, 4: 4 }; // Freshdesk priority mapping
      addToInbox({
        type: 'ticket',
        itemId: String(ticket.id),
        source: 'freshdesk',
        title: ticket.subject || `Ticket #${ticket.id}`,
        preview: ticket.description?.substring(0, 100),
        priority: priorityMap[ticket.priority] || 0,
        metadata: { status: ticket.status, originalPriority: ticket.priority }
      });
      synced++;
    }

    return { success: true, synced };
  } catch (e) {
    console.error('Error syncing tickets:', e.message);
    return { success: false, synced: 0 };
  }
}

/**
 * Sync tasks to inbox
 */
export function syncTasksToInbox() {
  const dbInstance = db.getDb();

  try {
    // Get synced tasks and add them to unified inbox
    const taskStmt = dbInstance.prepare(`
      SELECT id, task_name, platform, platform_task_id, sync_enabled
      FROM task_mappings
      WHERE sync_enabled = 1
    `);
    const tasks = taskStmt.all();

    let synced = 0;
    for (const task of tasks) {
      addToInbox({
        type: 'task',
        itemId: task.platform_task_id || String(task.id),
        source: task.platform,
        title: task.task_name,
        preview: `From ${task.platform}`,
        priority: 1,
        metadata: { localId: task.id, platform: task.platform }
      });
      synced++;
    }

    return { success: true, synced };
  } catch (e) {
    console.error('Error syncing tasks:', e.message);
    return { success: false, synced: 0 };
  }
}

/**
 * Full inbox refresh
 */
export async function refreshInbox() {
  const ticketResult = syncTicketsToInbox();
  const taskResult = syncTasksToInbox();

  return {
    tickets: ticketResult,
    tasks: taskResult,
    refreshedAt: new Date().toISOString()
  };
}

export default {
  initUnifiedInboxTables,
  getInboxItems,
  addToInbox,
  markAsRead,
  snoozeItem,
  dismissItem,
  addNotification,
  getUnreadCounts,
  syncTicketsToInbox,
  syncTasksToInbox,
  refreshInbox
};
