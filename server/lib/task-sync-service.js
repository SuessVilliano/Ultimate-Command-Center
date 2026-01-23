/**
 * Task Sync Service
 * Bidirectional synchronization between Taskade, Nifty PM, and Command Center
 *
 * Features:
 * - Sync task creation across platforms
 * - Sync status changes (complete/update)
 * - Task mapping for linked items
 * - Sync history tracking
 */

import * as db from './database.js';
import { taskade } from './integrations.js';
import { nifty } from './nifty-integration.js';

// Initialize sync tables
export function initSyncTables() {
  const dbInstance = db.getDb();

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS task_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_platform TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_project_id TEXT,
      target_platform TEXT NOT NULL,
      target_id TEXT,
      target_project_id TEXT,
      task_title TEXT,
      sync_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_platform, source_id, target_platform)
    );

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mapping_id INTEGER,
      action TEXT NOT NULL,
      source_platform TEXT,
      target_platform TEXT,
      status TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mapping_id) REFERENCES task_mappings(id)
    );

    CREATE TABLE IF NOT EXISTS sync_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_platform TEXT NOT NULL,
      source_project_id TEXT NOT NULL,
      target_platform TEXT NOT NULL,
      target_project_id TEXT NOT NULL,
      sync_creates INTEGER DEFAULT 1,
      sync_updates INTEGER DEFAULT 1,
      sync_completes INTEGER DEFAULT 1,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_platform, source_project_id, target_platform, target_project_id)
    );
  `);

  console.log('Task Sync: Tables initialized');
}

/**
 * Get all sync configurations
 */
export function getSyncConfigs() {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare('SELECT * FROM sync_config WHERE enabled = 1');
    return stmt.all();
  } catch (e) {
    return [];
  }
}

/**
 * Create a sync configuration between two projects
 */
export function createSyncConfig(config) {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`
    INSERT INTO sync_config (source_platform, source_project_id, target_platform, target_project_id, sync_creates, sync_updates, sync_completes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_platform, source_project_id, target_platform, target_project_id)
    DO UPDATE SET sync_creates = excluded.sync_creates, sync_updates = excluded.sync_updates, sync_completes = excluded.sync_completes, enabled = 1
  `);

  stmt.run(
    config.sourcePlatform,
    config.sourceProjectId,
    config.targetPlatform,
    config.targetProjectId,
    config.syncCreates !== false ? 1 : 0,
    config.syncUpdates !== false ? 1 : 0,
    config.syncCompletes !== false ? 1 : 0
  );

  return { success: true, config };
}

/**
 * Create a task mapping between platforms
 */
export function createTaskMapping(mapping) {
  const dbInstance = db.getDb();
  const stmt = dbInstance.prepare(`
    INSERT INTO task_mappings (source_platform, source_id, source_project_id, target_platform, target_id, target_project_id, task_title)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_platform, source_id, target_platform)
    DO UPDATE SET target_id = excluded.target_id, task_title = excluded.task_title, updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    mapping.sourcePlatform,
    mapping.sourceId,
    mapping.sourceProjectId || null,
    mapping.targetPlatform,
    mapping.targetId || null,
    mapping.targetProjectId || null,
    mapping.taskTitle || null
  );

  return { success: true };
}

/**
 * Get task mapping by source
 */
export function getTaskMapping(sourcePlatform, sourceId, targetPlatform) {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`
      SELECT * FROM task_mappings
      WHERE source_platform = ? AND source_id = ? AND target_platform = ?
    `);
    return stmt.get(sourcePlatform, sourceId, targetPlatform);
  } catch (e) {
    return null;
  }
}

/**
 * Get all mappings for a task
 */
export function getTaskMappings(platform, taskId) {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`
      SELECT * FROM task_mappings
      WHERE (source_platform = ? AND source_id = ?) OR (target_platform = ? AND target_id = ?)
    `);
    return stmt.all(platform, taskId, platform, taskId);
  } catch (e) {
    return [];
  }
}

/**
 * Log sync action
 */
