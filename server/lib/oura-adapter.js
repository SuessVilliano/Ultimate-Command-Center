/**
 * Oura adapter (HealthProvider)
 *
 * Reads from the Oura API v2 using a Personal Access Token in OURA_ACCESS_TOKEN
 * (or OURA_TOKEN). Normalizes readiness / sleep / activity into the shape the
 * Health OS uses, and can sync into hs_health_daily.
 *
 * Read-only. No Oura data is written back. Missing token/scopes degrade
 * gracefully instead of throwing.
 *
 * Docs: https://cloud.ouraring.com/v2/docs  (endpoints under /v2/usercollection)
 */

import * as hs from './highest-self-db.js';

const BASE = 'https://api.ouraring.com/v2/usercollection';

function token() { return process.env.OURA_ACCESS_TOKEN || process.env.OURA_TOKEN || process.env.OURA_RING_TOKEN || null; }
export function isConfigured() { return !!token(); }

async function get(path, params = {}) {
  const t = token();
  if (!t) return { ok: false, reason: 'no_token', data: [] };
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${BASE}/${path}?${qs}`, { headers: { Authorization: `Bearer ${t}` } });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized', data: [] };
    if (!res.ok) return { ok: false, reason: `http_${res.status}`, data: [] };
    const json = await res.json();
    return { ok: true, data: json.data || [] };
  } catch (e) {
    return { ok: false, reason: e.message, data: [] };
  }
}

const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

/** Pull readiness + sleep + activity for a date range and normalize by day. */
export async function fetchDaily({ days = 14 } = {}) {
  if (!isConfigured()) return { configured: false, days: [] };
  const start = isoDaysAgo(days), end = isoDaysAgo(-1);
  const params = { start_date: start, end_date: end };
  const [readiness, sleep, activity] = await Promise.all([
    get('daily_readiness', params), get('daily_sleep', params), get('daily_activity', params),
  ]);

  const byDay = {};
  const put = (day, patch) => { byDay[day] = { ...(byDay[day] || { date: day }), ...patch }; };
  for (const r of readiness.data) put(r.day, { readiness: r.score ?? null });
  for (const s of sleep.data) put(s.day, { sleep: s.score ?? null });
  for (const a of activity.data) {
    put(a.day, {
      activity: a.score ?? null,
      movement_min: Math.round(((a.high_activity_time || 0) + (a.medium_activity_time || 0) + (a.low_activity_time || 0)) / 60) || null,
      steps: a.steps ?? null,
    });
  }
  return {
    configured: true,
    unauthorized: readiness.reason === 'unauthorized',
    days: Object.values(byDay).sort((a, b) => (a.date || '').localeCompare(b.date || '')),
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
      // only fill Oura-derived fields; keep any manual entries intact
      movement_min: d.movement_min ?? existing.movement_min ?? 0,
      readiness: d.readiness ?? existing.readiness ?? null,
      energy: existing.energy ?? null,
      source: 'oura',
    });
    synced++;
  }
  return { ok: true, synced, unauthorized: res.unauthorized };
}

/** Snapshot for the Today/Health header. */
export async function snapshot() {
  if (!isConfigured()) return { configured: false };
  const res = await fetchDaily({ days: 3 });
  const latest = res.days[res.days.length - 1] || null;
  return { configured: true, unauthorized: res.unauthorized, latest, recent: res.days };
}
