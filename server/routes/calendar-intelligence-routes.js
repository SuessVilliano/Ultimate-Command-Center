import * as db from '../lib/database.js';
import * as calendarService from '../lib/calendar-service.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function config() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    ingestSecret: process.env.CALENDAR_INGEST_SECRET || process.env.LIV8_CALENDAR_WEBHOOK_SECRET || '',
  };
}

function ensureTables() {
  const database = db.getDb();
  database.exec(`CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY, summary TEXT, description TEXT, location TEXT,
    start_time TEXT, end_time TEXT, all_day INTEGER DEFAULT 0, status TEXT,
    html_link TEXT, attendees TEXT, reminders TEXT,
    synced_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  database.exec(`CREATE TABLE IF NOT EXISTS calendar_sync_state (
    source TEXT PRIMARY KEY, last_success_at TEXT, event_count INTEGER DEFAULT 0, detail TEXT
  )`);
  return database;
}

function normalizeEvent(event = {}, index = 0) {
  const rawStart = event.start?.dateTime || event.start?.date || event.start_time || event.start;
  const rawEnd = event.end?.dateTime || event.end?.date || event.end_time || event.end || rawStart;
  if (!rawStart) return null;
  return {
    id: String(event.id || event.eventId || event.uid || `external-${Date.now()}-${index}`),
    summary: String(event.summary || event.title || event.name || 'Untitled event'),
    description: String(event.description || ''),
    location: String(event.location || ''),
    start_time: new Date(rawStart).toISOString(),
    end_time: rawEnd ? new Date(rawEnd).toISOString() : new Date(rawStart).toISOString(),
    all_day: Number(Boolean(event.all_day || event.allDay || (event.start?.date && !event.start?.dateTime))),
    status: String(event.status || 'confirmed'),
    html_link: String(event.htmlLink || event.html_link || event.url || ''),
    attendees: JSON.stringify(event.attendees || []),
    reminders: JSON.stringify(event.reminders || {}),
  };
}

function upsertEvents(events = [], source = 'unknown') {
  const database = ensureTables();
  const rows = events.map(normalizeEvent).filter(Boolean);
  const stmt = database.prepare(`INSERT INTO calendar_events
    (id, summary, description, location, start_time, end_time, all_day, status, html_link, attendees, reminders, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      summary=excluded.summary, description=excluded.description, location=excluded.location,
      start_time=excluded.start_time, end_time=excluded.end_time, all_day=excluded.all_day,
      status=excluded.status, html_link=excluded.html_link, attendees=excluded.attendees,
      reminders=excluded.reminders, synced_at=CURRENT_TIMESTAMP`);
  const transaction = database.transaction(items => {
    for (const row of items) stmt.run(row.id,row.summary,row.description,row.location,row.start_time,row.end_time,row.all_day,row.status,row.html_link,row.attendees,row.reminders);
  });
  transaction(rows);
  database.prepare(`INSERT INTO calendar_sync_state (source,last_success_at,event_count,detail)
    VALUES (?,CURRENT_TIMESTAMP,?,?)
    ON CONFLICT(source) DO UPDATE SET last_success_at=CURRENT_TIMESTAMP,event_count=excluded.event_count,detail=excluded.detail`)
    .run(source, rows.length, `${rows.length} events synced`);
  return rows.length;
}

async function getAccessToken() {
  const c = config();
  if (!c.clientId || !c.clientSecret || !c.refreshToken) throw Object.assign(new Error('Durable Google Calendar OAuth is not configured'), { status: 503 });
  const body = new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,refresh_token:c.refreshToken,grant_type:'refresh_token'});
  const response = await fetch(GOOGLE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)});
  const payload = await response.json().catch(()=>({}));
  if (!response.ok || !payload.access_token) throw Object.assign(new Error(payload.error_description || payload.error || `Google OAuth HTTP ${response.status}`), { status: response.status });
  return payload.access_token;
}

async function refreshGoogle(days = 30) {
  const token = await getAccessToken();
  const c = config();
  const params = new URLSearchParams({
    maxResults:'500', singleEvents:'true', orderBy:'startTime',
    timeMin:new Date(Date.now()-86400000).toISOString(),
    timeMax:new Date(Date.now()+Math.max(1,Math.min(Number(days)||30,90))*86400000).toISOString(),
  });
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(c.calendarId)}/events?${params}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || `Google Calendar HTTP ${response.status}`), { status: response.status });
  return upsertEvents(payload.items || [], 'google');
}

function authorizedWebhook(req) {
  const secret = config().ingestSecret;
  if (!secret) return false;
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  const header = String(req.headers['x-calendar-secret'] || req.headers['x-webhook-secret'] || '');
  return bearer === secret || header === secret;
}

function state() {
  try { return ensureTables().prepare('SELECT * FROM calendar_sync_state ORDER BY last_success_at DESC').all(); }
  catch { return []; }
}

export function registerCalendarIntelligenceRoutes(app) {
  ensureTables();

  app.get('/api/calendar/status',(_req,res)=>{
    const c=config();
    res.json({ok:true,directGoogleConfigured:Boolean(c.clientId&&c.clientSecret&&c.refreshToken),webhookConfigured:Boolean(c.ingestSecret),calendarId:c.calendarId,sync:state()});
  });

  app.get('/api/calendar/live',async(req,res)=>{
    let refreshed=false, refreshError=null;
    if (String(req.query.refresh || 'true') !== 'false') {
      try { await refreshGoogle(req.query.days || 30); refreshed=true; } catch (error) { refreshError=error.message; }
    }
    const limit=Math.max(1,Math.min(Number(req.query.limit)||100,500));
    const events=calendarService.getCachedEvents({upcoming:String(req.query.upcoming||'true')!=='false',limit});
    res.json({ok:true,refreshed,refreshError,events,sync:state()});
  });

  app.get('/api/calendar/briefing',async(req,res)=>{
    if (String(req.query.refresh || 'true') !== 'false') await refreshGoogle(14).catch(()=>null);
    res.json({ok:true,...calendarService.getCalendarSummary(),sync:state()});
  });

  app.post('/api/calendar/sync/webhook',(req,res)=>{
    if (!authorizedWebhook(req)) return res.status(401).json({error:'Unauthorized calendar webhook'});
    const body=req.body||{};
    const events=Array.isArray(body)?body:Array.isArray(body.events)?body.events:body.event?[body.event]:[body];
    const count=upsertEvents(events,String(body.source||'webhook'));
    res.json({ok:true,synced:count});
  });

  console.log('Calendar Intelligence routes registered (read-only Google + authenticated webhook sync)');
}

export default registerCalendarIntelligenceRoutes;
