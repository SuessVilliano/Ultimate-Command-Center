/**
 * Highest Self OS - REST routes
 *
 * All endpoints are read/draft-only. Nothing here mutates an external system.
 * The trading-alert webhook only RECORDS incoming alerts; it never places orders.
 */

import * as hs from '../lib/highest-self-db.js';
import * as oura from '../lib/oura-adapter.js';
import * as hybridJournal from '../lib/hybrid-journal-adapter.js';
import * as githubPortfolio from '../lib/github-portfolio.js';

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

  // ---------- FAMILY ----------
  app.get('/api/hs/family/people', (req, res) => { try { res.json(hs.listPeople()); } catch (e) { fail(res, e); } });
  app.post('/api/hs/family/people', (req, res) => { try { res.json(hs.addPerson(req.body || {})); } catch (e) { fail(res, e); } });
  app.put('/api/hs/family/people/:id', (req, res) => { try { res.json(hs.updatePerson(+req.params.id, req.body || {})); } catch (e) { fail(res, e); } });
  app.delete('/api/hs/family/people/:id', (req, res) => { try { res.json(hs.deletePerson(+req.params.id)); } catch (e) { fail(res, e); } });

  app.get('/api/hs/family/protected', (req, res) => { try { res.json(hs.listProtectedDates()); } catch (e) { fail(res, e); } });
  app.post('/api/hs/family/protected', (req, res) => { try { res.json(hs.addProtectedDate(req.body || {})); } catch (e) { fail(res, e); } });
  app.put('/api/hs/family/protected/:id', (req, res) => { try { res.json(hs.updateProtectedDate(+req.params.id, req.body || {})); } catch (e) { fail(res, e); } });
  app.delete('/api/hs/family/protected/:id', (req, res) => { try { res.json(hs.deleteProtectedDate(+req.params.id)); } catch (e) { fail(res, e); } });

  app.get('/api/hs/family/events', (req, res) => { try { res.json(hs.listFamilyEvents()); } catch (e) { fail(res, e); } });
  app.post('/api/hs/family/events', (req, res) => { try { res.json(hs.addFamilyEvent(req.body || {})); } catch (e) { fail(res, e); } });
  app.delete('/api/hs/family/events/:id', (req, res) => { try { res.json(hs.deleteFamilyEvent(+req.params.id)); } catch (e) { fail(res, e); } });

  app.get('/api/hs/family/horizon', (req, res) => { try { res.json(hs.familyHorizon(+(req.query.days || 120))); } catch (e) { fail(res, e); } });

  // ---------- OURA (read-only health provider) ----------
  app.get('/api/hs/health/oura/status', (req, res) => { res.json({ configured: oura.isConfigured() }); });
  app.get('/api/hs/health/oura/snapshot', async (req, res) => { try { res.json(await oura.snapshot()); } catch (e) { fail(res, e); } });
  app.post('/api/hs/health/oura/sync', async (req, res) => {
    try { res.json(await oura.syncToHealthDaily({ days: +(req.body?.days || 14) })); } catch (e) { fail(res, e); }
  });

  // ---------- HYBRID JOURNAL trade import (bulk, draft-only) ----------
  // Accepts an array of trades exported from Hybrid Journal and records them
  // for adherence analysis. Never executes anything.
  app.post('/api/hs/trading/import', (req, res) => {
    try {
      const rows = Array.isArray(req.body) ? req.body : (req.body?.trades || []);
      const saved = rows.map(t => hs.addTrade({
        symbol: t.symbol || t.ticker, direction: t.direction || t.side,
        entry: t.entry ?? t.entry_price, exit: t.exit ?? t.exit_price, size: t.size ?? t.qty,
        pnl: t.pnl ?? t.profit, setup_type: t.setup || t.setup_type,
        on_setup: t.on_setup ?? (t.setup ? 1 : 0), followed_plan: t.followed_plan ?? 0,
        journal_ref: t.id || t.journal_ref || t.ref, notes: t.notes || '',
      }));
      res.json({ ok: true, imported: saved.length });
    } catch (e) { fail(res, e); }
  });

  // ---------- WEALTH / CREATION ----------
  app.get('/api/hs/projects', (req, res) => { try { res.json(hs.projectsOverview()); } catch (e) { fail(res, e); } });
  app.post('/api/hs/projects', (req, res) => { try { res.json(hs.addProject(req.body || {})); } catch (e) { fail(res, e); } });
  app.put('/api/hs/projects/:id', (req, res) => { try { res.json(hs.updateProject(+req.params.id, req.body || {})); } catch (e) { fail(res, e); } });
  app.delete('/api/hs/projects/:id', (req, res) => { try { res.json(hs.deleteProject(+req.params.id)); } catch (e) { fail(res, e); } });
  app.get('/api/hs/projects/cap', (req, res) => { try { res.json({ cap: +(hs.getSetting('active_project_cap', '4')) }); } catch (e) { fail(res, e); } });
  app.post('/api/hs/projects/cap', (req, res) => { try { res.json(hs.setSetting('active_project_cap', +(req.body?.cap || 4))); } catch (e) { fail(res, e); } });

  app.get('/api/hs/ideas', (req, res) => { try { res.json(hs.listIdeas()); } catch (e) { fail(res, e); } });
  app.post('/api/hs/ideas', (req, res) => { try { res.json(hs.addIdea(req.body || {})); } catch (e) { fail(res, e); } });
  app.put('/api/hs/ideas/:id', (req, res) => { try { res.json(hs.updateIdea(+req.params.id, req.body || {})); } catch (e) { fail(res, e); } });
  app.delete('/api/hs/ideas/:id', (req, res) => { try { res.json(hs.deleteIdea(+req.params.id)); } catch (e) { fail(res, e); } });
  app.post('/api/hs/ideas/:id/promote', (req, res) => { try { res.json(hs.promoteIdea(+req.params.id, req.body || {})); } catch (e) { fail(res, e); } });

  // Sync GitHub repos into projects (commit activity != strategic value).
  app.post('/api/hs/projects/sync-github', async (req, res) => {
    try {
      const portfolio = await githubPortfolio.getPortfolio(req.body?.refresh === true);
      const repos = portfolio?.repos || portfolio?.projects || portfolio?.items || [];
      const result = hs.upsertProjectsFromRepos(repos);
      res.json({ ok: true, ...result, source: 'github' });
    } catch (e) { fail(res, e); }
  });

  // ---------- TODAY (aggregated glance) ----------
  app.get('/api/hs/today', (req, res) => { try { res.json(hs.todayBrief(req.query.date)); } catch (e) { fail(res, e); } });

  // ---------- HYBRID JOURNAL (read-only import) ----------
  app.get('/api/hs/trading/hybrid-journal/status', (req, res) => { res.json(hybridJournal.status()); });
  app.post('/api/hs/trading/hybrid-journal/sync', async (req, res) => {
    try { res.json(await hybridJournal.sync({ limit: +(req.body?.limit || 200) })); } catch (e) { fail(res, e); }
  });

  console.log('Highest Self OS: routes registered (/api/hs/*)');
}
