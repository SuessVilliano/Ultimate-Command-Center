import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, BellRing, Brain, CalendarDays, ChevronDown, ChevronUp, Eye, EyeOff, Heart, RefreshCw, ShieldAlert, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { API_URL } from '../config';
import * as hs from '../services/highestSelfService';
import digitalTwinJamaur from '../assets/digitalTwinJamaurFull';
import SyncAllButton from './SyncAllButton';

const POLL_MS = 5 * 60_000;
const LS_SEEN = 'liv8_signal_seen_v1';
const LS_TWIN_VISIBLE = 'liv8_twin_visible_v1';
const LS_TWIN_EXPANDED = 'liv8_twin_expanded_v1';
const TWIN_NAME = 'META SV';

const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const signalKey = s => `${s.type}:${s.text}`;
function tone(v) {
  if (v == null) return 'border-white/10 bg-white/[0.03]';
  if (v >= 80) return 'border-emerald-500/20 bg-emerald-500/[0.06]';
  if (v >= 65) return 'border-amber-500/20 bg-amber-500/[0.06]';
  return 'border-rose-500/20 bg-rose-500/[0.06]';
}
function readSeen() { try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN) || '[]')); } catch { return new Set(); } }
function saveSeen(seen) { try { localStorage.setItem(LS_SEEN, JSON.stringify([...seen].slice(-250))); } catch {} }

