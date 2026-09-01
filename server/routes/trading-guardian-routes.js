import { evaluateGuardian, parseHybridAiAlert, SESSION_WINDOWS_ET, QQE_FACTORS, HYBRID_AI_ALERT_TYPES, AUTO_HYBRID_AI } from '../lib/trading-guardian-rules.js';
import {
  normalizeRichAlert,
  getTradingPlan,
  saveTradingPlan,
  compileTradingInstruction,
  evaluatePlanForAlert,
  createPaperOrder,
  listPaperOrders,
  closePaperOrder,
} from '../lib/juno-trading-engine.js';
import { brokerStatus, testBrokerConnection, routeDemoSignal } from '../lib/broker-router.js';

const PORT = () => process.env.PORT || 3005;
async function internal(path, { method = 'GET', body } = {}) {
  const r = await fetch(`http://127.0.0.1:${PORT()}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

function pickNumber(obj, paths = []) {
  for (const p of paths) {
    const v = p.split('.').reduce((x, k) => x?.[k], obj);
    if (Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
}
function pickText(obj, paths = []) {
  for (const p of paths) {
    const v = p.split('.').reduce((x, k) => x?.[k], obj);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

async function enrichGuardianInput(input, symbol, tools) {
  try {
    const qqe = await internal('/api/trading/hybrid-journal/briefing', { method: 'POST', body: { symbol, use_bible: true } });
    tools.push({ name: 'hybrid_journal.qqe', ok: true });
    input.qqeScore ??= pickNumber(qqe, ['score','qqe_score','briefing.score','result.score','data.score','structuredContent.score']);
    input.bias ??= pickText(qqe, ['bias','directional_bias','briefing.bias','result.bias','data.bias','structuredContent.bias']);
    input.vix ??= pickNumber(qqe, ['vix','briefing.vix','result.vix','data.vix','structuredContent.vix']);
    input.sweepOccurred ??= qqe?.sweep_occurred ?? qqe?.briefing?.sweep_occurred ?? qqe?.result?.sweep_occurred;
    input.reversalConfirmed ??= qqe?.reversal_confirmed ?? qqe?.briefing?.reversal_confirmed ?? qqe?.result?.reversal_confirmed;
  } catch (e) { tools.push({ name: 'hybrid_journal.qqe', ok: false, error: e.message }); }

  try {
    const snap = await internal('/api/trading/hybrid-journal/snapshot?limit=100');
    tools.push({ name: 'hybrid_journal.snapshot', ok: true });
    const latestSignal = snap?.signals?.[0] || snap?.latestSignal || snap?.data?.signals?.[0];
    input.signalGrade ??= latestSignal?.grade;
    input.confidence ??= latestSignal?.confidence ?? latestSignal?.confidence_score;
  } catch (e) { tools.push({ name: 'hybrid_journal.snapshot', ok: false, error: e.message }); }
}

function alertInput(body = {}) {
  if (body.alert && typeof body.alert === 'object') return body.alert;
  if (body.type || body.event || body.side || body.action) return body;
  return body.message || body.text || '';
}

export function registerTradingGuardianRoutes(app) {
  app.get('/api/trading/guardian/status', (req, res) => res.json({
    ok: true,
    advisoryOnly: true,
    liveExecutionAllowed: false,
    paperExecutionAllowed: true,
    junoTradingPlan: getTradingPlan(),
    brokers: brokerStatus(),
    sources: ['Auto Hybrid AI', 'Hybrid AI Supercator', 'AH-AI QQE', 'MNQ Trading Bible', 'Hybrid Journal MCP when configured'],
    autoHybridAi: AUTO_HYBRID_AI,
    sessionWindows: SESSION_WINDOWS_ET,
    qqeFactors: QQE_FACTORS,
    hybridAiAlertTypes: HYBRID_AI_ALERT_TYPES,
    preferredWebhook: {
      format: 'JSON',
      fields: ['signal_id','strategy_id','strategy_version','action','ticker','tf','price','score','grade','sl','tp1','tp2','tp3','adx','tenkan','kijun','sma','atr','regime','cloud','mtf','volume_ok','confirmed'],
      note: 'TradingView defines the setup. Juno applies the active plan and account rules. Only PAPER/DEMO broker routing is automatic.'
    }
  }));

  app.get('/api/trading/juno/brokers', (req, res) => res.json(brokerStatus()));

  app.post('/api/trading/juno/brokers/:accountId/test', async (req, res) => {
    try {
      const result = await testBrokerConnection(String(req.params.accountId || '').toUpperCase());
      res.status(result.ok ? 200 : 422).json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/trading/juno/plan', (req, res) => {
    res.json({ ok: true, plan: getTradingPlan() });
  });

  app.post('/api/trading/juno/plan/compile', (req, res) => {
    try {
      const text = req.body?.text || req.body?.message || req.body?.instruction || '';
      if (!String(text).trim()) return res.status(400).json({ ok: false, error: 'instruction text is required' });
      const compiled = compileTradingInstruction(text);
      const applied = req.body?.apply === true ? saveTradingPlan(compiled.patch) : null;
      res.json({ ok: true, ...compiled, applied });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.patch('/api/trading/juno/plan', (req, res) => {
    try { res.json({ ok: true, plan: saveTradingPlan(req.body || {}) }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/trading/juno/arm', (req, res) => {
    try {
      const enabled = req.body?.enabled !== false;
      const mode = String(req.body?.mode || 'PAPER').toUpperCase();
      if (mode !== 'PAPER') return res.status(403).json({ ok: false, error: 'Live execution is not enabled. Arm PAPER/DEMO first.' });
      const patch = { enabled, mode: 'PAPER' };
      if (Array.isArray(req.body?.targetAccounts)) patch.targetAccounts = req.body.targetAccounts;
      res.json({ ok: true, plan: saveTradingPlan(patch), brokers: brokerStatus() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/trading/juno/paper/orders', (req, res) => {
    try { res.json({ ok: true, orders: listPaperOrders(req.query.limit || 100) }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/trading/juno/paper/orders/:id/close', (req, res) => {
    try {
      const order = closePaperOrder(req.params.id, req.body || {});
      if (!order) return res.status(404).json({ ok: false, error: 'paper order not found' });
      res.json({ ok: true, order });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/trading/guardian/parse-alert', (req, res) => {
    const alert = parseHybridAiAlert(alertInput(req.body));
    const richAlert = normalizeRichAlert(req.body || {}, alert);
    res.status(alert.type === 'UNKNOWN' && !richAlert.direction ? 422 : 200).json({ ok: alert.type !== 'UNKNOWN' || !!richAlert.direction, alert, richAlert });
  });

  app.post('/api/trading/guardian/alert', async (req, res) => {
    try {
      const parsed = parseHybridAiAlert(alertInput(req.body));
      const richAlert = normalizeRichAlert(req.body || {}, parsed);
      if (parsed.type === 'UNKNOWN' && !richAlert.direction) return res.status(422).json({ ok: false, error: 'Unrecognized Hybrid AI alert', alert: parsed });
      const symbol = richAlert.symbol || String(req.body?.symbol || parsed.symbol || 'MNQ').toUpperCase();
      const input = { ...(req.body || {}), symbol, alert: parsed };
      input.signalGrade ??= richAlert.grade;
      input.confidence ??= richAlert.score;
      input.adx ??= richAlert.adx;
      input.tenkan ??= richAlert.tenkan;
      input.kijun ??= richAlert.kijun;
      input.sma ??= richAlert.sma;
      input.atr ??= richAlert.atr;
      const tools = [];
      if (req.body?.enrich !== false && ['AUTO_BUY_CANDIDATE','AUTO_SELL_CANDIDATE'].includes(parsed.type)) await enrichGuardianInput(input, symbol, tools);
      const guardian = evaluateGuardian(input);
      const plan = getTradingPlan();
      const planEvaluation = evaluatePlanForAlert(richAlert, plan);
      const paper = req.body?.paper === false ? { placed: false, skipped: true } : createPaperOrder(richAlert, plan, planEvaluation);
      let brokerRouting = { ok: true, attempted: 0, succeeded: 0, results: [] };
      if (paper?.placed && req.body?.routeBrokers !== false) {
        const targets = (plan.targetAccounts || []).filter(id => id !== 'JUNO_DEMO');
        brokerRouting = await routeDemoSignal(richAlert, targets);
      }
      res.json({ ok: true, symbol, alert: parsed, richAlert, guardian, plan, planEvaluation, paper, brokerRouting, inputs: input, tools });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/trading/guardian/evaluate', async (req, res) => {
    try {
      const input = { ...(req.body || {}) };
      const enrich = req.body?.enrich !== false;
      const parsed = input.alert ? parseHybridAiAlert(input.alert) : null;
      if (parsed && parsed.type !== 'UNKNOWN') input.alert = parsed;
      const richAlert = normalizeRichAlert(req.body || {}, parsed || {});
      const symbol = richAlert.symbol || String(req.body?.symbol || parsed?.symbol || 'MNQ').toUpperCase();
      const tools = [];
      if (enrich) await enrichGuardianInput(input, symbol, tools);
      const guardian = evaluateGuardian(input);
      const plan = getTradingPlan();
      const planEvaluation = evaluatePlanForAlert(richAlert, plan);
      res.json({ ok: true, symbol, richAlert, guardian, plan, planEvaluation, brokers: brokerStatus(), inputs: input, tools });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

export default registerTradingGuardianRoutes;
