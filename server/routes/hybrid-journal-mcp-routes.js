import { hybridJournalMcp } from '../lib/hybrid-journal-mcp-client.js';
import * as hybridJournal from '../lib/hybrid-journal-adapter.js';

const READ_TOOLS = new Set([
  'generate_qqe_briefing',
  'run_market_cause_engine',
  'analyze_my_trades',
  'trigger_broker_sync'
]);
const EXECUTION_TOOLS = new Set(['place_trade', 'ctrader_mcp']);
const CTRADER_WRITE_RE = /create_order|place|modify|cancel|close|delete|execute/i;
const EXECUTION_URL = String(process.env.HYBRID_EXECUTION_URL || 'https://hybridzone-api.onrender.com').replace(/\/$/, '');

function unwrap(result) {
  if (!result) return null;
  if (result.structuredContent) return result.structuredContent;
  for (const item of Array.isArray(result.content) ? result.content : []) {
    if (item?.type !== 'text' || !item.text) continue;
    try { return JSON.parse(item.text); } catch { return item.text; }
  }
  return result;
}

async function call(name, args = {}) {
  const tools = await hybridJournalMcp.listTools();
  if (!tools.some(tool => tool.name === name)) throw new Error(`Hybrid Journal MCP tool is unavailable: ${name}`);
  return unwrap(await hybridJournalMcp.callTool(name, args));
}

