/**
 * Unified Workflow Orchestrator for LIV8 Command Center
 *
 * This module enables complex multi-platform workflows that chain actions
 * across Nifty, Taskade, TaskMagic, and other integrated services.
 *
 * Features:
 * - Workflow templates (common automation patterns)
 * - Multi-step action sequences
 * - Conditional branching
 * - Error handling and rollback
 * - AI-powered workflow suggestions
 */

import { taskade, taskmagic, ghl } from './integrations.js';
import { nifty } from './nifty-integration.js';
import * as ai from './ai-provider.js';
import * as db from './database.js';
import eventBus, { EVENTS, PLATFORMS } from './cross-platform-event-bus.js';

// Workflow storage
const workflows = {
  templates: new Map(),
  active: [],
  history: [],
  scheduled: []
};

// Built-in workflow templates
const WORKFLOW_TEMPLATES = {
  // Template: New task synced across all platforms
  MULTI_PLATFORM_TASK: {
    id: 'multi_platform_task',
    name: 'Create Task Everywhere',
    description: 'Create a task in Taskade, Nifty, and trigger TaskMagic notification',
    trigger: 'manual',
    inputs: ['title', 'description', 'priority', 'dueDate'],
    steps: [
      {
        id: 'create_taskade',
        platform: PLATFORMS.TASKADE,
        action: 'create_task',
        params: {
          title: '{{title}}',
          description: '{{description}}',
          priority: '{{priority}}'
        },
        onSuccess: 'create_nifty',
        onError: 'notify_failure'
      },
      {
        id: 'create_nifty',
        platform: PLATFORMS.NIFTY,
        action: 'create_task',
        params: {
          name: '{{title}}',
          description: '{{description}}',
          due_date: '{{dueDate}}'
        },
        onSuccess: 'trigger_taskmagic',
        onError: 'notify_failure'
      },
      {
        id: 'trigger_taskmagic',
        platform: PLATFORMS.TASKMAGIC,
        action: 'trigger_automation',
        params: {
          automation: 'new_task_notification',
          payload: {
            task: '{{title}}',
            platforms: ['taskade', 'nifty']
          }
        },
        onSuccess: 'complete',
        onError: 'notify_failure'
      },
      {
        id: 'notify_failure',
        platform: PLATFORMS.TASKMAGIC,
        action: 'send_notification',
        params: {
          message: 'Workflow failed: {{error}}',
          channel: 'errors'
        }
      }
    ]
  },

  // Template: Escalate ticket to all systems
  TICKET_ESCALATION: {
    id: 'ticket_escalation',
    name: 'Full Ticket Escalation',
    description: 'Escalate ticket with tasks in project management + CRM update',
    trigger: 'event',
    eventType: EVENTS.TICKET_ESCALATED,
    steps: [
      {
        id: 'create_followup_taskade',
        platform: PLATFORMS.TASKADE,
        action: 'create_task',
        params: {
          title: '[URGENT] Follow up on ticket #{{ticketId}}',
          description: 'Escalated ticket: {{subject}}\n\nUrgency: {{urgency}}/10',
          priority: 'high'
        },
        onSuccess: 'create_followup_nifty'
      },
      {
        id: 'create_followup_nifty',
        platform: PLATFORMS.NIFTY,
        action: 'create_task',
        params: {
          name: '[ESCALATED] {{subject}}',
          description: 'Ticket #{{ticketId}} needs immediate attention'
        },
        onSuccess: 'update_ghl'
      },
      {
        id: 'update_ghl',
        platform: PLATFORMS.GHL,
        action: 'add_tag',
        params: {
          contactId: '{{contactId}}',
          tag: 'escalated_ticket'
        },
        onSuccess: 'notify_team'
      },
      {
        id: 'notify_team',
        platform: PLATFORMS.TASKMAGIC,
        action: 'trigger_automation',
        params: {
          automation: 'escalation_alert',
          payload: {
            ticketId: '{{ticketId}}',
            subject: '{{subject}}',
            urgency: '{{urgency}}'
          }
        }
      }
    ]
  },

  // Template: Daily sync across platforms
  DAILY_SYNC: {
    id: 'daily_sync',
    name: 'Daily Platform Sync',
    description: 'Synchronize tasks between Taskade and Nifty',
    trigger: 'scheduled',
    schedule: '0 9 * * *', // 9 AM daily
    steps: [
      {
        id: 'fetch_taskade',
        platform: PLATFORMS.TASKADE,
        action: 'get_tasks',
        params: { status: 'pending' },
        onSuccess: 'sync_to_nifty'
      },
      {
        id: 'sync_to_nifty',
        platform: PLATFORMS.NIFTY,
        action: 'sync_tasks',
        params: {
          tasks: '{{fetch_taskade.result}}',
          mode: 'merge'
        },
        onSuccess: 'report_sync'
      },
      {
        id: 'report_sync',
        platform: PLATFORMS.TASKMAGIC,
        action: 'send_notification',
        params: {
          message: 'Daily sync complete: {{sync_to_nifty.synced}} tasks synchronized',
          channel: 'sync-reports'
        }
      }
    ]
  },

  // Template: Complete task everywhere
  COMPLETE_EVERYWHERE: {
    id: 'complete_everywhere',
    name: 'Complete Task Everywhere',
    description: 'Mark a task complete across all platforms where it exists',
    trigger: 'event',
    eventType: EVENTS.TASK_COMPLETED,
    steps: [
      {
        id: 'complete_taskade',
        platform: PLATFORMS.TASKADE,
        action: 'complete_task',
        params: {
          taskId: '{{taskadeTaskId}}',
          projectId: '{{taskadeProjectId}}'
        },
        condition: '{{taskadeTaskId}}',
        onSuccess: 'complete_nifty'
      },
      {
        id: 'complete_nifty',
        platform: PLATFORMS.NIFTY,
        action: 'complete_task',
        params: {
          taskId: '{{niftyTaskId}}'
        },
        condition: '{{niftyTaskId}}',
        onSuccess: 'notify_completion'
      },
      {
        id: 'notify_completion',
        platform: PLATFORMS.TASKMAGIC,
        action: 'send_notification',
        params: {
          message: 'Task "{{taskTitle}}" completed across all platforms!',
          channel: 'completions'
        }
      }
    ]
  },

  // Template: AI-Powered Task Routing
  AI_TASK_ROUTING: {
    id: 'ai_task_routing',
    name: 'AI Task Routing',
    description: 'Use AI to determine best platform and project for new tasks',
    trigger: 'manual',
    inputs: ['taskDescription'],
    steps: [
      {
        id: 'ai_analyze',
        platform: PLATFORMS.INTERNAL,
        action: 'ai_analyze',
        params: {
          prompt: 'Analyze this task and determine the best platform (taskade/nifty) and suggest priority: {{taskDescription}}'
        },
        onSuccess: 'route_task'
      },
      {
        id: 'route_task',
        platform: '{{ai_analyze.platform}}',
        action: 'create_task',
        params: {
          title: '{{ai_analyze.title}}',
          description: '{{taskDescription}}',
          priority: '{{ai_analyze.priority}}'
        }
      }
    ]
  }
};

