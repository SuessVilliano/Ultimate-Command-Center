import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';
import * as hs from '../services/highestSelfService';

const localDateTime = (date, time) => new Date(`${date}T${time || '09:00'}:00`).toISOString();
const eventTime = e => e.start?.dateTime || e.start?.date || e.start || e.start_time || e.date_start || '';
const eventEnd = e => e.end?.dateTime || e.end?.date || e.end || e.end_time || e.date_end || '';
const eventTitle = e => e.summary || e.title || e.name || '(Untitled event)';

export default function LifeCalendarPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: 'work', title: '', date: '', start: '09:00', end: '10:00', description: '' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const now = new Date(); const end = new Date(now.getTime() + 120*86400000);
      const r = await fetch(`${API_URL}/api/connectors/calendar/events?start=${encodeURIComponent(now.toISOString())}&end=${encodeURIComponent(end.toISOString())}&limit=150`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Calendar connector unavailable');
      setEvents(data.events || []);
    } catch (e) { setError(e.message); setEvents([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const upcoming = useMemo(() => [...events].sort((a,b)=>new Date(eventTime(a)||0)-new Date(eventTime(b)||0)).slice(0,30), [events]);

  const add = async () => {
    if (!form.title || !form.date) return;
    const start = localDateTime(form.date, form.start); const end = localDateTime(form.date, form.end);
    try {
      const r = await fetch(`${API_URL}/api/connectors/calendar/events`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ summary: form.title, start, end, description: `[${form.category.toUpperCase()}] ${form.description || ''}`.trim() }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not create calendar event');
      if (form.category === 'family') {
        try { await hs.addFamilyEvent({ person_id: null, title: form.title, event_type: 'family', date_start: form.date, date_end: form.date, notes: form.description, source: 'calendar' }); } catch {}
      }
      setForm({ ...form, title:'', description:'' }); await load();
    } catch (e) { window.alert(e.message); }
  };

  const input = 'rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/30';
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2 font-semibold text-white"><CalendarDays className="h-5 w-5 text-cyan-300"/>Life Calendar</div><p className="mt-1 text-xs text-gray-500">Pulls your connected calendar into Command Center. New family, work, or personal events write back to the real calendar.</p></div>
      <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Sync</button>
    </div>
    {error && <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">{error}</div>}
    <div className="grid gap-2 lg:grid-cols-[.7fr_1.6fr_1fr_.8fr_.8fr_1.5fr_auto]">
      <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className={input}><option value="work">Work</option><option value="family">Family</option><option value="personal">Personal</option></select>
      <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Event name" className={input}/>
      <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className={input}/>
      <input type="time" value={form.start} onChange={e=>setForm({...form,start:e.target.value})} className={input}/>
      <input type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})} className={input}/>
      <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Notes" className={input}/>
      <button onClick={add} className="inline-flex items-center justify-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500"><Plus className="h-4 w-4"/>Add</button>
    </div>
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {upcoming.map((e,i)=><div key={e.id||`${eventTitle(e)}-${i}`} className="rounded-xl border border-white/10 bg-black/15 p-3"><div className="text-sm font-medium text-white truncate">{eventTitle(e)}</div><div className="mt-1 text-[11px] text-gray-500">{eventTime(e) ? new Date(eventTime(e)).toLocaleString() : 'No start'}{eventEnd(e) ? ` → ${new Date(eventEnd(e)).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}` : ''}</div></div>)}
      {!upcoming.length && !loading && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-600">No connected calendar events returned yet.</div>}
    </div>
  </div>;
}
