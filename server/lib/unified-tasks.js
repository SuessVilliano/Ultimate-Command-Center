/**
 * Unified Task Management System
 *
 * Orchestrates tasks across Taskade, Nifty PM, and TaskMagic
 * Allows natural language commands to manage tasks across platforms
 */

import { taskade, taskmagic } from './integrations.js';
import { nifty } from './nifty-integration.js';
import { taskmagicMCP } from './taskmagic-mcp.js';

/**
 * Unified task format
 */
function normalizeTask(task, source) {
  return {
    id: task.id,
    title: task.content || task.name || task.title || task.subject,
    description: task.description || task.note || '',
    status: normalizeStatus(task.status || task.state, source),
    dueDate: task.dueDate || task.due_date || task.end?.date || null,
    assignees: task.assignees || task.members || [],
    source,
    sourceId: task.id,
    metadata: task
  };
}

function normalizeStatus(status, source) {
  if (!status) return 'pending';

  const statusLower = String(status).toLowerCase();

  if (['completed', 'done', 'closed', 'resolved'].includes(statusLower)) {
    return 'completed';
  }
  if (['in_progress', 'in progress', 'active', 'working'].includes(statusLower)) {
    return 'in_progress';
  }
  return 'pending';
}

export const unifiedTasks = {
  /**
   * Get all tasks from all connected platforms
   */
  async getAllTasks(options = {}) {
    const results = {
      taskade: [],
      nifty: [],
      errors: []
    };

    // Get Taskade tasks
    if (process.env.TASKADE_API_KEY) {
      try {
        const workspaces = await taskade.getWorkspaces();
        for (const workspace of (workspaces.items || []).slice(0, 3)) {
          const folders = await taskade.getFolders(workspace.id);
          for (const folder of (folders.items || []).slice(0, 5)) {
            const projects = await taskade.getProjects(folder.id);
            for (const project of (projects.items || []).slice(0, 5)) {
              try {
                const tasks = await taskade.getTasks(project.id);
                results.taskade.push(...(tasks.items || []).map(t => ({
                  ...normalizeTask(t, 'taskade'),
                  projectId: project.id,
                  projectName: project.name,
                  workspaceId: workspace.id,
                  workspaceName: workspace.name
                })));
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        results.errors.push({ source: 'taskade', error: e.message });
      }
    }

    // Get Nifty tasks
    if (nifty.getTokenStatus().authenticated) {
      try {
        const projects = await nifty.getProjects();
        for (const project of (projects.projects || projects || []).slice(0, 10)) {
          try {
            const tasks = await nifty.getTasks(project.id);
            results.nifty.push(...(tasks.tasks || tasks || []).map(t => ({
              ...normalizeTask(t, 'nifty'),
              projectId: project.id,
              projectName: project.name
            })));
          } catch (e) {}
        }
      } catch (e) {
        results.errors.push({ source: 'nifty', error: e.message });
      }
    }

    return results;
  },

  /**
   * Create a task on a specific platform
   */
  async createTask(platform, projectId, taskData) {
    switch (platform) {
      case 'taskade':
        return taskade.createTask(projectId, taskData.title, {
          placement: 'beforeend'
        });

      case 'nifty':
        return nifty.createTask(projectId, {
          name: taskData.title,
          description: taskData.description,
          due_date: taskData.dueDate
        });

      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  },

  /**
   * Copy a task from one platform to another
   */
  async copyTask(sourceTask, targetPlatform, targetProjectId) {
    const taskData = {
      title: sourceTask.title,
      description: sourceTask.description || `Copied from ${sourceTask.source}: ${sourceTask.sourceId}`,
      dueDate: sourceTask.dueDate
    };

    const created = await this.createTask(targetPlatform, targetProjectId, taskData);

    return {
      success: true,
      source: sourceTask,
      target: {
        platform: targetPlatform,
        projectId: targetProjectId,
        task: created
      }
    };
  },

  /**
   * Sync task status across platforms
   */
  async syncTaskStatus(taskId, platform, newStatus) {
    switch (platform) {
      case 'taskade':
        if (newStatus === 'completed') {
          // Taskade complete task requires projectId and taskId
          // This would need the projectId to be passed
          return { success: true, message: 'Use completeTask endpoint with projectId' };
        }
        break;

      case 'nifty':
        if (newStatus === 'completed') {
          return nifty.completeTask(taskId);
        }
        return nifty.updateTask(taskId, { status: newStatus });

      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  },

  /**
   * Trigger a TaskMagic automation for a task
   */
  async triggerAutomation(automationName, taskData) {
    // Try MCP first
    if (taskmagicMCP.isConfigured()) {
      try {
        const bots = await taskmagicMCP.getBots();
        const bot = (bots.bots || []).find(b =>
          b.name.toLowerCase().includes(automationName.toLowerCase())
        );

        if (bot) {
          return taskmagicMCP.runBot(bot.id, { task: taskData });
        }
      } catch (e) {
        console.warn('TaskMagic MCP failed, falling back to webhook:', e.message);
      }
    }

    // Fallback to webhook
    return taskmagic.triggerAutomation(automationName, taskData);
  },

  /**
   * Get available projects from all platforms
   */
  async getProjects() {
    const results = {
      taskade: [],
      nifty: [],
      errors: []
    };

    // Taskade projects
    if (process.env.TASKADE_API_KEY) {
      try {
        const workspaces = await taskade.getWorkspaces();
        for (const workspace of (workspaces.items || [])) {
          const folders = await taskade.getFolders(workspace.id);
          for (const folder of (folders.items || [])) {
            const projects = await taskade.getProjects(folder.id);
            results.taskade.push(...(projects.items || []).map(p => ({
              id: p.id,
              name: p.name,
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              folderId: folder.id,
              folderName: folder.name
            })));
          }
        }
      } catch (e) {
        results.errors.push({ source: 'taskade', error: e.message });
      }
    }

    // Nifty projects
    if (nifty.getTokenStatus().authenticated) {
      try {
        const projects = await nifty.getProjects();
        results.nifty = (projects.projects || projects || []).map(p => ({
          id: p.id,
          name: p.name
        }));
      } catch (e) {
        results.errors.push({ source: 'nifty', error: e.message });
      }
    }

    return results;
  },

  /**
   * Natural language task command parser
   */
  parseCommand(command) {
    const lowerCmd = command.toLowerCase();

    // Create task patterns
    if (lowerCmd.includes('create') || lowerCmd.includes('add') || lowerCmd.includes('new')) {
      const platformMatch = lowerCmd.match(/(?:in|on|to)\s+(taskade|nifty)/i);
      const platform = platformMatch ? platformMatch[1].toLowerCase() : null;

      // Extract task title (text after "task" or quoted text)
      const titleMatch = command.match(/(?:task|called|named|titled)\s+["']?([^"'\n]+)["']?/i) ||
                         command.match(/create\s+["']?([^"'\n]+)["']?/i);
      const title = titleMatch ? titleMatch[1].trim() : null;

      return {
        action: 'create',
        platform,
        title,
        raw: command
      };
    }

    // Copy task patterns
    if (lowerCmd.includes('copy') || lowerCmd.includes('sync') || lowerCmd.includes('move')) {
      const fromMatch = lowerCmd.match(/from\s+(taskade|nifty)/i);
      const toMatch = lowerCmd.match(/to\s+(taskade|nifty)/i);

      return {
        action: 'copy',
        fromPlatform: fromMatch ? fromMatch[1].toLowerCase() : null,
        toPlatform: toMatch ? toMatch[1].toLowerCase() : null,
        raw: command
      };
    }

    // Complete task patterns
    if (lowerCmd.includes('complete') || lowerCmd.includes('done') || lowerCmd.includes('finish')) {
      const platformMatch = lowerCmd.match(/(?:in|on)\s+(taskade|nifty)/i);
      return {
        action: 'complete',
        platform: platformMatch ? platformMatch[1].toLowerCase() : null,
        raw: command
      };
    }

    // Automation trigger patterns
    if (lowerCmd.includes('automate') || lowerCmd.includes('trigger') || lowerCmd.includes('run')) {
      const automationMatch = command.match(/(?:automation|bot|workflow)\s+["']?([^"'\n]+)["']?/i);
      return {
        action: 'automate',
        automationName: automationMatch ? automationMatch[1].trim() : null,
        raw: command
      };
    }

    // List/show patterns
    if (lowerCmd.includes('list') || lowerCmd.includes('show') || lowerCmd.includes('get')) {
      const platformMatch = lowerCmd.match(/(taskade|nifty|taskmagic|all)/i);
      const typeMatch = lowerCmd.match(/(tasks?|projects?|automations?|bots?)/i);

      return {
        action: 'list',
        platform: platformMatch ? platformMatch[1].toLowerCase() : 'all',
        type: typeMatch ? typeMatch[1].toLowerCase().replace(/s$/, '') : 'task',
        raw: command
      };
    }

    return {
      action: 'unknown',
      raw: command
    };
  },

  /**
   * Execute a parsed command
   */
  async executeCommand(parsedCommand, context = {}) {
    switch (parsedCommand.action) {
      case 'list':
        if (parsedCommand.type === 'task') {
          return this.getAllTasks();
        }
        if (parsedCommand.type === 'project') {
          return this.getProjects();
        }
        if (parsedCommand.type === 'automation' || parsedCommand.type === 'bot') {
          if (taskmagicMCP.isConfigured()) {
            return taskmagicMCP.getBots();
          }
          return { error: 'TaskMagic MCP not configured' };
        }
        break;

      case 'create':
        if (!parsedCommand.platform || !parsedCommand.title) {
          return {
            error: 'Please specify platform and task title',
            example: 'Create task "Review proposal" in Taskade'
          };
        }
        if (!context.projectId) {
          return {
            error: 'Please specify which project to create the task in',
            needsProject: true,
            platform: parsedCommand.platform
          };
        }
        return this.createTask(parsedCommand.platform, context.projectId, {
          title: parsedCommand.title
        });

      case 'automate':
        if (!parsedCommand.automationName) {
          return { error: 'Please specify automation name' };
        }
        return this.triggerAutomation(parsedCommand.automationName, context.taskData || {});

      default:
        return {
          error: 'Could not understand command',
          parsed: parsedCommand,
          suggestions: [
            'List all tasks',
            'Create task "title" in Taskade',
            'Trigger automation "bot name"',
            'Show Nifty projects'
          ]
        };
    }
  }
};

export default unifiedTasks;