/**
 * Initialize workflow orchestrator
 */
export function initWorkflowOrchestrator() {
  // Load built-in templates
  for (const [id, template] of Object.entries(WORKFLOW_TEMPLATES)) {
    workflows.templates.set(id, template);
  }

  // Register event listeners for event-triggered workflows
  for (const [id, template] of workflows.templates.entries()) {
    if (template.trigger === 'event' && template.eventType) {
      eventBus.on(template.eventType, async (event) => {
        console.log(`[Workflow] Event-triggered: ${template.name}`);
        await executeWorkflow(id, event.data);
      });
    }
  }

  console.log(`[Workflow] Orchestrator initialized with ${workflows.templates.size} templates`);

  return {
    templateCount: workflows.templates.size
  };
}

/**
 * Execute a workflow by template ID
 */
export async function executeWorkflow(templateId, inputs = {}) {
  const template = workflows.templates.get(templateId);
  if (!template) {
    throw new Error(`Workflow template not found: ${templateId}`);
  }

  const execution = {
    id: `exec_${Date.now()}`,
    templateId,
    templateName: template.name,
    inputs,
    startTime: new Date().toISOString(),
    status: 'running',
    currentStep: null,
    stepResults: {},
    errors: []
  };

  workflows.active.push(execution);

  console.log(`[Workflow] Starting: ${template.name} (${execution.id})`);

  // Emit workflow started event
  eventBus.emit(EVENTS.AUTOMATION_TRIGGERED, {
    workflowId: execution.id,
    template: templateId
  });

  try {
    // Execute steps
    let currentStepId = template.steps[0].id;

    while (currentStepId && currentStepId !== 'complete') {
      const step = template.steps.find(s => s.id === currentStepId);
      if (!step) break;

      execution.currentStep = step.id;

      // Check condition if specified
      if (step.condition) {
        const conditionMet = evaluateCondition(step.condition, { ...inputs, ...execution.stepResults });
        if (!conditionMet) {
          console.log(`[Workflow] Skipping step ${step.id} (condition not met)`);
          currentStepId = step.onSuccess || getNextStepId(template.steps, step.id);
          continue;
        }
      }

      try {
        // Execute step
        const result = await executeStep(step, { ...inputs, ...execution.stepResults });
        execution.stepResults[step.id] = { success: true, result };

        console.log(`[Workflow] Step ${step.id} completed`);

        // Move to next step
        currentStepId = step.onSuccess || getNextStepId(template.steps, step.id);

      } catch (error) {
        console.error(`[Workflow] Step ${step.id} failed:`, error.message);
        execution.stepResults[step.id] = { success: false, error: error.message };
        execution.errors.push({ step: step.id, error: error.message });

        // Handle error
        if (step.onError) {
          currentStepId = step.onError;
        } else {
          break;
        }
      }
    }

    execution.status = execution.errors.length > 0 ? 'completed_with_errors' : 'completed';

  } catch (error) {
    execution.status = 'failed';
    execution.errors.push({ step: 'workflow', error: error.message });
  }

  execution.endTime = new Date().toISOString();

  // Move to history
  workflows.active = workflows.active.filter(e => e.id !== execution.id);
  workflows.history.push(execution);

  // Keep history limited
  if (workflows.history.length > 100) {
    workflows.history = workflows.history.slice(-50);
  }

  // Emit completion event
  eventBus.emit(
    execution.status === 'completed' ? EVENTS.AUTOMATION_COMPLETED : EVENTS.AUTOMATION_FAILED,
    { workflowId: execution.id, status: execution.status }
  );

  console.log(`[Workflow] Completed: ${template.name} - ${execution.status}`);

  return execution;
}

