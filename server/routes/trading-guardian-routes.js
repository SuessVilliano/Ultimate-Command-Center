import { evaluateGuardian, SESSION_WINDOWS_ET, QQE_FACTORS } from '../lib/trading-guardian-rules.js';

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

export function registerTradingGuardianRoutes(app) {
  app.get('/api/trading/guardian/status', (req, res) => res.json({
    ok: true,
    advisoryOnly: true,
    executionAllowed: false,
    sources: ['MNQ Trading Bible', 'QQE Framework', 'Hybrid Journal MCP when configured'],
    sessionWindows: SESSION_WINDOWS_ET,
    qqeFactors: QQE_FACTORS,
  }));

  app.post('/api/trading/guardian/evaluate', async (req, res) => {
    try {
      const input = { ...(req.body || {}) };
      const enrich = req.body?.enrich !== false;
      const symbol = String(req.body?.symbol || 'MNQ').toUpperCase();
      const tools = [];
      if (enrich) {
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
      const guardian = evaluateGuardian(input);
      res.json({ ok: true, symbol, guardian, inputs: input, tools });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

export default registerTradingGuardianRoutes;
