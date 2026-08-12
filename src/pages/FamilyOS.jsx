import React, { useEffect, useState } from 'react';
import {
  Users, Cake, Plane, CalendarDays, Plus, Trash2, Shield, Star,
  MapPin, GraduationCap, Heart, Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import * as svc from '../services/highestSelfService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FamilyOS() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [horizon, setHorizon] = useState(null);
  const [people, setPeople] = useState([]);
  const [days, setDays] = useState(120);
  const [evForm, setEvForm] = useState({ person_id: '', title: '', event_type: 'school_off', date_start: '', date_end: '' });

  const load = async () => {
    const [h, p] = [await svc.getFamilyHorizon(days), await svc.getPeople()];
    setHorizon(h); setPeople(p);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const addEvent = async () => {
    if (!evForm.title || !evForm.date_start) return;
    await svc.addFamilyEvent({ ...evForm, person_id: evForm.person_id || null, date_end: evForm.date_end || evForm.date_start });
    setEvForm({ person_id: '', title: '', event_type: 'school_off', date_start: '', date_end: '' });
    load();
  };

  const card = isDark ? 'bg-[#121817] border-[#243130]' : 'bg-white border-gray-200';
  const inp = `px-3 py-2 rounded-lg border bg-transparent text-sm ${isDark ? 'border-[#243130] text-white placeholder-gray-600' : 'border-gray-200 text-gray-900 placeholder-gray-400'}`;
  const kids = people.filter(p => p.relationship === 'child');
  const pColor = (name) => people.find(p => p.name === name)?.color || '#8b93a7';

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}><Users className="w-6 h-6 text-amber-400" /> Family OS</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>See the year before the calendar fills up. Protect what matters — Jovi, Jionni, Justis.</p>
        </div>
        <select value={days} onChange={e => setDays(+e.target.value)} className={inp}>
          {[60, 90, 120, 180, 365].map(d => <option key={d} value={d} className={isDark ? 'bg-[#121817]' : ''}>Next {d} days</option>)}
        </select>
      </div>

      {/* Kids */}
      <div className="grid sm:grid-cols-3 gap-3">
        {kids.map(k => (
          <div key={k.id} className={`rounded-2xl border p-4 ${card}`} style={{ borderColor: k.color + '55' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: k.color }}>{k.name[0]}</span>
              <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{k.name}</span>
            </div>
            <p className={`text-xs flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}><GraduationCap className="w-3.5 h-3.5" /> {k.school_name || '—'}</p>
            <p className={`text-xs flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}><MapPin className="w-3.5 h-3.5" /> {k.city || '—'}</p>
            <p className={`text-xs flex items-center gap-1.5 mt-1`} style={{ color: k.color }}><Cake className="w-3.5 h-3.5" /> {k.birthday_month ? `${MONTHS[k.birthday_month - 1]} ${k.birthday_day}` : '—'}</p>
          </div>
        ))}
      </div>

      {/* Upcoming protected dates */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4"><Cake className="w-5 h-5 text-pink-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Protected dates ahead</h2></div>
        <div className="space-y-2">
          {(horizon?.upcoming || []).length === 0 && <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Nothing in this window.</p>}
          {(horizon?.upcoming || []).map(u => (
            <div key={u.id} className={`flex items-center gap-3 rounded-xl border p-3 ${isDark ? 'border-[#243130] bg-[#0e1413]' : 'border-gray-100 bg-gray-50'}`}>
              <div className="text-center w-12 flex-shrink-0">
                <div className={`text-lg font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>{u.daysUntil}</div>
                <div className={`text-[9px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>days</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{u.title}</p>
                <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{u.date}{u.person ? ` · ${u.person}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {u.travel_required && <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400"><Plane className="w-3 h-3" /> travel</span>}
                <ProtectPill level={u.protection_level} />
              </div>
            </div>
          ))}
        </div>
        {(horizon?.upcoming || []).some(u => u.planningWindow) && (
          <div className="mt-3 flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300">
            <Plane className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Travel-required date within 45 days — good time to look at flights and plan PTO. (Nothing is booked automatically.)</span>
          </div>
        )}
      </section>

      {/* All-kids windows + PTO candidates */}
      <div className="grid lg:grid-cols-2 gap-5">
        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4"><Star className="w-5 h-5 text-amber-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>All-kids windows</h2></div>
          {(horizon?.overlaps || []).length === 0 && <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Add school-off / visit dates below and overlaps where the kids are free together show up here.</p>}
          <div className="space-y-2">
            {(horizon?.overlaps || []).map((o, i) => (
              <div key={i} className={`rounded-xl border p-3 ${o.highValue ? 'border-amber-500/40' : isDark ? 'border-[#243130]' : 'border-gray-100'} ${isDark ? 'bg-[#0e1413]' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{o.start} → {o.end}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${o.highValue ? 'bg-amber-500/15 text-amber-400' : 'bg-gray-500/15 text-gray-400'}`}>{o.days}d{o.allKids ? ' · all kids' : ''}</span>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {o.kids.map(name => <span key={name} className="text-[10px] px-2 py-0.5 rounded-full text-white" style={{ background: pColor(name) }}>{name}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-teal-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>PTO candidates</h2></div>
          {(horizon?.ptoCandidates || []).length === 0 && <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Multi-day windows worth taking off will surface here as you add school breaks and visits.</p>}
          <div className="space-y-2">
            {(horizon?.ptoCandidates || []).map((o, i) => (
              <div key={i} className={`flex items-center justify-between rounded-xl border p-3 ${isDark ? 'border-[#243130] bg-[#0e1413]' : 'border-gray-100 bg-gray-50'}`}>
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{o.start} → {o.end}</p>
                  <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{o.kids.join(', ')} · {o.days} days</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-teal-500/15 text-teal-400">consider PTO</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Add school-off / visit / travel */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4"><CalendarDays className="w-5 h-5 text-blue-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add a family date</h2></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <select value={evForm.person_id} onChange={e => setEvForm({ ...evForm, person_id: e.target.value })} className={inp}>
            <option value="" className={isDark ? 'bg-[#121817]' : ''}>Which child?</option>
            {kids.map(k => <option key={k.id} value={k.id} className={isDark ? 'bg-[#121817]' : ''}>{k.name}</option>)}
          </select>
          <select value={evForm.event_type} onChange={e => setEvForm({ ...evForm, event_type: e.target.value })} className={inp}>
            {['school_off', 'long_weekend', 'holiday', 'visit', 'travel', 'pickup'].map(t => <option key={t} value={t} className={isDark ? 'bg-[#121817]' : ''}>{t.replace('_', ' ')}</option>)}
          </select>
          <input value={evForm.title} onChange={e => setEvForm({ ...evForm, title: e.target.value })} placeholder="Title (Spring Break)" className={inp} />
          <input type="date" value={evForm.date_start} onChange={e => setEvForm({ ...evForm, date_start: e.target.value })} className={inp} />
          <input type="date" value={evForm.date_end} onChange={e => setEvForm({ ...evForm, date_end: e.target.value })} className={inp} />
        </div>
        <button onClick={addEvent} className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"><Plus className="w-4 h-4" /> Add date</button>
      </section>
    </div>
  );
}

function ProtectPill({ level }) {
  const map = { hard: ['#f87171', 'hard protect', Shield], soft: ['#f59e0b', 'soft', Heart], flexible: ['#8b93a7', 'flexible', null] };
  const [c, t, Icon] = map[level] || map.soft;
  return <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: c + '26', color: c }}>{Icon && <Icon className="w-3 h-3" />}{t}</span>;
}