async function execution(path, { method = 'GET', body } = {}) {
  const key = process.env.HYBRID_EXECUTION_API_KEY;
  if (!key) throw new Error('HYBRID_EXECUTION_API_KEY is not configured on Command Center');
  const response = await fetch(`${EXECUTION_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.errors?.join('; ') || `Execution gateway HTTP ${response.status}`);
  return data;
}

function wantsKraken(body = {}) {
  if (String(body.broker || '').toLowerCase() === 'kraken') return true;
  const text = String(body.text || body.rationale || '').toLowerCase();
  return /\b(kraken|bitcoin|btc|xbt|ethereum|eth|solana|sol|xrp|doge|ada)\b/.test(text);
}

async function krakenIntentFromBody(body = {}, mode = 'paper') {
  if (body.intent && typeof body.intent === 'object') {
    return { ...body.intent, broker: 'kraken', mode, source: body.intent.source || 'command-center' };
  }
  if (!body.text) throw new Error('text or intent is required for Kraken execution');
  const parsed = await execution('/api/execution/parse', {
    method: 'POST',
    body: { text: body.text, broker: 'kraken', mode, source: 'command-center' },
  });
  return parsed.intent;
}

export function registerHybridJournalMcpRoutes(app) {
  app.get('/api/trading/hybrid-journal/status', async (req, res) => {
    const mcp = hybridJournalMcp.status();
    const fallback = hybridJournal.status();
    let tools = [];
    let executionGateway = { configured: Boolean(process.env.HYBRID_EXECUTION_API_KEY), reachable: false };
    if (mcp.configured) {
      try { tools = (await hybridJournalMcp.listTools()).map(({ name, title, description }) => ({ name, title, description })); } catch {}
    }
    if (executionGateway.configured) {
      try {
        const gateway = await execution('/api/execution/status');
        executionGateway = { ...executionGateway, reachable: true, ...gateway };
      } catch (error) { executionGateway.error = error.message; }
    }
    res.json({ mcp, fallback, tools, executionGateway, executionRequiresConfirmation: true });
  });

  app.get('/api/trading/hybrid-journal/snapshot', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 250);
      const synced = await hybridJournal.sync({ limit });
      res.json({ source: 'hybrid-journal', synced });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/trading/hybrid-journal/briefing', async (req, res) => {
    try { res.json({ result: await call('generate_qqe_briefing', req.body || {}) }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/trading/hybrid-journal/regime', async (req, res) => {
    try { res.json({ result: await call('run_market_cause_engine', req.body || {}) }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/trading/hybrid-journal/analyze', async (req, res) => {
    try { res.json({ result: await call('analyze_my_trades', req.body || {}) }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/trading/hybrid-journal/broker-sync', async (req, res) => {
    try { res.json({ result: await call('trigger_broker_sync', req.body || {}) }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Dry-run / preview. Kraken commands are normalized by the shared execution
  // gateway; futures/cTrader continue through Hybrid Journal MCP.
  app.post('/api/trading/hybrid-journal/order-preview', async (req, res) => {
    try {
      if (wantsKraken(req.body || {})) {
        const intent = await krakenIntentFromBody(req.body || {}, req.body?.mode || 'paper');
        const data = await execution('/api/execution/intents/preview', { method: 'POST', body: intent });
        return res.json({ preview: data.preview, broker: 'kraken', gateway: true, live: false });
      }
      res.json({ preview: await call('place_trade', { ...(req.body || {}), dry_run: true }), broker: req.body?.broker || 'hybrid-journal', live: false });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Paper execution is a first-class action for Kraken. It deliberately does
  // not accept live mode and does not require the live confirmation token.
  app.post('/api/trading/hybrid-journal/order-paper', async (req, res) => {
    try {
      const intent = await krakenIntentFromBody(req.body || {}, 'paper');
      const data = await execution('/api/execution/intents/execute', {
        method: 'POST',
        body: { ...intent, mode: 'paper', confirmation: 'preview' },
      });
      res.json({ result: data, broker: 'kraken', live: false });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Live execution remains separately confirmation-gated. For Kraken, the exact
  // previewed TradeIntent may be sent back to avoid re-interpreting user speech.
  app.post('/api/trading/hybrid-journal/order-execute', async (req, res) => {
    try {
      const { confirmation, ...order } = req.body || {};
      if (confirmation !== 'CONFIRM_LIVE_TRADE') {
        return res.status(409).json({ error: 'Explicit live-trade confirmation required.', requiredConfirmation: 'CONFIRM_LIVE_TRADE' });
      }
      if (wantsKraken(order)) {
        const intent = await krakenIntentFromBody(order, 'live');
        const data = await execution('/api/execution/intents/execute', {
          method: 'POST',
          body: { ...intent, mode: 'live', confirmation: 'CONFIRM_LIVE_TRADE' },
        });
        return res.json({ result: data, broker: 'kraken', live: true });
      }
      res.json({ result: await call('place_trade', { ...order, dry_run: false }), broker: order.broker || 'hybrid-journal', live: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/trading/execution/positions', async (req, res) => {
    try {
      const broker = req.query.broker || 'kraken';
      const mode = req.query.mode || 'paper';
      res.json(await execution(`/api/execution/positions?broker=${encodeURIComponent(broker)}&mode=${encodeURIComponent(mode)}`));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/trading/execution/orders', async (req, res) => {
    try {
      const broker = req.query.broker || 'kraken';
      const mode = req.query.mode || 'paper';
      res.json(await execution(`/api/execution/orders?broker=${encodeURIComponent(broker)}&mode=${encodeURIComponent(mode)}`));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Generic MCP gateway for agents. Read/analysis tools are allowed. Trading
  // execution tools are blocked here so they cannot bypass the dedicated gate.
  app.post('/api/trading/hybrid-journal/mcp/call', async (req, res) => {
    try {
      const { tool, arguments: args = {} } = req.body || {};
      if (!tool) return res.status(400).json({ error: 'tool is required' });
      if (EXECUTION_TOOLS.has(tool)) {
        return res.status(403).json({ error: 'Execution-capable tools must use the gated trading endpoints.' });
      }
      if (!READ_TOOLS.has(tool)) return res.status(403).json({ error: `Tool not allowlisted for generic use: ${tool}` });
      res.json({ result: await call(tool, args) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // cTrader read bridge. Write-like cTrader tools are refused here; future live
  // cTrader actions should get their own confirmation-gated endpoint.
  app.post('/api/trading/hybrid-journal/ctrader/read', async (req, res) => {
    try {
      const { connection_id, tool, arguments: args = {}, list_tools = false } = req.body || {};
      if (!connection_id) return res.status(400).json({ error: 'connection_id is required' });
      if (!list_tools && (!tool || CTRADER_WRITE_RE.test(tool))) return res.status(403).json({ error: 'Only read-only cTrader tools are allowed here.' });
      res.json({ result: await call('ctrader_mcp', { connection_id, tool, arguments: args, list_tools }) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
}

export default registerHybridJournalMcpRoutes;
