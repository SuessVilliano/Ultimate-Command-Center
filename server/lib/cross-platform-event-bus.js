/**
 * Cross-Platform Event Bus for LIV8 Command Center
 *
 * This module enables seamless real-time communication between:
 * - Nifty PM
 * - Taskade
 * - TaskMagic
 * - Internal systems (tickets, AI agents, etc.)
 *
 * Features:
 * - Event-driven architecture
 * - Automatic event routing
 * - Cross-platform action chains
 * - Webhook integration for external triggers
 */

import { taskade, taskmagic } from './integrations.js';
import { nifty } from './nifty-integration.js';
import * as db from './database.js';

// Event Bus State
const eventBus = {
  handlers: new Map(),
  history: [],
  chainedActions: [],
  webhookQueue: [],
  isProcessing: false
};

// Event Types for Cross-Platform Communication
export const EVENTS = {
  // Task Events
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',
  TASK_DELETED: 'task.deleted',
  TASK_ASSIGNED: 'task.assigned',
  TASK_OVERDUE: 'task.overdue',

  // Project Events
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',

  // Ticket Events
  TICKET_CREATED: 'ticket.created',
  TICKET_UPDATED: 'ticket.updated',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_ESCALATED: 'ticket.escalated',

  // Sync Events
  SYNC_STARTED: 'sync.started',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_CONFLICT: 'sync.conflict',

  // AI Events
  AI_SUGGESTION: 'ai.suggestion',
  AI_ACTION_TRIGGERED: 'ai.action.triggered',
  AI_ACTION_COMPLETED: 'ai.action.completed',

  // Automation Events
  AUTOMATION_TRIGGERED: 'automation.triggered',
  AUTOMATION_COMPLETED: 'automation.completed',
  AUTOMATION_FAILED: 'automation.failed',

  // System Events
  PLATFORM_CONNECTED: 'platform.connected',
  PLATFORM_DISCONNECTED: 'platform.disconnected',
  ERROR: 'error'
};

// Platform identifiers
export const PLATFORMS = {
  TASKADE: 'taskade',
  NIFTY: 'nifty',
  TASKMAGIC: 'taskmagic',
  FRESHDESK: 'freshdesk',
  GHL: 'ghl',
  INTERNAL: 'internal'
};

/**
 * Subscribe to an event
 */
