import * as appleHealth from '../lib/apple-health-adapter.js';

function bearer(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-health-token'] || '');
}

export function registerAppleHealthRoutes(app) {
  app.get('/api/hs/health/apple/status', (req, res) => {
    try { res.json(appleHealth.snapshot()); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/hs/health/apple/history', (req, res) => {
    try { res.json({ rows: appleHealth.history(req.query.days || 30) }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/hs/health/apple/ingest', (req, res) => {
    try {
      if (!appleHealth.isConfigured()) {
        return res.status(503).json({ error: 'APPLE_HEALTH_INGEST_TOKEN is not configured' });
      }
      if (!appleHealth.authorize(bearer(req))) {
        return res.status(401).json({ error: 'Unauthorized Apple Health bridge' });
      }
      res.json({ ok: true, source: 'apple_health', snapshot: appleHealth.ingest(req.body || {}) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
}

export default registerAppleHealthRoutes;