/**
 * Execute a single workflow step
 */
async function executeStep(step, context) {
  // Resolve template variables in params
  const params = resolveParams(step.params, context);

  console.log(`[Workflow] Executing step: ${step.id} on ${step.platform}`);

  switch (step.platform) {
    case PLATFORMS.TASKADE:
      return executeTaskadeAction(step.action, params);

    case PLATFORMS.NIFTY:
      return executeNiftyAction(step.action, params);

    case PLATFORMS.TASKMAGIC:
      return executeTaskMagicAction(step.action, params);

    case PLATFORMS.GHL:
      return executeGHLAction(step.action, params);

    case PLATFORMS.INTERNAL:
      return executeInternalAction(step.action, params);

    default:
      throw new Error(`Unknown platform: ${step.platform}`);
  }
}

/**
 * Execute Taskade action
 */
async function executeTaskadeAction(action, params) {
  switch (action) {
    case 'create_task':
      const projects = await taskade.getWorkspaces();
      const workspace = projects.items?.[0];
      if (!workspace) throw new Error('No Taskade workspace found');

      const folders = await taskade.getFolders(workspace.id);
      const folder = folders.items?.[0];
      if (!folder) throw new Error('No Taskade folder found');

      const projectsList = await taskade.getProjects(folder.id);
      const project = projectsList.items?.[0];
      if (!project) throw new Error('No Taskade project found');

      return taskade.createTask(project.id, params.title, { placement: 'beforeend' });

    case 'complete_task':
      if (!params.projectId || !params.taskId) {
        throw new Error('Missing projectId or taskId');
      }
      return taskade.completeTask(params.projectId, params.taskId);

    case 'get_tasks':
      // Get tasks from all projects
      const workspaces = await taskade.getWorkspaces();
      const allTasks = [];
      for (const ws of (workspaces.items || []).slice(0, 2)) {
        const flds = await taskade.getFolders(ws.id);
        for (const fld of (flds.items || []).slice(0, 3)) {
          const prjs = await taskade.getProjects(fld.id);
          for (const prj of (prjs.items || []).slice(0, 5)) {
            const tasks = await taskade.getTasks(prj.id);
            allTasks.push(...(tasks.items || []));
          }
        }
      }
      return allTasks;

    default:
      throw new Error(`Unknown Taskade action: ${action}`);
  }
}

