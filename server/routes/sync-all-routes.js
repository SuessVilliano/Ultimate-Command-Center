const PORT = process.env.PORT || 3005;
const BASE = `http://127.0.0.1:${PORT}`;

async function call(path, { method = 'GET', body } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
    return { ok: res.ok, status: res.status, ms: Date.now() - started, data };
  } catch (error) {
    return { ok: false, status: 0, ms: Date.now() - started, error: error?.message || 'request failed' };
  }
}

export function registerSyncAllRoutes(app) {
  app.get('/api/sync/status', (req, res) => {
    res.json({
      ok: true,
      endpoint: '/api/sync/all',
      sources: ['oura', 'apple_health_cache', 'nifty', 'hybrid_journal', 'command_intelligence'],
      note: 'Apple Health itself is push-based: the iPhone Shortcut sends fresh HealthKit data into /api/hs/health/apple/ingest. Sync All refreshes everything the server can pull immediately.'
    });
  });

  app.post('/api/sync/all', async (req, res) => {
    const startedAt = new Date().toISOString();
    const days = Math.max(1, Math.min(Number(req.body?.days || 14), 90));

    // Phase 1: source syncs that may update local Command Center state.
    const [oura, nifty, hybrid] = await Promise.all([
      call('/api/hs/health/oura/sync', { method: 'POST', body: { days } }),
      call('/api/nifty/mcp/sync-inbox', { method: 'POST', body: { limit: 150 } }),
      call('/api/trading/hybrid-journal/snapshot?limit=150'),
    ]);

    // Phase 2: re-read derived/live views after source syncs complete.
    const [health, intelligence, shortcut] = await Promise.all([
      call(`/api/hs/health/metrics/live?days=${days}`),
      call('/api/intelligence/period', {
        method: 'POST',
        body: { period: 'today', goals: req.body?.goals || [], todayFocus: req.body?.todayFocus || null, completedToday: req.body?.completedToday || [] }
      }),
      call('/api/shortcut/status'),
    ]);

    const results = { oura, nifty, hybrid_journal: hybrid, health, intelligence, shortcut };
    const succeeded = Object.entries(results).filter(([, v]) => v?.ok).map(([k]) => k);
    const failed = Object.entries(results).filter(([, v]) => !v?.ok).map(([k, v]) => ({ source: k, status: v?.status || 0, error: v?.error || v?.data?.error || 'unavailable' }));

    res.status(succeeded.length ? 200 : 503).json({
      ok: succeeded.length > 0,
      startedAt,
      completedAt: new Date().toISOString(),
      succeeded,
      failed,
      appleHealth: {
        pullableFromServer: false,
        shortcutConfigured: !!shortcut?.data?.configured,
        note: 'Run the LIV8 iPhone Shortcut to push fresh Apple Health data. Oura direct and all other pullable systems update from this button.'
      },
      results
    });
  });
}

export default registerSyncAllRoutes;
