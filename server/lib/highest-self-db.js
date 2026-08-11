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
  `);
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
