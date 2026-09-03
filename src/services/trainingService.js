import { API_URL } from '../config';

const LS_KEY = 'liv8-health-training-log-v1';

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function writeLocal(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
  return items;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getTrainingSessions(limit = 100) {
  try {
    const res = await api(`/api/hs/health/training?limit=${limit}`);
    const sessions = res.sessions || [];
    writeLocal(sessions);
    return sessions;
  } catch {
    return readLocal();
  }
}

export async function saveTrainingSession(session) {
  const item = { ...session, clientId: session.clientId || session.id || `${Date.now()}-${session.type}` };
  try {
    const res = await api('/api/hs/health/training', { method: 'POST', body: item });
    const local = readLocal().filter(x => (x.clientId || x.id) !== item.clientId);
    writeLocal([res.session || item, ...local]);
    return res;
  } catch {
    const local = readLocal().filter(x => (x.clientId || x.id) !== item.clientId);
    writeLocal([item, ...local]);
    return { ok: false, offline: true, session: item };
  }
}

export async function getTrainingStats(days = 7) {
  try {
    const res = await api(`/api/hs/health/training/stats?days=${days}`);
    return res.stats;
  } catch {
    const since = Date.now() - days * 86400000;
    const rows = readLocal().filter(x => new Date(x.date).getTime() >= since);
    const strength = rows.filter(x => x.type === 'strength');
    const rides = rows.filter(x => x.type === 'bike');
    return {
      days,
      strengthSessions: strength.length,
      rides: rides.length,
      bikeMiles: rides.reduce((s, x) => s + Number(x.distance || 0), 0),
      bikeMinutes: rides.reduce((s, x) => s + Number(x.duration || 0), 0),
      avgRideSpeed: rides.length ? rides.reduce((s, x) => s + Number(x.avgSpeed || 0), 0) / Math.max(1, rides.filter(x => Number(x.avgSpeed || 0) > 0).length) : 0,
      longestRide: rides.reduce((m, x) => Math.max(m, Number(x.distance || 0)), 0),
      strengthCompletionPct: strength.length ? Math.round(strength.reduce((s, x) => s + (x.total ? Number(x.completed || 0) / Number(x.total) : 0), 0) / strength.length * 100) : 0,
      recent: rows.slice(0, 12),
      offline: true,
    };
  }
}
