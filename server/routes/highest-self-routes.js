/**
 * Highest Self OS - REST routes
 *
 * All endpoints are read/draft-only. Nothing here mutates an external system.
 * The trading-alert webhook only RECORDS incoming alerts; it never places orders.
 */

import * as hs from '../lib/highest-self-db.js';

const today = () => new Date().toISOString().slice(0, 10);

export function registerHighestSelfRoutes(app) {
  const ok = (res, data) => res.json({ ok: true, ...data });
  const fail = (res, e) => res.status(500).json({ ok: false, error: e.message });

  // ---------- MIND MAP ----------
  app.get('/api/hs/graph', (req, res) => {
    try { res.json(hs.getGraph()); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/notes', (req, res) => {
    try { res.json(hs.createNote(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.put('/api/hs/notes/:id', (req, res) => {
    try { res.json(hs.updateNote(+req.params.id, req.body || {})); } catch (e) { fail(res, e); }
  });
  app.delete('/api/hs/notes/:id', (req, res) => {
    try { res.json(hs.deleteNote(+req.params.id)); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/links', (req, res) => {
    try {
      const { from_id, to_id, relationship, strength } = req.body || {};
      res.json(hs.linkNotes(+from_id, +to_id, relationship, strength));
    } catch (e) { fail(res, e); }
  });
  app.delete('/api/hs/links/:id', (req, res) => {
    try { res.json(hs.unlinkNotes(+req.params.id)); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/master-plans', (req, res) => {
    try { res.json(hs.createMasterPlan(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.put('/api/hs/master-plans/:id', (req, res) => {
    try { res.json(hs.updateMasterPlan(+req.params.id, req.body || {})); } catch (e) { fail(res, e); }
  });
  app.delete('/api/hs/master-plans/:id', (req, res) => {
    try { res.json(hs.deleteMasterPlan(+req.params.id)); } catch (e) { fail(res, e); }
  });

  // ---------- SELF / TODAY ----------
  app.get('/api/hs/intention', (req, res) => {
    try { res.json(hs.getIntention(req.query.date || today()) || {}); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/intention', (req, res) => {
    try { res.json(hs.upsertIntention(req.body?.date || today(), req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/reflection', (req, res) => {
    try { res.json(hs.getReflection(req.query.date || today()) || {}); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/reflection', (req, res) => {
    try { res.json(hs.upsertReflection(req.body?.date || today(), req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/hour-of-me', (req, res) => {
    try { res.json(hs.getHourOfMe(req.query.date || today()) || {}); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/hour-of-me', (req, res) => {
    try { res.json(hs.upsertHourOfMe(req.body?.date || today(), req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/weekly-review', (req, res) => {
    try { res.json(hs.getWeeklyReview(req.query.week_start) || {}); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/weekly-review', (req, res) => {
    try { res.json(hs.upsertWeeklyReview(req.body?.week_start, req.body || {})); } catch (e) { fail(res, e); }
  });

  // ---------- TRADING (alert adherence) ----------
  // Webhook: RECORD an incoming alert (Hybrid AI / Auto Hybrid AI / TradingView).
  // Accepts a flexible payload and normalizes it. NEVER places an order.
  app.post('/api/hs/trading/webhook', (req, res) => {
    try {
      const b = req.body || {};
      const alert = hs.addAlert({
        source: b.source || b.strategy || 'hybrid_ai',
        symbol: b.symbol || b.ticker,
        setup_type: b.setup || b.setup_type || b.type,
        level: b.level ?? b.price,
        direction: b.direction || b.side || b.action,
        timeframe: b.timeframe || b.tf,
        message: b.message || b.comment || JSON.stringify(b).slice(0, 500),
        status: 'fired',
      });
      res.json({ ok: true, recorded: alert, note: 'Alert recorded. No order placed (draft-only).' });
    } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/trading/alerts', (req, res) => {
    try { res.json(hs.listAlerts(+(req.query.limit || 100))); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/trading/alerts', (req, res) => {
    try { res.json(hs.addAlert(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.patch('/api/hs/trading/alerts/:id', (req, res) => {
    try { res.json(hs.setAlertStatus(+req.params.id, req.body?.status, req.body?.linked_trade_id ?? null)); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/trading/trades', (req, res) => {
    try { res.json(hs.listTrades(+(req.query.limit || 200))); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/trading/trades', (req, res) => {
    try { res.json(hs.addTrade(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/trading/adherence', (req, res) => {
    try { res.json(hs.tradingAdherence(+(req.query.days || 30))); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/trading/day', (req, res) => {
    try { res.json(hs.getTradingDay(req.query.date || today()) || {}); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/trading/day', (req, res) => {
    try { res.json(hs.upsertTradingDay(req.body?.date || today(), req.body || {})); } catch (e) { fail(res, e); }
  });

  // ---------- HEALTH (recomposition + labs) ----------
  app.get('/api/hs/health/snapshot', (req, res) => {
    try { res.json(hs.healthSnapshot()); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/health/plan', (req, res) => {
    try { res.json(hs.getHealthPlan()); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/health/plan', (req, res) => {
    try { res.json(hs.upsertHealthPlan(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/health/metrics', (req, res) => {
    try { res.json(hs.listBodyMetrics(+(req.query.limit || 120))); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/health/metrics', (req, res) => {
    try { res.json(hs.addBodyMetric(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/health/labs', (req, res) => {
    try { res.json(hs.listLabs(+(req.query.limit || 300))); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/health/labs', (req, res) => {
    try { res.json(hs.addLab(req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get('/api/hs/health/daily', (req, res) => {
    try { res.json(hs.getHealthDaily(req.query.date || today()) || {}); } catch (e) { fail(res, e); }
  });
  app.post('/api/hs/health/daily', (req, res) => {
    try { res.json(hs.upsertHealthDaily(req.body?.date || today(), req.body || {})); } catch (e) { fail(res, e); }
  });

  console.log('Highest Self OS: routes registered (/api/hs/*)');
}
