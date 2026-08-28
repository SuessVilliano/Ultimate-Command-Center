import * as db from './database.js';

function getDb() {
  const d = db.getDb ? db.getDb() : null;
  if (!d) throw new Error('SQLite not available for Life Journal');
  return d;
}

export function initLifeJournalTables() {
  const d = db.getDb ? db.getDb() : null;
  if (!d) return;
  d.exec(`
    CREATE TABLE IF NOT EXISTS life_journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT DEFAULT '',
      text TEXT NOT NULL,
      mood INTEGER,
      energy INTEGER,
      stress INTEGER,
      calories REAL,
      protein_g REAL,
      hydration_oz REAL,
      duration_min REAL,
      source TEXT DEFAULT 'juno_chat',
      tags_json TEXT DEFAULT '[]',
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_life_journal_date ON life_journal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_life_journal_category ON life_journal_entries(category);
  `);
}

const dateOf = ts => String(ts || new Date().toISOString()).slice(0, 10);
const clamp10 = v => Number.isFinite(Number(v)) ? Math.max(0, Math.min(10, Number(v))) : null;

export function addEntry(v = {}) {
  const ts = v.ts || new Date().toISOString();
  const r = getDb().prepare(`INSERT INTO life_journal_entries
    (ts,date,category,subcategory,text,mood,energy,stress,calories,protein_g,hydration_oz,duration_min,source,tags_json,metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      ts, v.date || dateOf(ts), v.category || 'note', v.subcategory || '', String(v.text || '').trim(),
      clamp10(v.mood), clamp10(v.energy), clamp10(v.stress),
      Number.isFinite(Number(v.calories)) ? Number(v.calories) : null,
      Number.isFinite(Number(v.protein_g)) ? Number(v.protein_g) : null,
      Number.isFinite(Number(v.hydration_oz)) ? Number(v.hydration_oz) : null,
      Number.isFinite(Number(v.duration_min)) ? Number(v.duration_min) : null,
      v.source || 'juno_chat', JSON.stringify(v.tags || []), JSON.stringify(v.metadata || {})
    );
  return getDb().prepare('SELECT * FROM life_journal_entries WHERE id=?').get(r.lastInsertRowid);
}

export function listEntries({ days = 30, category, limit = 300 } = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(days) || 30) * 864e5).toISOString().slice(0, 10);
  if (category) return getDb().prepare('SELECT * FROM life_journal_entries WHERE date>=? AND category=? ORDER BY ts DESC LIMIT ?').all(since, category, limit);
  return getDb().prepare('SELECT * FROM life_journal_entries WHERE date>=? ORDER BY ts DESC LIMIT ?').all(since, limit);
}

function avg(rows, key) {
  const vals = rows.map(r => Number(r[key])).filter(Number.isFinite);
  return vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : null;
}

function count(rows, category) { return rows.filter(r => r.category === category).length; }

export function scoreboard({ days = 7 } = {}) {
  const d = getDb();
  const rows = listEntries({ days, limit: 1000 });
  const since = new Date(Date.now() - Math.max(1, Number(days) || 7) * 864e5).toISOString().slice(0, 10);
  const health = d.prepare('SELECT * FROM hs_health_daily WHERE date>=? ORDER BY date DESC').all(since);
  const intentions = d.prepare('SELECT * FROM hs_intentions WHERE date>=? ORDER BY date DESC').all(since);
  const reflections = d.prepare('SELECT * FROM hs_reflections WHERE date>=? ORDER BY date DESC').all(since);
  const trading = d.prepare('SELECT * FROM hs_trading_days WHERE date>=? ORDER BY date DESC').all(since);

  const activeDays = new Set(rows.map(r => r.date));
  const protein = rows.reduce((s,r)=>s+(Number(r.protein_g)||0),0);
  const calories = rows.reduce((s,r)=>s+(Number(r.calories)||0),0);
  const categories = ['food','mood','stress','energy','movement','sleep','family','work','trading','win','friction','note']
    .reduce((o,k)=>({ ...o, [k]: count(rows,k) }),{});

  const evidence = {
    journalEntries: rows.length,
    activeJournalDays: activeDays.size,
    intentionDays: intentions.length,
    reflectionDays: reflections.length,
    healthDays: health.length,
    tradingDays: trading.length,
  };

  // Alignment scores measure evidence/consistency, not medical health or worth.
  const consistency = Math.min(100, Math.round((activeDays.size / Math.max(1, Math.min(days, 7))) * 100));
  const selfScore = Math.round((Math.min(100, intentions.length * 20) + Math.min(100, reflections.length * 20) + consistency) / 3);
  const healthScore = Math.round((Math.min(100, health.length * 18) + Math.min(100, (categories.food + categories.movement + categories.sleep) * 12)) / 2);
  const workScore = Math.min(100, (categories.work + categories.win) * 15);
  const familyScore = Math.min(100, categories.family * 25);
  const tradingScore = trading.length ? Math.round(trading.reduce((s,r)=>s+(Number(r.process_score)||0),0)/trading.length) : null;

  return {
    days: Number(days),
    generatedAt: new Date().toISOString(),
    evidence,
    dimensions: {
      self: selfScore,
      healthHabits: healthScore,
      work: workScore,
      family: familyScore,
      tradingProcess: tradingScore,
    },
    wellness: { mood: avg(rows,'mood'), energy: avg(rows,'energy'), stress: avg(rows,'stress') },
    nutritionLogged: { calories, protein_g: protein, entries: categories.food },
    categories,
    recent: rows.slice(0, 20),
    note: 'Scores reflect logged consistency/evidence only. They are not medical scores and missing data is not treated as failure.'
  };
}
