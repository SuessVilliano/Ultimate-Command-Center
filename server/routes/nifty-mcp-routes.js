import { niftyMcp } from '../lib/nifty-mcp-client.js';
import { nifty } from '../lib/nifty-integration.js';
import * as unifiedInbox from '../lib/unified-inbox.js';
import { getAffiliateTasks, syncAffiliateTasksToInbox } from '../lib/nifty-action-feed.js';

const ACTIVE_PORTFOLIO_ID = process.env.NIFTY_ACTIVE_PORTFOLIO_ID || 'u45ydW04vO';
const AFFILIATE_PROJECT_ID = process.env.NIFTY_AFFILIATE_PROJECT_ID || 'SYXYZ5G8j!';

function apiAuthenticated() {
  return nifty.getTokenStatus().authenticated;
}

function restChatId(projectId = AFFILIATE_PROJECT_ID) {
  return `project:${projectId}`;
}

function projectIdFromChat(chatId) {
  return String(chatId || '').startsWith('project:') ? String(chatId).slice(8) : null;
}

function normalizeRestMessage(message, projectId = AFFILIATE_PROJECT_ID) {
  return {
    id: message.id,
    content: message.content || message.text || '',
    text: message.text || message.content || '',
    author_name: message.author_name || message.author?.name || message.user?.name || 'Nifty teammate',
    author_type: message.author_type || 'user',
    author_id: message.author_id || message.authorId || message.user?.id || null,
    created_at: message.created_at || message.createdAt || message.updated_at || message.updatedAt,
    createdAt: message.createdAt || message.created_at || message.updatedAt || message.updated_at,
    taskId: message.taskId || message.task_id || null,
    projectId,
    metadata: { source: 'nifty-api', projectId, taskId: message.taskId || message.task_id || null }
  };
}

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
  for (const key of ['items', 'results', 'data', 'messages', 'chats', 'tasks', 'projects']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function activeProject(project) {
  if (!project) return true;
  if (project.archived === true) return false;
  const portfolioId = project.portfolioId || project.portfolio?.id || null;
  return !ACTIVE_PORTFOLIO_ID || portfolioId === ACTIVE_PORTFOLIO_ID;
}

function messageProject(message) {
  return message?.task?.project || message?.chat?.project || message?.project || null;
}

async function getCommunicationTool(mode = 'query') {
  const tools = await niftyMcp.listTools();
  const exact = mode === 'query' ? 'communication_query' : 'communication_mutate';
  const fallback = mode === 'query' ? /communication.*query|message.*list/i : /communication.*mutate|message.*create/i;
  return tools.find(t => t.name === exact) || tools.find(t => fallback.test(t.name));
}

async function getTaskQueryTool() {
  const tools = await niftyMcp.listTools();
  return tools.find(t => t.name === 'tasks_query') || tools.find(t => /task.*query|task.*list/i.test(t.name));
}

async function getTaskMutateTool() {
  const tools = await niftyMcp.listTools();
  return tools.find(t => t.name === 'tasks_mutate') || tools.find(t => /task.*mutate|task.*update/i.test(t.name));
}

export function registerNiftyMcpRoutes(app) {
  app.get('/api/nifty/mcp/status', (req, res) => {
    const mcp = niftyMcp.status();
    const rest = apiAuthenticated();
    res.json({
      ...mcp,
      configured: mcp.configured || rest,
      connected: mcp.initialized || rest,
      source: mcp.configured ? 'nifty-mcp' : rest ? 'nifty-api' : 'unavailable',
      mcpConfigured: mcp.configured,
      apiAuthenticated: rest,
      fallbackActive: !mcp.configured && rest
    });
  });

  app.get('/api/nifty/mcp/tasks', async (req, res) => {
    try {
      if (!niftyMcp.configured) {
        const result = await getAffiliateTasks({
          limit: req.query.limit,
          includeCompleted: req.query.includeCompleted === 'true'
        });
        if (!result.configured) return res.status(503).json(result);
        return res.json({ ...result, total: result.tasks.length, scope: 'affiliate-project' });
      }
      const tool = await getTaskQueryTool();
      if (!tool) return res.status(501).json({ error: 'Nifty MCP task reads are unavailable.', tasks: [] });

      const limit = Math.min(Number(req.query.limit) || 250, 250);
      const includeCompleted = req.query.includeCompleted === 'true';
      const states = includeCompleted ? [false, true] : [false];
      const payloads = await Promise.all(states.map(async completed => {
        const result = await niftyMcp.callTool(tool.name, {
          resource: 'task', operation: 'list', completed, archived: false, limit,
          includeTotal: true, sort: 'dueAt', expand: 'project,status,list,assignees'
        });
        return rowsFrom(unwrapToolResult(result));
      }));

      const seen = new Set();
      const tasks = payloads.flat()
        .filter(task => task && task.archived !== true)
        .filter(task => {
          if (!task.id || seen.has(task.id)) return false;
          seen.add(task.id);
          return true;
        });

      res.json({ tasks, total: tasks.length, source: 'nifty-mcp', scope: 'live' });
    } catch (error) {
      res.status(500).json({ error: error.message, tasks: [] });
    }
  });

  app.get('/api/nifty/mcp/action-feed', async (req, res) => {
    try {
      const result = await getAffiliateTasks({ limit: req.query.limit });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message, tasks: [] });
    }
  });

  app.post('/api/nifty/mcp/action-feed/sync', async (req, res) => {
    try {
      const result = await syncAffiliateTasksToInbox({ limit: req.body?.limit });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/nifty/mcp/tasks/:taskId/complete', async (req, res) => {
    try {
      if (!niftyMcp.configured && apiAuthenticated()) {
        const result = await nifty.completeTask(req.params.taskId);
        return res.json({ success: true, source: 'nifty-api', result });
      }
      const tool = await getTaskMutateTool();
      if (!tool) return res.status(501).json({ error: 'Nifty MCP task writes are unavailable.' });
      const result = await niftyMcp.callTool(tool.name, {
        resource: 'task', operation: 'update', id: req.params.taskId, completed: true
      });
      res.json({ success: true, result: unwrapToolResult(result) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/nifty/mcp/tools', async (req, res) => {
    try { res.json({ tools: await niftyMcp.listTools({ refresh: req.query.refresh === 'true' }) }); }
    catch (error) { res.status(500).json({ error: error.message, ...niftyMcp.status() }); }
  });

  app.post('/api/nifty/mcp/call', async (req, res) => {
    try {
      const { tool, arguments: args = {} } = req.body || {};
      if (!tool) return res.status(400).json({ error: 'tool is required' });
      const available = await niftyMcp.listTools();
      if (!available.some(item => item.name === tool)) return res.status(400).json({ error: `Unknown Nifty MCP tool: ${tool}` });
      const result = await niftyMcp.callTool(tool, args);
      res.json({ result: unwrapToolResult(result), raw: result });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/mcp/chats', async (req, res) => {
    try {
      if (!niftyMcp.configured && apiAuthenticated()) {
        let project = null;
        try { project = await nifty.getProject(AFFILIATE_PROJECT_ID); } catch {}
        return res.json({
          chats: [{
            id: restChatId(), name: project?.name || 'Affiliate Career',
            description: 'Nifty project conversation via REST API', type: 'project',
            projectId: AFFILIATE_PROJECT_ID, source: 'nifty-api'
          }],
          source: 'nifty-api', fallback: true, scope: 'affiliate-project'
        });
      }
      const tool = await getCommunicationTool('query');
      if (!tool) return res.status(501).json({ error: 'Nifty MCP communication reads are unavailable.' });
      const result = await niftyMcp.callTool(tool.name, {
        resource: 'chat', operation: 'list', limit: Math.min(Number(req.query.limit) || 50, 100),
        sort: '-lastMessageAt', expand: 'chatMembers.member,project,project.portfolio'
      });
      const chats = rowsFrom(unwrapToolResult(result))
        .filter(chat => activeProject(chat.project))
        .map(chat => ({
          id: chat.id,
          name: chat.name || chat.project?.name || 'Direct message',
          description: chat.description || (chat.project?.name ? `Nifty · ${chat.project.name}` : 'Nifty conversation'),
          lastMessageAt: chat.lastMessageAt || chat.updatedAt || chat.createdAt,
          type: chat.type || 'chat',
          members: chat.chatMembers || [],
          projectId: chat.projectId || chat.project?.id || null,
          source: 'nifty'
        }));
      res.json({ chats, scope: '2026-active' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/mcp/chats/:chatId/messages', async (req, res) => {
    try {
      if (!niftyMcp.configured && apiAuthenticated()) {
        const projectId = projectIdFromChat(req.params.chatId) || AFFILIATE_PROJECT_ID;
        const payload = await nifty.getMessages(projectId, { limit: Math.min(Number(req.query.limit) || 100, 200) });
        return res.json({
          messages: rowsFrom(payload).map(message => normalizeRestMessage(message, projectId)),
          source: 'nifty-api', fallback: true
        });
      }
      const tool = await getCommunicationTool('query');
      if (!tool) return res.status(501).json({ error: 'Nifty MCP communication reads are unavailable.' });
      const result = await niftyMcp.callTool(tool.name, {
        resource: 'message', operation: 'list', chatId: req.params.chatId,
        limit: Math.min(Number(req.query.limit) || 100, 200), sort: 'createdAt', expand: 'author,chat,chat.project,chat.project.portfolio,parentMessage'
      });
      const messages = rowsFrom(unwrapToolResult(result))
        .filter(message => !message.subtype && activeProject(message.chat?.project))
        .map(message => ({
          id: message.id,
          content: message.text || message.content || '',
          author_name: message.author?.name || message.author?.email || (message.authorId ? 'Nifty teammate' : 'Nifty'),
          author_type: message.authorId ? 'user' : 'system',
          author_id: message.authorId || null,
          created_at: message.createdAt || message.updatedAt,
          metadata: { source: 'nifty', chatId: message.chatId || req.params.chatId, parentMessageId: message.parentMessageId || null }
        }));
      res.json({ messages });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/nifty/mcp/sync-inbox', async (req, res) => {
    try {
      if (!niftyMcp.configured && apiAuthenticated()) {
        const limit = Math.min(Number(req.body?.limit) || 100, 250);
        const payload = await nifty.getMessages(AFFILIATE_PROJECT_ID, { limit });
        const messages = rowsFrom(payload).map(message => normalizeRestMessage(message));
        let synced = 0;
        for (const message of messages) {
          if (!message.id || !message.content) continue;
          unifiedInbox.addToInbox({
            type: 'conversation', itemId: String(message.id), source: 'nifty',
            title: `${message.author_name} · Affiliate Career`, preview: message.content.slice(0, 240),
            priority: message.taskId ? 2 : 1, metadata: message.metadata
          });
          synced++;
        }
        return res.json({ success: true, synced, fetched: messages.length, source: 'nifty-api', fallback: true, scope: 'affiliate-project' });
      }
      const commTool = await getCommunicationTool('query');
      if (!commTool) return res.status(501).json({ error: 'This Nifty MCP server does not expose communication/message reads.' });
      const limit = Math.min(Number(req.body?.limit) || 100, 250);
      const toolResult = await niftyMcp.callTool(commTool.name, {
        resource: 'message', operation: 'list', limit, sort: '-createdAt',
        expand: 'author,chat,chat.project,chat.project.portfolio,task,task.project,task.project.portfolio,document,file,parentMessage'
      });
      const messages = rowsFrom(unwrapToolResult(toolResult));
      let synced = 0;
      let skippedArchived = 0;
      for (const message of messages) {
        if (!message?.id || message.subtype) continue;
        if (!activeProject(messageProject(message))) { skippedArchived++; continue; }
        const text = message.text || message.content || '';
        if (!text && !message.sharedDocumentId) continue;
        const author = message.author?.name || message.author?.email || 'Nifty teammate';
        const chatName = message.chat?.name || (message.task ? `Task: ${message.task.name || message.task.id}` : 'Nifty conversation');
        const contextId = message.chatId || message.taskId || message.documentId || message.fileId || null;
        unifiedInbox.addToInbox({
          type: 'conversation', itemId: String(message.id), source: 'nifty', title: `${author} · ${chatName}`,
          preview: text.slice(0, 240), priority: message.taskId ? 2 : 1,
          metadata: {
            niftyMessageId: message.id, chatId: message.chatId || null, taskId: message.taskId || null,
            documentId: message.documentId || null, fileId: message.fileId || null,
            parentMessageId: message.parentMessageId || null, contextId, authorId: message.authorId || null,
            createdAt: message.createdAt || null
          }
        });
        synced++;
      }
      res.json({ success: true, synced, skippedArchived, fetched: messages.length, source: 'nifty-mcp', scope: '2026-active' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/nifty/mcp/message', async (req, res) => {
    try {
      if (!niftyMcp.configured && apiAuthenticated()) {
        const { text, chatId, taskId } = req.body || {};
        if (!text) return res.status(400).json({ error: 'text is required' });
        const projectId = projectIdFromChat(chatId) || AFFILIATE_PROJECT_ID;
        const result = await nifty.createMessage(projectId, text, { taskId });
        return res.json({ success: true, source: 'nifty-api', fallback: true, result });
      }
      const commTool = await getCommunicationTool('mutate');
      if (!commTool) return res.status(501).json({ error: 'Nifty MCP message writes are unavailable.' });
      const { text, chatId, taskId, documentId, fileId, parentMessageId, recipientMemberId } = req.body || {};
      if (!text) return res.status(400).json({ error: 'text is required' });
      const contexts = { chatId, taskId, documentId, fileId, parentMessageId, recipientMemberId };
      const populated = Object.entries(contexts).filter(([, value]) => Boolean(value));
      if (populated.length !== 1) return res.status(400).json({ error: 'Provide exactly one Nifty message context.' });
      const result = await niftyMcp.callTool(commTool.name, {
        resource: 'message', operation: 'create', text, [populated[0][0]]: populated[0][1]
      });
      res.json({ success: true, result: unwrapToolResult(result) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
}

export default registerNiftyMcpRoutes;