export function on(event, handler, options = {}) {
  if (!eventBus.handlers.has(event)) {
    eventBus.handlers.set(event, []);
  }

  const handlerObj = {
    handler,
    platform: options.platform || 'all',
    priority: options.priority || 0,
    once: options.once || false,
    id: `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  eventBus.handlers.get(event).push(handlerObj);

  // Sort by priority (higher first)
  eventBus.handlers.get(event).sort((a, b) => b.priority - a.priority);

  // Return unsubscribe function
  return () => off(event, handlerObj.id);
}

/**
 * Subscribe to an event once
 */
export function once(event, handler, options = {}) {
  return on(event, handler, { ...options, once: true });
}

/**
 * Unsubscribe from an event
 */
export function off(event, handlerId) {
  if (eventBus.handlers.has(event)) {
    const handlers = eventBus.handlers.get(event);
    eventBus.handlers.set(
      event,
      handlers.filter(h => h.id !== handlerId)
    );
  }
}

/**
 * Emit an event
 */
export async function emit(event, data, options = {}) {
  const eventObj = {
    type: event,
    data,
    source: options.source || PLATFORMS.INTERNAL,
    timestamp: new Date().toISOString(),
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  // Log event to history
  eventBus.history.push(eventObj);
  if (eventBus.history.length > 1000) {
    eventBus.history = eventBus.history.slice(-500);
  }

  console.log(`[EventBus] ${event} from ${eventObj.source}`, data?.id || '');

  // Get handlers for this event
  const handlers = eventBus.handlers.get(event) || [];
  const wildcardHandlers = eventBus.handlers.get('*') || [];

  const allHandlers = [...handlers, ...wildcardHandlers];
  const results = [];

  for (const handlerObj of allHandlers) {
    // Filter by platform if specified
    if (handlerObj.platform !== 'all' && handlerObj.platform !== eventObj.source) {
      continue;
    }

    try {
      const result = await handlerObj.handler(eventObj);
      results.push({ handlerId: handlerObj.id, result, success: true });

      // Remove if once
      if (handlerObj.once) {
        off(event, handlerObj.id);
      }
    } catch (error) {
      console.error(`[EventBus] Handler error for ${event}:`, error.message);
      results.push({ handlerId: handlerObj.id, error: error.message, success: false });
    }
  }

  // Trigger chained actions
  await processChainedActions(eventObj);

  return { event: eventObj, results };
}

/**
 * Register a chained action (event -> action -> event)
 */
export function registerChain(config) {
  const chain = {
    id: `chain_${Date.now()}`,
    trigger: config.trigger, // Event type that triggers this chain
    condition: config.condition, // Optional function to check if action should run
    actions: config.actions, // Array of actions to perform
    platforms: config.platforms, // Which platforms this affects
    enabled: config.enabled !== false,
    name: config.name || 'Unnamed chain'
  };

  eventBus.chainedActions.push(chain);
  console.log(`[EventBus] Registered chain: ${chain.name}`);

  return chain.id;
}

/**
 * Process chained actions for an event
 */
async function processChainedActions(event) {
  const matchingChains = eventBus.chainedActions.filter(
    c => c.enabled && c.trigger === event.type
  );

  for (const chain of matchingChains) {
    // Check condition if specified
    if (chain.condition && !chain.condition(event)) {
      continue;
    }

    console.log(`[EventBus] Executing chain: ${chain.name}`);

    for (const action of chain.actions) {
      try {
        await executeChainAction(action, event);
      } catch (error) {
        console.error(`[EventBus] Chain action failed:`, error.message);

        // Emit error event
        await emit(EVENTS.ERROR, {
          chain: chain.name,
          action: action.type,
          error: error.message
        });
      }
    }
  }
}

/**
 * Execute a single chain action
 */
async function executeChainAction(action, triggerEvent) {
  switch (action.type) {
    case 'create_task':
      await createCrossPlattformTask(action, triggerEvent);
      break;

    case 'sync_task':
      await syncTaskAcrossPlatforms(action, triggerEvent);
      break;

    case 'trigger_automation':
      await triggerTaskMagicAutomation(action, triggerEvent);
      break;

    case 'notify':
      await sendCrossPatformNotification(action, triggerEvent);
      break;

    case 'update_task':
      await updateCrossPlatformTask(action, triggerEvent);
      break;

    case 'complete_task':
      await completeCrossPlatformTask(action, triggerEvent);
      break;

    case 'emit_event':
      await emit(action.event, { ...action.data, trigger: triggerEvent });
      break;

    default:
      console.warn(`[EventBus] Unknown action type: ${action.type}`);
  }
}

/**
 * Create task across platforms
 */
async function createCrossPlattformTask(action, triggerEvent) {
  const platforms = action.platforms || [PLATFORMS.TASKADE];
  const taskData = action.transform
    ? action.transform(triggerEvent.data)
    : triggerEvent.data;

  const results = [];

  for (const platform of platforms) {
    try {
      let result;

      switch (platform) {
        case PLATFORMS.TASKADE:
          if (action.projectId) {
            result = await taskade.createTask(
              action.projectId,
              taskData.title || taskData.content,
              { placement: 'beforeend' }
            );
          }
          break;

        case PLATFORMS.NIFTY:
          if (nifty.getTokenStatus().authenticated && action.projectId) {
            result = await nifty.createTask(action.projectId, {
              name: taskData.title || taskData.content,
              description: taskData.description,
              due_date: taskData.dueDate
            });
          }
          break;
      }

      if (result) {
        results.push({ platform, success: true, taskId: result.id });

        // Emit task created event
        await emit(EVENTS.TASK_CREATED, {
          ...result,
          platform,
          chainTriggered: true
        }, { source: platform });
      }

    } catch (error) {
      results.push({ platform, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Sync task across platforms
 */
async function syncTaskAcrossPlatforms(action, triggerEvent) {
  const sourcePlatform = triggerEvent.source;
  const targetPlatforms = action.platforms.filter(p => p !== sourcePlatform);
  const taskData = triggerEvent.data;

  for (const targetPlatform of targetPlatforms) {
    try {
      // Find or create mapping
      switch (targetPlatform) {
        case PLATFORMS.TASKADE:
          if (action.taskadeProjectId) {
            await taskade.createTask(
              action.taskadeProjectId,
              `[Synced from ${sourcePlatform}] ${taskData.title || taskData.name}`,
              { placement: 'beforeend' }
            );
          }
          break;

        case PLATFORMS.NIFTY:
          if (nifty.getTokenStatus().authenticated && action.niftyProjectId) {
            await nifty.createTask(action.niftyProjectId, {
              name: `[Synced from ${sourcePlatform}] ${taskData.title || taskData.name}`,
              description: taskData.description
            });
          }
          break;
      }

      // Emit sync completed
      await emit(EVENTS.SYNC_COMPLETED, {
        source: sourcePlatform,
        target: targetPlatform,
        taskId: taskData.id
      });

    } catch (error) {
      await emit(EVENTS.SYNC_CONFLICT, {
        source: sourcePlatform,
        target: targetPlatform,
        error: error.message
      });
    }
  }
}

/**
 * Trigger TaskMagic automation
 */
async function triggerTaskMagicAutomation(action, triggerEvent) {
  const automationName = action.automation;
  const payload = action.transform
    ? action.transform(triggerEvent.data)
    : triggerEvent.data;

  try {
    const result = await taskmagic.triggerAutomation(automationName, payload);

    await emit(EVENTS.AUTOMATION_TRIGGERED, {
      automation: automationName,
      payload,
      result
    }, { source: PLATFORMS.TASKMAGIC });

    return result;

  } catch (error) {
    await emit(EVENTS.AUTOMATION_FAILED, {
      automation: automationName,
      error: error.message
    });
    throw error;
  }
}

/**
 * Send cross-platform notification
 */
async function sendCrossPatformNotification(action, triggerEvent) {
  const message = action.template
    ? action.template(triggerEvent.data)
    : `${triggerEvent.type}: ${JSON.stringify(triggerEvent.data)}`;

  try {
    await taskmagic.sendNotification(message, action.channel || 'default');
  } catch (e) {
    console.warn('Notification failed:', e.message);
  }
}

/**
 * Update task across platforms
 */
async function updateCrossPlatformTask(action, triggerEvent) {
  const updates = action.transform
    ? action.transform(triggerEvent.data)
    : triggerEvent.data.updates;

  const platforms = action.platforms || [PLATFORMS.TASKADE];

  for (const platform of platforms) {
    try {
      switch (platform) {
        case PLATFORMS.TASKADE:
          if (action.projectId && action.taskId) {
            await taskade.updateTask(action.projectId, action.taskId, updates.content || updates.title);
          }
          break;

        case PLATFORMS.NIFTY:
          if (nifty.getTokenStatus().authenticated && action.taskId) {
            await nifty.updateTask(action.taskId, {
              name: updates.title || updates.name,
              description: updates.description
            });
          }
          break;
      }

      await emit(EVENTS.TASK_UPDATED, { platform, taskId: action.taskId, updates });

    } catch (error) {
      console.error(`Update failed on ${platform}:`, error.message);
    }
  }
}

/**
 * Complete task across platforms
 */
async function completeCrossPlatformTask(action, triggerEvent) {
  const platforms = action.platforms || [PLATFORMS.TASKADE];

  for (const platform of platforms) {
    try {
      switch (platform) {
        case PLATFORMS.TASKADE:
          if (action.projectId && action.taskId) {
            await taskade.completeTask(action.projectId, action.taskId);
          }
          break;

        case PLATFORMS.NIFTY:
          if (nifty.getTokenStatus().authenticated && action.taskId) {
            await nifty.completeTask(action.taskId);
          }
          break;
      }

      await emit(EVENTS.TASK_COMPLETED, {
        platform,
        taskId: action.taskId,
        chainTriggered: true
      });

    } catch (error) {
      console.error(`Complete failed on ${platform}:`, error.message);
    }
  }
}

/**
 * Get event history
 */
export function getEventHistory(options = {}) {
  let history = [...eventBus.history];

  if (options.eventType) {
    history = history.filter(e => e.type === options.eventType);
  }

  if (options.platform) {
    history = history.filter(e => e.source === options.platform);
  }

  if (options.limit) {
    history = history.slice(-options.limit);
  }

  return history;
}

/**
 * Get registered chains
 */
export function getChains() {
  return eventBus.chainedActions.map(c => ({
    id: c.id,
    name: c.name,
    trigger: c.trigger,
    enabled: c.enabled,
    platforms: c.platforms,
    actionCount: c.actions.length
  }));
}

/**
 * Enable/disable a chain
 */
export function toggleChain(chainId, enabled) {
  const chain = eventBus.chainedActions.find(c => c.id === chainId);
  if (chain) {
    chain.enabled = enabled;
    return true;
  }
  return false;
}

/**
 * Remove a chain
 */
export function removeChain(chainId) {
  eventBus.chainedActions = eventBus.chainedActions.filter(c => c.id !== chainId);
}

/**
 * Initialize default cross-platform chains
 */
export function initializeDefaultChains() {
  // When a task is completed in Taskade, sync to Nifty
  registerChain({
    name: 'Taskade -> Nifty Task Complete Sync',
    trigger: EVENTS.TASK_COMPLETED,
    condition: (event) => event.source === PLATFORMS.TASKADE,
    platforms: [PLATFORMS.NIFTY],
    actions: [
      {
        type: 'notify',
        channel: 'sync',
        template: (data) => `Task completed in Taskade: ${data.title || data.id}`
      }
    ]
  });

  // When a task is created in Nifty, trigger TaskMagic
  registerChain({
    name: 'Nifty Task -> TaskMagic Notification',
    trigger: EVENTS.TASK_CREATED,
    condition: (event) => event.source === PLATFORMS.NIFTY,
    platforms: [PLATFORMS.TASKMAGIC],
    actions: [
      {
        type: 'trigger_automation',
        automation: 'new_task_notification',
        transform: (data) => ({
          taskName: data.name || data.title,
          project: data.projectName,
          source: 'nifty'
        })
      }
    ]
  });

  // When ticket is escalated, create tasks in both platforms
  registerChain({
    name: 'Escalated Ticket -> Multi-Platform Tasks',
    trigger: EVENTS.TICKET_ESCALATED,
    condition: (event) => event.data.urgency >= 8,
    platforms: [PLATFORMS.TASKADE, PLATFORMS.NIFTY],
    actions: [
      {
        type: 'notify',
        channel: 'escalation',
        template: (data) => `URGENT: Ticket #${data.id} escalated - ${data.subject}`
      }
    ]
  });

  // AI suggestion -> Auto-create task
  registerChain({
    name: 'AI Suggestion Auto-Execute',
    trigger: EVENTS.AI_SUGGESTION,
    condition: (event) => event.data.autoExecutable === true && event.data.priority === 'high',
    platforms: [PLATFORMS.TASKADE],
    actions: [
      {
        type: 'notify',
        channel: 'ai',
        template: (data) => `AI Auto-Action: ${data.title}`
      }
    ]
  });

  console.log('[EventBus] Default chains initialized');
}

