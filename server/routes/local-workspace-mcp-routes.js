import { workspaceTools, status as workspaceStatus, list, read, search, stat, write, mkdir } from '../lib/local-workspace.js';

const MCP_PROTOCOL = process.env.LOCAL_MCP_PROTOCOL_VERSION || '2025-06-18';

const TOOL_DEFS = [
  { name: 'workspace_status', description: 'Show whether the Mac workspace bridge is enabled and which roots are available.', inputSchema: { type: 'object', properties: {} } },
  { name: 'workspace_list', description: 'List files and folders inside an allow-listed Mac workspace root.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'workspace_search', description: 'Search file names and small text files inside an allow-listed Mac workspace root.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, root: { type: 'string' }, limit: { type: 'number' }, content: { type: 'boolean' } } } },
  { name: 'workspace_read', description: 'Read a UTF-8 text file inside an allow-listed Mac workspace root.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'workspace_stat', description: 'Get metadata for an allow-listed file or folder.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
  { name: 'workspace_write', description: 'Create or update a UTF-8 text file inside an allow-listed Mac workspace root. Requires local write permission.', inputSchema: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' }, overwrite: { type: 'boolean' } } } },
  { name: 'workspace_mkdir', description: 'Create a directory inside an allow-listed Mac workspace root. Requires local write permission.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
];

function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: false };
}
function toolError(error) {
  return { content: [{ type: 'text', text: error?.message || 'Tool failed' }], isError: true };
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'workspace_status': return workspaceStatus();
    case 'workspace_list': return list(args.path || '.', { limit: args.limit });
    case 'workspace_search': return search(args.query, { root: args.root || '.', limit: args.limit, content: args.content !== false });
    case 'workspace_read': return read(args.path);
    case 'workspace_stat': return stat(args.path);
    case 'workspace_write': return write(args.path, args.content, { overwrite: args.overwrite !== false });
    case 'workspace_mkdir': return mkdir(args.path);
    default: throw new Error(`Unknown workspace tool: ${name}`);
  }
}

function rpcResponse(id, result) { return { jsonrpc: '2.0', id: id ?? null, result }; }
function rpcError(id, code, message) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }; }

export function registerLocalWorkspaceMcpRoutes(app) {
  app.get('/api/workspace/status', async (req, res) => { try { res.json({ ok: true, ...(await workspaceStatus()) }); } catch (e) { res.status(500).json({ ok: false, error: e.message }); } });
  app.get('/api/workspace/list', async (req, res) => { try { res.json(await list(req.query.path || '.', { limit: req.query.limit })); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.get('/api/workspace/read', async (req, res) => { try { res.json(await read(req.query.path)); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.get('/api/workspace/search', async (req, res) => { try { res.json(await search(req.query.q, { root: req.query.root || '.', limit: req.query.limit, content: req.query.content !== 'false' })); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.post('/api/workspace/write', async (req, res) => { try { res.json(await write(req.body?.path, req.body?.content, { overwrite: req.body?.overwrite !== false })); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.post('/api/workspace/mkdir', async (req, res) => { try { res.json(await mkdir(req.body?.path)); } catch (e) { res.status(400).json({ error: e.message }); } });

  // Streamable HTTP-compatible JSON-RPC entry point for local MCP clients.
  // Keep this endpoint private/local unless placed behind an authenticated tunnel.
  app.post('/mcp', async (req, res) => {
    const { id, method, params = {} } = req.body || {};
    try {
      if (method === 'initialize') return res.json(rpcResponse(id, { protocolVersion: MCP_PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'liv8-command-center', version: '1.0.0' } }));
      if (method === 'notifications/initialized') return res.status(202).end();
      if (method === 'tools/list') return res.json(rpcResponse(id, { tools: TOOL_DEFS }));
      if (method === 'tools/call') {
        try { return res.json(rpcResponse(id, await callTool(params.name, params.arguments || {}))); }
        catch (e) { return res.json(rpcResponse(id, toolError(e))); }
      }
      return res.status(400).json(rpcError(id, -32601, `Method not found: ${method}`));
    } catch (e) {
      return res.status(500).json(rpcError(id, -32603, e?.message || 'Internal MCP error'));
    }
  });

  app.get('/api/mcp/status', async (req, res) => {
    const workspace = await workspaceStatus().catch(e => ({ enabled: false, error: e.message }));
    res.json({ ok: true, role: 'mcp-server-and-client', endpoint: '/mcp', protocolVersion: MCP_PROTOCOL, tools: TOOL_DEFS.map(t => t.name), workspace, note: 'Nifty and Hybrid Journal are MCP clients; /mcp exposes the allow-listed local workspace to trusted MCP clients.' });
  });

  console.log('Local Mac Workspace + LIV8 MCP server routes registered');
}

export default registerLocalWorkspaceMcpRoutes;
