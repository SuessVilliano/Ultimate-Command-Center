import * as db from './database.js';
import * as hs from './highest-self-db.js';

function getDb() {
  const d = db.getDb ? db.getDb() : null;
  if (!d) throw new Error('SQLite unavailable');
  return d;
}

function init() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS hs_apple_health_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      steps INTEGER,
      active_calories REAL,
      exercise_min REAL,
      stand_hours REAL,
      resting_hr REAL,
      walking_hr REAL,
      hrv REAL,
      respiratory_rate REAL,
      oxygen_saturation REAL,
      sleep_hours REAL,
      weight REAL,
      body_fat REAL,
      source TEXT DEFAULT 'apple_health',
      raw_json TEXT DEFAULT '{}',
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function isConfigured() {
  return Boolean(process.env.APPLE_HEALTH_INGEST_TOKEN);
}

export function authorize(token) {
  return isConfigured() && token && token === process.env.APPLE_HEALTH_INGEST_TOKEN;
}

export function ingest(payload = {}) {
  init();
  const d = getDb();
  const date = payload.date || new Date().toISOString().slice(0, 10);
  const v = {
    steps: payload.steps ?? null,
    active_calories: payload.active_calories ?? payload.activeCalories ?? null,
    exercise_min: payload.exercise_min ?? payload.exerciseMinutes ?? null,
    stand_hours: payload.stand_hours ?? payload.standHours ?? null,
    resting_hr: payload.resting_hr ?? payload.restingHeartRate ?? null,
    walking_hr: payload.walking_hr ?? payload.walkingHeartRate ?? null,
    hrv: payload.hrv ?? payload.hrv_ms ?? null,
    respiratory_rate: payload.respiratory_rate ?? payload.respiratoryRate ?? null,
    oxygen_saturation: payload.oxygen_saturation ?? payload.spo2 ?? null,
    sleep_hours: payload.sleep_hours ?? payload.sleepHours ?? null,
    weight: payload.weight ?? null,
    body_fat: payload.body_fat ?? payload.bodyFat ?? null,
  };

  d.prepare(`
    INSERT INTO hs_apple_health_daily
      (date, steps, active_calories, exercise_min, stand_hours, resting_hr, walking_hr, hrv,
       respiratory_rate, oxygen_saturation, sleep_hours, weight, body_fat, raw_json, synced_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(date) DO UPDATE SET
      steps=excluded.steps, active_calories=excluded.active_calories, exercise_min=excluded.exercise_min,
      stand_hours=excluded.stand_hours, resting_hr=excluded.resting_hr, walking_hr=excluded.walking_hr,
      hrv=excluded.hrv, respiratory_rate=excluded.respiratory_rate,
      oxygen_saturation=excluded.oxygen_saturation, sleep_hours=excluded.sleep_hours,
      weight=excluded.weight, body_fat=excluded.body_fat, raw_json=excluded.raw_json,
      synced_at=CURRENT_TIMESTAMP
  `).run(date, v.steps, v.active_calories, v.exercise_min, v.stand_hours, v.resting_hr, v.walking_hr,
    v.hrv, v.respiratory_rate, v.oxygen_saturation, v.sleep_hours, v.weight, v.body_fat,
    JSON.stringify(payload));

  const existingDaily = hs.getHealthDaily(date) || {};
  hs.upsertHealthDaily(date, {
    ...existingDaily,
    movement_min: Math.round(v.exercise_min ?? existingDaily.movement_min ?? 0),
    source: 'apple_health',
    notes: existingDaily.notes || ''
  });

  if (v.weight != null || v.body_fat != null || v.resting_hr != null) {
    hs.addBodyMetric({
      date,
      weight: v.weight,
      body_fat: v.body_fat,
      resting_hr: v.resting_hr,
      source: 'apple_health'
    });
  }

  return snapshot(date);
}

export function snapshot(date) {
  init();
  const d = getDb();
  const row = date
    ? d.prepare('SELECT * FROM hs_apple_health_daily WHERE date=?').get(date)
    : d.prepare('SELECT * FROM hs_apple_health_daily ORDER BY date DESC LIMIT 1').get();
  return {
    configured: isConfigured(),
    connected: Boolean(row),
    latest: row || null,
  };
}

export function history(days = 30) {
  init();
  const d = getDb();
  return d.prepare('SELECT * FROM hs_apple_health_daily ORDER BY date DESC LIMIT ?').all(Math.min(Math.max(+days || 30, 1), 365));
}
