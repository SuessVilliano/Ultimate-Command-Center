/**
 * Oura adapter (read-only HealthProvider)
 *
 * Pulls both daily scores and richer Oura V2 data. Every endpoint degrades
 * gracefully when the current OAuth token is missing a scope so Health OS can
 * distinguish "not authorized" from "no data".
 */

import * as hs from './highest-self-db.js';

const BASE = 'https://api.ouraring.com/v2/usercollection';

function token() {
  return process.env.OURA_ACCESS_TOKEN || process.env.OURA_TOKEN || process.env.OURA_RING_TOKEN || null;
}
export function isConfigured() { return !!token(); }

async function get(path, params = {}) {
  const t = token();
  if (!t) return { ok: false, reason: 'no_token', status: 0, data: [] };
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)).toString();
  try {
    const res = await fetch(`${BASE}/${path}${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401) return { ok: false, reason: 'unauthorized', status: 401, data: [] };
    if (res.status === 403) return { ok: false, reason: 'scope_or_membership', status: 403, data: [] };
    if (!res.ok) return { ok: false, reason: `http_${res.status}`, status: res.status, data: [] };
    const json = await res.json();
    return { ok: true, status: res.status, data: json.data || [], nextToken: json.next_token || null };
  } catch (e) {
    return { ok: false, reason: e?.name === 'TimeoutError' ? 'timeout' : (e.message || 'request_failed'), status: 0, data: [] };
  }
}

const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const isoDateTimeDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const avg = values => {
  const nums = values.filter(v => Number.isFinite(Number(v))).map(Number);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};
const latestBy = (rows, key = 'day') => [...rows].sort((a, b) => String(a?.[key] || '').localeCompare(String(b?.[key] || ''))).at(-1) || null;

/** Pull readiness + sleep + activity for a date range and normalize by day. */
export async function fetchDaily({ days = 14 } = {}) {
  if (!isConfigured()) return { configured: false, days: [] };
  const start = isoDaysAgo(days), end = isoDaysAgo(-1);
  const params = { start_date: start, end_date: end };
  const [readiness, sleep, activity] = await Promise.all([
    get('daily_readiness', params), get('daily_sleep', params), get('daily_activity', params),
  ]);

  const byDay = {};
  const put = (day, patch) => { if (day) byDay[day] = { ...(byDay[day] || { date: day }), ...patch }; };
  for (const r of readiness.data) put(r.day, { readiness: r.score ?? null, readiness_contributors: r.contributors || null, temperature_deviation: r.temperature_deviation ?? null, temperature_trend_deviation: r.temperature_trend_deviation ?? null });
  for (const s of sleep.data) put(s.day, { sleep: s.score ?? null, sleep_contributors: s.contributors || null });
  for (const a of activity.data) {
    put(a.day, {
      activity: a.score ?? null,
      activity_contributors: a.contributors || null,
      movement_min: Math.round(((a.high_activity_time || 0) + (a.medium_activity_time || 0) + (a.low_activity_time || 0)) / 60) || null,
      high_activity_min: Math.round((a.high_activity_time || 0) / 60),
      medium_activity_min: Math.round((a.medium_activity_time || 0) / 60),
      low_activity_min: Math.round((a.low_activity_time || 0) / 60),
      sedentary_min: Math.round((a.sedentary_time || 0) / 60),
      resting_min: Math.round((a.resting_time || 0) / 60),
      steps: a.steps ?? null,
      active_calories: a.active_calories ?? null,
      total_calories: a.total_calories ?? null,
      equivalent_walking_distance_m: a.equivalent_walking_distance ?? null,
      inactivity_alerts: a.inactivity_alerts ?? null,
      target_calories: a.target_calories ?? null,
    });
  }
  return {
    configured: true,
    unauthorized: [readiness, sleep, activity].some(x => x.reason === 'unauthorized'),
    endpointStatus: {
      readiness: { ok: readiness.ok, reason: readiness.reason || null },
      sleep: { ok: sleep.ok, reason: sleep.reason || null },
      activity: { ok: activity.ok, reason: activity.reason || null },
    },
    days: Object.values(byDay).sort((a, b) => (a.date || '').localeCompare(b.date || '')),
  };
}

/** Rich Oura view used by the custom Health OS dashboards. */
export async function details({ days = 14 } = {}) {
  if (!isConfigured()) return { configured: false, endpoints: {}, daily: [], heartRate: [], sleepSessions: [], workouts: [] };
  const boundedDays = Math.max(1, Math.min(Number(days) || 14, 90));
  const startDate = isoDaysAgo(boundedDays), endDate = isoDaysAgo(-1);
  const dateParams = { start_date: startDate, end_date: endDate };
  const timeParams = { start_datetime: isoDateTimeDaysAgo(boundedDays), end_datetime: new Date().toISOString() };

  const [daily, heartRate, sleepSessions, stress, spo2, workouts, resilience, cardiovascularAge] = await Promise.all([
    fetchDaily({ days: boundedDays }),
    get('heartrate', timeParams),
    get('sleep', dateParams),
    get('daily_stress', dateParams),
    get('daily_spo2', dateParams),
    get('workout', dateParams),
    get('daily_resilience', dateParams),
    get('daily_cardiovascular_age', dateParams),
  ]);

  const endpoint = (x) => ({ ok: !!x?.ok, reason: x?.reason || null, status: x?.status || (x?.ok ? 200 : 0) });
  const hrRows = heartRate.data || [];
  const latestHeartRate = latestBy(hrRows, 'timestamp');
  const recentHr = hrRows.slice(-288);
  const hrSummary = {
    latest: latestHeartRate?.bpm ?? null,
    average: avg(recentHr.map(x => x.bpm)) != null ? Math.round(avg(recentHr.map(x => x.bpm))) : null,
    low: recentHr.length ? Math.min(...recentHr.map(x => Number(x.bpm)).filter(Number.isFinite)) : null,
    high: recentHr.length ? Math.max(...recentHr.map(x => Number(x.bpm)).filter(Number.isFinite)) : null,
    samples: hrRows.length,
  };

  const latestSleep = latestBy(sleepSessions.data || [], 'day');
  const sleepDetail = latestSleep ? {
    day: latestSleep.day,
    bedtimeStart: latestSleep.bedtime_start || null,
    bedtimeEnd: latestSleep.bedtime_end || null,
    totalSleepSec: latestSleep.total_sleep_duration ?? null,
    timeInBedSec: latestSleep.time_in_bed ?? null,
    awakeSec: latestSleep.awake_time ?? null,
    remSec: latestSleep.rem_sleep_duration ?? null,
    deepSec: latestSleep.deep_sleep_duration ?? null,
    lightSec: latestSleep.light_sleep_duration ?? null,
    efficiency: latestSleep.efficiency ?? null,
    latencySec: latestSleep.latency ?? null,
    averageBreath: latestSleep.average_breath ?? null,
    averageHeartRate: latestSleep.average_heart_rate ?? null,
    lowestHeartRate: latestSleep.lowest_heart_rate ?? null,
    averageHrv: latestSleep.average_hrv ?? null,
  } : null;

  return {
    configured: true,
    days: boundedDays,
    generatedAt: new Date().toISOString(),
    endpoints: {
      daily: { ok: true, reason: daily.unauthorized ? 'unauthorized' : null },
      heartrate: endpoint(heartRate),
      sleep_sessions: endpoint(sleepSessions),
      stress: endpoint(stress),
      spo2: endpoint(spo2),
      workouts: endpoint(workouts),
      resilience: endpoint(resilience),
      cardiovascular_age: endpoint(cardiovascularAge),
    },
    daily: daily.days || [],
    heartRate: hrRows,
    heartRateSummary: hrSummary,
    sleepSessions: sleepSessions.data || [],
    latestSleepDetail: sleepDetail,
    stress: stress.data || [],
    latestStress: latestBy(stress.data || [], 'day'),
    spo2: spo2.data || [],
    latestSpo2: latestBy(spo2.data || [], 'day'),
    workouts: workouts.data || [],
    resilience: resilience.data || [],
    latestResilience: latestBy(resilience.data || [], 'day'),
    cardiovascularAge: cardiovascularAge.data || [],
    latestCardiovascularAge: latestBy(cardiovascularAge.data || [], 'day'),
  };
}

/** Sync Oura readiness/activity into hs_health_daily (source: oura). */
export async function syncToHealthDaily({ days = 14 } = {}) {
  const res = await fetchDaily({ days });
  if (!res.configured) return { ok: false, reason: 'no_token', synced: 0 };
  let synced = 0;
  for (const d of res.days) {
    if (!d.date) continue;
    const existing = hs.getHealthDaily(d.date) || {};
    hs.upsertHealthDaily(d.date, {
      ...existing,
      movement_min: d.movement_min ?? existing.movement_min ?? 0,
      readiness: d.readiness ?? existing.readiness ?? null,
      energy: existing.energy ?? null,
      source: 'oura',
    });
    synced++;
  }
  return { ok: true, synced, unauthorized: res.unauthorized };
}

/** Snapshot for Today/Health header. */
export async function snapshot() {
  if (!isConfigured()) return { configured: false };
  const res = await fetchDaily({ days: 3 });
  const latest = res.days[res.days.length - 1] || null;
  return { configured: true, unauthorized: res.unauthorized, latest, recent: res.days, endpointStatus: res.endpointStatus };
}
