import { status as workspaceStatus, list, read, search, stat, write, mkdir } from '../lib/local-workspace.js';
import { registerVerticalReadinessRoutes } from './vertical-readiness-routes.js';

const MCP_PROTOCOL = process.env.LOCAL_MCP_PROTOCOL_VERSION || '2025-11-25';
const PORT = () => process.env.PORT || 3005;

function liveTradingEnabled() {
  return /^(1|true|yes|on)$/i.test(String(process.env.LIV8_MCP_LIVE_TRADING_ENABLED || ''));
}

function allowedLiveBrokers() {
  return String(process.env.LIV8_MCP_LIVE_TRADING_BROKERS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

async function internal(path, { method = 'GET', body } = {}) {
  const response = await fetch(`http://127.0.0.1:${PORT()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || data?.errors?.join?.('; ') || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const flexibleTradeSchema = {
  broker: { type: 'string', description: 'Broker/execution target, for example kraken, ctrader, or hybrid-journal.' },
  accountId: { type: 'string', description: 'Optional broker/account identifier when the downstream execution adapter supports it.' },
  symbol: { type: 'string', description: 'Instrument symbol, for example MNQ, NQ, BTC/USD, or XBTUSD.' },
  side: { type: 'string', description: 'BUY or SELL when structured order fields are used.' },
  quantity: { type: 'number', description: 'Order quantity/contracts when structured order fields are used.' },
  orderType: { type: 'string', description: 'Optional order type such as market, limit, or stop.' },
  price: { type: 'number', description: 'Optional limit/stop price.' },
  stopLoss: { type: 'number', description: 'Optional stop-loss level.' },
  takeProfit: { type: 'number', description: 'Optional take-profit level.' },
  text: { type: 'string', description: 'Natural-language order intent. Required for Kraken when no structured intent object is supplied.' },
  intent: { type: 'object', description: 'Structured execution intent accepted by the execution gateway.', additionalProperties: true },
};

// Historical export name retained because the unified gateway already imports this
// array. It now contains both workspace tools and tightly gated trading execution
// extensions so there remains exactly one /mcp transport.
export const LOCAL_WORKSPACE_MCP_TOOLS = [
  { name: 'workspace_status', title: 'Workspace Status', description: 'Show whether the allow-listed workspace bridge is enabled and which roots are available.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_list', title: 'List Workspace', description: 'List files and folders inside an allow-listed workspace root.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_search', title: 'Search Workspace', description: 'Search file names and small text files inside an allow-listed workspace root.', inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, root: { type: 'string' }, limit: { type: 'number' }, content: { type: 'boolean' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_read', title: 'Read Workspace File', description: 'Read a UTF-8 text file inside an allow-listed workspace root.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_stat', title: 'Workspace File Metadata', description: 'Get metadata for an allow-listed file or folder.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_write', title: 'Write Workspace File', description: 'Create or update a UTF-8 text file inside an allow-listed workspace root. Requires local write permission and liv8.write scope.', inputSchema: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' }, overwrite: { type: 'boolean' } }, additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } },
  { name: 'workspace_mkdir', title: 'Create Workspace Directory', description: 'Create a directory inside an allow-listed workspace root. Requires local write permission and liv8.write scope.', inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } }, additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } },

  { name: 'trading_execution_status', title: 'Trading Execution Status', description: 'Show whether live MCP trading is armed, whether the Hybrid execution gateway is configured/reachable, and which brokers are allow-listed.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  { name: 'trading_positions', title: 'Trading Positions', description: 'Read open/current positions from the execution gateway for a broker and mode.', inputSchema: { type: 'object', properties: { broker: { type: 'string' }, mode: { type: 'string', enum: ['paper', 'live'] } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  { name: 'trading_orders', title: 'Trading Orders', description: 'Read orders from the execution gateway for a broker and mode.', inputSchema: { type: 'object', properties: { broker: { type: 'string' }, mode: { type: 'string', enum: ['paper', 'live'] } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  { name: 'trading_order_preview', title: 'Preview Trade', description: 'Validate and preview a trade without placing it. Use this before any live execution.', inputSchema: { type: 'object', properties: flexibleTradeSchema, additionalProperties: true }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  { name: 'trading_order_paper', title: 'Paper Trade', description: 'Send a paper/demo order through the execution gateway. This never submits a live order.', inputSchema: { type: 'object', properties: flexibleTradeSchema, additionalProperties: true }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: 'trading_live_execute', title: 'Execute Live Trade', description: 'Submit a real live order through the gated execution path. Requires LIV8_MCP_LIVE_TRADING_ENABLED, liv8.write scope, supported broker configuration, and confirmation exactly equal to CONFIRM_LIVE_TRADE.', inputSchema: { type: 'object', required: ['confirmation'], properties: { ...flexibleTradeSchema, confirmation: { type: 'string', enum: ['CONFIRM_LIVE_TRADE'], description: 'Explicit live-trade confirmation phrase.' } }, additionalProperties: true }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } },
  { name: 'trading_ctrader_mcp_read', title: 'cTrader MCP Read', description: 'Discover or call read-only cTrader MCP tools for a configured connection. Write-capable cTrader operations must go through trading_live_execute instead.', inputSchema: { type: 'object', required: ['connectionId'], properties: { connectionId: { type: 'string' }, tool: { type: 'string' }, arguments: { type: 'object', additionalProperties: true }, listTools: { type: 'boolean' } }, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
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

    case 'trading_execution_status': {
      const hybrid = await internal('/api/trading/hybrid-journal/status').catch(error => ({ error: error.message }));
      return {
        liveTradingEnabled: liveTradingEnabled(),
        confirmationRequired: 'CONFIRM_LIVE_TRADE',
        allowedBrokers: allowedLiveBrokers(),
        hybrid,
      };
    }
    case 'trading_positions': {
      const broker = encodeURIComponent(String(args.broker || 'kraken'));
      const mode = encodeURIComponent(String(args.mode || 'paper'));
      return internal(`/api/trading/execution/positions?broker=${broker}&mode=${mode}`);
    }
    case 'trading_orders': {
      const broker = encodeURIComponent(String(args.broker || 'kraken'));
      const mode = encodeURIComponent(String(args.mode || 'paper'));
      return internal(`/api/trading/execution/orders?broker=${broker}&mode=${mode}`);
    }
    case 'trading_order_preview':
      return internal('/api/trading/hybrid-journal/order-preview', { method: 'POST', body: { ...args } });
    case 'trading_order_paper':
      return internal('/api/trading/hybrid-journal/order-paper', { method: 'POST', body: { ...args } });
    case 'trading_live_execute': {
      if (!liveTradingEnabled()) {
        const error = new Error('Live MCP trading is disabled. Set LIV8_MCP_LIVE_TRADING_ENABLED=true on the Command Center API to arm it.');
        error.status = 403;
        throw error;
      }
      if (args.confirmation !== 'CONFIRM_LIVE_TRADE') {
        const error = new Error('Explicit live-trade confirmation required: CONFIRM_LIVE_TRADE');
        error.status = 409;
        throw error;
      }
      const allowlist = allowedLiveBrokers();
      const broker = String(args.broker || '').trim().toLowerCase();
      if (allowlist.length) {
        if (!broker) {
          const error = new Error(`broker is required for live trading because an MCP broker allowlist is configured (${allowlist.join(', ')}).`);
          error.status = 400;
          throw error;
        }
        if (!allowlist.includes(broker)) {
          const error = new Error(`Broker ${broker} is not enabled for live MCP trading.`);
          error.status = 403;
          throw error;
        }
      }
      const payload = { ...args, confirmation: 'CONFIRM_LIVE_TRADE' };
      const result = await internal('/api/trading/hybrid-journal/order-execute', { method: 'POST', body: payload });
      console.log('[LIV8 MCP] live trade execution confirmed', {
        at: new Date().toISOString(),
        broker: broker || result?.broker || 'downstream',
        accountId: args.accountId || null,
        symbol: args.symbol || args.intent?.symbol || null,
        side: args.side || args.intent?.side || null,
      });
      return result;
    }
    case 'trading_ctrader_mcp_read':
      return internal('/api/trading/hybrid-journal/ctrader/read', {
        method: 'POST',
        body: {
          connection_id: args.connectionId,
          tool: args.tool,
          arguments: args.arguments || {},
          list_tools: args.listTools === true,
        },
      });
    default: throw new Error(`Unknown unified MCP extension tool: ${name}`);
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
      liveTrading: {
        enabled: liveTradingEnabled(),
        confirmationRequired: 'CONFIRM_LIVE_TRADE',
        allowedBrokers: allowedLiveBrokers(),
      },
      unified: true,
      note: 'Workspace and gated trading tools are part of the authenticated LIV8 Command Center MCP gateway; Nifty, HighLevel, Hybrid Journal and broker execution remain downstream source systems.'
    });
  });

  registerVerticalReadinessRoutes(app);
  console.log('Local workspace + gated trading MCP extensions registered; unified LIV8 gateway owns /mcp');
}

export default registerLocalWorkspaceMcpRoutes;
