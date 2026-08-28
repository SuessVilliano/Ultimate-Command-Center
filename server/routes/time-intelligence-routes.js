import * as ollama from '../lib/ollama-provider.js';
import { getCommanderPrompt } from '../lib/system-prompt.js';

const PORT = () => process.env.PORT || 3005;

const PERIODS = {
  yesterday: { label: 'Yesterday', direction: 'past', unit: 'day', offset: -1 },
  today: { label: 'Today', direction: 'present', unit: 'day', offset: 0 },
  tomorrow: { label: 'Tomorrow', direction: 'future', unit: 'day', offset: 1 },
  last_week: { label: 'Last week', direction: 'past', unit: 'week', offset: -1 },
  this_week: { label: 'This week', direction: 'present', unit: 'week', offset: 0 },
  next_week: { label: 'Next week', direction: 'future', unit: 'week', offset: 1 },
  last_month: { label: 'Last month', direction: 'past', unit: 'month', offset: -1 },
  this_month: { label: 'This month', direction: 'present', unit: 'month', offset: 0 },
  next_month: { label: 'Next month', direction: 'future', unit: 'month', offset: 1 },
  this_quarter: { label: 'This quarter', direction: 'present', unit: 'quarter', offset: 0 },
  this_year: { label: 'This year', direction: 'present', unit: 'year', offset: 0 },
};

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function clone(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = clone(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) { const x = clone(d); const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1); return x; }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfQuarter(d) { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1); }

function windowFor(key, now = new Date()) {
  const p = PERIODS[key] || PERIODS.today;
  let start; let end;
  if (p.unit === 'day') {
    start = addDays(now, p.offset);
    end = start;
  } else if (p.unit === 'week') {
    start = addDays(mondayOf(now), p.offset * 7);
    end = addDays(start, 6);
  } else if (p.unit === 'month') {
    const base = new Date(now.getFullYear(), now.getMonth() + p.offset, 1);
    start = base;
    end = endOfMonth(base);
  } else if (p.unit === 'quarter') {
    start = startOfQuarter(now);
    end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  }
  return { key, ...p, start: ymd(start), end: ymd(end) };
}

function daysBetween(start, end) {
  return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
}

function rowDate(row) {
  return String(row?.date || row?.day || row?.start_date || row?.created_at || row?.timestamp || '').slice(0, 10);
}

function filterRowsToWindow(payload, window) {
  if (!payload) return payload;
  const rows = Array.isArray(payload) ? payload : (Array.isArray(payload.rows) ? payload.rows : null);
  if (!rows) return payload;
  const filtered = rows.filter(r => {
    const d = rowDate(r);
    return d && d >= window.start && d <= window.end;
  });
  return Array.isArray(payload) ? filtered : { ...payload, rows: filtered };
}

