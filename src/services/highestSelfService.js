/**
 * Highest Self OS - frontend API client
 *
 * Talks to the /api/hs/* endpoints, but degrades gracefully to localStorage
 * so every surface stays usable even when the AI server isn't running.
 * Nothing here triggers external writes.
 */

import { API_URL } from '../config';

const LS = 'hs_local_v1';

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; }
}
function writeLocal(patch) {
  const cur = readLocal();
  const next = { ...cur, ...patch };
  localStorage.setItem(LS, JSON.stringify(next));
  return next;
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

/* ---------------- MIND MAP ---------------- */
export async function getGraph() {
  try { return await api('/api/hs/graph'); }
  catch {
    const l = readLocal();
    return { notes: l.notes || seedNotes(), links: l.links || seedLinks(), plans: l.plans || [] };
  }
}
export async function saveGraphLocal(graph) { writeLocal(graph); }

export async function createNote(note) {
  try { return await api('/api/hs/notes', { method: 'POST', body: note }); }
  catch {
    const l = readLocal(); const notes = l.notes || [];
    const n = { id: Date.now(), created_at: new Date().toISOString(), ...note };
    writeLocal({ notes: [...notes, n] }); return n;
  }
}
export async function updateNote(id, patch) {
  try { return await api(`/api/hs/notes/${id}`, { method: 'PUT', body: patch }); }
  catch {
    const l = readLocal();
    const notes = (l.notes || []).map(n => n.id === id ? { ...n, ...patch } : n);
    writeLocal({ notes }); return notes.find(n => n.id === id);
  }
}
export async function deleteNote(id) {
  try { return await api(`/api/hs/notes/${id}`, { method: 'DELETE' }); }
  catch {
    const l = readLocal();
    writeLocal({
      notes: (l.notes || []).filter(n => n.id !== id),
      links: (l.links || []).filter(e => e.from_id !== id && e.to_id !== id),
    });
    return { deleted: id };
  }
}
export async function linkNotes(from_id, to_id, relationship = 'related') {
  try { return await api('/api/hs/links', { method: 'POST', body: { from_id, to_id, relationship } }); }
  catch {
    const l = readLocal(); const links = l.links || [];
    if (links.some(e => e.from_id === from_id && e.to_id === to_id)) return null;
    const e = { id: Date.now(), from_id, to_id, relationship };
    writeLocal({ links: [...links, e] }); return e;
  }
}
export async function unlinkNotes(id) {
  try { return await api(`/api/hs/links/${id}`, { method: 'DELETE' }); }
  catch { const l = readLocal(); writeLocal({ links: (l.links || []).filter(e => e.id !== id) }); return { deleted: id }; }
}
export async function createMasterPlan(plan) {
  try { return await api('/api/hs/master-plans', { method: 'POST', body: plan }); }
  catch {
    const l = readLocal(); const plans = l.plans || [];
    const p = { id: Date.now(), created_at: new Date().toISOString(), ...plan,
      note_ids_json: JSON.stringify(plan.note_ids || []), milestones_json: JSON.stringify(plan.milestones || []) };
    writeLocal({ plans: [...plans, p] }); return p;
  }
}
export async function updateMasterPlan(id, patch) {
  try { return await api(`/api/hs/master-plans/${id}`, { method: 'PUT', body: patch }); }
  catch {
    const l = readLocal();
    const plans = (l.plans || []).map(p => p.id === id ? { ...p, ...patch,
      milestones_json: JSON.stringify(patch.milestones ?? JSON.parse(p.milestones_json || '[]')) } : p);
    writeLocal({ plans }); return plans.find(p => p.id === id);
  }
}
export async function deleteMasterPlan(id) {
  try { return await api(`/api/hs/master-plans/${id}`, { method: 'DELETE' }); }
  catch { const l = readLocal(); writeLocal({ plans: (l.plans || []).filter(p => p.id !== id) }); return { deleted: id }; }
}

/* ---------------- SELF / TODAY ---------------- */
const dayKey = (d) => `day_${d}`;
export async function getIntention(date) {
  try { return await api(`/api/hs/intention?date=${date}`); }
  catch { return readLocal()[`intention_${date}`] || {}; }
}
export async function saveIntention(date, v) {
  try { return await api('/api/hs/intention', { method: 'POST', body: { date, ...v } }); }
  catch { writeLocal({ [`intention_${date}`]: { date, ...v } }); return { date, ...v }; }
}
export async function getReflection(date) {
  try { return await api(`/api/hs/reflection?date=${date}`); }
  catch { return readLocal()[`reflection_${date}`] || {}; }
}
export async function saveReflection(date, v) {
  try { return await api('/api/hs/reflection', { method: 'POST', body: { date, ...v } }); }
  catch { writeLocal({ [`reflection_${date}`]: { date, ...v } }); return { date, ...v }; }
}
export async function getHourOfMe(date) {
  try { return await api(`/api/hs/hour-of-me?date=${date}`); }
  catch { return readLocal()[`hom_${date}`] || {}; }
}
export async function saveHourOfMe(date, v) {
  try { return await api('/api/hs/hour-of-me', { method: 'POST', body: { date, ...v } }); }
  catch { writeLocal({ [`hom_${date}`]: { date, ...v } }); return { date, ...v }; }
}
export async function getWeeklyReview(week_start) {
  try { return await api(`/api/hs/weekly-review?week_start=${week_start}`); }
  catch { return readLocal()[`wr_${week_start}`] || {}; }
}
export async function saveWeeklyReview(week_start, v) {
  try { return await api('/api/hs/weekly-review', { method: 'POST', body: { week_start, ...v } }); }
  catch { writeLocal({ [`wr_${week_start}`]: { week_start, ...v } }); return { week_start, ...v }; }
}

/* ---------------- TRADING ---------------- */
export async function getAlerts(limit = 100) {
  try { return await api(`/api/hs/trading/alerts?limit=${limit}`); }
  catch { return readLocal().alerts || []; }
}
export async function addAlert(a) {
  try { return await api('/api/hs/trading/alerts', { method: 'POST', body: a }); }
  catch { const l = readLocal(); const alerts = l.alerts || []; const x = { id: Date.now(), ts: new Date().toISOString(), status: 'fired', ...a }; writeLocal({ alerts: [x, ...alerts] }); return x; }
}
export async function setAlertStatus(id, status) {
  try { return await api(`/api/hs/trading/alerts/${id}`, { method: 'PATCH', body: { status } }); }
  catch { const l = readLocal(); const alerts = (l.alerts || []).map(a => a.id === id ? { ...a, status } : a); writeLocal({ alerts }); return alerts.find(a => a.id === id); }
}
export async function getTrades(limit = 200) {
  try { return await api(`/api/hs/trading/trades?limit=${limit}`); }
  catch { return readLocal().trades || []; }
}
export async function addTrade(t) {
  try { return await api('/api/hs/trading/trades', { method: 'POST', body: t }); }
  catch { const l = readLocal(); const trades = l.trades || []; const x = { id: Date.now(), ts: new Date().toISOString(), ...t }; writeLocal({ trades: [x, ...trades] }); return x; }
}
export async function getAdherence(days = 30) {
  try { return await api(`/api/hs/trading/adherence?days=${days}`); }
  catch {
    const trades = readLocal().trades || [];
    const total = trades.length; const onSetup = trades.filter(t => t.on_setup).length;
    const followed = trades.filter(t => t.followed_plan).length;
    return { days, trades: total, onSetup, random: total - onSetup,
      onSetupPct: total ? Math.round(onSetup / total * 100) : null,
      followedPlanPct: total ? Math.round(followed / total * 100) : null,
      pnl: trades.reduce((s, t) => s + (+t.pnl || 0), 0) };
  }
}

/* ---------------- HEALTH ---------------- */
export async function getHealthSnapshot() {
  try { return await api('/api/hs/health/snapshot'); }
  catch { const l = readLocal(); return { plan: l.healthPlan || localHealthPlan(), latestMetrics: (l.bodyMetrics || [])[0] || null, metrics: l.bodyMetrics || [], markerSummary: summarizeLabs(l.labs || []) }; }
}
export async function getHealthPlan() {
  try { return await api('/api/hs/health/plan'); }
  catch { return readLocal().healthPlan || localHealthPlan(); }
}
export async function saveHealthPlan(v) {
  try { return await api('/api/hs/health/plan', { method: 'POST', body: v }); }
  catch { const p = { ...localHealthPlan(), ...v, targets_json: JSON.stringify(v.targets || {}), training_json: JSON.stringify(v.training || []), nutrition_json: JSON.stringify(v.nutrition || []) }; writeLocal({ healthPlan: p }); return p; }
}
export async function getBodyMetrics(limit = 120) {
  try { return await api(`/api/hs/health/metrics?limit=${limit}`); }
  catch { return readLocal().bodyMetrics || []; }
}
export async function addBodyMetric(m) {
  try { return await api('/api/hs/health/metrics', { method: 'POST', body: m }); }
  catch { const l = readLocal(); const x = { id: Date.now(), ...m }; writeLocal({ bodyMetrics: [x, ...(l.bodyMetrics || [])] }); return x; }
}
export async function getLabs(limit = 300) {
  try { return await api(`/api/hs/health/labs?limit=${limit}`); }
  catch { return readLocal().labs || []; }
}
export async function addLab(x) {
  try { return await api('/api/hs/health/labs', { method: 'POST', body: x }); }
  catch { const l = readLocal(); const y = { id: Date.now(), ...x }; writeLocal({ labs: [y, ...(l.labs || [])] }); return y; }
}
export async function getHealthDaily(date) {
  try { return await api(`/api/hs/health/daily?date=${date}`); }
  catch { return readLocal()[`hd_${date}`] || {}; }
}
export async function saveHealthDaily(date, v) {
  try { return await api('/api/hs/health/daily', { method: 'POST', body: { date, ...v } }); }
  catch { writeLocal({ [`hd_${date}`]: { date, ...v } }); return { date, ...v }; }
}

/* ---------------- FAMILY ---------------- */
export async function getPeople() {
  try { return await api('/api/hs/family/people'); }
  catch { return readLocal().people_family || seedFamily().people; }
}
export async function addPerson(p) {
  try { return await api('/api/hs/family/people', { method: 'POST', body: p }); }
  catch { const l = readLocal(); const people = l.people_family || seedFamily().people; const x = { id: Date.now(), ...p }; writeLocal({ people_family: [...people, x] }); return x; }
}
export async function updatePerson(id, patch) {
  try { return await api(`/api/hs/family/people/${id}`, { method: 'PUT', body: patch }); }
  catch { const l = readLocal(); const people = (l.people_family || []).map(p => p.id === id ? { ...p, ...patch } : p); writeLocal({ people_family: people }); return people.find(p => p.id === id); }
}
export async function deletePerson(id) {
  try { return await api(`/api/hs/family/people/${id}`, { method: 'DELETE' }); }
  catch { const l = readLocal(); writeLocal({ people_family: (l.people_family || []).filter(p => p.id !== id) }); return { deleted: id }; }
}
export async function getProtectedDates() {
  try { return await api('/api/hs/family/protected'); }
  catch { return readLocal().protected_dates || seedFamily().protectedDates; }
}
export async function addProtectedDate(v) {
  try { return await api('/api/hs/family/protected', { method: 'POST', body: v }); }
  catch { const l = readLocal(); const arr = l.protected_dates || []; const x = { id: Date.now(), ...v }; writeLocal({ protected_dates: [...arr, x] }); return x; }
}
export async function deleteProtectedDate(id) {
  try { return await api(`/api/hs/family/protected/${id}`, { method: 'DELETE' }); }
  catch { const l = readLocal(); writeLocal({ protected_dates: (l.protected_dates || []).filter(p => p.id !== id) }); return { deleted: id }; }
}
export async function getFamilyEvents() {
  try { return await api('/api/hs/family/events'); }
  catch { return readLocal().family_events || []; }
}
export async function addFamilyEvent(v) {
  try { return await api('/api/hs/family/events', { method: 'POST', body: v }); }
  catch { const l = readLocal(); const arr = l.family_events || []; const x = { id: Date.now(), ...v }; writeLocal({ family_events: [...arr, x] }); return x; }
}
export async function deleteFamilyEvent(id) {
  try { return await api(`/api/hs/family/events/${id}`, { method: 'DELETE' }); }
  catch { const l = readLocal(); writeLocal({ family_events: (l.family_events || []).filter(p => p.id !== id) }); return { deleted: id }; }
}
export async function getFamilyHorizon(days = 120) {
  try { return await api(`/api/hs/family/horizon?days=${days}`); }
  catch { return localFamilyHorizon(days); }
}

/* ---------------- OURA ---------------- */
export async function getOuraStatus() {
  try { return await api('/api/hs/health/oura/status'); } catch { return { configured: false }; }
}
export async function getOuraSnapshot() {
  try { return await api('/api/hs/health/oura/snapshot'); } catch { return { configured: false }; }
}
export async function syncOura(days = 14) {
  try { return await api('/api/hs/health/oura/sync', { method: 'POST', body: { days } }); }
  catch { return { ok: false, reason: 'server_unavailable' }; }
}

/* ---------------- WEALTH / CREATION ---------------- */
export async function getProjects() {
  try { return await api('/api/hs/projects'); }
  catch { const l = readLocal(); const projects = l.projects_hs || seedProjects(); return localProjectsOverview(projects, l.project_cap || 4); }
}
export async function addProject(p) {
  try { return await api('/api/hs/projects', { method: 'POST', body: p }); }
  catch { const l = readLocal(); const projects = l.projects_hs || seedProjects(); const x = { id: Date.now(), operating_state: 'idea', strategic_type: 'cash_flow', domain: 'wealth', ...p }; writeLocal({ projects_hs: [...projects, x] }); return x; }
}
export async function updateProject(id, patch) {
  try { return await api(`/api/hs/projects/${id}`, { method: 'PUT', body: patch }); }
  catch { const l = readLocal(); const projects = (l.projects_hs || []).map(p => p.id === id ? { ...p, ...patch } : p); writeLocal({ projects_hs: projects }); return projects.find(p => p.id === id); }
}
export async function deleteProject(id) {
  try { return await api(`/api/hs/projects/${id}`, { method: 'DELETE' }); }
  catch { const l = readLocal(); writeLocal({ projects_hs: (l.projects_hs || []).filter(p => p.id !== id) }); return { deleted: id }; }
}
export async function setProjectCap(cap) {
  try { return await api('/api/hs/projects/cap', { method: 'POST', body: { cap } }); }
  catch { writeLocal({ project_cap: cap }); return { cap }; }
}
export async function getIdeas() {
  try { return await api('/api/hs/ideas'); }
  catch { return readLocal().ideas_hs || []; }
}
export async function addIdea(v) {
  try { return await api('/api/hs/ideas', { method: 'POST', body: v }); }
  catch { const l = readLocal(); const arr = l.ideas_hs || []; const x = { id: Date.now(), stage: 'idea', ...v }; writeLocal({ ideas_hs: [x, ...arr] }); return x; }
}
export async function updateIdea(id, patch) {
  try { return await api(`/api/hs/ideas/${id}`, { method: 'PUT', body: patch }); }
  catch { const l = readLocal(); const arr = (l.ideas_hs || []).map(i => i.id === id ? { ...i, ...patch } : i); writeLocal({ ideas_hs: arr }); return arr.find(i => i.id === id); }
}
export async function deleteIdea(id) {
  try { return await api(`/api/hs/ideas/${id}`, { method: 'DELETE' }); }
  catch { const l = readLocal(); writeLocal({ ideas_hs: (l.ideas_hs || []).filter(i => i.id !== id) }); return { deleted: id }; }
}
export async function promoteIdea(id, opts = {}) {
  try { return await api(`/api/hs/ideas/${id}/promote`, { method: 'POST', body: opts }); }
  catch {
    const l = readLocal(); const idea = (l.ideas_hs || []).find(i => i.id === id); if (!idea) return { error: 'not_found' };
    const projects = l.projects_hs || seedProjects();
    if (opts.operating_state === 'active' && projects.filter(p => p.operating_state === 'active').length >= (l.project_cap || 4)) return { error: 'over_capacity', cap: l.project_cap || 4 };
    const project = { id: Date.now(), name: idea.title, domain: idea.domain, strategic_type: idea.strategic_type, operating_state: opts.operating_state || 'idea' };
    writeLocal({ projects_hs: [...projects, project], ideas_hs: (l.ideas_hs || []).map(i => i.id === id ? { ...i, stage: 'project', promoted_project_id: project.id } : i) });
    return { project };
  }
}

export async function syncGitHubProjects(refresh = false) {
  try { return await api('/api/hs/projects/sync-github', { method: 'POST', body: { refresh } }); }
  catch { return { ok: false, reason: 'server_unavailable' }; }
}

/* ---------------- TODAY ---------------- */
export async function getTodayBrief(date) {
  try { return await api(`/api/hs/today${date ? `?date=${date}` : ''}`); }
  catch { return null; }
}

/* ---------------- HYBRID JOURNAL ---------------- */
export async function getHybridJournalStatus() {
  try { return await api('/api/hs/trading/hybrid-journal/status'); } catch { return { configured: false }; }
}
export async function syncHybridJournal(limit = 200) {
  try { return await api('/api/hs/trading/hybrid-journal/sync', { method: 'POST', body: { limit } }); }
  catch { return { ok: false, reason: 'server_unavailable' }; }
}

/* ---------------- local fallbacks ---------------- */
function seedProjects() {
  const P = (id, name, strategic_type, operating_state, domain) => ({ id, name, strategic_type, operating_state, domain });
  const list = [
    P(1, 'Smart Life Brokers', 'asset', 'active', 'wealth'),
    P(2, 'Hybrid Funding', 'cash_flow', 'active', 'wealth'),
    P(3, 'Trade Hybrid', 'asset', 'active', 'wealth'),
    P(4, 'Hybrid Journal', 'asset', 'active', 'creation'),
    P(5, 'LIV8 Health', 'cash_flow', 'maintenance', 'wealth'),
    P(6, 'LIV8 AI / Elevate OS', 'moonshot', 'active', 'creation'),
    P(7, 'LIV8 Solar', 'cash_flow', 'maintenance', 'wealth'),
    P(8, 'Agency Owner Support', 'cash_flow', 'parked', 'wealth'),
    P(9, 'OMet', 'moonshot', 'idea', 'creation'),
    P(10, 'Broker Aggregator', 'asset', 'parked', 'creation'),
    P(11, 'ABATEV', 'moonshot', 'idea', 'creation'),
  ];
  writeLocal({ projects_hs: list });
  return list;
}
function localProjectsOverview(projects, cap) {
  const byType = { cash_flow: 0, asset: 0, moonshot: 0 }, byState = { active: 0, maintenance: 0, parked: 0, idea: 0, archived: 0 };
  let monthlyCost = 0, recurring = 0;
  for (const p of projects) { byType[p.strategic_type] = (byType[p.strategic_type] || 0) + 1; byState[p.operating_state] = (byState[p.operating_state] || 0) + 1; monthlyCost += p.monthly_cost || 0; recurring += p.recurring_revenue || 0; }
  const activeCount = byState.active;
  return { projects, cap, activeCount, overCapacity: activeCount > cap, byType, byState, monthlyCost, recurring };
}

function seedFamily() {
  const people = [
    { id: 1, name: 'Jovi', relationship: 'child', city: 'Wesley Chapel', school_name: 'Watergrass Elementary', lives_with: 1, birthday_month: 11, birthday_day: 22, color: '#f59e0b' },
    { id: 2, name: 'Jionni', relationship: 'child', city: 'Orlando', school_name: 'Innovation', birthday_month: 2, birthday_day: 25, color: '#60a5fa' },
    { id: 3, name: 'Justis', relationship: 'child', city: 'Sandy Springs / Atlanta', school_name: 'Riverwood', birthday_month: 4, birthday_day: 23, color: '#f472b6' },
    { id: 4, name: 'Me', relationship: 'self', birthday_month: 8, birthday_day: 6, color: '#a78bfa' },
    { id: 5, name: 'Mom', relationship: 'parent', birthday_month: 8, birthday_day: 17, color: '#2dd4bf' },
  ];
  const protectedDates = [
    { id: 1, person_id: 4, title: 'My birthday', event_type: 'birthday', month: 8, day: 6, protection_level: 'soft' },
    { id: 2, person_id: 5, title: "Mom's birthday", event_type: 'birthday', month: 8, day: 17, protection_level: 'soft' },
    { id: 3, person_id: 1, title: "Jovi's birthday", event_type: 'birthday', month: 11, day: 22, protection_level: 'hard' },
    { id: 4, person_id: 2, title: "Jionni's birthday", event_type: 'birthday', month: 2, day: 25, protection_level: 'hard', travel_required: 1 },
    { id: 5, person_id: 3, title: "Justis's birthday", event_type: 'birthday', month: 4, day: 23, protection_level: 'hard', travel_required: 1 },
  ];
  const l = readLocal();
  if (!l.people_family) writeLocal({ people_family: people, protected_dates: protectedDates });
  return { people, protectedDates };
}
function localFamilyHorizon(days) {
  const { people, protectedDates } = { people: readLocal().people_family || seedFamily().people, protectedDates: readLocal().protected_dates || seedFamily().protectedDates };
  const today = new Date();
  const horizon = new Date(today.getTime() + days * 864e5);
  const pMap = Object.fromEntries(people.map(p => [p.id, p]));
  const nextOcc = (m, d) => { if (!m || !d) return null; let y = today.getFullYear(); let x = new Date(y, m - 1, d); if (x < new Date(today.getFullYear(), today.getMonth(), today.getDate())) x = new Date(y + 1, m - 1, d); return x; };
  const upcoming = protectedDates.map(pd => {
    const dt = nextOcc(pd.month, pd.day); if (!dt || dt > horizon) return null;
    const daysUntil = Math.round((dt - today) / 864e5);
    return { id: pd.id, title: pd.title, event_type: pd.event_type, person: pd.person_id ? pMap[pd.person_id]?.name : null, date: dt.toISOString().slice(0, 10), daysUntil, protection_level: pd.protection_level, travel_required: !!pd.travel_required, planningWindow: pd.travel_required && daysUntil <= 45 };
  }).filter(Boolean).sort((a, b) => a.daysUntil - b.daysUntil);
  return { people, upcoming, overlaps: [], ptoCandidates: [] };
}

function summarizeLabs(labs) {
  const by = {};
  for (const l of labs) { (by[l.marker] ||= []).push(l); }
  return Object.entries(by).map(([marker, rows]) => {
    rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latest = rows[0], prev = rows[1];
    const onTarget = latest.target == null ? null
      : latest.goal_direction === 'higher' ? +latest.value >= +latest.target : +latest.value <= +latest.target;
    return { marker, value: latest.value, unit: latest.unit, target: latest.target,
      goal_direction: latest.goal_direction, date: latest.date,
      trend: prev ? +(+latest.value - +prev.value).toFixed(2) : null, onTarget };
  });
}
function localHealthPlan() {
  return {
    focus: 'recomposition',
    targets_json: JSON.stringify({ goal: 'Lean, strong, "fighter" build — sustainably', protein_g_per_day: 180, training_days_per_week: 4 }),
    training_json: JSON.stringify([
      { day: 'Mon', focus: 'Full-body strength (push)', detail: 'Compounds 4-6 reps, then 8-12' },
      { day: 'Tue', focus: 'Zone-2 cardio + mobility', detail: '35-45 min bike/walk' },
      { day: 'Wed', focus: 'Full-body strength (pull/legs)', detail: 'Deadlift/row/squat' },
      { day: 'Thu', focus: 'Conditioning + core (fighter)', detail: 'Intervals, bag, bracing' },
      { day: 'Fri', focus: 'Strength (upper) + stretch', detail: 'Accessories + mobility' },
      { day: 'Sat', focus: 'Active / bike / play', detail: 'Movement you enjoy' },
      { day: 'Sun', focus: 'Recovery + meditation', detail: 'Stretch, breathe, prep meals' },
    ]),
    nutrition_json: JSON.stringify([
      'Protein-forward every meal (~180g/day) — build muscle while losing fat',
      'Iron for anemia: red meat, liver, spinach, lentils + vitamin C',
      'Heart-healthy fats for cholesterol: olive oil, avocado, nuts, fatty fish',
      'Fiber (oats, beans, veg) lowers LDL',
      'Hydrate; limit alcohol (triglycerides + recovery)',
      'Sustainable > extreme: small deficit, keep the muscle',
    ]),
  };
}

function seedNotes() {
  const mk = (id, title, node_type, domain, body = '') => ({ id, title, node_type, domain, body, status: 'active' });
  return [
    mk(1, 'Highest Self', 'domain', 'self', 'The center. Am I living the life I said I wanted?'),
    mk(2, 'Self', 'domain', 'self', 'Hour of Me, intention, reflection'),
    mk(3, 'Family', 'domain', 'family', 'Jovi, Jionni, Justis — protected time'),
    mk(4, 'Health', 'domain', 'health', 'Recomposition, labs, recovery'),
    mk(5, 'Wealth', 'domain', 'wealth', 'Trading process, businesses'),
    mk(6, 'Creation', 'domain', 'creation', 'Projects, ideas, GitHub'),
    mk(7, 'Trade my setup, not my emotions', 'note', 'wealth', 'Order block forms → Hybrid AI alert → prepared → execute'),
    mk(8, 'Fighter-lean, sustainably', 'note', 'health', 'Muscle up, cut, fix cholesterol + anemia — and stay there'),
    mk(9, 'Hour of Me', 'note', 'self', 'Mind · Identity · Body · Knowledge'),
    mk(10, 'Idea: capture without obligation', 'idea', 'creation', 'Ideas orbit here until promoted'),
  ];
}
function seedLinks() {
  const e = (from_id, to_id) => ({ id: from_id * 100 + to_id, from_id, to_id, relationship: 'related' });
  return [e(1, 2), e(1, 3), e(1, 4), e(1, 5), e(1, 6), e(5, 7), e(4, 8), e(2, 9), e(6, 10)];
}