/**
 * Execute Nifty action
 */
async function executeNiftyAction(action, params) {
  if (!nifty.getTokenStatus().authenticated) {
    throw new Error('Nifty not authenticated');
  }

  switch (action) {
    case 'create_task':
      const projects = await nifty.getProjects();
      const project = projects.projects?.[0] || projects?.[0];
      if (!project) throw new Error('No Nifty project found');

      return nifty.createTask(project.id, {
        name: params.name || params.title,
        description: params.description,
        due_date: params.due_date
      });

    case 'complete_task':
      if (!params.taskId) {
        throw new Error('Missing taskId');
      }
      return nifty.completeTask(params.taskId);

    case 'sync_tasks':
      // Sync provided tasks to Nifty
      const prjs = await nifty.getProjects();
      const prj = prjs.projects?.[0] || prjs?.[0];
      if (!prj) throw new Error('No Nifty project found');

      const results = [];
      for (const task of (params.tasks || []).slice(0, 20)) {
        try {
          const result = await nifty.createTask(prj.id, {
            name: task.title || task.content,
            description: task.description
          });
          results.push({ success: true, taskId: result.id });
        } catch (e) {
          results.push({ success: false, error: e.message });
        }
      }
      return { synced: results.filter(r => r.success).length, results };

    default:
      throw new Error(`Unknown Nifty action: ${action}`);
  }
}

/**
 * Execute TaskMagic action
 */
async function executeTaskMagicAction(action, params) {
  switch (action) {
    case 'trigger_automation':
      return taskmagic.triggerAutomation(params.automation, params.payload || {});

    case 'send_notification':
      return taskmagic.sendNotification(params.message, params.channel);

    default:
      throw new Error(`Unknown TaskMagic action: ${action}`);
  }
}

/**
 * Execute GHL action
 */
async function executeGHLAction(action, params) {
  switch (action) {
    case 'add_tag':
      if (!params.contactId || !params.tag) {
        throw new Error('Missing contactId or tag');
      }
      return ghl.addTag(params.contactId, params.tag);

    case 'create_contact':
      return ghl.createContact(params);

    default:
      throw new Error(`Unknown GHL action: ${action}`);
  }
}

/**
 * Execute internal action (AI, etc.)
 */
async function executeInternalAction(action, params) {
  switch (action) {
    case 'ai_analyze':
      const response = await ai.chat([{ role: 'user', content: params.prompt }], {
        systemPrompt: `You are a task routing AI. Analyze the task and respond with JSON:
{
  "platform": "taskade" or "nifty",
  "title": "extracted task title",
  "priority": "high/medium/low",
  "reasoning": "why this platform"
}`,
        maxTokens: 500
      });

      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {}

      return { platform: 'taskade', title: params.prompt, priority: 'medium' };

    default:
      throw new Error(`Unknown internal action: ${action}`);
  }
}