function logSyncAction(mappingId, action, sourcePlatform, targetPlatform, status, details) {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`
      INSERT INTO sync_history (mapping_id, action, source_platform, target_platform, status, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(mappingId, action, sourcePlatform, targetPlatform, status, JSON.stringify(details));
  } catch (e) {
    console.error('Failed to log sync action:', e.message);
  }
}

/**
 * Get sync history
 */
export function getSyncHistory(limit = 50) {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(`
      SELECT h.*, m.task_title, m.source_id, m.target_id
      FROM sync_history h
      LEFT JOIN task_mappings m ON h.mapping_id = m.id
      ORDER BY h.created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  } catch (e) {
    return [];
  }
}

/**
 * Sync a task creation to linked platforms
 */
export async function syncTaskCreate(sourcePlatform, sourceProjectId, task) {
  const configs = getSyncConfigs().filter(
    c => c.source_platform === sourcePlatform && c.source_project_id === sourceProjectId && c.sync_creates
  );

  const results = [];

  for (const config of configs) {
    try {
      let createdTask;

      if (config.target_platform === 'taskade') {
        const result = await taskade.createTask(config.target_project_id, task.title || task.name, {
          placement: 'beforeend'
        });
        createdTask = result;
      } else if (config.target_platform === 'nifty') {
        const result = await nifty.createTask(config.target_project_id, {
          name: task.title || task.name,
          description: task.description || `Synced from ${sourcePlatform}`
        });
        createdTask = result;
      }

      if (createdTask) {
        // Create mapping
        createTaskMapping({
          sourcePlatform,
          sourceId: task.id,
          sourceProjectId,
          targetPlatform: config.target_platform,
          targetId: createdTask.id,
          targetProjectId: config.target_project_id,
          taskTitle: task.title || task.name
        });

        logSyncAction(null, 'create', sourcePlatform, config.target_platform, 'success', {
          sourceTask: task.id,
          targetTask: createdTask.id
        });

        results.push({
          platform: config.target_platform,
          success: true,
          taskId: createdTask.id
        });
      }
    } catch (e) {
      logSyncAction(null, 'create', sourcePlatform, config.target_platform, 'error', { error: e.message });
      results.push({
        platform: config.target_platform,
        success: false,
        error: e.message
      });
    }
  }

  return results;
}

/**
 * Sync a task completion to linked platforms
 */
export async function syncTaskComplete(sourcePlatform, taskId) {
  const mappings = getTaskMappings(sourcePlatform, taskId);
  const results = [];

  for (const mapping of mappings) {
    const targetPlatform = mapping.source_platform === sourcePlatform
      ? mapping.target_platform
      : mapping.source_platform;
    const targetTaskId = mapping.source_platform === sourcePlatform
      ? mapping.target_id
      : mapping.source_id;
    const targetProjectId = mapping.source_platform === sourcePlatform
      ? mapping.target_project_id
      : mapping.source_project_id;

    if (!targetTaskId) continue;

    try {
      if (targetPlatform === 'taskade' && targetProjectId) {
        await taskade.completeTask(targetProjectId, targetTaskId);
      } else if (targetPlatform === 'nifty') {
        await nifty.completeTask(targetTaskId);
      }

      logSyncAction(mapping.id, 'complete', sourcePlatform, targetPlatform, 'success', {
        sourceTask: taskId,
        targetTask: targetTaskId
      });

      results.push({
        platform: targetPlatform,
        success: true,
        taskId: targetTaskId
      });
    } catch (e) {
      logSyncAction(mapping.id, 'complete', sourcePlatform, targetPlatform, 'error', { error: e.message });
      results.push({
        platform: targetPlatform,
        success: false,
        error: e.message
      });
    }
  }

  return results;
}

/**
 * Sync a task update to linked platforms
 */