/**
 * Receive webhook from external platform
 */
export async function handleWebhook(platform, payload) {
  console.log(`[EventBus] Webhook received from ${platform}`);

  // Map webhook to event
  let event;
  let eventData;

  switch (platform) {
    case PLATFORMS.TASKADE:
      event = mapTaskadeWebhook(payload);
      eventData = payload;
      break;

    case PLATFORMS.NIFTY:
      event = mapNiftyWebhook(payload);
      eventData = payload;
      break;

    case PLATFORMS.TASKMAGIC:
      event = mapTaskMagicWebhook(payload);
      eventData = payload;
      break;

    default:
      event = EVENTS.ERROR;
      eventData = { error: 'Unknown platform', payload };
  }

  if (event) {
    return emit(event, eventData, { source: platform });
  }
}

function mapTaskadeWebhook(payload) {
  switch (payload.event || payload.type) {
    case 'task_created': return EVENTS.TASK_CREATED;
    case 'task_completed': return EVENTS.TASK_COMPLETED;
    case 'task_updated': return EVENTS.TASK_UPDATED;
    default: return null;
  }
}

function mapNiftyWebhook(payload) {
  switch (payload.event || payload.type) {
    case 'task.created': return EVENTS.TASK_CREATED;
    case 'task.completed': return EVENTS.TASK_COMPLETED;
    case 'task.updated': return EVENTS.TASK_UPDATED;
    default: return null;
  }
}

function mapTaskMagicWebhook(payload) {
  switch (payload.event || payload.type) {
    case 'automation_complete': return EVENTS.AUTOMATION_COMPLETED;
    case 'automation_failed': return EVENTS.AUTOMATION_FAILED;
    default: return EVENTS.AUTOMATION_TRIGGERED;
  }
}

/**
 * Get event bus status
 */
export function getStatus() {
  return {
    handlerCount: Array.from(eventBus.handlers.values()).reduce((sum, arr) => sum + arr.length, 0),
    eventTypes: Array.from(eventBus.handlers.keys()),
    chainCount: eventBus.chainedActions.length,
    enabledChains: eventBus.chainedActions.filter(c => c.enabled).length,
    historySize: eventBus.history.length,
    recentEvents: eventBus.history.slice(-10).map(e => ({
      type: e.type,
      source: e.source,
      timestamp: e.timestamp
    }))
  };
}

export default {
  on,
  once,
  off,
  emit,
  registerChain,
  toggleChain,
  removeChain,
  getChains,
  getEventHistory,
  handleWebhook,
  getStatus,
  initializeDefaultChains,
  EVENTS,
  PLATFORMS
};
