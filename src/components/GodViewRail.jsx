import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, BellRing, Brain, CalendarDays, Heart, RefreshCw, ShieldAlert, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { API_URL } from '../config';
import * as hs from '../services/highestSelfService';

const TWIN_IMAGE = '/digital-twin.jpg';
const POLL_MS = 60_000;
const LS_SEEN = 'liv8_signal_seen_v1';

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, n)); }
function tone(value) {
  if (value == null) return 'text-gray-400 border-white/10 bg-white/[0.03]';
  if (value >= 80) return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]';
  if (value >= 65) return 'text-amber-300 border-amber-500/20 bg-amber-500/[0.06]';
  return 'text-rose-300 border-rose-500/20 bg-rose-500/[0.06]';
}

function Metric({ label, value, suffix = '', icon: Icon, score }) {
  return (
    <div className={`rounded-xl border p-3 ${tone(score)}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-70"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value ?? '—'}{value != null && suffix ? <span className="ml-1 text-[10px] font-medium text-gray-500">{suffix}</span> : null}</div>
    </div>
  );
}

function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN) || '[]')); } catch { return new Set(); }
}
function persistSeen(set) {
  try { localStorage.setItem(LS_SEEN, JSON.stringify([...set].slice(-250))); } catch {}
}
function signalKey(s) { return `${s.type}:${s.text}`; }

export default function GodViewRail({ activePage, onNavigate }) {
  const [oura, setOura] = useState(null);
  const [health, setHealth] = useState(null);
  const [intel, setIntel] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifyPermission, setNotifyPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const [o, h, i] = await Promise.allSettled([
        hs.getOuraSnapshot(),
        hs.getHealthSnapshot(),
        fetch(`${API_URL}/api/intelligence/period`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ period: 'today', goals: [], todayFocus: null, completedToday: [] })
        }).then(r => r.ok ? r.json() : null)
      ]);
      const nextOura = o.status === 'fulfilled' ? o.value : null;
      const nextHealth = h.status === 'fulfilled' ? h.value : null;
      const nextIntel = i.status === 'fulfilled' ? i.value : null;
      setOura(nextOura); setHealth(nextHealth); setIntel(nextIntel);

      const ii = nextIntel?.intelligence || {};
      const raw = [
        ...(ii.attention || []).map(text => ({ type: 'attention', severity: 'high', text })),
        ...(ii.misses || []).map(text => ({ type: 'miss', severity: 'medium', text })),
        ...(ii.opportunities || []).map(text => ({ type: 'opportunity', severity: 'medium', text })),
        ...(ii.nextActions || []).slice(0, 3).map(text => ({ type: 'next', severity: 'low', text }))
      ].filter(x => typeof x.text === 'string' && x.text.trim());

      if (nextOura?.latest?.readiness != null && nextOura.latest.readiness < 65) raw.unshift({ type: 'health', severity: 'high', text: `Recovery is low: Oura readiness ${nextOura.latest.readiness}. Protect the operator today.` });
      if (nextOura?.latest?.sleep != null && nextOura.latest.sleep < 65) raw.unshift({ type: 'health', severity: 'high', text: `Sleep score is ${nextOura.latest.sleep}. Consider reducing load and protecting recovery.` });

      const unique = [...new Map(raw.map(s => [signalKey(s), s])).values()].slice(0, 12);
      setSignals(unique);

      const seen = readSeen();
      const freshHigh = unique.filter(s => s.severity === 'high' && !seen.has(signalKey(s)));
      if (freshHigh.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        freshHigh.slice(0, 2).forEach(s => new Notification('LIV8 Command Center', { body: s.text, tag: signalKey(s) }));
      }
      unique.forEach(s => seen.add(signalKey(s))); persistSeen(seen);
    } catch (e) {
      console.warn('God View refresh failed:', e?.message || e);
    } finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load({ quiet: true }), POLL_MS);
    const onFocus = () => load({ quiet: true });
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [load]);

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission(); setNotifyPermission(p);
  };

  const latest = oura?.latest || {};
  const latestMetrics = health?.latestMetrics || {};
  const readiness = safeNum(latest.readiness);
  const sleep = safeNum(latest.sleep);
  const activity = safeNum(latest.activity);
  const alignment = safeNum(intel?.intelligence?.score);
  const labs = health?.markerSummary || [];
  const totalChol = labs.find(x => x.marker === 'total_cholesterol')?.latest_value ?? labs.find(x => x.marker === 'total_cholesterol')?.value;
  const ldl = labs.find(x => x.marker === 'ldl')?.latest_value ?? labs.find(x => x.marker === 'ldl')?.value;
  const highCount = signals.filter(s => s.severity === 'high').length;

  const momentum = useMemo(() => {
    const vals = [readiness, sleep, activity, alignment].filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [readiness, sleep, activity, alignment]);

  return (
    <aside className="hidden 2xl:flex fixed top-6 right-6 bottom-6 w-[360px] z-30 flex-col gap-3 overflow-y-auto pr-1">
      <section className="rounded-2xl border border-purple-500/25 bg-[#0b0c13]/95 shadow-2xl shadow-purple-950/20 overflow-hidden backdrop-blur-xl">
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div><div className="text-[10px] uppercase tracking-[.18em] text-purple-300">Live Digital Twin</div><div className="font-semibold text-white">LIV8 Overview</div></div>
          <button onClick={() => load()} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400" title="Refresh live data"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>

        <div className="relative h-[300px] bg-gradient-to-b from-purple-950/20 via-cyan-950/5 to-black overflow-hidden">
          <div className="absolute inset-x-10 bottom-1 h-10 rounded-[50%] border border-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,.18)]" />
          <img src={TWIN_IMAGE} alt="LIV8 digital twin" className="absolute inset-0 w-full h-full object-cover object-top opacity-80 mix-blend-screen" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c13] via-transparent to-transparent" />
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/50 border border-cyan-400/20 text-[10px] text-cyan-300">LIVE • {activePage?.replaceAll('-', ' ')}</div>
          {momentum != null && <div className="absolute bottom-4 right-4 w-16 h-16 rounded-full border-2 border-cyan-400/40 bg-black/60 grid place-items-center shadow-[0_0_24px_rgba(34,211,238,.18)]"><div className="text-center"><div className="text-xl font-bold text-white">{momentum}</div><div className="text-[8px] uppercase text-cyan-300">momentum</div></div></div>}
        </div>

        <div className="grid grid-cols-2 gap-2 p-3">
          <Metric label="Readiness" value={readiness} suffix="/100" score={readiness} icon={Activity} />
          <Metric label="Sleep" value={sleep} suffix="/100" score={sleep} icon={Brain} />
          <Metric label="Activity" value={activity} suffix="/100" score={activity} icon={TrendingUp} />
          <Metric label="Alignment" value={alignment} suffix="/100" score={alignment} icon={Target} />
          <Metric label="Weight" value={latestMetrics?.weight ?? '—'} suffix={latestMetrics?.weight != null ? 'lb' : ''} icon={Heart} />
          <Metric label="Signals" value={signals.length} suffix={highCount ? `${highCount} urgent` : 'live'} score={highCount ? 50 : 90} icon={Zap} />
        </div>

        {(totalChol != null || ldl != null) && <div className="mx-3 mb-3 grid grid-cols-2 gap-2">
          <button onClick={() => onNavigate?.('health-os')} className="text-left p-3 rounded-xl border border-pink-500/15 bg-pink-500/[.04]"><div className="text-[9px] uppercase text-pink-300/70">Total cholesterol</div><div className="text-lg font-bold text-white">{totalChol ?? '—'} <span className="text-[9px] text-gray-500">mg/dL</span></div></button>
          <button onClick={() => onNavigate?.('health-os')} className="text-left p-3 rounded-xl border border-violet-500/15 bg-violet-500/[.04]"><div className="text-[9px] uppercase text-violet-300/70">LDL</div><div className="text-lg font-bold text-white">{ldl ?? '—'} <span className="text-[9px] text-gray-500">mg/dL</span></div></button>
        </div>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b0c13]/95 backdrop-blur-xl overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2"><BellRing className="w-4 h-4 text-amber-300" /><div><div className="font-semibold text-white text-sm">Signal Center</div><div className="text-[10px] text-gray-500">Everything changes here first.</div></div></div>
          {notifyPermission !== 'granted' && notifyPermission !== 'unsupported' && <button onClick={requestNotifications} className="text-[10px] px-2 py-1 rounded-md border border-amber-500/20 text-amber-300 hover:bg-amber-500/10"><Bell className="w-3 h-3 inline mr-1" />Notify me</button>}
        </div>
        <div className="p-3 space-y-2 max-h-[310px] overflow-y-auto">
          {!signals.length && <div className="p-4 text-center text-xs text-gray-500">No urgent signal right now. Juno is still watching.</div>}
          {signals.map((s, i) => (
            <div key={signalKey(s)} className={`p-3 rounded-xl border ${s.severity === 'high' ? 'border-rose-500/20 bg-rose-500/[.05]' : s.severity === 'medium' ? 'border-amber-500/15 bg-amber-500/[.04]' : 'border-white/10 bg-white/[.025]'}`}>
              <div className="flex gap-2"><div className="mt-0.5">{s.severity === 'high' ? <ShieldAlert className="w-4 h-4 text-rose-300" /> : s.type === 'opportunity' ? <Sparkles className="w-4 h-4 text-cyan-300" /> : <CalendarDays className="w-4 h-4 text-gray-400" />}</div><div className="text-xs leading-5 text-gray-300">{s.text}</div></div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