function Metric({ label, value, suffix = '', icon: Icon, score, source = 'Live data' }) {
  return <div className={`rounded-xl border p-3 ${tone(score)}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className="text-[8px] uppercase tracking-wider text-gray-600">{source}</div>
    </div>
    <div className="mt-1 text-xl font-bold text-white">{value ?? '—'}{value != null && suffix && <span className="ml-1 text-[10px] font-medium text-gray-500">{suffix}</span>}</div>
  </div>;
}

export default function GodViewRail({ activePage, onNavigate }) {
  const [oura, setOura] = useState(null);
  const [health, setHealth] = useState(null);
  const [intel, setIntel] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [twinVisible, setTwinVisible] = useState(() => {
    try { return localStorage.getItem(LS_TWIN_VISIBLE) !== '0'; } catch { return true; }
  });
  const [twinExpanded, setTwinExpanded] = useState(() => {
    try { return localStorage.getItem(LS_TWIN_EXPANDED) !== '0'; } catch { return true; }
  });

  const toggleTwin = () => {
    setTwinVisible(v => {
      const next = !v;
      try { localStorage.setItem(LS_TWIN_VISIBLE, next ? '1' : '0'); } catch {}
      return next;
    });
  };
  const toggleExpanded = () => {
    setTwinExpanded(v => {
      const next = !v;
      try { localStorage.setItem(LS_TWIN_EXPANDED, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [o, h, i] = await Promise.allSettled([
        hs.getOuraSnapshot(), hs.getHealthSnapshot(),
        fetch(`${API_URL}/api/intelligence/period`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ period: 'today', goals: [], todayFocus: null, completedToday: [] })
        }).then(r => r.ok ? r.json() : null)
      ]);
      const nextOura = o.status === 'fulfilled' ? o.value : null;
      const nextHealth = h.status === 'fulfilled' ? h.value : null;
      const nextIntel = i.status === 'fulfilled' ? i.value : null;
      setOura(nextOura); setHealth(nextHealth); setIntel(nextIntel);

      const x = nextIntel?.intelligence || {};
      const raw = [
        ...(x.attention || []).map(text => ({ type: 'attention', severity: 'high', text })),
        ...(x.misses || []).map(text => ({ type: 'miss', severity: 'medium', text })),
        ...(x.opportunities || []).map(text => ({ type: 'opportunity', severity: 'medium', text })),
        ...(x.nextActions || []).slice(0, 3).map(text => ({ type: 'next', severity: 'low', text }))
      ].filter(s => typeof s.text === 'string' && s.text.trim());
      if (nextOura?.latest?.readiness != null && nextOura.latest.readiness < 65) raw.unshift({ type: 'health', severity: 'high', text: `Recovery is low: Oura readiness ${nextOura.latest.readiness}. Protect the operator today.` });
      if (nextOura?.latest?.sleep != null && nextOura.latest.sleep < 65) raw.unshift({ type: 'health', severity: 'high', text: `Sleep score is ${nextOura.latest.sleep}. Consider reducing load and protecting recovery.` });
      const unique = [...new Map(raw.map(s => [signalKey(s), s])).values()].slice(0, 12);
      setSignals(unique);

      const seen = readSeen();
      const fresh = unique.filter(s => s.severity === 'high' && !seen.has(signalKey(s)));
      if (fresh.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        fresh.slice(0, 2).forEach(s => new Notification('LIV8 Command Center', { body: s.text, tag: signalKey(s) }));
      }
      unique.forEach(s => seen.add(signalKey(s))); saveSeen(seen);
    } catch (e) { console.warn('God View refresh failed:', e?.message || e); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(true), POLL_MS);
    const onFocus = () => refresh(true);
    const onExternalSync = () => refresh(true);
    window.addEventListener('focus', onFocus);
    window.addEventListener('liv8:sync-complete', onExternalSync);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); window.removeEventListener('liv8:sync-complete', onExternalSync); };
  }, [refresh]);

  const allowNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  };

  const latest = oura?.latest || {};
  const readiness = num(latest.readiness), sleep = num(latest.sleep), activity = num(latest.activity);
  const lifeAlignment = num(intel?.intelligence?.score);
  const latestMetrics = health?.latestMetrics || {};
  const labs = health?.markerSummary || [];
  const labValue = marker => labs.find(x => x.marker === marker)?.latest_value ?? labs.find(x => x.marker === marker)?.value ?? null;
  const highCount = signals.filter(s => s.severity === 'high').length;
  const momentum = useMemo(() => {
    const vals = [readiness, sleep, activity, lifeAlignment].filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [readiness, sleep, activity, lifeAlignment]);

  const motionScore = momentum ?? readiness ?? 70;
  const motionDuration = Math.max(4.8, Math.min(8.5, 9 - motionScore / 28));
  const glowOpacity = Math.max(.12, Math.min(.34, motionScore / 300));
  const liveState = highCount ? 'ATTENTION' : loading ? 'SYNCING' : 'LIVE';

  const ouraSource = oura?.configured ? 'Oura live' : 'Oura unavailable';
  const healthSource = health ? 'Health OS' : 'Health unavailable';
  const intelSource = intel ? 'Juno' : 'Juno unavailable';

  return <aside data-testid="god-view-rail" className="hidden 2xl:flex fixed top-6 right-6 bottom-6 w-[360px] z-30 flex-col gap-3 overflow-y-auto pr-1">
    <style>{`
      @keyframes metaSvFloat { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(0,-7px,0) scale(1.008); } }
      @keyframes metaSvGlow { 0%,100% { transform: scale(.94); opacity: .45; } 50% { transform: scale(1.07); opacity: 1; } }
      @keyframes metaSvScan { 0% { transform: translateY(-120%); opacity: 0; } 15% { opacity: .35; } 70% { opacity: .2; } 100% { transform: translateY(520%); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) {
        .meta-sv-avatar, .meta-sv-glow, .meta-sv-scan { animation: none !important; }
      }
    `}</style>

    <section className="rounded-2xl border border-purple-500/25 bg-[#0b0c13]/95 shadow-2xl shadow-purple-950/20 overflow-hidden backdrop-blur-xl">
      <div className="p-4 flex items-center justify-between gap-2 border-b border-white/10">
        <div>
          <div className="text-[10px] uppercase tracking-[.18em] text-purple-300">Live Digital Twin</div>
          <div className="font-semibold text-white">{TWIN_NAME}</div>
          <div className="mt-0.5 text-[9px] uppercase tracking-[.16em] text-cyan-400/70">{liveState} • source-aware operator twin</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTwin} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400" title={twinVisible ? 'Hide META SV avatar' : 'Show META SV avatar'} aria-label={twinVisible ? 'Hide META SV avatar' : 'Show META SV avatar'}>{twinVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          <button onClick={toggleExpanded} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400" title={twinExpanded ? 'Minimize META SV' : 'Expand META SV'} aria-label={twinExpanded ? 'Minimize META SV' : 'Expand META SV'}>{twinExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
          <SyncAllButton compact />
          <button onClick={() => refresh()} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400" title="Refresh live view"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {twinExpanded && <>
        {twinVisible && <>
          <div className="relative h-[430px] bg-gradient-to-b from-cyan-950/10 via-[#070b14] to-black overflow-hidden">
            <div className="meta-sv-glow absolute left-1/2 bottom-7 -translate-x-1/2 w-56 h-20 rounded-[100%] blur-3xl bg-cyan-400/30 pointer-events-none" style={{ animation: `metaSvGlow ${motionDuration * .72}s ease-in-out infinite`, opacity: glowOpacity }} />
            <img
              src={digitalTwinJamaur}
              alt={`${TWIN_NAME} digital twin`}
              className="meta-sv-avatar absolute inset-0 w-full h-full object-contain object-center opacity-100 p-1 will-change-transform"
              style={{ animation: `metaSvFloat ${motionDuration}s ease-in-out infinite` }}
            />
            <div className="meta-sv-scan absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent via-cyan-300/10 to-transparent pointer-events-none" style={{ animation: `metaSvScan ${Math.max(7, motionDuration * 1.45)}s linear infinite` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c13]/70 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 border border-cyan-400/20 text-[10px] text-cyan-300">{liveState} • {(activePage || 'command').replaceAll('-', ' ')}</div>
            {momentum != null && <div className="absolute bottom-4 right-4 w-16 h-16 rounded-full border-2 border-cyan-400/40 bg-black/70 grid place-items-center shadow-[0_0_24px_rgba(34,211,238,.18)]"><div className="text-center"><div className="text-xl font-bold text-white">{momentum}</div><div className="text-[8px] uppercase text-cyan-300">momentum</div></div></div>}
          </div>
          <div className="px-3 pt-3 text-[9px] leading-4 text-gray-500">META SV artwork is animated from live state only. Every number below is rendered from its labeled source; unavailable data stays blank instead of being estimated.</div>
        </>}
        <div className="grid grid-cols-2 gap-2 p-3">
          <Metric label="Readiness" value={readiness} suffix="/100" score={readiness} icon={Activity} source={ouraSource} />
          <Metric label="Sleep" value={sleep} suffix="/100" score={sleep} icon={Brain} source={ouraSource} />
          <Metric label="Activity" value={activity} suffix="/100" score={activity} icon={TrendingUp} source={ouraSource} />
          <Metric label="Life alignment" value={lifeAlignment} suffix="/100" score={lifeAlignment} icon={Target} source={intelSource} />
          <Metric label="Weight" value={latestMetrics.weight ?? null} suffix="lb" icon={Heart} source={healthSource} />
          <Metric label="Signals" value={signals.length} suffix={highCount ? `${highCount} urgent` : 'live'} score={highCount ? 50 : 90} icon={Zap} source={intelSource} />
        </div>
        {(labValue('total_cholesterol') != null || labValue('ldl') != null) && <div className="mx-3 mb-3 grid grid-cols-2 gap-2">
          <button onClick={() => onNavigate?.('health-os')} className="text-left p-3 rounded-xl border border-pink-500/15 bg-pink-500/[.04]"><div className="text-[9px] uppercase text-pink-300/70">Total cholesterol <span className="text-gray-600">• Health OS</span></div><div className="text-lg font-bold text-white">{labValue('total_cholesterol') ?? '—'} <span className="text-[9px] text-gray-500">mg/dL</span></div></button>
          <button onClick={() => onNavigate?.('health-os')} className="text-left p-3 rounded-xl border border-violet-500/15 bg-violet-500/[.04]"><div className="text-[9px] uppercase text-violet-300/70">LDL <span className="text-gray-600">• Health OS</span></div><div className="text-lg font-bold text-white">{labValue('ldl') ?? '—'} <span className="text-[9px] text-gray-500">mg/dL</span></div></button>
        </div>}
      </>}
    </section>

    <section className="rounded-2xl border border-white/10 bg-[#0b0c13]/95 backdrop-blur-xl overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2"><BellRing className="w-4 h-4 text-amber-300" /><div><div className="font-semibold text-white text-sm">Signal Center</div><div className="text-[10px] text-gray-500">Everything changes here first.</div></div></div>
        {permission !== 'granted' && permission !== 'unsupported' && <button onClick={allowNotifications} className="text-[10px] px-2 py-1 rounded-md border border-amber-500/20 text-amber-300 hover:bg-amber-500/10"><Bell className="w-3 h-3 inline mr-1" />Notify me</button>}
      </div>
      <div className="p-3 space-y-2 max-h-[310px] overflow-y-auto">
        {!signals.length && <div className="p-4 text-center text-xs text-gray-500">No urgent signal right now. Juno is still watching.</div>}
        {signals.map(s => <div key={signalKey(s)} className={`p-3 rounded-xl border ${s.severity === 'high' ? 'border-rose-500/20 bg-rose-500/[.05]' : s.severity === 'medium' ? 'border-amber-500/15 bg-amber-500/[.04]' : 'border-white/10 bg-white/[.025]'}`}>
          <div className="flex gap-2"><div className="mt-0.5">{s.severity === 'high' ? <ShieldAlert className="w-4 h-4 text-rose-300" /> : s.type === 'opportunity' ? <Sparkles className="w-4 h-4 text-cyan-300" /> : <CalendarDays className="w-4 h-4 text-gray-400" />}</div><div className="text-xs leading-5 text-gray-300">{s.text}</div></div>
        </div>)}
      </div>
    </section>
  </aside>;
}