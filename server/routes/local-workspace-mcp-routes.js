import { status as workspaceStatus, list, read, search, stat, write, mkdir } from '../lib/local-workspace.js';
import { registerVerticalReadinessRoutes } from './vertical-readiness-routes.js';

const MCP_PROTOCOL = process.env.LOCAL_MCP_PROTOCOL_VERSION || '2025-11-25';

export const LOCAL_WORKSPACE_MCP_TOOLS = [
  { name: 'workspace_status', title: 'Workspace Status', description: 'Show whether the allow-listed workspace bridge is enabled and which roots are available.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_list', title: 'List Workspace', description: 'List files and folders inside an allow-listed workspace root.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_search', title: 'Search Workspace', description: 'Search file names and small text files inside an allow-listed workspace root.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, root: { type: 'string' }, limit: { type: 'number' }, content: { type: 'boolean' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_read', title: 'Read Workspace File', description: 'Read a UTF-8 text file inside an allow-listed workspace root.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_stat', title: 'Workspace File Metadata', description: 'Get metadata for an allow-listed file or folder.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_write', title: 'Write Workspace File', description: 'Create or update a UTF-8 text file inside an allow-listed workspace root. Requires local write permission and liv8.write scope.', inputSchema: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' }, overwrite: { type: 'boolean' } }, additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_mkdir', title: 'Create Workspace Directory', description: 'Create a directory inside an allow-listed workspace root. Requires local write permission and liv8.write scope.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } }, additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
];

export async function callLocalWorkspaceMcpTool(name, args = {}) {
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

export function registerLocalWorkspaceMcpRoutes(app) {
  app.get('/api/workspace/status', async (_req, res) => { try { res.json({ ok: true, ...(await workspaceStatus()) }); } catch (e) { res.status(500).json({ ok: false, error: e.message }); } });
  app.get('/api/workspace/list', async (req, res) => { try { res.json(await list(req.query.path || '.', { limit: req.query.limit })); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.get('/api/workspace/read', async (req, res) => { try { res.json(await read(req.query.path)); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.get('/api/workspace/search', async (req, res) => { try { res.json(await search(req.query.q, { root: req.query.root || '.', limit: req.query.limit, content: req.query.content !== 'false' })); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.post('/api/workspace/write', async (req, res) => { try { res.json(await write(req.body?.path, req.body?.content, { overwrite: req.body?.overwrite !== false })); } catch (e) { res.status(400).json({ error: e.message }); } });
  app.post('/api/workspace/mkdir', async (req, res) => { try { res.json(await mkdir(req.body?.path)); } catch (e) { res.status(400).json({ error: e.message }); } });

  // `/mcp` is registered once by LIV8 Connect. These tools are imported into that
  // unified server instead of creating a second competing MCP endpoint.
  app.get('/api/mcp/status', async (_req, res) => {
    const workspace = await workspaceStatus().catch(e => ({ enabled: false, error: e.message }));
    res.json({
      ok: true,
      role: 'mcp-server-and-client',
      endpoint: '/mcp',
      protocolVersion: MCP_PROTOCOL,
      tools: LOCAL_WORKSPACE_MCP_TOOLS.map(t => t.name),
      workspace,
      unified: true,
      note: 'Workspace tools are part of the authenticated LIV8 Command Center MCP gateway; Nifty and Hybrid Journal remain downstream source systems.'
    });
  });

  registerVerticalReadinessRoutes(app);
  console.log('Local workspace routes registered; MCP tools delegated to unified LIV8 gateway');
}

export default registerLocalWorkspaceMcpRoutes;
