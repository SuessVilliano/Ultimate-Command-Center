/**
 * Highest Self OS - Data Layer
 *
 * Additive persistence for the Highest Self OS feature set. Every table is new
 * (prefix `hs_`) and created with CREATE TABLE IF NOT EXISTS, so this never
 * touches or migrates existing Command Center tables.
 *
 * Domains covered:
 *  - Mind Map: notes (web nodes) + links + master plans
 *  - Self / Today: intentions, reflections, hour-of-me, weekly reviews
 *  - Trading: alert-adherence (alerts + trade log linked to setups)
 *  - Health: body metrics, labs, daily health log, recomposition plan
 *
 * Safety: read/draft-only. Nothing here writes to any external system.
 */

import * as db from './database.js';

function getDb() {
  const instance = db.getDb ? db.getDb() : null;
  if (!instance) throw new Error('SQLite not available for Highest Self OS');
  return instance;
}

/** Create all Highest Self tables (idempotent). */
export function initHighestSelfTables() {
  const d = db.getDb ? db.getDb() : null;
  if (!d) { console.warn('Highest Self OS: SQLite unavailable, tables skipped'); return; }
  d.exec(`
    -- ===== MIND MAP =====
    CREATE TABLE IF NOT EXISTS hs_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      node_type TEXT DEFAULT 'note',      -- note | domain | idea | project | plan
      domain TEXT DEFAULT 'self',         -- self | family | health | wealth | creation
      status TEXT DEFAULT 'active',       -- active | parked | archived | idea | research | validated
      x REAL, y REAL,                     -- optional saved layout position
      color TEXT,
      pinned INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_note_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL,
      to_id INTEGER NOT NULL,
      relationship TEXT DEFAULT 'related',
      strength REAL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_master_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      domain TEXT DEFAULT 'self',
      note_ids_json TEXT DEFAULT '[]',
      milestones_json TEXT DEFAULT '[]',  -- [{id,title,done,due}]
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== SELF / TODAY =====
    CREATE TABLE IF NOT EXISTS hs_intentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      identity TEXT DEFAULT '',
      top_outcomes_json TEXT DEFAULT '[]',
      trading_rule TEXT DEFAULT '',
      health_commitment TEXT DEFAULT '',
      family_commitment TEXT DEFAULT '',
      not_doing TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      went_well TEXT DEFAULT '',
      did_not TEXT DEFAULT '',
      alignment INTEGER DEFAULT 0,        -- 0..100 highest-self alignment
      evidence_json TEXT DEFAULT '[]',
      adjustment TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_hour_of_me (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      blocks_json TEXT DEFAULT '{}',      -- {mind:{done,min}, identity:{}, body:{}, knowledge:{}}
      total_minutes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_weekly_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT UNIQUE NOT NULL,
      self_review TEXT DEFAULT '',
      health_review TEXT DEFAULT '',
      family_review TEXT DEFAULT '',
      trading_review TEXT DEFAULT '',
      wealth_review TEXT DEFAULT '',
      top_three_json TEXT DEFAULT '[]',
      theme TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_work_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      days_json TEXT DEFAULT '[]',        -- ["Tue","Wed","Thu","Fri","Sat"]
      start_time TEXT DEFAULT '09:00',
      end_time TEXT DEFAULT '17:00',
      timezone TEXT DEFAULT 'America/New_York',
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== TRADING (alert adherence) =====
    CREATE TABLE IF NOT EXISTS hs_trade_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'hybrid_ai',    -- hybrid_ai | auto_hybrid_ai | tradingview | telegram | manual
      symbol TEXT,
      setup_type TEXT,                    -- e.g. order_block, fvg, bias_break
      level REAL,
      direction TEXT,                     -- long | short
      timeframe TEXT,
      message TEXT DEFAULT '',
      status TEXT DEFAULT 'fired',        -- fired | prepared | taken | skipped | expired
      linked_trade_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      symbol TEXT,
      direction TEXT,
      entry REAL, exit REAL, size REAL,
      pnl REAL,
      setup_type TEXT,
      alert_id INTEGER,                   -- links to hs_trade_alerts.id if on-setup
      on_setup INTEGER DEFAULT 0,         -- 1 = matched a valid alert/setup, 0 = discretionary/random
      followed_plan INTEGER DEFAULT 0,
      journal_ref TEXT,                   -- Hybrid Journal reference
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_trading_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      day_type TEXT DEFAULT '',           -- no_trade | setup | execute | review
      bias TEXT DEFAULT '',
      levels_json TEXT DEFAULT '[]',
      process_score INTEGER DEFAULT 0,
      pnl REAL,
      rule_violations_json TEXT DEFAULT '[]',
      closed_at TEXT,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== HEALTH (recomposition + labs) =====
    CREATE TABLE IF NOT EXISTS hs_body_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight REAL, body_fat REAL, muscle_mass REAL,
      waist REAL, resting_hr INTEGER,
      notes TEXT DEFAULT '',
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_labs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      marker TEXT NOT NULL,               -- total_cholesterol | ldl | hdl | triglycerides | ferritin | hemoglobin | ...
      value REAL,
      unit TEXT DEFAULT '',
      target REAL,
      goal_direction TEXT DEFAULT 'lower', -- lower | higher | range
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_health_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      movement_min INTEGER DEFAULT 0,
      strength INTEGER DEFAULT 0,         -- did a strength session (0/1)
      mobility_min INTEGER DEFAULT 0,
      meditation_min INTEGER DEFAULT 0,
      protein_g INTEGER DEFAULT 0,
      hydration INTEGER DEFAULT 0,
      readiness INTEGER,                  -- from Oura when available
      energy INTEGER,
      notes TEXT DEFAULT '',
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_health_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      focus TEXT DEFAULT 'recomposition',
      targets_json TEXT DEFAULT '{}',     -- {ideal_weight, target_bf, protein_g, ...}
      training_json TEXT DEFAULT '[]',    -- weekly split
      nutrition_json TEXT DEFAULT '[]',   -- principles
      active INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== FAMILY =====
    CREATE TABLE IF NOT EXISTS hs_people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      relationship TEXT DEFAULT 'child',  -- child | self | parent | partner | other
      birthday_month INTEGER,
      birthday_day INTEGER,
      school_name TEXT DEFAULT '',
      grade TEXT DEFAULT '',
      city TEXT DEFAULT '',
      lives_with INTEGER DEFAULT 0,
      color TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_protected_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER,
      title TEXT NOT NULL,
      event_type TEXT DEFAULT 'birthday', -- birthday | holiday | tradition | special | anchor
      month INTEGER, day INTEGER,
      recurring INTEGER DEFAULT 1,
      protection_level TEXT DEFAULT 'soft', -- hard | soft | flexible
      travel_required INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_family_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER,                  -- null = all-kids / general
      title TEXT NOT NULL,
      event_type TEXT DEFAULT 'school_off', -- school_off | long_weekend | holiday | all_kids | visit | travel | pickup
      date_start TEXT NOT NULL,
      date_end TEXT,
      source TEXT DEFAULT 'manual',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ===== WEALTH / CREATION =====
    CREATE TABLE IF NOT EXISTS hs_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      domain TEXT DEFAULT 'wealth',       -- wealth | creation
      strategic_type TEXT DEFAULT 'cash_flow', -- cash_flow | asset | moonshot
      operating_state TEXT DEFAULT 'idea', -- active | maintenance | parked | idea | archived
      repo_url TEXT DEFAULT '',
      website_url TEXT DEFAULT '',
      monthly_cost REAL,
      current_revenue REAL,
      recurring_revenue REAL,
      next_milestone TEXT DEFAULT '',
      last_activity TEXT,
      why TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      stage TEXT DEFAULT 'idea',          -- idea | research | validated | project | active
      domain TEXT DEFAULT 'creation',
      problem TEXT DEFAULT '',
      audience TEXT DEFAULT '',
      evidence TEXT DEFAULT '',
      business_model TEXT DEFAULT '',
      strategic_type TEXT DEFAULT 'moonshot',
      estimated_effort TEXT DEFAULT '',
      next_validation_step TEXT DEFAULT '',
      source TEXT DEFAULT 'manual',
      promoted_project_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hs_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  seedFamilyIfEmpty();
  seedProjectsIfEmpty();
  console.log('Highest Self OS: tables initialized');
}

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */
const now = () => new Date().toISOString();

function all(sql, params = []) { return getDb().prepare(sql).all(...params); }
function one(sql, params = []) { return getDb().prepare(sql).get(...params); }
function run(sql, params = []) { return getDb().prepare(sql).run(...params); }

/* ------------------------------------------------------------------ */
/* MIND MAP                                                            */
/* ------------------------------------------------------------------ */
export function getGraph() {
  const notes = all('SELECT * FROM hs_notes ORDER BY id');
  const links = all('SELECT * FROM hs_note_links');
  const plans = all('SELECT * FROM hs_master_plans ORDER BY updated_at DESC');
  return { notes, links, plans };
}

export function createNote(n = {}) {
  const r = run(
    `INSERT INTO hs_notes (title, body, node_type, domain, status, x, y, color, pinned, source, metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [n.title || 'Untitled', n.body || '', n.node_type || 'note', n.domain || 'self',
     n.status || 'active', n.x ?? null, n.y ?? null, n.color || null, n.pinned ? 1 : 0,
     n.source || 'manual', JSON.stringify(n.metadata || {})]
  );
  return one('SELECT * FROM hs_notes WHERE id = ?', [r.lastInsertRowid]);
}

export function updateNote(id, patch = {}) {
  const cur = one('SELECT * FROM hs_notes WHERE id = ?', [id]);
  if (!cur) return null;
  const m = { ...cur, ...patch };
  run(
    `UPDATE hs_notes SET title=?, body=?, node_type=?, domain=?, status=?, x=?, y=?, color=?, pinned=?, updated_at=?
     WHERE id=?`,
    [m.title, m.body, m.node_type, m.domain, m.status, m.x ?? null, m.y ?? null, m.color || null,
     m.pinned ? 1 : 0, now(), id]
  );
  return one('SELECT * FROM hs_notes WHERE id = ?', [id]);
}

export function deleteNote(id) {
  run('DELETE FROM hs_note_links WHERE from_id=? OR to_id=?', [id, id]);
  run('DELETE FROM hs_notes WHERE id=?', [id]);
  return { deleted: id };
}

export function linkNotes(from_id, to_id, relationship = 'related', strength = 1) {
  const exists = one('SELECT id FROM hs_note_links WHERE from_id=? AND to_id=?', [from_id, to_id]);
  if (exists) return exists;
  const r = run('INSERT INTO hs_note_links (from_id,to_id,relationship,strength) VALUES (?,?,?,?)',
    [from_id, to_id, relationship, strength]);
  return one('SELECT * FROM hs_note_links WHERE id=?', [r.lastInsertRowid]);
}

export function unlinkNotes(id) { run('DELETE FROM hs_note_links WHERE id=?', [id]); return { deleted: id }; }

export function createMasterPlan(p = {}) {
  const r = run(
    `INSERT INTO hs_master_plans (title, summary, domain, note_ids_json, milestones_json, status)
     VALUES (?,?,?,?,?,?)`,
    [p.title || 'New Master Plan', p.summary || '', p.domain || 'self',
     JSON.stringify(p.note_ids || []), JSON.stringify(p.milestones || []), p.status || 'active']
  );
  // Optionally create a plan node in the graph so the cluster is visible.
  return one('SELECT * FROM hs_master_plans WHERE id=?', [r.lastInsertRowid]);
}

export function updateMasterPlan(id, patch = {}) {
  const cur = one('SELECT * FROM hs_master_plans WHERE id=?', [id]);
  if (!cur) return null;
  const m = { ...cur, ...patch };
  run(`UPDATE hs_master_plans SET title=?, summary=?, domain=?, note_ids_json=?, milestones_json=?, status=?, updated_at=? WHERE id=?`,
    [m.title, m.summary, m.domain,
     JSON.stringify(patch.note_ids ?? JSON.parse(cur.note_ids_json || '[]')),
     JSON.stringify(patch.milestones ?? JSON.parse(cur.milestones_json || '[]')),
     m.status, now(), id]);
  return one('SELECT * FROM hs_master_plans WHERE id=?', [id]);
}

export function deleteMasterPlan(id) { run('DELETE FROM hs_master_plans WHERE id=?', [id]); return { deleted: id }; }

/* ------------------------------------------------------------------ */
/* SELF / TODAY                                                        */
/* ------------------------------------------------------------------ */
export function getIntention(date) { return one('SELECT * FROM hs_intentions WHERE date=?', [date]); }
export function upsertIntention(date, v = {}) {
  run(`INSERT INTO hs_intentions (date, identity, top_outcomes_json, trading_rule, health_commitment, family_commitment, not_doing, notes)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(date) DO UPDATE SET identity=excluded.identity, top_outcomes_json=excluded.top_outcomes_json,
         trading_rule=excluded.trading_rule, health_commitment=excluded.health_commitment,
         family_commitment=excluded.family_commitment, not_doing=excluded.not_doing, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
    [date, v.identity || '', JSON.stringify(v.top_outcomes || []), v.trading_rule || '',
     v.health_commitment || '', v.family_commitment || '', v.not_doing || '', v.notes || '']);
  return getIntention(date);
}

export function getReflection(date) { return one('SELECT * FROM hs_reflections WHERE date=?', [date]); }
export function upsertReflection(date, v = {}) {
  run(`INSERT INTO hs_reflections (date, went_well, did_not, alignment, evidence_json, adjustment)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(date) DO UPDATE SET went_well=excluded.went_well, did_not=excluded.did_not,
         alignment=excluded.alignment, evidence_json=excluded.evidence_json, adjustment=excluded.adjustment`,
    [date, v.went_well || '', v.did_not || '', v.alignment || 0, JSON.stringify(v.evidence || []), v.adjustment || '']);
  return getReflection(date);
}

export function getHourOfMe(date) { return one('SELECT * FROM hs_hour_of_me WHERE date=?', [date]); }
export function upsertHourOfMe(date, v = {}) {
  run(`INSERT INTO hs_hour_of_me (date, blocks_json, total_minutes)
       VALUES (?,?,?)
       ON CONFLICT(date) DO UPDATE SET blocks_json=excluded.blocks_json, total_minutes=excluded.total_minutes, updated_at=CURRENT_TIMESTAMP`,
    [date, JSON.stringify(v.blocks || {}), v.total_minutes || 0]);
  return getHourOfMe(date);
}

export function getWeeklyReview(week_start) { return one('SELECT * FROM hs_weekly_reviews WHERE week_start=?', [week_start]); }
export function upsertWeeklyReview(week_start, v = {}) {
  run(`INSERT INTO hs_weekly_reviews (week_start, self_review, health_review, family_review, trading_review, wealth_review, top_three_json, theme)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(week_start) DO UPDATE SET self_review=excluded.self_review, health_review=excluded.health_review,
         family_review=excluded.family_review, trading_review=excluded.trading_review, wealth_review=excluded.wealth_review,
         top_three_json=excluded.top_three_json, theme=excluded.theme`,
    [week_start, v.self_review || '', v.health_review || '', v.family_review || '',
     v.trading_review || '', v.wealth_review || '', JSON.stringify((v.top_three || []).slice(0, 3)), v.theme || '']);
  return getWeeklyReview(week_start);
}

/* ------------------------------------------------------------------ */
/* TRADING - alert adherence                                           */
/* ------------------------------------------------------------------ */
export function addAlert(a = {}) {
  const r = run(
    `INSERT INTO hs_trade_alerts (source, symbol, setup_type, level, direction, timeframe, message, status)
     VALUES (?,?,?,?,?,?,?,?)`,
    [a.source || 'hybrid_ai', a.symbol || null, a.setup_type || null, a.level ?? null,
     a.direction || null, a.timeframe || null, a.message || '', a.status || 'fired']);
  return one('SELECT * FROM hs_trade_alerts WHERE id=?', [r.lastInsertRowid]);
}
export function listAlerts(limit = 100) { return all('SELECT * FROM hs_trade_alerts ORDER BY id DESC LIMIT ?', [limit]); }
export function setAlertStatus(id, status, linked_trade_id = null) {
  run('UPDATE hs_trade_alerts SET status=?, linked_trade_id=? WHERE id=?', [status, linked_trade_id, id]);
  return one('SELECT * FROM hs_trade_alerts WHERE id=?', [id]);
}

export function addTrade(t = {}) {
  const r = run(
    `INSERT INTO hs_trades (symbol, direction, entry, exit, size, pnl, setup_type, alert_id, on_setup, followed_plan, journal_ref, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [t.symbol || null, t.direction || null, t.entry ?? null, t.exit ?? null, t.size ?? null,
     t.pnl ?? null, t.setup_type || null, t.alert_id ?? null, t.on_setup ? 1 : 0,
     t.followed_plan ? 1 : 0, t.journal_ref || null, t.notes || '']);
  if (t.alert_id) setAlertStatus(t.alert_id, 'taken', r.lastInsertRowid);
  return one('SELECT * FROM hs_trades WHERE id=?', [r.lastInsertRowid]);
}
export function listTrades(limit = 200) { return all('SELECT * FROM hs_trades ORDER BY id DESC LIMIT ?', [limit]); }

/** Adherence: of trades taken, how many were on a valid setup vs discretionary. */
export function tradingAdherence(days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const trades = all('SELECT * FROM hs_trades WHERE ts >= ?', [since]);
  const alerts = all('SELECT * FROM hs_trade_alerts WHERE ts >= ?', [since]);
  const total = trades.length;
  const onSetup = trades.filter(t => t.on_setup).length;
  const followed = trades.filter(t => t.followed_plan).length;
  const alertsFired = alerts.length;
  const alertsTaken = alerts.filter(a => a.status === 'taken').length;
  return {
    days, trades: total, onSetup, random: total - onSetup,
    onSetupPct: total ? Math.round((onSetup / total) * 100) : null,
    followedPlanPct: total ? Math.round((followed / total) * 100) : null,
    alertsFired, alertsTaken,
    alertTakeRate: alertsFired ? Math.round((alertsTaken / alertsFired) * 100) : null,
    pnl: trades.reduce((s, t) => s + (t.pnl || 0), 0),
  };
}

export function getTradingDay(date) { return one('SELECT * FROM hs_trading_days WHERE date=?', [date]); }
export function upsertTradingDay(date, v = {}) {
  run(`INSERT INTO hs_trading_days (date, day_type, bias, levels_json, process_score, pnl, rule_violations_json, closed_at, notes)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(date) DO UPDATE SET day_type=excluded.day_type, bias=excluded.bias, levels_json=excluded.levels_json,
         process_score=excluded.process_score, pnl=excluded.pnl, rule_violations_json=excluded.rule_violations_json,
         closed_at=excluded.closed_at, notes=excluded.notes`,
    [date, v.day_type || '', v.bias || '', JSON.stringify(v.levels || []), v.process_score || 0,
     v.pnl ?? null, JSON.stringify(v.rule_violations || []), v.closed_at || null, v.notes || '']);
  return getTradingDay(date);
}

/* ------------------------------------------------------------------ */
/* HEALTH - recomposition + labs                                       */
/* ------------------------------------------------------------------ */
export function addBodyMetric(m = {}) {
  const r = run(`INSERT INTO hs_body_metrics (date, weight, body_fat, muscle_mass, waist, resting_hr, notes, source)
     VALUES (?,?,?,?,?,?,?,?)`,
    [m.date || now().slice(0, 10), m.weight ?? null, m.body_fat ?? null, m.muscle_mass ?? null,
     m.waist ?? null, m.resting_hr ?? null, m.notes || '', m.source || 'manual']);
  return one('SELECT * FROM hs_body_metrics WHERE id=?', [r.lastInsertRowid]);
}
export function listBodyMetrics(limit = 120) { return all('SELECT * FROM hs_body_metrics ORDER BY date DESC LIMIT ?', [limit]); }

export function addLab(l = {}) {
  const r = run(`INSERT INTO hs_labs (date, marker, value, unit, target, goal_direction, notes)
     VALUES (?,?,?,?,?,?,?)`,
    [l.date || now().slice(0, 10), l.marker, l.value ?? null, l.unit || '',
     l.target ?? null, l.goal_direction || 'lower', l.notes || '']);
  return one('SELECT * FROM hs_labs WHERE id=?', [r.lastInsertRowid]);
}
export function listLabs(limit = 300) { return all('SELECT * FROM hs_labs ORDER BY date DESC, marker LIMIT ?', [limit]); }

export function getHealthDaily(date) { return one('SELECT * FROM hs_health_daily WHERE date=?', [date]); }
export function upsertHealthDaily(date, v = {}) {
  run(`INSERT INTO hs_health_daily (date, movement_min, strength, mobility_min, meditation_min, protein_g, hydration, readiness, energy, notes, source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(date) DO UPDATE SET movement_min=excluded.movement_min, strength=excluded.strength,
         mobility_min=excluded.mobility_min, meditation_min=excluded.meditation_min, protein_g=excluded.protein_g,
         hydration=excluded.hydration, readiness=excluded.readiness, energy=excluded.energy, notes=excluded.notes`,
    [date, v.movement_min || 0, v.strength ? 1 : 0, v.mobility_min || 0, v.meditation_min || 0,
     v.protein_g || 0, v.hydration || 0, v.readiness ?? null, v.energy ?? null, v.notes || '', v.source || 'manual']);
  return getHealthDaily(date);
}

export function getHealthPlan() {
  let plan = one('SELECT * FROM hs_health_plan WHERE active=1 ORDER BY id DESC LIMIT 1');
  if (!plan) plan = seedHealthPlan();
  return plan;
}
export function upsertHealthPlan(v = {}) {
  const cur = one('SELECT * FROM hs_health_plan WHERE active=1 ORDER BY id DESC LIMIT 1');
  if (cur) {
    run(`UPDATE hs_health_plan SET focus=?, targets_json=?, training_json=?, nutrition_json=?, updated_at=? WHERE id=?`,
      [v.focus || cur.focus, JSON.stringify(v.targets ?? JSON.parse(cur.targets_json || '{}')),
       JSON.stringify(v.training ?? JSON.parse(cur.training_json || '[]')),
       JSON.stringify(v.nutrition ?? JSON.parse(cur.nutrition_json || '[]')), now(), cur.id]);
    return one('SELECT * FROM hs_health_plan WHERE id=?', [cur.id]);
  }
  const r = run(`INSERT INTO hs_health_plan (focus, targets_json, training_json, nutrition_json) VALUES (?,?,?,?)`,
    [v.focus || 'recomposition', JSON.stringify(v.targets || {}), JSON.stringify(v.training || []), JSON.stringify(v.nutrition || [])]);
  return one('SELECT * FROM hs_health_plan WHERE id=?', [r.lastInsertRowid]);
}

/** Seed a sensible recomposition + labs formula the user can then edit. */
function seedHealthPlan() {
  return upsertHealthPlan({
    focus: 'recomposition',
    targets: {
      goal: 'Lean, strong, "fighter" build — sustainably',
      protein_g_per_day: 180,
      training_days_per_week: 4,
      cardio_days_per_week: 3,
      note: 'Ideal weight, body-fat %, cholesterol and ferritin/hemoglobin targets are set in the Labs & Metrics panels.',
    },
    training: [
      { day: 'Mon', focus: 'Full-body strength (push emphasis)', detail: 'Compound lifts 4-6 reps, then hypertrophy 8-12' },
      { day: 'Tue', focus: 'Zone-2 cardio + mobility', detail: '35-45 min bike/walk, easy on the heart, aids cholesterol' },
      { day: 'Wed', focus: 'Full-body strength (pull/legs)', detail: 'Deadlift/row/squat pattern' },
      { day: 'Thu', focus: 'Conditioning + core (fighter work)', detail: 'Intervals, bag/shadow, bracing' },
      { day: 'Fri', focus: 'Strength (upper) + stretch', detail: 'Accessories, long mobility flow' },
      { day: 'Sat', focus: 'Active / bike / play', detail: 'Movement you enjoy' },
      { day: 'Sun', focus: 'Recovery + meditation', detail: 'Stretch, breathe, prep meals' },
    ],
    nutrition: [
      'Protein-forward every meal (target ~180g/day) to build muscle while losing fat',
      'Iron-rich foods for anemia: red meat, liver, spinach, lentils — pair with vitamin C for absorption',
      'Heart-healthy fats for cholesterol: olive oil, avocado, nuts, fatty fish; limit fried/trans fats',
      'Fiber (oats, beans, veg) lowers LDL; whole-food carbs around training',
      'Hydration + electrolytes; limit alcohol (helps triglycerides + recovery)',
      'Sustainable > extreme: small deficit, keep the muscle, don\'t crash',
    ],
  });
}

/* ------------------------------------------------------------------ */
/* FAMILY                                                              */
/* ------------------------------------------------------------------ */
export function listPeople() { return all('SELECT * FROM hs_people ORDER BY id'); }
export function addPerson(p = {}) {
  const r = run(`INSERT INTO hs_people (name, relationship, birthday_month, birthday_day, school_name, grade, city, lives_with, color, metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [p.name, p.relationship || 'child', p.birthday_month ?? null, p.birthday_day ?? null,
     p.school_name || '', p.grade || '', p.city || '', p.lives_with ? 1 : 0, p.color || null, JSON.stringify(p.metadata || {})]);
  return one('SELECT * FROM hs_people WHERE id=?', [r.lastInsertRowid]);
}
export function updatePerson(id, patch = {}) {
  const cur = one('SELECT * FROM hs_people WHERE id=?', [id]);
  if (!cur) return null;
  const m = { ...cur, ...patch };
  run(`UPDATE hs_people SET name=?, relationship=?, birthday_month=?, birthday_day=?, school_name=?, grade=?, city=?, lives_with=?, color=?, updated_at=? WHERE id=?`,
    [m.name, m.relationship, m.birthday_month ?? null, m.birthday_day ?? null, m.school_name || '', m.grade || '', m.city || '', m.lives_with ? 1 : 0, m.color || null, now(), id]);
  return one('SELECT * FROM hs_people WHERE id=?', [id]);
}
export function deletePerson(id) {
  run('DELETE FROM hs_protected_dates WHERE person_id=?', [id]);
  run('DELETE FROM hs_family_events WHERE person_id=?', [id]);
  run('DELETE FROM hs_people WHERE id=?', [id]);
  return { deleted: id };
}

export function listProtectedDates() { return all('SELECT * FROM hs_protected_dates ORDER BY month, day'); }
export function addProtectedDate(v = {}) {
  const r = run(`INSERT INTO hs_protected_dates (person_id, title, event_type, month, day, recurring, protection_level, travel_required, notes)
    VALUES (?,?,?,?,?,?,?,?,?)`,
    [v.person_id ?? null, v.title, v.event_type || 'birthday', v.month ?? null, v.day ?? null,
     v.recurring == null ? 1 : (v.recurring ? 1 : 0), v.protection_level || 'soft', v.travel_required ? 1 : 0, v.notes || '']);
  return one('SELECT * FROM hs_protected_dates WHERE id=?', [r.lastInsertRowid]);
}
export function updateProtectedDate(id, patch = {}) {
  const cur = one('SELECT * FROM hs_protected_dates WHERE id=?', [id]);
  if (!cur) return null;
  const m = { ...cur, ...patch };
  run(`UPDATE hs_protected_dates SET title=?, event_type=?, month=?, day=?, protection_level=?, travel_required=?, notes=? WHERE id=?`,
    [m.title, m.event_type, m.month ?? null, m.day ?? null, m.protection_level, m.travel_required ? 1 : 0, m.notes || '', id]);
  return one('SELECT * FROM hs_protected_dates WHERE id=?', [id]);
}
export function deleteProtectedDate(id) { run('DELETE FROM hs_protected_dates WHERE id=?', [id]); return { deleted: id }; }

export function listFamilyEvents() { return all('SELECT * FROM hs_family_events ORDER BY date_start'); }
export function addFamilyEvent(v = {}) {
  const r = run(`INSERT INTO hs_family_events (person_id, title, event_type, date_start, date_end, source, notes)
    VALUES (?,?,?,?,?,?,?)`,
    [v.person_id ?? null, v.title, v.event_type || 'school_off', v.date_start, v.date_end || v.date_start, v.source || 'manual', v.notes || '']);
  return one('SELECT * FROM hs_family_events WHERE id=?', [r.lastInsertRowid]);
}
export function deleteFamilyEvent(id) { run('DELETE FROM hs_family_events WHERE id=?', [id]); return { deleted: id }; }

/**
 * Family horizon: upcoming protected dates + all-kids overlap windows + PTO
 * candidates within `days`. Supportive planning, never shaming.
 */
export function familyHorizon(days = 120) {
  const people = listPeople();
  const protectedDates = listProtectedDates();
  const events = listFamilyEvents();
  const today = new Date();
  const horizon = new Date(today.getTime() + days * 864e5);

  // upcoming birthdays / anchors (recurring, next occurrence)
  const nextOccurrence = (month, day) => {
    if (!month || !day) return null;
    let y = today.getFullYear();
    let d = new Date(y, month - 1, day);
    if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) d = new Date(y + 1, month - 1, day);
    return d;
  };
  const pMap = Object.fromEntries(people.map(p => [p.id, p]));
  const upcoming = protectedDates.map(pd => {
    const d = nextOccurrence(pd.month, pd.day);
    if (!d || d > horizon) return null;
    const daysUntil = Math.round((d - today) / 864e5);
    return {
      id: pd.id, title: pd.title, event_type: pd.event_type,
      person: pd.person_id ? pMap[pd.person_id]?.name : null,
      date: d.toISOString().slice(0, 10), daysUntil,
      protection_level: pd.protection_level, travel_required: !!pd.travel_required,
      planningWindow: pd.travel_required && daysUntil <= 45,
    };
  }).filter(Boolean).sort((a, b) => a.daysUntil - b.daysUntil);

  // all-kids overlap windows from school-off / visit events among children
  const kids = people.filter(p => p.relationship === 'child');
  const kidEvents = events.filter(e => e.person_id && kids.some(k => k.id === e.person_id) &&
    ['school_off', 'long_weekend', 'holiday', 'visit', 'travel'].includes(e.event_type));
  const overlaps = detectAllKidsWindows(kidEvents, kids, pMap).filter(w => new Date(w.end) >= today);

  return { people, upcoming, overlaps, ptoCandidates: overlaps.filter(o => o.kids.length >= 2 || o.days >= 3) };
}

function detectAllKidsWindows(kidEvents, kids, pMap) {
  // Build a day -> set(kids off) map, then merge consecutive days where >=2 kids overlap.
  const dayKids = {};
  for (const e of kidEvents) {
    const start = new Date(e.date_start), end = new Date(e.date_end || e.date_start);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      (dayKids[key] ||= new Set()).add(e.person_id);
    }
  }
  const days = Object.keys(dayKids).sort();
  const windows = [];
  let cur = null;
  for (const day of days) {
    const set = dayKids[day];
    if (!cur) { cur = { start: day, end: day, kidSet: new Set(set) }; }
    else {
      const prev = new Date(cur.end); const now2 = new Date(day);
      if ((now2 - prev) <= 864e5 * 1.5) { cur.end = day; set.forEach(k => cur.kidSet.add(k)); }
      else { windows.push(cur); cur = { start: day, end: day, kidSet: new Set(set) }; }
    }
  }
  if (cur) windows.push(cur);
  return windows.map(w => {
    const kidsIn = [...w.kidSet];
    const dd = Math.round((new Date(w.end) - new Date(w.start)) / 864e5) + 1;
    return {
      start: w.start, end: w.end, days: dd,
      kids: kidsIn.map(id => pMap[id]?.name).filter(Boolean),
      allKids: kidsIn.length === kids.length && kids.length > 0,
      highValue: kidsIn.length >= 2 && dd >= 3,
    };
  });
}

/** Seed the user's children + protected birthdays once (all editable later). */
function seedFamilyIfEmpty() {
  const count = one('SELECT COUNT(*) c FROM hs_people');
  if (count && count.c > 0) return;
  const kids = [
    { name: 'Jovi', city: 'Wesley Chapel', school_name: 'Watergrass Elementary', lives_with: 1, birthday_month: 11, birthday_day: 22, color: '#f59e0b' },
    { name: 'Jionni', city: 'Orlando', school_name: 'Innovation', birthday_month: 2, birthday_day: 25, color: '#60a5fa' },
    { name: 'Justis', city: 'Sandy Springs / Atlanta', school_name: 'Riverwood', birthday_month: 4, birthday_day: 23, color: '#f472b6' },
  ];
  const ids = {};
  for (const k of kids) ids[k.name] = addPerson({ ...k, relationship: 'child' }).id;
  const self = addPerson({ name: 'Me', relationship: 'self', birthday_month: 8, birthday_day: 6, color: '#a78bfa' });
  const mom = addPerson({ name: 'Mom', relationship: 'parent', birthday_month: 8, birthday_day: 17, color: '#2dd4bf' });

  const pd = (person_id, title, month, day, level = 'soft', travel = 0) =>
    addProtectedDate({ person_id, title, event_type: 'birthday', month, day, protection_level: level, travel_required: travel });
  pd(self.id, 'My birthday', 8, 6, 'soft');
  pd(mom.id, "Mom's birthday", 8, 17, 'soft');
  pd(ids.Jovi, "Jovi's birthday", 11, 22, 'hard');
  pd(ids.Jionni, "Jionni's birthday", 2, 25, 'hard', 1);
  pd(ids.Justis, "Justis's birthday", 4, 23, 'hard', 1); // "I want to be there"
  // co-parent birthdays (context, flexible)
  addProtectedDate({ title: "Jovi's mom's birthday", event_type: 'anchor', month: 12, day: 16, protection_level: 'flexible' });
  addProtectedDate({ title: "Jionni's mom's birthday", event_type: 'anchor', month: 2, day: 1, protection_level: 'flexible' });
  addProtectedDate({ title: "Justis's mom's birthday", event_type: 'anchor', month: 2, day: 1, protection_level: 'flexible' });
}

/* ------------------------------------------------------------------ */
/* WEALTH / CREATION — projects + ideas                                */
/* ------------------------------------------------------------------ */
const ACTIVE_CAP_KEY = 'active_project_cap';

export function getSetting(key, fallback = null) {
  const r = one('SELECT value FROM hs_settings WHERE key=?', [key]);
  return r ? r.value : fallback;
}
export function setSetting(key, value) {
  run('INSERT INTO hs_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, String(value)]);
  return { key, value };
}

export function listProjects() { return all('SELECT * FROM hs_projects ORDER BY operating_state, name'); }
export function addProject(p = {}) {
  const r = run(`INSERT INTO hs_projects (name, domain, strategic_type, operating_state, repo_url, website_url, monthly_cost, current_revenue, recurring_revenue, next_milestone, last_activity, why, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [p.name, p.domain || 'wealth', p.strategic_type || 'cash_flow', p.operating_state || 'idea',
     p.repo_url || '', p.website_url || '', p.monthly_cost ?? null, p.current_revenue ?? null,
     p.recurring_revenue ?? null, p.next_milestone || '', p.last_activity || null, p.why || '', p.notes || '']);
  return one('SELECT * FROM hs_projects WHERE id=?', [r.lastInsertRowid]);
}
export function updateProject(id, patch = {}) {
  const cur = one('SELECT * FROM hs_projects WHERE id=?', [id]);
  if (!cur) return null;
  const m = { ...cur, ...patch };
  run(`UPDATE hs_projects SET name=?, domain=?, strategic_type=?, operating_state=?, repo_url=?, website_url=?, monthly_cost=?, current_revenue=?, recurring_revenue=?, next_milestone=?, last_activity=?, why=?, notes=?, updated_at=? WHERE id=?`,
    [m.name, m.domain, m.strategic_type, m.operating_state, m.repo_url || '', m.website_url || '',
     m.monthly_cost ?? null, m.current_revenue ?? null, m.recurring_revenue ?? null, m.next_milestone || '',
     m.last_activity || null, m.why || '', m.notes || '', now(), id]);
  return one('SELECT * FROM hs_projects WHERE id=?', [id]);
}
export function deleteProject(id) { run('DELETE FROM hs_projects WHERE id=?', [id]); return { deleted: id }; }

export function projectsOverview() {
  const projects = listProjects();
  const cap = +(getSetting(ACTIVE_CAP_KEY, '4'));
  const active = projects.filter(p => p.operating_state === 'active');
  const byType = { cash_flow: 0, asset: 0, moonshot: 0 };
  const byState = { active: 0, maintenance: 0, parked: 0, idea: 0, archived: 0 };
  let monthlyCost = 0, recurring = 0;
  for (const p of projects) {
    byType[p.strategic_type] = (byType[p.strategic_type] || 0) + 1;
    byState[p.operating_state] = (byState[p.operating_state] || 0) + 1;
    monthlyCost += p.monthly_cost || 0;
    recurring += p.recurring_revenue || 0;
  }
  return { projects, cap, activeCount: active.length, overCapacity: active.length > cap, byType, byState, monthlyCost, recurring };
}

export function listIdeas() { return all('SELECT * FROM hs_ideas ORDER BY updated_at DESC'); }
export function addIdea(v = {}) {
  const r = run(`INSERT INTO hs_ideas (title, stage, domain, problem, audience, evidence, business_model, strategic_type, estimated_effort, next_validation_step, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [v.title, v.stage || 'idea', v.domain || 'creation', v.problem || '', v.audience || '',
     v.evidence || '', v.business_model || '', v.strategic_type || 'moonshot', v.estimated_effort || '',
     v.next_validation_step || '', v.source || 'manual']);
  return one('SELECT * FROM hs_ideas WHERE id=?', [r.lastInsertRowid]);
}
export function updateIdea(id, patch = {}) {
  const cur = one('SELECT * FROM hs_ideas WHERE id=?', [id]);
  if (!cur) return null;
  const m = { ...cur, ...patch };
  run(`UPDATE hs_ideas SET title=?, stage=?, domain=?, problem=?, audience=?, evidence=?, business_model=?, strategic_type=?, estimated_effort=?, next_validation_step=?, updated_at=? WHERE id=?`,
    [m.title, m.stage, m.domain, m.problem || '', m.audience || '', m.evidence || '', m.business_model || '',
     m.strategic_type, m.estimated_effort || '', m.next_validation_step || '', now(), id]);
  return one('SELECT * FROM hs_ideas WHERE id=?', [id]);
}
export function deleteIdea(id) { run('DELETE FROM hs_ideas WHERE id=?', [id]); return { deleted: id }; }

/** Promote an idea to a project (respects capacity if activating). */
export function promoteIdea(id, { operating_state = 'idea' } = {}) {
  const idea = one('SELECT * FROM hs_ideas WHERE id=?', [id]);
  if (!idea) return { error: 'not_found' };
  if (operating_state === 'active') {
    const ov = projectsOverview();
    if (ov.activeCount >= ov.cap) return { error: 'over_capacity', cap: ov.cap, activeCount: ov.activeCount };
  }
  const project = addProject({
    name: idea.title, domain: idea.domain, strategic_type: idea.strategic_type,
    operating_state, why: idea.problem, next_milestone: idea.next_validation_step, notes: idea.evidence,
  });
  run('UPDATE hs_ideas SET stage=?, promoted_project_id=?, updated_at=? WHERE id=?', ['project', project.id, now(), id]);
  return { project, idea: one('SELECT * FROM hs_ideas WHERE id=?', [id]) };
}

/** Seed the known business/project universe (all editable; conservative states). */
function seedProjectsIfEmpty() {
  const c = one('SELECT COUNT(*) c FROM hs_projects');
  if (c && c.c > 0) return;
  const P = (name, strategic_type, operating_state, domain, extra = {}) =>
    addProject({ name, strategic_type, operating_state, domain, ...extra });
  P('Smart Life Brokers', 'asset', 'active', 'wealth', { why: 'Recurring insurance asset', recurring_revenue: null });
  P('Hybrid Funding', 'cash_flow', 'active', 'wealth', { website_url: 'https://hybridfunding.co' });
  P('Trade Hybrid', 'asset', 'active', 'wealth', { website_url: 'https://tradehybrid.co' });
  P('Hybrid Journal', 'asset', 'active', 'creation', { why: 'Trading journal — feeds adherence' });
  P('LIV8 Health', 'cash_flow', 'maintenance', 'wealth', { website_url: 'https://liv8health.com' });
  P('LIV8 AI / Elevate OS', 'moonshot', 'active', 'creation');
  P('LIV8 Solar', 'cash_flow', 'maintenance', 'wealth');
  P('Agency Owner Support', 'cash_flow', 'parked', 'wealth');
  P('OMet', 'moonshot', 'idea', 'creation');
  P('Broker Aggregator', 'asset', 'parked', 'creation');
  P('ABATEV', 'moonshot', 'idea', 'creation');
}

/**
 * Today brief — one aggregated glance: intention, health/recovery, trading day
 * type, next family anchor, project capacity. Distinguishes evidence vs plan.
 */
export function todayBrief(date) {
  const d = date || now().slice(0, 10);
  const jsDay = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const DAY_TYPES = { Sunday: 'no_trade', Monday: 'setup', Tuesday: 'execute', Wednesday: 'execute', Thursday: 'execute', Friday: 'review', Saturday: 'no_trade' };
  const intention = getIntention(d);
  const health = getHealthDaily(d);
  const tradingDay = getTradingDay(d);
  const horizon = familyHorizon(60);
  const ov = projectsOverview();
  return {
    date: d, dayName: jsDay,
    dayType: tradingDay?.day_type || DAY_TYPES[jsDay] || 'setup',
    intention: intention || null,
    topOutcomes: intention ? safeJson(intention.top_outcomes_json, []) : [],
    health: health || null,
    readiness: health?.readiness ?? null,
    nextFamily: horizon.upcoming[0] || null,
    activeProjects: ov.activeCount, projectCap: ov.cap, overCapacity: ov.overCapacity,
  };
}
function safeJson(s, f) { try { return JSON.parse(s || 'null') ?? f; } catch { return f; } }

/** Combined health snapshot with lab trend + latest metrics. */
export function healthSnapshot() {
  const plan = getHealthPlan();
  const metrics = listBodyMetrics(30);
  const labs = listLabs(60);
  // latest value per marker + previous for trend
  const byMarker = {};
  for (const l of labs) {
    if (!byMarker[l.marker]) byMarker[l.marker] = [];
    byMarker[l.marker].push(l);
  }
  const markerSummary = Object.entries(byMarker).map(([marker, rows]) => {
    const latest = rows[0], prev = rows[1];
    const onTarget = latest.target == null ? null
      : latest.goal_direction === 'higher' ? latest.value >= latest.target
      : latest.value <= latest.target;
    return {
      marker, value: latest.value, unit: latest.unit, target: latest.target,
      goal_direction: latest.goal_direction, date: latest.date,
      trend: prev ? +(latest.value - prev.value).toFixed(2) : null, onTarget,
    };
  });
  return { plan, latestMetrics: metrics[0] || null, metrics, markerSummary };
}
