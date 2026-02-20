/**
 * Proactive AI Engine for LIV8 Command Center
 *
 * This engine makes the AI proactive instead of reactive by:
 * 1. Continuously monitoring all connected platforms
 * 2. Detecting patterns, issues, and opportunities
 * 3. Initiating actions without being asked
 * 4. Pushing notifications and suggestions to users
 * 5. Auto-triggering workflows based on conditions
 */

import * as ai from './ai-provider.js';
import * as db from './database.js';
import { taskade, taskmagic, ghl } from './integrations.js';
import { nifty } from './nifty-integration.js';
import { unifiedTasks } from './unified-tasks.js';
import * as taskSync from './task-sync-service.js';

// In-memory store for proactive state
const proactiveState = {
  lastCheck: null,
  pendingActions: [],
  detectedIssues: [],
  suggestions: [],
  automationQueue: [],
  listeners: [],
  isRunning: false,
  checkInterval: null
};

// Proactive rules and triggers
const PROACTIVE_RULES = {
  // Task-based rules
  OVERDUE_TASK: {
    name: 'Overdue Task Detection',
    check: (task) => {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      return due < new Date() && task.status !== 'completed';
    },
    action: 'notify_and_escalate',
    priority: 'high'
  },

  STALE_TASK: {
    name: 'Stale Task Detection',
    check: (task) => {
      const lastUpdated = new Date(task.updatedAt || task.created_at);
      const daysSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 7 && task.status !== 'completed';
    },
    action: 'suggest_review',
    priority: 'medium'
  },

  HIGH_PRIORITY_UNASSIGNED: {
    name: 'High Priority Unassigned',
    check: (task) => {
      return (task.priority === 'high' || task.priority === 'urgent') &&
             (!task.assignees || task.assignees.length === 0);
    },
    action: 'auto_assign_or_notify',
    priority: 'high'
  },

  // Ticket-based rules
  URGENT_TICKET: {
    name: 'Urgent Ticket Detection',
    check: (ticket, analysis) => {
      return analysis && analysis.URGENCY_SCORE >= 8;
    },
    action: 'immediate_escalation',
    priority: 'critical'
  },

  TICKET_PATTERN: {
    name: 'Repeated Issue Pattern',
    check: (tickets) => {
      // Detect if same issue type appears multiple times
      const categories = {};
      tickets.forEach(t => {
        const cat = t.analysis?.ISSUE_CATEGORY || 'Other';
        categories[cat] = (categories[cat] || 0) + 1;
      });
      return Object.entries(categories).filter(([_, count]) => count >= 3);
    },
    action: 'suggest_systemic_fix',
    priority: 'medium'
  },

  // Sync-based rules
  SYNC_CONFLICT: {
    name: 'Cross-Platform Sync Conflict',
    check: (taskA, taskB) => {
      return taskA.status !== taskB.status || taskA.title !== taskB.title;
    },
    action: 'resolve_conflict',
    priority: 'high'
  },

  // Calendar-based rules
  DEADLINE_APPROACHING: {
    name: 'Deadline Approaching',
    check: (task) => {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      const hoursUntil = (due - Date.now()) / (1000 * 60 * 60);
      return hoursUntil > 0 && hoursUntil <= 24;
    },
    action: 'send_reminder',
    priority: 'high'
  }
};

// Event types for cross-platform communication
const EVENT_TYPES = {
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_UPDATED: 'task.updated',
  TASK_OVERDUE: 'task.overdue',
  TICKET_NEW: 'ticket.new',
  TICKET_ESCALATED: 'ticket.escalated',
  SYNC_REQUIRED: 'sync.required',
  AUTOMATION_TRIGGER: 'automation.trigger',
  AI_SUGGESTION: 'ai.suggestion',
  AI_ACTION: 'ai.action'
};

/**
 * Initialize the proactive AI engine
 */