async function internal(path, { method = 'GET', body } = {}) {
  const res = await fetch(`http://127.0.0.1:${PORT()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  let data;
  try { data = await res.json(); } catch { data = { text: await res.text().catch(() => '') }; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function source(name, fn) {
  const started = Date.now();
  try {
    const data = await fn();
    return { name, ok: true, ms: Date.now() - started, data };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - started, error: e?.message || 'Unavailable' };
  }
}

function clip(v, max = 7000) {
  let s;
  try { s = JSON.stringify(v); } catch { s = String(v); }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

async function collect(window) {
  const now = ymd(new Date());
  const span = Math.min(daysBetween(window.start, window.end), 365);
  const historyLookback = window.direction === 'past'
    ? Math.min(daysBetween(window.start, now), 365)
    : Math.max(Math.min(span, 365), 7);
  const daily = window.start === window.end;
  const future = window.direction === 'future';

  const jobs = [
    source('nifty.projects', () => internal('/api/nifty/projects')),
    source('nifty.chats', () => internal('/api/nifty/mcp/chats?limit=12')),
    source('apple_health.history', async () => filterRowsToWindow(await internal(`/api/hs/health/apple/history?days=${historyLookback}`), window)),
    source('oura.snapshot', () => internal('/api/hs/health/oura/snapshot')),
    source('ghl.opportunities', () => internal('/api/ghl/opportunities')),
    source('integrations.status', () => internal('/api/integrations/status')),
  ];

  if (daily) {
    jobs.push(source('highest_self.intention', () => internal(`/api/hs/intention?date=${window.start}`)));
    jobs.push(source('highest_self.reflection', () => internal(`/api/hs/reflection?date=${window.start}`)));
    jobs.push(source('highest_self.hour_of_me', () => internal(`/api/hs/hour-of-me?date=${window.start}`)));
    jobs.push(source('health_os.day', () => internal(`/api/hs/health/daily?date=${window.start}`)));
  }

  if (window.unit === 'week') {
    jobs.push(source('highest_self.weekly_review', () => internal(`/api/hs/weekly-review?week_start=${window.start}`)));
  }

  jobs.push(source('hybrid_journal.performance', () => internal('/api/trading/hybrid-journal/analyze', {
    method: 'POST',
    body: { analysisType: 'weekly_summary', dateRange: { start: window.start, end: window.end } }
  })));

  if (window.key === 'today') {
    jobs.push(source('calendar.today', () => internal('/api/calendar/today')));
    jobs.push(source('calendar.upcoming', () => internal('/api/calendar/upcoming?hours=48')));
  } else if (future) {
    const hours = Math.min(span * 24, 24 * 60);
    jobs.push(source('calendar.upcoming', () => internal(`/api/calendar/upcoming?hours=${hours}`)));
  } else if (window.direction === 'present') {
    jobs.push(source('calendar.upcoming', () => internal('/api/calendar/upcoming?hours=336')));
  }

  return Promise.all(jobs);
}

function sourceContext(results) {
  return results.map(r => r.ok
    ? `SOURCE ${r.name} (confirmed):\n${clip(r.data)}`
    : `SOURCE ${r.name} (unavailable): ${r.error}`
  ).join('\n\n');
}

function localGoalContext(body = {}) {
  const goals = Array.isArray(body.goals) ? body.goals : [];
  const focus = body.todayFocus || null;
  const completed = Array.isArray(body.completedToday) ? body.completedToday : [];
  const wellness = body.wellness || null;
  return clip({ goals, todayFocus: focus, completedToday: completed, wellness }, 7000);
}

async function synthesize(window, results, body) {
  const mode = window.direction === 'past' ? 'RECAP' : window.direction === 'future' ? 'LOOK AHEAD' : 'TRACKING';
  const prompt = `${getCommanderPrompt()}\n\nTIME INTELLIGENCE MODE: ${mode}\nWINDOW: ${window.label} (${window.start} through ${window.end})\n\nLOCAL GOALS / FOCUS CONTEXT:\n${localGoalContext(body)}\n\nCONNECTED SOURCE DATA:\n${sourceContext(results)}\n\nReturn STRICT JSON only with this shape:\n{\n  \"headline\": \"one sharp sentence\",\n  \"summary\": \"2-4 sentence executive summary\",\n  \"score\": 0-100,\n  \"status\": \"on_track|watch|off_track|insufficient_data\",\n  \"wins\": [\"...\"],\n  \"misses\": [\"...\"],\n  \"goalAlignment\": [ { \"goal\": \"...\", \"status\": \"on_track|watch|off_track|unknown\", \"evidence\": \"...\" } ],\n  \"attention\": [\"...\"],\n  \"opportunities\": [\"...\"],\n  \"nextActions\": [\"...\"],\n  \"questions\": [\"...\"]\n}\n\nRules: use only confirmed data. Distinguish missing data from poor performance. Never invent completed work, trading results, health metrics, appointments, messages, or revenue. A current-state source such as Nifty projects or GHL opportunities may inform what is open now, but must not be treated as proof that something happened inside a historical window unless timestamps confirm it. Keep arrays concise (max 5 each). For future windows, misses should be empty and nextActions should emphasize preparation. For past windows, emphasize what happened vs goals. For present windows, emphasize pace and what must happen next.`;

  const ai = await ollama.chat([{ role: 'user', content: `Build my ${window.label.toLowerCase()} command summary.` }], {
    systemPrompt: prompt,
    maxTokens: 1500,
    temperature: 0.25,
  });

  let parsed;
  try {
    const m = ai.text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : ai.text);
  } catch {
    parsed = {
      headline: `${window.label} summary ready`, summary: ai.text,
      score: null, status: 'insufficient_data', wins: [], misses: [], goalAlignment: [], attention: [], opportunities: [], nextActions: [], questions: []
    };
  }
  return { ...parsed, provider: ai.provider, model: ai.model };
}

export function registerTimeIntelligenceRoutes(app) {
  app.get('/api/intelligence/periods', (req, res) => {
    res.json({ periods: Object.keys(PERIODS).map(key => windowFor(key)) });
  });

  app.post('/api/intelligence/period', async (req, res) => {
    try {
      const period = PERIODS[req.body?.period] ? req.body.period : 'today';
      const window = windowFor(period);
      const results = await collect(window);
      const intelligence = await synthesize(window, results, req.body || {});
      res.json({
        ok: true,
        window,
        intelligence,
        sources: results.map(r => ({ name: r.name, ok: r.ok, ms: r.ms, error: r.error || null })),
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || 'Time intelligence failed' });
    }
  });
}

export default registerTimeIntelligenceRoutes;
