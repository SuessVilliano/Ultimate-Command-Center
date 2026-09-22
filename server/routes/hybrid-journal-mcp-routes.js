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
const executionKey = () => process.env.HYBRID_EXECUTION_API_KEY || process.env.THZ_API_KEY || '';

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
  const key = executionKey();
  if (!key) throw new Error('HYBRID_EXECUTION_API_KEY or THZ_API_KEY is not configured on Command Center');
  const response = await fetch(`${EXECUTION_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error(`Execution gateway returned a non-JSON response for ${path}. Check HYBRID_EXECUTION_URL and the deployed /api/execution routes.`);
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.error || data.errors?.join('; ') || `Execution gateway HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function responseStatus(error, fallback = 500) {
  const status = Number(error?.status);
  return status >= 400 && status <= 599 ? status : fallback;
}

function gatewayBroker(body = {}) {
  const explicit = String(body.broker || body.intent?.broker || '').toLowerCase();
  if (['kraken', 'public'].includes(explicit)) return explicit;
  const text = String(body.text || body.rationale || '').toLowerCase();
  if (/\b(kraken|bitcoin|btc|xbt|ethereum|eth|solana|sol|xrp|doge|ada)\b/.test(text)) return 'kraken';
  return null;
}

async function gatewayIntentFromBody(body = {}, broker = 'kraken', mode) {
  const resolvedMode = mode || (broker === 'public' ? 'live' : 'paper');
  if (body.intent && typeof body.intent === 'object') {
    return { ...body.intent, broker, mode: resolvedMode, source: body.intent.source || 'command-center' };
  }
  if (!body.text) throw new Error(`text or intent is required for ${broker} execution`);
  const parsed = await execution('/api/execution/parse', {
    method: 'POST',
    body: {
      text: body.text,
      broker,
      mode: resolvedMode,
      source: 'command-center',
      symbol: body.symbol,
      instrumentType: body.instrumentType,
      openCloseIndicator: body.openCloseIndicator,
    },
  });
  return parsed.intent;
}

export function registerHybridJournalMcpRoutes(app, { requireOwnerSession } = {}) {
  if (typeof requireOwnerSession !== 'function') throw new Error('requireOwnerSession middleware is required for trading routes');

  app.get('/api/trading/hybrid-journal/status', async (_req, res) => {
    const mcp = hybridJournalMcp.status();
    const fallback = hybridJournal.status();
    let tools = [];
    let mcpError = null;
    let executionGateway = { configured: Boolean(executionKey()), reachable: false };
    if (mcp.configured) {
      try { tools = (await hybridJournalMcp.listTools()).map(({ name, title, description }) => ({ name, title, description })); }
      catch (error) { mcpError = error.message; }
    }
    if (executionGateway.configured) {
      try {
        const remote = await execution('/api/execution/status');
        if (remote?.ok !== true || remote?.gateway !== 'hybrid-execution') {
          const error = new Error('Execution gateway contract verification failed. The configured URL did not identify itself as hybrid-execution.');
          error.status = 502;
          throw error;
        }
        executionGateway = { ...executionGateway, ...remote, reachable: true, verified: true };
      }
      catch (error) { executionGateway.error = error.message; }
    }
    const connected = Boolean(mcp.hasSession || (mcp.initialized && tools.length));
    res.json({ mcp, connected, mcpError, fallback, tools, executionGateway, executionRequiresConfirmation: true });
  });

  app.get('/api/trading/hybrid-journal/snapshot', async (req, res) => {
    try { res.json({ source: 'hybrid-journal', synced: await hybridJournal.sync({ limit: Math.min(Number(req.query.limit) || 100, 250) }) }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/api/trading/hybrid-journal/briefing', async (req, res) => { try { res.json({ result: await call('generate_qqe_briefing', req.body || {}) }); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/trading/hybrid-journal/regime', async (req, res) => { try { res.json({ result: await call('run_market_cause_engine', req.body || {}) }); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/trading/hybrid-journal/analyze', async (req, res) => { try { res.json({ result: await call('analyze_my_trades', req.body || {}) }); } catch (e) { res.status(500).json({ error: e.message }); } });
  app.post('/api/trading/hybrid-journal/broker-sync', async (req, res) => { try { res.json({ result: await call('trigger_broker_sync', req.body || {}) }); } catch (e) { res.status(500).json({ error: e.message }); } });

  app.post('/api/trading/hybrid-journal/order-preview', async (req, res) => {
    try {
      const broker = gatewayBroker(req.body || {});
      if (broker) {
        const mode = req.body?.mode || (broker === 'public' ? 'live' : 'paper');
        const intent = await gatewayIntentFromBody(req.body || {}, broker, mode);
        const data = await execution('/api/execution/intents/preview', { method: 'POST', body: intent });
        return res.json({ preview: data.preview, preflight: data.preflight || null, broker, gateway: true, live: false });
      }
      res.json({ preview: await call('place_trade', { ...(req.body || {}), dry_run: true }), broker: req.body?.broker || 'hybrid-journal', live: false });
    } catch (error) { res.status(responseStatus(error)).json({ error: error.message }); }
  });

  app.post('/api/trading/hybrid-journal/order-paper', async (req, res) => {
    try {
      const broker = gatewayBroker(req.body || {}) || 'kraken';
      if (broker === 'public') return res.status(409).json({ error: 'Public does not provide a paper brokerage environment. Use Public preflight for a non-executing preview.' });
      const intent = await gatewayIntentFromBody(req.body || {}, broker, 'paper');
      const data = await execution('/api/execution/intents/execute', { method: 'POST', body: { ...intent, mode: 'paper', confirmation: 'preview' } });
      res.json({ result: data, broker, live: false });
    } catch (error) { res.status(responseStatus(error)).json({ error: error.message }); }
  });

  app.post('/api/trading/hybrid-journal/order-execute', requireOwnerSession, async (req, res) => {
    try {
      const { confirmation, ...order } = req.body || {};
      if (confirmation !== 'CONFIRM_LIVE_TRADE') return res.status(409).json({ error: 'Explicit live-trade confirmation required.', requiredConfirmation: 'CONFIRM_LIVE_TRADE' });
      const broker = gatewayBroker(order);
      if (broker) {
        const intent = await gatewayIntentFromBody(order, broker, 'live');
        const data = await execution('/api/execution/intents/execute', { method: 'POST', body: { ...intent, mode: 'live', confirmation: 'CONFIRM_LIVE_TRADE' } });
        return res.json({ result: data, broker, live: true });
      }
      res.json({ result: await call('place_trade', { ...order, dry_run: false }), broker: order.broker || 'hybrid-journal', live: true });
    } catch (error) { res.status(responseStatus(error)).json({ error: error.message }); }
  });

  function executionQuery(req, defaultBroker = 'kraken') {
    const broker = String(req.query.broker || defaultBroker).toLowerCase();
    const mode = String(req.query.mode || (broker === 'public' ? 'live' : 'paper')).toLowerCase();
    const qs = new URLSearchParams({ broker, mode });
    if (req.query.accountId) qs.set('accountId', String(req.query.accountId));
    return { broker, mode, qs };
  }

  app.get('/api/trading/execution/account-snapshot', requireOwnerSession, async (req, res) => { try { const {qs}=executionQuery(req); res.json(await execution(`/api/execution/account-snapshot?${qs}`)); } catch(e){res.status(responseStatus(e)).json({error:e.message});} });
  app.get('/api/trading/execution/positions', requireOwnerSession, async (req, res) => { try { const {qs}=executionQuery(req); res.json(await execution(`/api/execution/positions?${qs}`)); } catch(e){res.status(responseStatus(e)).json({error:e.message});} });
  app.get('/api/trading/execution/orders', requireOwnerSession, async (req, res) => { try { const {qs}=executionQuery(req); res.json(await execution(`/api/execution/orders?${qs}`)); } catch(e){res.status(responseStatus(e)).json({error:e.message});} });
  app.get('/api/trading/execution/history', requireOwnerSession, async (req, res) => { try { const qs=new URLSearchParams({broker:String(req.query.broker||'public')}); for(const key of ['accountId','start','end','pageSize','nextToken'])if(req.query[key])qs.set(key,String(req.query[key])); res.json(await execution(`/api/execution/history?${qs}`)); } catch(e){res.status(responseStatus(e)).json({error:e.message});} });
  app.get('/api/trading/execution/options/:symbol/expirations', requireOwnerSession, async (req,res)=>{try{const qs=new URLSearchParams({broker:String(req.query.broker||'public')});if(req.query.accountId)qs.set('accountId',String(req.query.accountId));if(req.query.instrumentType)qs.set('instrumentType',String(req.query.instrumentType));res.json(await execution(`/api/execution/options/${encodeURIComponent(req.params.symbol)}/expirations?${qs}`));}catch(e){res.status(responseStatus(e)).json({error:e.message});}});
  app.get('/api/trading/execution/options/:symbol/chain', requireOwnerSession, async (req,res)=>{try{if(!req.query.expirationDate)return res.status(400).json({error:'expirationDate is required'});const qs=new URLSearchParams({broker:String(req.query.broker||'public'),expirationDate:String(req.query.expirationDate)});if(req.query.accountId)qs.set('accountId',String(req.query.accountId));if(req.query.instrumentType)qs.set('instrumentType',String(req.query.instrumentType));res.json(await execution(`/api/execution/options/${encodeURIComponent(req.params.symbol)}/chain?${qs}`));}catch(e){res.status(responseStatus(e)).json({error:e.message});}});
  app.get('/api/trading/execution/orders/:orderId', requireOwnerSession, async (req,res)=>{try{const qs=new URLSearchParams({broker:String(req.query.broker||'public')});if(req.query.accountId)qs.set('accountId',String(req.query.accountId));res.json(await execution(`/api/execution/orders/${encodeURIComponent(req.params.orderId)}?${qs}`));}catch(e){res.status(responseStatus(e)).json({error:e.message});}});
  app.post('/api/trading/execution/orders/:orderId/cancel', requireOwnerSession, async (req,res)=>{try{res.json(await execution(`/api/execution/orders/${encodeURIComponent(req.params.orderId)}/cancel`,{method:'POST',body:req.body||{broker:'public'}}));}catch(e){res.status(responseStatus(e)).json({error:e.message});}});
  app.post('/api/trading/execution/orders/:orderId/replace', requireOwnerSession, async (req,res)=>{try{if(req.body?.confirmation!=='CONFIRM_LIVE_TRADE')return res.status(409).json({error:'Explicit live-trade confirmation required.'});res.json(await execution(`/api/execution/orders/${encodeURIComponent(req.params.orderId)}/replace`,{method:'POST',body:req.body}));}catch(e){res.status(responseStatus(e)).json({error:e.message});}});

  app.post('/api/trading/hybrid-journal/mcp/call', async (req, res) => {
    try {
      const { tool, arguments: args = {} } = req.body || {};
      if (!tool) return res.status(400).json({ error: 'tool is required' });
      if (EXECUTION_TOOLS.has(tool)) return res.status(403).json({ error: 'Execution-capable tools must use the gated trading endpoints.' });
      if (!READ_TOOLS.has(tool)) return res.status(403).json({ error: `Tool not allowlisted for generic use: ${tool}` });
      res.json({ result: await call(tool, args) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

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