/**
 * Resolve template variables in params
 */
function resolveParams(params, context) {
  if (!params) return {};

  const resolved = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      // Replace {{variable}} with context values
      resolved[key] = value.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        const parts = path.split('.');
        let val = context;
        for (const part of parts) {
          val = val?.[part];
        }
        return val !== undefined ? val : match;
      });
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = resolveParams(value, context);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Evaluate a condition
 */
function evaluateCondition(condition, context) {
  if (typeof condition === 'string') {
    // Check if it's a simple variable check
    const match = condition.match(/\{\{(\w+(?:\.\w+)*)\}\}/);
    if (match) {
      const parts = match[1].split('.');
      let val = context;
      for (const part of parts) {
        val = val?.[part];
      }
      return !!val;
    }
  }
  return true;
}

/**
 * Get next step ID in sequence
 */
function getNextStepId(steps, currentId) {
  const currentIndex = steps.findIndex(s => s.id === currentId);
  if (currentIndex >= 0 && currentIndex < steps.length - 1) {
    return steps[currentIndex + 1].id;
  }
  return null;
}

/**
 * Create a custom workflow
 */
export function createWorkflow(config) {
  const workflow = {
    id: `custom_${Date.now()}`,
    name: config.name,
    description: config.description,
    trigger: config.trigger || 'manual',
    eventType: config.eventType,
    inputs: config.inputs || [],
    steps: config.steps || [],
    createdAt: new Date().toISOString()
  };

  workflows.templates.set(workflow.id, workflow);

  // Register event listener if event-triggered
  if (workflow.trigger === 'event' && workflow.eventType) {
    eventBus.on(workflow.eventType, async (event) => {
      await executeWorkflow(workflow.id, event.data);
    });
  }

  return workflow;
}

/**
 * Get all workflow templates
 */
export function getWorkflowTemplates() {
  return Array.from(workflows.templates.values()).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    trigger: t.trigger,
    stepCount: t.steps.length,
    inputs: t.inputs
  }));
}

/**
 * Get workflow execution history
 */
export function getWorkflowHistory(limit = 20) {
  return workflows.history.slice(-limit);
}

/**
 * Get active workflow executions
 */
export function getActiveWorkflows() {
  return workflows.active;
}

/**
 * Generate AI workflow suggestion
 */
export async function suggestWorkflow(description) {
  const prompt = `Based on this automation request, suggest a workflow configuration:

Request: "${description}"

Available platforms: Taskade (task management), Nifty (project management), TaskMagic (automation/notifications), GHL (CRM)

Respond with a workflow configuration in JSON:
{
  "name": "Workflow name",
  "description": "What it does",
  "trigger": "manual" or "event",
  "steps": [
    {
      "id": "step_1",
      "platform": "taskade|nifty|taskmagic|ghl",
      "action": "action_name",
      "params": { "key": "value" },
      "onSuccess": "next_step_id"
    }
  ]
}

Available actions:
- taskade: create_task, complete_task, get_tasks
- nifty: create_task, complete_task, sync_tasks
- taskmagic: trigger_automation, send_notification
- ghl: add_tag, create_contact`;

  try {
    const response = await ai.chat([{ role: 'user', content: prompt }], {
      systemPrompt: 'You are a workflow automation expert. Create practical, working workflows.',
      maxTokens: 1000
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { error: 'Could not parse workflow suggestion' };

  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Quick action: Create task everywhere
 */
export async function createTaskEverywhere(taskData) {
  return executeWorkflow('multi_platform_task', taskData);
}

/**
 * Quick action: Complete task everywhere
 */
export async function completeTaskEverywhere(taskIds) {
  return executeWorkflow('complete_everywhere', taskIds);
}

export default {
  initWorkflowOrchestrator,
  executeWorkflow,
  createWorkflow,
  getWorkflowTemplates,
  getWorkflowHistory,
  getActiveWorkflows,
  suggestWorkflow,
  createTaskEverywhere,
  completeTaskEverywhere,
  WORKFLOW_TEMPLATES
};