export function initProactiveEngine(options = {}) {
  const {
    checkIntervalMinutes = 5,
    enableAutoActions = true
  } = options;

  console.log('Initializing Proactive AI Engine...');

  // Start the monitoring loop
  if (proactiveState.checkInterval) {
    clearInterval(proactiveState.checkInterval);
  }

  proactiveState.checkInterval = setInterval(
    () => runProactiveCheck(),
    checkIntervalMinutes * 60 * 1000
  );

  proactiveState.isRunning = true;
  proactiveState.enableAutoActions = enableAutoActions;

  // Run initial check
  runProactiveCheck();

  console.log(`Proactive AI Engine started (checking every ${checkIntervalMinutes} minutes)`);

  return {
    status: 'running',
    checkInterval: checkIntervalMinutes
  };
}

/**
 * Stop the proactive engine
 */
export function stopProactiveEngine() {
  if (proactiveState.checkInterval) {
    clearInterval(proactiveState.checkInterval);
    proactiveState.checkInterval = null;
  }
  proactiveState.isRunning = false;
  console.log('Proactive AI Engine stopped');
}

/**
 * Main proactive check loop
 */
async function runProactiveCheck() {
  console.log('Running proactive check...', new Date().toISOString());
  proactiveState.lastCheck = new Date().toISOString();

  try {
    // Gather data from all platforms
    const platformData = await gatherPlatformData();

    // Run all proactive rules
    const detectedIssues = await runProactiveRules(platformData);

    // Generate AI suggestions based on patterns
    const suggestions = await generateAISuggestions(platformData, detectedIssues);

    // Execute automatic actions if enabled
    if (proactiveState.enableAutoActions) {
      await executeAutoActions(detectedIssues);
    }

    // Auto-draft responses for any open tickets missing drafts
    let autoDraftCount = 0;
    try {
      const openTickets = platformData.tickets.filter(t => [2, 3, 6, 7].includes(t.status));
      if (openTickets.length > 0) {
        const pipeline = await import('./ticket-pipeline.js');
        for (const ticket of openTickets) {
          try {
            const existingDrafts = db.getAllDrafts({ ticket_id: ticket.id, limit: 1 });
            if (!existingDrafts || existingDrafts.length === 0) {
              console.log(`  Proactive: Auto-drafting for ticket #${ticket.id}: ${(ticket.subject || '').substring(0, 40)}...`);
              await pipeline.processTicket(ticket.id, { skipQA: false });
              autoDraftCount++;
              // Rate limit between drafts
              await new Promise(r => setTimeout(r, 800));
            }
          } catch (e) {
            console.log(`  Proactive: Draft failed for #${ticket.id}: ${e.message}`);
          }
        }
        if (autoDraftCount > 0) {
          console.log(`  Proactive: Generated ${autoDraftCount} new draft responses`);
        }
      }
    } catch (e) {
      console.log('  Proactive auto-draft skipped:', e.message);
    }

    // Store results
    proactiveState.detectedIssues = detectedIssues;
    proactiveState.suggestions = suggestions;

    // Emit events to listeners
    emitProactiveEvent('check_complete', {
      issueCount: detectedIssues.length,
      suggestionCount: suggestions.length,
      autoDraftCount,
      timestamp: proactiveState.lastCheck
    });

    return {
      success: true,
      issues: detectedIssues,
      suggestions,
      autoDraftCount
    };

  } catch (error) {
    console.error('Proactive check error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gather data from all connected platforms
 */
async function gatherPlatformData() {
  const data = {
    taskade: { tasks: [], projects: [] },
    nifty: { tasks: [], projects: [] },
    taskmagic: { bots: [], runs: [] },
    tickets: [],
    ghl: { contacts: [], opportunities: [] }
  };

  // Fetch Taskade data
  try {
    const taskadeResult = await unifiedTasks.getAllTasks();
    data.taskade.tasks = taskadeResult.taskade || [];
    console.log(`Fetched ${data.taskade.tasks.length} Taskade tasks`);
  } catch (e) {
    console.warn('Could not fetch Taskade data:', e.message);
  }

  // Fetch Nifty data
  try {
    if (nifty.getTokenStatus().authenticated) {
      const projects = await nifty.getProjects();
      data.nifty.projects = projects.projects || projects || [];

      // Fetch tasks for each project
      for (const project of data.nifty.projects.slice(0, 5)) {
        try {
          const tasks = await nifty.getTasks(project.id);
          data.nifty.tasks.push(...(tasks.tasks || tasks || []).map(t => ({
            ...t,
            projectId: project.id,
            projectName: project.name
          })));
        } catch (e) {}
      }
      console.log(`Fetched ${data.nifty.tasks.length} Nifty tasks`);
    }
  } catch (e) {
    console.warn('Could not fetch Nifty data:', e.message);
  }

  // Fetch local tickets
  try {
    const ticketsWithAnalysis = db.getAllTicketsWithAnalysis();
    data.tickets = ticketsWithAnalysis.map(t => {
      const ticket = t.ticket ? JSON.parse(t.ticket) : t;
      const analysis = t.analysis ? JSON.parse(t.analysis) : null;
      return { ...ticket, analysis };
    });
    console.log(`Fetched ${data.tickets.length} tickets`);
  } catch (e) {
    console.warn('Could not fetch tickets:', e.message);
  }

  return data;
}

/**
 * Run proactive rules against gathered data
 */
async function runProactiveRules(data) {
  const issues = [];

  // Check Taskade tasks
  for (const task of data.taskade.tasks) {
    if (PROACTIVE_RULES.OVERDUE_TASK.check(task)) {
      issues.push({
        type: 'OVERDUE_TASK',
        platform: 'taskade',
        item: task,
        priority: PROACTIVE_RULES.OVERDUE_TASK.priority,
        action: PROACTIVE_RULES.OVERDUE_TASK.action,
        message: `Task "${task.title || task.content}" is overdue`
      });
    }

    if (PROACTIVE_RULES.STALE_TASK.check(task)) {
      issues.push({
        type: 'STALE_TASK',
        platform: 'taskade',
        item: task,
        priority: PROACTIVE_RULES.STALE_TASK.priority,
        action: PROACTIVE_RULES.STALE_TASK.action,
        message: `Task "${task.title || task.content}" hasn't been updated in over a week`
      });
    }
  }

  // Check Nifty tasks
  for (const task of data.nifty.tasks) {
    if (PROACTIVE_RULES.OVERDUE_TASK.check(task)) {
      issues.push({
        type: 'OVERDUE_TASK',
        platform: 'nifty',
        item: task,
        priority: PROACTIVE_RULES.OVERDUE_TASK.priority,
        action: PROACTIVE_RULES.OVERDUE_TASK.action,
        message: `Nifty task "${task.name || task.title}" is overdue`
      });
    }

    if (PROACTIVE_RULES.HIGH_PRIORITY_UNASSIGNED.check(task)) {
      issues.push({
        type: 'HIGH_PRIORITY_UNASSIGNED',
        platform: 'nifty',
        item: task,
        priority: PROACTIVE_RULES.HIGH_PRIORITY_UNASSIGNED.priority,
        action: PROACTIVE_RULES.HIGH_PRIORITY_UNASSIGNED.action,
        message: `High priority task "${task.name || task.title}" has no assignee`
      });
    }
  }

  // Check tickets for urgent issues
  for (const ticket of data.tickets.filter(t => [2, 3, 6, 7].includes(t.status))) {
    if (PROACTIVE_RULES.URGENT_TICKET.check(ticket, ticket.analysis)) {
      issues.push({
        type: 'URGENT_TICKET',
        platform: 'freshdesk',
        item: ticket,
        priority: 'critical',
        action: PROACTIVE_RULES.URGENT_TICKET.action,
        message: `Ticket #${ticket.id} "${ticket.subject}" requires immediate attention (Urgency: ${ticket.analysis?.URGENCY_SCORE}/10)`
      });
    }
  }

  // Check for ticket patterns
  const activeTickets = data.tickets.filter(t => [2, 3, 6, 7].includes(t.status));
  const patterns = PROACTIVE_RULES.TICKET_PATTERN.check(activeTickets);
  for (const [category, count] of patterns) {
    issues.push({
      type: 'TICKET_PATTERN',
      platform: 'freshdesk',
      item: { category, count },
      priority: 'medium',
      action: PROACTIVE_RULES.TICKET_PATTERN.action,
      message: `Pattern detected: ${count} tickets related to "${category}" - consider systemic fix`
    });
  }

  return issues;
}

/**
 * Generate AI suggestions based on collected data
 */
async function generateAISuggestions(data, issues) {
  const suggestions = [];

  // Only generate AI suggestions if there's meaningful data
  if (issues.length === 0 && data.taskade.tasks.length === 0 && data.nifty.tasks.length === 0) {
    return suggestions;
  }

  try {
    // Build context for AI
    const context = buildAIContext(data, issues);

    const prompt = `You are a proactive AI assistant for task and project management. Based on the current state of the user's tasks and issues, provide 3-5 specific, actionable suggestions.

Current State:
${context}

Provide suggestions in JSON format:
[
  {
    "type": "workflow|task|optimization|reminder",
    "title": "Short title",
    "description": "What to do and why",
    "priority": "high|medium|low",
    "platforms": ["taskade", "nifty", "taskmagic"],
    "autoExecutable": true/false,
    "action": { "type": "create_task|trigger_automation|sync|notify", "params": {} }
  }
]

Focus on:
1. Cross-platform syncing opportunities
2. Automation recommendations
3. Priority rebalancing
4. Deadline management
5. Workload distribution`;

    const response = await ai.chat([{ role: 'user', content: prompt }], {
      systemPrompt: 'You are a proactive AI that helps optimize task management across multiple platforms. Return only valid JSON.',
      maxTokens: 1000
    });

    // Parse AI response
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      suggestions.push(...parsed.map(s => ({
        ...s,
        generatedAt: new Date().toISOString(),
        source: 'ai'
      })));
    }

  } catch (error) {
    console.error('AI suggestion generation error:', error.message);
  }

  return suggestions;
}

/**
 * Build context string for AI
 */
function buildAIContext(data, issues) {
  let context = '';

  context += `\n== TASKADE TASKS (${data.taskade.tasks.length}) ==\n`;
  data.taskade.tasks.slice(0, 10).forEach(t => {
    context += `- ${t.title || t.content} [${t.status || 'pending'}]\n`;
  });

  context += `\n== NIFTY TASKS (${data.nifty.tasks.length}) ==\n`;
  data.nifty.tasks.slice(0, 10).forEach(t => {
    context += `- ${t.name || t.title} [${t.status || 'pending'}] in ${t.projectName || 'Unknown project'}\n`;
  });

  context += `\n== ACTIVE TICKETS (${data.tickets.filter(t => [2,3,6,7].includes(t.status)).length}) ==\n`;
  data.tickets.filter(t => [2,3,6,7].includes(t.status)).slice(0, 5).forEach(t => {
    context += `- #${t.id}: ${t.subject} (Urgency: ${t.analysis?.URGENCY_SCORE || 'N/A'})\n`;
  });

  context += `\n== DETECTED ISSUES (${issues.length}) ==\n`;
  issues.forEach(i => {
    context += `- [${i.priority.toUpperCase()}] ${i.message}\n`;
  });

  return context;
}

/**
 * Execute automatic actions for critical issues
 */
async function executeAutoActions(issues) {
  const actions = [];

  for (const issue of issues.filter(i => i.priority === 'critical' || i.priority === 'high')) {
    try {
      let action = null;

      switch (issue.action) {
        case 'notify_and_escalate':
          action = await notifyAndEscalate(issue);
          break;

        case 'immediate_escalation':
          action = await immediateEscalation(issue);
          break;

        case 'send_reminder':
          action = await sendReminder(issue);
          break;

        case 'auto_assign_or_notify':
          action = await autoAssignOrNotify(issue);
          break;
      }

      if (action) {
        actions.push(action);
        proactiveState.pendingActions.push({
          ...action,
          executedAt: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error(`Auto action failed for issue ${issue.type}:`, error.message);
    }
  }

  return actions;
}

/**
 * Notify and escalate an issue
 */
async function notifyAndEscalate(issue) {
  // Try to trigger TaskMagic notification
  try {
    await taskmagic.sendNotification(
      `[${issue.priority.toUpperCase()}] ${issue.message}`,
      'escalation'
    );
  } catch (e) {}

  // Create a task in Taskade for follow-up
  try {
    const projects = await unifiedTasks.getProjects();
    const defaultProject = projects.taskade?.[0];
    if (defaultProject) {
      await unifiedTasks.createTask('taskade', defaultProject.id, {
        title: `[AUTO] ${issue.message}`,
        priority: issue.priority,
        source: 'proactive-ai'
      });
    }
  } catch (e) {}

  return {
    type: 'notify_and_escalate',
    issue,
    status: 'completed'
  };
}

/**
 * Immediate escalation for critical issues
 * Now also auto-generates a draft response for the ticket
 */
async function immediateEscalation(issue) {
  const message = `CRITICAL: ${issue.message}\n\nSource: ${issue.platform}\nDetected: ${new Date().toISOString()}`;

  // Notify via TaskMagic
  try {
    await taskmagic.triggerAutomation('escalation', {
      severity: 'critical',
      message,
      item: issue.item
    });
  } catch (e) {}

  // Auto-generate draft response for urgent tickets
  if (issue.platform === 'freshdesk' && issue.item?.id) {
    try {
      const pipeline = await import('./ticket-pipeline.js');
      const existingDrafts = db.getAllDrafts({ ticket_id: issue.item.id, limit: 1 });
      if (!existingDrafts || existingDrafts.length === 0) {
        console.log(`  Proactive: Auto-drafting response for urgent ticket #${issue.item.id}...`);
        await pipeline.processTicket(issue.item.id, { skipQA: false });
        console.log(`  Proactive: Draft generated for urgent ticket #${issue.item.id}`);
      }
    } catch (e) {
      console.log(`  Proactive: Could not auto-draft for ticket #${issue.item.id}: ${e.message}`);
    }
  }

  return {
    type: 'immediate_escalation',
    issue,
    status: 'completed'
  };
}

/**
 * Send reminder for approaching deadlines
 */
async function sendReminder(issue) {
  try {
    await taskmagic.sendNotification(
      `Reminder: ${issue.message}`,
      'reminder'
    );
  } catch (e) {}

  return {
    type: 'send_reminder',
    issue,
    status: 'completed'
  };
}

/**
 * Auto-assign or notify about unassigned high-priority tasks
 */
async function autoAssignOrNotify(issue) {
  // For now, just notify - auto-assignment would need user preferences
  try {
    await taskmagic.sendNotification(
      `Action Required: ${issue.message}`,
      'assignment'
    );
  } catch (e) {}

  return {
    type: 'auto_assign_or_notify',
    issue,
    status: 'completed'
  };
}

/**
 * Register a listener for proactive events
 */
export function onProactiveEvent(callback) {
  proactiveState.listeners.push(callback);
  return () => {
    proactiveState.listeners = proactiveState.listeners.filter(l => l !== callback);
  };
}

/**
 * Emit an event to all listeners
 */
function emitProactiveEvent(type, data) {
  for (const listener of proactiveState.listeners) {
    try {
      listener({ type, data, timestamp: new Date().toISOString() });
    } catch (e) {}
  }
}

/**
 * Manually trigger a proactive check
 */
export async function triggerProactiveCheck() {
  return runProactiveCheck();
}

/**
 * Get current proactive state
 */
export function getProactiveState() {
  return {
    isRunning: proactiveState.isRunning,
    lastCheck: proactiveState.lastCheck,
    pendingActions: proactiveState.pendingActions.slice(-20),
    detectedIssues: proactiveState.detectedIssues,
    suggestions: proactiveState.suggestions,
    listenerCount: proactiveState.listeners.length
  };
}

/**
 * Clear pending actions
 */
export function clearPendingActions() {
  proactiveState.pendingActions = [];
}

/**
 * Get AI-generated action plan based on current state
 */
export async function getProactiveActionPlan() {
  const state = getProactiveState();

  if (state.detectedIssues.length === 0 && state.suggestions.length === 0) {
    // Run a fresh check first
    await runProactiveCheck();
  }

  const issues = proactiveState.detectedIssues;
  const suggestions = proactiveState.suggestions;

  const prompt = `Based on the following detected issues and AI suggestions, create a prioritized action plan:

DETECTED ISSUES:
${issues.map(i => `- [${i.priority}] ${i.message}`).join('\n')}

AI SUGGESTIONS:
${suggestions.map(s => `- [${s.priority}] ${s.title}: ${s.description}`).join('\n')}

Create an action plan with:
1. IMMEDIATE ACTIONS (do right now)
2. SHORT-TERM ACTIONS (today)
3. AUTOMATION RECOMMENDATIONS (set up once)

Be specific and actionable.`;

  try {
    const response = await ai.chat([{ role: 'user', content: prompt }], {
      systemPrompt: 'You are a productivity expert creating actionable plans. Be concise and specific.',
      maxTokens: 1000
    });

    return {
      plan: response.text,
      basedOn: {
        issueCount: issues.length,
        suggestionCount: suggestions.length
      },
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Execute a specific AI suggestion
 */
export async function executeSuggestion(suggestionIndex) {
  const suggestion = proactiveState.suggestions[suggestionIndex];
  if (!suggestion) {
    throw new Error('Suggestion not found');
  }

  const result = {
    suggestion,
    actions: [],
    status: 'pending'
  };

  try {
    if (suggestion.action) {
      switch (suggestion.action.type) {
        case 'create_task':
          const platforms = suggestion.platforms || ['taskade'];
          for (const platform of platforms) {
            const projects = await unifiedTasks.getProjects();
            const defaultProject = projects[platform]?.[0];
            if (defaultProject) {
              await unifiedTasks.createTask(platform, defaultProject.id, {
                title: suggestion.title,
                description: suggestion.description,
                priority: suggestion.priority
              });
              result.actions.push({ type: 'create_task', platform, success: true });
            }
          }
          break;

        case 'trigger_automation':
          await taskmagic.triggerAutomation(
            suggestion.action.params?.automationName || 'default',
            suggestion.action.params?.payload || {}
          );
          result.actions.push({ type: 'trigger_automation', success: true });
          break;

        case 'sync':
          // Trigger cross-platform sync
          const syncStatus = taskSync.getSyncStatus();
          if (syncStatus.configs?.length > 0) {
            for (const config of syncStatus.configs.slice(0, 3)) {
              await taskSync.fullProjectSync(
                config.source_platform,
                config.source_project_id,
                config.target_platform,
                config.target_project_id
              );
              result.actions.push({ type: 'sync', config, success: true });
            }
          }
          break;

        case 'notify':
          await taskmagic.sendNotification(
            `AI Suggestion: ${suggestion.title}\n${suggestion.description}`,
            'suggestion'
          );
          result.actions.push({ type: 'notify', success: true });
          break;
      }
    }

    result.status = 'completed';

  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
  }

  return result;
}

export default {
  initProactiveEngine,
  stopProactiveEngine,
  triggerProactiveCheck,
  getProactiveState,
  getProactiveActionPlan,
  executeSuggestion,
  onProactiveEvent,
  clearPendingActions,
  EVENT_TYPES,
  PROACTIVE_RULES
};
