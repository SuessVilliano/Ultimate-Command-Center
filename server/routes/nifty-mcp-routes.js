import { niftyMcp } from '../lib/nifty-mcp-client.js';
import * as unifiedInbox from '../lib/unified-inbox.js';

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

async function getCommunicationTool(mode = 'query') {
  const tools = await niftyMcp.listTools();
  const exact = mode === 'query' ? 'communication_query' : 'communication_mutate';
  const fallback = mode === 'query' ? /communication.*query|message.*list/i : /communication.*mutate|message.*create/i;
  return tools.find(t => t.name === exact) || tools.find(t => fallback.test(t.name));
}

export function registerNiftyMcpRoutes(app) {
  app.get('/api/nifty/mcp/status', (req, res) => res.json(niftyMcp.status()));

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

  // Nifty chats become first-class Command Center inbox channels.
  app.get('/api/nifty/mcp/chats', async (req, res) => {
    try {
      const tool = await getCommunicationTool('query');
      if (!tool) return res.status(501).json({ error: 'Nifty MCP communication reads are unavailable.' });
      const result = await niftyMcp.callTool(tool.name, {
        resource: 'chat', operation: 'list', limit: Math.min(Number(req.query.limit) || 50, 100),
        sort: '-lastMessageAt', expand: 'chatMembers.member,project'
      });
      const chats = rowsFrom(unwrapToolResult(result)).map(chat => ({
        id: chat.id,
        name: chat.name || chat.project?.name || 'Direct message',
        description: chat.description || (chat.project?.name ? `Nifty · ${chat.project.name}` : 'Nifty conversation'),
        lastMessageAt: chat.lastMessageAt || chat.updatedAt || chat.createdAt,
        type: chat.type || 'chat',
        members: chat.chatMembers || [],
        projectId: chat.projectId || chat.project?.id || null,
        source: 'nifty'
      }));
      res.json({ chats });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/mcp/chats/:chatId/messages', async (req, res) => {
    try {
      const tool = await getCommunicationTool('query');
      if (!tool) return res.status(501).json({ error: 'Nifty MCP communication reads are unavailable.' });
      const result = await niftyMcp.callTool(tool.name, {
        resource: 'message', operation: 'list', chatId: req.params.chatId,
        limit: Math.min(Number(req.query.limit) || 100, 200), sort: 'createdAt', expand: 'author,chat,parentMessage'
      });
      const messages = rowsFrom(unwrapToolResult(result))
        .filter(message => !message.subtype)
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
      const commTool = await getCommunicationTool('query');
      if (!commTool) return res.status(501).json({ error: 'This Nifty MCP server does not expose communication/message reads.' });
      const limit = Math.min(Number(req.body?.limit) || 100, 250);
      const toolResult = await niftyMcp.callTool(commTool.name, {
        resource: 'message', operation: 'list', limit, sort: '-createdAt', expand: 'author,chat,task,document,file,parentMessage'
      });
      const messages = rowsFrom(unwrapToolResult(toolResult));
      let synced = 0;
      for (const message of messages) {
        if (!message?.id || message.subtype) continue;
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
      res.json({ success: true, synced, fetched: messages.length, source: 'nifty-mcp' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/nifty/mcp/message', async (req, res) => {
    try {
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
