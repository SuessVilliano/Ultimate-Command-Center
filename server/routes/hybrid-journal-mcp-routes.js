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

export function registerHybridJournalMcpRoutes(app) {
  app.get('/api/trading/hybrid-journal/status', async (req, res) => {
    const mcp = hybridJournalMcp.status();
    const fallback = hybridJournal.status();
    let tools = [];
    if (mcp.configured) {
      try { tools = (await hybridJournalMcp.listTools()).map(({ name, title, description }) => ({ name, title, description })); } catch {}
    }
    res.json({ mcp, fallback, tools, executionRequiresConfirmation: true });
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

  // Always dry-run. This can be called freely by the AI/Command Center to turn
  // natural language into a proposed order without touching the broker.
  app.post('/api/trading/hybrid-journal/order-preview', async (req, res) => {
    try { res.json({ preview: await call('place_trade', { ...(req.body || {}), dry_run: true }), live: false }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Live execution is deliberately separate. A caller must send the exact
  // confirmation value after showing the proposed order to the user.
  app.post('/api/trading/hybrid-journal/order-execute', async (req, res) => {
    try {
      const { confirmation, ...order } = req.body || {};
      if (confirmation !== 'CONFIRM_LIVE_TRADE') {
        return res.status(409).json({ error: 'Explicit live-trade confirmation required.', requiredConfirmation: 'CONFIRM_LIVE_TRADE' });
      }
      res.json({ result: await call('place_trade', { ...order, dry_run: false }), live: true });
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