export async function syncTaskUpdate(sourcePlatform, taskId, updates) {
  const mappings = getTaskMappings(sourcePlatform, taskId);
  const results = [];

  for (const mapping of mappings) {
    const targetPlatform = mapping.source_platform === sourcePlatform
      ? mapping.target_platform
      : mapping.source_platform;
    const targetTaskId = mapping.source_platform === sourcePlatform
      ? mapping.target_id
      : mapping.source_id;
    const targetProjectId = mapping.source_platform === sourcePlatform
      ? mapping.target_project_id
      : mapping.source_project_id;

    if (!targetTaskId) continue;

    try {
      if (targetPlatform === 'taskade' && targetProjectId) {
        await taskade.updateTask(targetProjectId, targetTaskId, updates.title || updates.content);
      } else if (targetPlatform === 'nifty') {
        await nifty.updateTask(targetTaskId, {
          name: updates.title || updates.name,
          description: updates.description
        });
      }

      logSyncAction(mapping.id, 'update', sourcePlatform, targetPlatform, 'success', {
        sourceTask: taskId,
        targetTask: targetTaskId,
        updates
      });

      results.push({
        platform: targetPlatform,
        success: true,
        taskId: targetTaskId
      });
    } catch (e) {
      logSyncAction(mapping.id, 'update', sourcePlatform, targetPlatform, 'error', { error: e.message });
      results.push({
        platform: targetPlatform,
        success: false,
        error: e.message
      });
    }
  }

  return results;
}

/**
 * Full sync between two projects (one-time or scheduled)
 */
export async function fullProjectSync(sourcePlatform, sourceProjectId, targetPlatform, targetProjectId) {
  const results = {
    created: [],
    skipped: [],
    errors: []
  };

  try {
    // Get all tasks from source
    let sourceTasks = [];

    if (sourcePlatform === 'taskade') {
      const resp = await taskade.getTasks(sourceProjectId);
      sourceTasks = resp.items || [];
    } else if (sourcePlatform === 'nifty') {
      const resp = await nifty.getTasks(sourceProjectId);
      sourceTasks = resp.tasks || resp || [];
    }

    // Check each task for existing mapping
    for (const task of sourceTasks) {
      const taskTitle = task.content || task.name || task.title;
      const existingMapping = getTaskMapping(sourcePlatform, task.id, targetPlatform);

      if (existingMapping) {
        results.skipped.push({
          taskId: task.id,
          title: taskTitle,
          reason: 'Already synced'
        });
        continue;
      }

      // Create task in target
      try {
        let createdTask;

        if (targetPlatform === 'taskade') {
          const resp = await taskade.createTask(targetProjectId, taskTitle, { placement: 'beforeend' });
          createdTask = resp;
        } else if (targetPlatform === 'nifty') {
          const resp = await nifty.createTask(targetProjectId, {
            name: taskTitle,
            description: task.description || task.note || `Synced from ${sourcePlatform}`
          });
          createdTask = resp;
        }

        if (createdTask) {
          createTaskMapping({
            sourcePlatform,
            sourceId: task.id,
            sourceProjectId,
            targetPlatform,
            targetId: createdTask.id,
            targetProjectId,
            taskTitle
          });

          results.created.push({
            sourceId: task.id,
            targetId: createdTask.id,
            title: taskTitle
          });
        }
      } catch (e) {
        results.errors.push({
          taskId: task.id,
          title: taskTitle,
          error: e.message
        });
      }
    }

    // Also create sync config for future syncs
    createSyncConfig({
      sourcePlatform,
      sourceProjectId,
      targetPlatform,
      targetProjectId
    });

  } catch (e) {
    results.errors.push({ error: e.message });
  }

  return results;
}

/**
 * Get sync status overview
 */
export function getSyncStatus() {
  const dbInstance = db.getDb();
  let mappingCount = 0;
  let configCount = 0;
  let recentActions = [];

  try {
    mappingCount = dbInstance.prepare('SELECT COUNT(*) as count FROM task_mappings').get()?.count || 0;
    configCount = dbInstance.prepare('SELECT COUNT(*) as count FROM sync_config WHERE enabled = 1').get()?.count || 0;
    recentActions = getSyncHistory(10);
  } catch (e) {}

  return {
    mappings: mappingCount,
    activeConfigs: configCount,
    recentActions,
    platforms: {
      taskade: !!process.env.TASKADE_API_KEY,
      nifty: nifty.getTokenStatus().authenticated
    }
  };
}

// Note: Call initSyncTables() after database is initialized in server.js

export default {
  initSyncTables,
  getSyncConfigs,
  createSyncConfig,
  createTaskMapping,
  getTaskMapping,
  getTaskMappings,
  getSyncHistory,
  syncTaskCreate,
  syncTaskComplete,
  syncTaskUpdate,
  fullProjectSync,
  getSyncStatus
};
