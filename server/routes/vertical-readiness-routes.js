const PORT = () => process.env.PORT || 3005;

async function probe(path, { method = 'GET', body, timeout = 3500 } = {}) {
  const started = Date.now();
  try {
    const r = await fetch(`http://127.0.0.1:${PORT()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { text: text.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, ms: Date.now() - started, data };
  } catch (error) {
    return { ok: false, status: 0, ms: Date.now() - started, error: error?.message || 'probe failed' };
  }
}

function env(...names) { return names.some(n => Boolean(process.env[n])); }
function result(id, label, probeResult, configured = true, mode = 'cloud-or-local', note = '') {
  const routeHealthy = Boolean(probeResult?.ok);
  let state = routeHealthy && configured ? 'READY' : routeHealthy ? 'DEGRADED' : 'FAILED';
  if (routeHealthy && mode === 'local-only' && !configured) state = 'LOCAL-ONLY';
  return { id, label, state, configured, mode, routeHealthy, probe: probeResult, note };
}

export function registerVerticalReadinessRoutes(app) {
  app.get('/api/system/verticals', async (req, res) => {
    const [health, oura, trading, guardian, nifty, mcp, ai, calendar, integrations, memory, shortcut] = await Promise.all([
      probe('/api/hs/health/snapshot'),
      probe('/api/hs/health/oura/snapshot'),
      probe('/api/trading/hybrid-journal/status'),
      probe('/api/trading/guardian/status'),
      probe('/api/nifty/mcp/status'),
      probe('/api/mcp/status'),
      probe('/api/ai/local/status'),
      probe('/api/calendar/upcoming?hours=24'),
      probe('/api/integrations/status'),
      probe('/api/memory/vault/stats'),
      probe('/api/shortcut/voice'),
    ]);

    const rows = [
      result('health', 'Health OS', health, env('OURA_ACCESS_TOKEN','APPLE_HEALTH_INGEST_TOKEN'), 'cloud-or-local', 'Oura direct + Apple Health push bridge.'),
      result('oura', 'Oura', oura, env('OURA_ACCESS_TOKEN'), 'cloud', 'Detailed Oura recovery/sleep/activity metrics.'),
      result('trading', 'Hybrid Journal', trading, env('HYBRID_JOURNAL_MCP_URL','HYBRID_JOURNAL_API_KEY'), 'cloud', 'Canonical trades, signals, journal and trading intelligence.'),
      result('guardian', 'Trading Guardian', guardian, true, 'local', 'Bible + QQE + Hybrid AI qualification layer; advisory only.'),
      result('nifty', 'Nifty', nifty, env('NIFTY_MCP_URL','NIFTY_ACCESS_TOKEN'), 'cloud', 'Projects, tasks and team conversations.'),
      result('mcp', 'Mac Workspace MCP', mcp, env('LOCAL_WORKSPACE_ROOTS'), 'local-only', 'Allow-listed file search/read/write. Never exposes shell or secrets.'),
      result('local-ai', 'Juno Local AI', ai, env('OLLAMA_BASE_URL') || process.env.NODE_ENV !== 'production', 'local-only', 'Ollama/Qwen on the Mac Mini.'),
      result('calendar', 'Calendar', calendar, env('GOOGLE_CALENDAR_EMAIL'), 'cloud', 'Time intelligence and upcoming commitments.'),
      result('ghl', 'GHL / Integrations', integrations, env('GHL_API_KEY','GHL_LOCATION_ID'), 'cloud', 'CRM/affiliate/client operating layer.'),
      result('memory', 'Memory Vault', memory, true, 'local', 'Structured LLM and operator memory.'),
      result('voice', 'Voice / Shortcut', shortcut, env('LIV8_SHORTCUT_TOKEN','APPLE_HEALTH_INGEST_TOKEN'), 'cloud', 'Hands-free capture and routing.'),
      { id: 'creator', label: 'Creator Control Room', state: (process.env.CLIPPEDIT_URL || process.env.OBS_REMOTE_URL) ? 'READY' : 'DEGRADED', configured: Boolean(process.env.CLIPPEDIT_URL || process.env.OBS_REMOTE_URL), mode: 'app-embed', routeHealthy: true, note: 'Clippedit + OBS Remote compartments. URLs can also be supplied by VITE env vars.' },
      { id: 'agents', label: 'Agent Hierarchy', state: 'READY', configured: true, mode: 'local', routeHealthy: true, note: 'Juno → lead agents → specialist workers; writes remain policy-gated.' },
    ];

    const counts = rows.reduce((a, x) => { a[x.state] = (a[x.state] || 0) + 1; return a; }, {});
    res.json({ ok: !rows.some(x => x.state === 'FAILED'), generatedAt: new Date().toISOString(), counts, verticals: rows });
  });

  app.get('/api/system/verticals/:id', async (req, res) => {
    const r = await fetch(`http://127.0.0.1:${PORT()}/api/system/verticals`, { signal: AbortSignal.timeout(10000) });
    const data = await r.json();
    const row = data.verticals.find(v => v.id === req.params.id);
    if (!row) return res.status(404).json({ error: 'Unknown vertical' });
    res.json(row);
  });

  console.log('Vertical readiness diagnostics registered');
}

export default registerVerticalReadinessRoutes;
