import * as oura from '../lib/oura-adapter.js';
import * as appleHealth from '../lib/apple-health-adapter.js';
import * as db from '../lib/database.js';

function latestApple(rows = [], metricNames = []) {
  const names = metricNames.map(x => String(x).toLowerCase());
  return [...rows].reverse().find(row => {
    const key = String(row.metric || row.type || row.identifier || row.name || '').toLowerCase();
    return names.some(n => key.includes(n));
  }) || null;
}

function trainingDb() {
  const d = db.getDb ? db.getDb() : null;
  if (!d) throw new Error('SQLite unavailable for training log');
  d.exec(`
    CREATE TABLE IF NOT EXISTS hs_training_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT UNIQUE,
      session_type TEXT NOT NULL,
      program_id TEXT,
      title TEXT NOT NULL,
      performed_at TEXT NOT NULL,
      duration_min REAL DEFAULT 0,
      distance_mi REAL DEFAULT 0,
      avg_speed_mph REAL DEFAULT 0,
      rpe REAL DEFAULT 0,
      completed_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      exercises_json TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      source TEXT DEFAULT 'command-center',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_hs_training_performed_at ON hs_training_sessions(performed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_hs_training_type ON hs_training_sessions(session_type, performed_at DESC);
  `);
  return d;
}

function rowToTraining(row) {
  if (!row) return row;
  return {
    id: row.id,
    clientId: row.client_id,
    type: row.session_type,
    programId: row.program_id,
    title: row.title,
    date: row.performed_at,
    duration: Number(row.duration_min || 0),
    distance: Number(row.distance_mi || 0),
    avgSpeed: Number(row.avg_speed_mph || 0),
    rpe: Number(row.rpe || 0),
    completed: Number(row.completed_count || 0),
    total: Number(row.total_count || 0),
    exercises: (() => { try { return JSON.parse(row.exercises_json || '[]'); } catch { return []; } })(),
    notes: row.notes || '',
    source: row.source || 'command-center',
  };
}

function listTraining(limit = 100) {
  const d = trainingDb();
  return d.prepare('SELECT * FROM hs_training_sessions ORDER BY performed_at DESC LIMIT ?').all(Math.max(1, Math.min(limit, 500))).map(rowToTraining);
}

function trainingStats(days = 7) {
  const d = trainingDb();
  const safeDays = Math.max(1, Math.min(Number(days || 7), 365));
  const since = new Date(Date.now() - safeDays * 86400000).toISOString();
  const rows = d.prepare('SELECT * FROM hs_training_sessions WHERE performed_at >= ? ORDER BY performed_at DESC').all(since).map(rowToTraining);
  const strength = rows.filter(x => x.type === 'strength');
  const rides = rows.filter(x => x.type === 'bike');
  const exerciseVolume = {};
  strength.forEach(session => (session.exercises || []).forEach(ex => {
    const load = Number(ex.load || 0);
    const repsText = String(ex.reps || '').trim();
    const reps = Number((repsText.match(/\d+(?:\.\d+)?/) || [0])[0]);
    if (!ex.name || !load || !reps) return;
    exerciseVolume[ex.name] = (exerciseVolume[ex.name] || 0) + load * reps;
  }));
  return {
    days: safeDays,
    strengthSessions: strength.length,
    rides: rides.length,
    bikeMiles: rides.reduce((s, x) => s + x.distance, 0),
    bikeMinutes: rides.reduce((s, x) => s + x.duration, 0),
    avgRideSpeed: rides.length ? rides.reduce((s, x) => s + x.avgSpeed, 0) / rides.filter(x => x.avgSpeed > 0).length || 0 : 0,
    longestRide: rides.reduce((m, x) => Math.max(m, x.distance), 0),
    strengthCompletionPct: strength.length ? Math.round(strength.reduce((s, x) => s + (x.total ? x.completed / x.total : 0), 0) / strength.length * 100) : 0,
    exerciseVolume,
    recent: rows.slice(0, 12),
  };
}

export function registerHealthMetricsRoutes(app) {
  app.get('/api/hs/health/metrics/live', async (req, res) => {
    try {
      const days = Math.max(1, Math.min(Number(req.query.days || 14), 90));
      const [ouraDetails, appleRows] = await Promise.all([
        oura.details({ days }),
        Promise.resolve(appleHealth.history(days)).catch(() => []),
      ]);

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        days,
        oura: ouraDetails,
        appleHealth: {
          configured: appleHealth.isConfigured(),
          rows: appleRows,
          latest: {
            heartRate: latestApple(appleRows, ['heart rate', 'heartrate']),
            restingHeartRate: latestApple(appleRows, ['resting heart rate', 'restingheartrate']),
            hrv: latestApple(appleRows, ['hrv', 'heart rate variability']),
            respiratoryRate: latestApple(appleRows, ['respiratory']),
            steps: latestApple(appleRows, ['steps', 'step count']),
            sleep: latestApple(appleRows, ['sleep']),
            activeEnergy: latestApple(appleRows, ['active energy', 'calories']),
            walkingSpeed: latestApple(appleRows, ['walking speed']),
            weight: latestApple(appleRows, ['weight', 'body mass']),
            vo2Max: latestApple(appleRows, ['vo2']),
          },
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || 'Health metrics unavailable' });
    }
  });

  app.get('/api/hs/health/training', (req, res) => {
    try { res.json({ ok: true, sessions: listTraining(Number(req.query.limit || 100)) }); }
    catch (error) { res.status(500).json({ ok: false, error: error?.message || 'Training unavailable' }); }
  });

  app.get('/api/hs/health/training/stats', (req, res) => {
    try { res.json({ ok: true, stats: trainingStats(Number(req.query.days || 7)) }); }
    catch (error) { res.status(500).json({ ok: false, error: error?.message || 'Training stats unavailable' }); }
  });

  app.post('/api/hs/health/training', (req, res) => {
    try {
      const b = req.body || {};
      if (!['strength', 'bike'].includes(b.type)) return res.status(400).json({ ok: false, error: 'type must be strength or bike' });
      const performedAt = b.date || new Date().toISOString();
      const title = String(b.title || (b.type === 'bike' ? 'Bike Ride' : 'Strength Session')).slice(0, 180);
      const clientId = String(b.clientId || b.id || `${Date.now()}-${b.type}`).slice(0, 120);
      const d = trainingDb();
      d.prepare(`INSERT OR REPLACE INTO hs_training_sessions
        (client_id, session_type, program_id, title, performed_at, duration_min, distance_mi, avg_speed_mph, rpe, completed_count, total_count, exercises_json, notes, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(clientId, b.type, b.programId || b.dayId || b.rideType || null, title, performedAt,
          Number(b.duration || 0), Number(b.distance || 0), Number(b.avgSpeed || 0), Number(b.rpe || 0),
          Number(b.completed || 0), Number(b.total || 0), JSON.stringify(Array.isArray(b.exercises) ? b.exercises : []),
          String(b.notes || '').slice(0, 4000), String(b.source || 'command-center').slice(0, 80));
      const saved = d.prepare('SELECT * FROM hs_training_sessions WHERE client_id = ?').get(clientId);
      res.json({ ok: true, session: rowToTraining(saved), stats: trainingStats(7) });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || 'Could not save training' });
    }
  });
}

export default registerHealthMetricsRoutes;
