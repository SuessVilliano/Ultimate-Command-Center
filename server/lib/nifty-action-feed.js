import { niftyMcp } from './nifty-mcp-client.js';
import * as unifiedInbox from './unified-inbox.js';

const AFFILIATE_PROJECT_ID = process.env.NIFTY_AFFILIATE_PROJECT_ID || 'SYXYZ5G8j!';

function unwrapToolResult(result) {
  if (!result) return null;
  if (result.structuredContent) return result.structuredContent;
  const content = Array.isArray(result.content) ? result.content : [];
  for (const item of content) {
    if (item?.type !== 'text' || !item.text) continue;
    try { return JSON.parse(item.text); } catch {}
  }
  return result;
}

function rowsFrom(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const key of ['items', 'results', 'data', 'tasks']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function taskPriority(task) {
  const statusName = String(task.status?.name || task.status || '').toLowerCase();
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const now = new Date();
  const hours = due ? (due.getTime() - now.getTime()) / 36e5 : null;

  if (hours !== null && hours < 0) return 4;
  if (hours !== null && hours <= 24) return 4;
  if (hours !== null && hours <= 48) return 3;
  if (statusName.includes('in progress')) return 3;
  if (statusName.includes('waiting') || statusName.includes('blocked')) return 2;
  return 1;
}

function previewFor(task) {
  const pieces = [];
  if (task.status?.name) pieces.push(task.status.name);
  if (task.list?.name) pieces.push(task.list.name);
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    if (!Number.isNaN(due.getTime())) pieces.push(`Due ${due.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
  }
  if (task.description) pieces.push(task.description.replace(/\s+/g, ' ').trim().slice(0, 160));
  return pieces.join(' · ');
}

async function getTaskQueryTool() {
  const tools = await niftyMcp.listTools();
  return tools.find(tool => tool.name === 'tasks_query')
    || tools.find(tool => /task.*query|task.*list/i.test(tool.name));
}

export async function getAffiliateTasks({ limit = 200 } = {}) {
  if (!niftyMcp.configured) {
    return { tasks: [], source: 'nifty-mcp', configured: false, error: 'Nifty MCP is not configured.' };
  }

  const tool = await getTaskQueryTool();
  if (!tool) {
    return { tasks: [], source: 'nifty-mcp', configured: true, error: 'Nifty MCP task reads are unavailable.' };
  }

  const result = await niftyMcp.callTool(tool.name, {
    resource: 'task',
    operation: 'list',
    projectId: AFFILIATE_PROJECT_ID,
    limit: Math.min(Number(limit) || 200, 250),
    includeTotal: true,
    expand: 'status,list,subtasks,checklists,customFields'
  });

  const tasks = rowsFrom(unwrapToolResult(result))
    .filter(task => task && task.archived !== true && task.completed !== true)
    .map(task => ({
      ...task,
      priority: taskPriority(task)
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });

  return { tasks, source: 'nifty-mcp', configured: true, projectId: AFFILIATE_PROJECT_ID };
}

export async function syncAffiliateTasksToInbox({ limit = 200 } = {}) {
  const result = await getAffiliateTasks({ limit });
  let synced = 0;

  for (const task of result.tasks || []) {
    unifiedInbox.addToInbox({
      type: 'task',
      itemId: String(task.id),
      source: 'nifty',
      title: task.name || `Nifty task ${task.id}`,
      preview: previewFor(task),
      priority: task.priority || 1,
      metadata: {
        projectId: task.projectId || AFFILIATE_PROJECT_ID,
        parentTaskId: task.parentTaskId || null,
        listId: task.listId || task.list?.id || null,
        listName: task.list?.name || null,
        statusId: task.statusId || task.status?.id || null,
        statusName: task.status?.name || null,
        dueAt: task.dueAt || null,
        startAt: task.startAt || null,
        niceId: task.niceId || null,
        source: 'nifty-mcp'
      }
    });
    synced++;
  }

  return { ...result, synced };
}

export default { getAffiliateTasks, syncAffiliateTasksToInbox };
