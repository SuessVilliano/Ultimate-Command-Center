import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Brain, Heart, Moon, Footprints, Flame, Wind, Gauge,
  ShieldCheck, RefreshCw, AlertTriangle, Zap, BedDouble, Dumbbell
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { API_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

const TABS = [
  ['recovery', 'Recovery', Brain],
  ['heart', 'Heart & stress', Heart],
  ['sleep', 'Sleep', Moon],
  ['activity', 'Activity', Footprints],
];

const fmtMin = sec => sec == null ? '—' : `${Math.round(sec / 60)}m`;
const fmtHours = sec => sec == null ? '—' : `${(sec / 3600).toFixed(1)}h`;
const n = v => Number.isFinite(Number(v)) ? Number(v) : null;
const last = arr => Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
const USER_TIME_ZONE = 'America/New_York';

function sourceLabel(endpoint) {
  if (!endpoint) return 'Unknown';
  if (endpoint.ok) return 'Oura direct';
  if (endpoint.reason === 'scope_or_membership') return 'Oura scope unavailable';
  if (endpoint.reason === 'unauthorized') return 'Oura authorization needed';
  return 'Unavailable';
}

function MetricCard({ title, value, unit = '', detail, icon: Icon, accent = 'text-cyan-300', source }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500"><Icon className={`w-4 h-4 ${accent}`} />{title}</div>
      {source && <span className="text-[9px] text-gray-600 truncate">{source}</span>}
    </div>
    <div className="mt-2 text-2xl font-bold text-white">{value ?? '—'}{value != null && unit && <span className="ml-1 text-xs font-medium text-gray-500">{unit}</span>}</div>
    {detail && <div className="mt-1 text-[11px] text-gray-500">{detail}</div>}
  </div>;
}

function ScopeNotice({ label, endpoint }) {
  if (!endpoint || endpoint.ok) return null;
  return <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2 text-[11px] text-amber-200/80 flex items-start gap-2">
    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
    <span><b>{label}</b> is not available from the current Oura authorization ({endpoint.reason || 'unknown'}). The rest of Health OS will keep working.</span>
  </div>;
}

function ContributorGrid({ contributors }) {
  if (!contributors || typeof contributors !== 'object') return null;
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
    {Object.entries(contributors).map(([key, value]) => <div key={key} className="rounded-xl bg-black/20 border border-white/5 p-2.5">
      <div className="text-[9px] uppercase tracking-wide text-gray-600">{key.replaceAll('_', ' ')}</div>
      <div className="text-sm font-semibold text-gray-200 mt-0.5">{value ?? '—'}</div>
    </div>)}
  </div>;
}

function ChartShell({ title, subtitle, children }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
    <div className="mb-4"><div className="text-sm font-semibold text-white">{title}</div>{subtitle && <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>}</div>
    <div className="h-52">{children}</div>
  </div>;
}

export default function HealthMetricsDashboard() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState('recovery');
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/hs/health/metrics/live?days=${days}`);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`Health API returned ${text.slice(0, 40) || 'non-JSON response'}`); }
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) { setError(e.message || 'Health metrics unavailable'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [days]);

  const oura = data?.oura || {};
  const endpoints = oura.endpoints || {};
  const daily = oura.daily || [];
  const latestDaily = last(daily) || {};
  const sleep = oura.latestSleepDetail || {};
  const hr = oura.heartRateSummary || {};
  const stress = oura.latestStress || {};
  const spo2 = oura.latestSpo2 || {};
  const workouts = oura.workouts || [];

  const hrChart = useMemo(() => (oura.heartRate || []).slice(-160).map(x => ({
    t: x.timestamp ? new Date(x.timestamp).toLocaleTimeString('en-US', { timeZone: USER_TIME_ZONE, hour: 'numeric', minute: '2-digit' }) : '',
    bpm: n(x.bpm),
  })).filter(x => x.bpm != null), [oura.heartRate]);

  const dailyChart = useMemo(() => daily.map(x => ({
    day: String(x.date || '').slice(5), readiness: n(x.readiness), sleep: n(x.sleep), activity: n(x.activity), steps: n(x.steps), calories: n(x.active_calories)
  })), [daily]);

  const sleepStages = [
    { name: 'Deep', minutes: sleep.deepSec ? Math.round(sleep.deepSec / 60) : 0 },
    { name: 'REM', minutes: sleep.remSec ? Math.round(sleep.remSec / 60) : 0 },
    { name: 'Light', minutes: sleep.lightSec ? Math.round(sleep.lightSec / 60) : 0 },
    { name: 'Awake', minutes: sleep.awakeSec ? Math.round(sleep.awakeSec / 60) : 0 },
  ];

  const stressHigh = n(stress.stress_high ?? stress.stressHigh ?? stress.stress_high_time);
  const recoveryHigh = n(stress.recovery_high ?? stress.recoveryHigh ?? stress.recovery_high_time);
  const stressSummary = stress.day_summary || stress.summary || stress.status || null;
  const spo2Value = n(spo2.spo2_percentage?.average ?? spo2.average ?? spo2.spo2_average);

  const panel = isDark ? 'bg-[#101412] border-[#243130]' : 'bg-white border-gray-200';

  return <section className={`rounded-2xl border overflow-hidden ${panel}`}>
    <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2"><Gauge className="w-5 h-5 text-cyan-300" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Live Health Intelligence</h2></div>
        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Oura direct + Apple Health bridge. Detailed metrics stay read-only.</p>
      </div>
      <div className="flex items-center gap-2">
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-lg border border-white/10 bg-black/20 text-gray-300 text-xs px-2.5 py-2">
          <option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
        </select>
        <button onClick={load} className="p-2 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
    </div>

    <div className="px-5 pt-4 flex gap-2 overflow-x-auto">
      {TABS.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap border ${tab === id ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' : 'text-gray-500 border-white/5 hover:text-gray-300'}`}><Icon className="w-3.5 h-3.5" />{label}</button>)}
    </div>

    <div className="p-5">
      {error && <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3 text-sm text-rose-300">{error}</div>}
      {loading && !data ? <div className="h-64 grid place-items-center"><div className="text-center"><RefreshCw className="w-6 h-6 text-cyan-300 animate-spin mx-auto" /><div className="text-xs text-gray-500 mt-3">Reading your health signals…</div><div className="text-[10px] text-gray-600 mt-1">The body keeps receipts. We turn them into decisions.</div></div></div> : null}

      {!loading || data ? <>
        {tab === 'recovery' && <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard title="Readiness" value={latestDaily.readiness} unit="/100" icon={ShieldCheck} source="Oura" />
            <MetricCard title="HRV" value={sleep.averageHrv != null ? Math.round(sleep.averageHrv) : null} unit="ms" icon={Heart} detail="Night average" source={sourceLabel(endpoints.sleep_sessions)} />
            <MetricCard title="Resting HR" value={sleep.lowestHeartRate ?? sleep.averageHeartRate ?? null} unit="bpm" icon={Activity} detail={sleep.lowestHeartRate != null ? 'Lowest overnight' : 'Night average'} source={sourceLabel(endpoints.sleep_sessions)} />
            <MetricCard title="Respiratory" value={sleep.averageBreath != null ? Number(sleep.averageBreath).toFixed(1) : null} unit="/min" icon={Wind} source={sourceLabel(endpoints.sleep_sessions)} />
          </div>
          <ChartShell title="Recovery trend" subtitle="Readiness, sleep and activity scores">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={dailyChart}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/><XAxis dataKey="day" tick={{fontSize:10, fill:'#6b7280'}}/><YAxis domain={[0,100]} tick={{fontSize:10, fill:'#6b7280'}}/><Tooltip contentStyle={{background:'#111827',border:'1px solid rgba(255,255,255,.1)',fontSize:11}}/><Line dataKey="readiness" dot={false} stroke="currentColor"/><Line dataKey="sleep" dot={false} stroke="currentColor" opacity={0.65}/><Line dataKey="activity" dot={false} stroke="currentColor" opacity={0.35}/></LineChart></ResponsiveContainer>
          </ChartShell>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="text-sm font-semibold text-white">Readiness contributors</div><ContributorGrid contributors={latestDaily.readiness_contributors} /></div>
        </div>}

        {tab === 'heart' && <div className="space-y-4">
          <ScopeNotice label="Oura heart-rate stream" endpoint={endpoints.heartrate}/><ScopeNotice label="Oura stress" endpoint={endpoints.stress}/>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard title="Latest HR" value={hr.latest} unit="bpm" icon={Heart} source={sourceLabel(endpoints.heartrate)} />
            <MetricCard title="Recent average" value={hr.average} unit="bpm" icon={Activity} source={sourceLabel(endpoints.heartrate)} />
            <MetricCard title="Recent range" value={hr.low != null && hr.high != null ? `${hr.low}–${hr.high}` : null} unit="bpm" icon={Zap} source={sourceLabel(endpoints.heartrate)} />
            <MetricCard title="Stress state" value={stressSummary || (stressHigh != null ? 'Measured' : null)} icon={Brain} source={sourceLabel(endpoints.stress)} />
          </div>
          <ChartShell title="Heart rate" subtitle="Recent Oura heart-rate samples">
            {hrChart.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={hrChart}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/><XAxis dataKey="t" tick={{fontSize:9,fill:'#6b7280'}} minTickGap={30}/><YAxis tick={{fontSize:10,fill:'#6b7280'}}/><Tooltip contentStyle={{background:'#111827',border:'1px solid rgba(255,255,255,.1)',fontSize:11}}/><Area dataKey="bpm" stroke="currentColor" fill="currentColor" fillOpacity={0.12}/></AreaChart></ResponsiveContainer> : <div className="h-full grid place-items-center text-xs text-gray-600">Heart-rate scope is not available yet.</div>}
          </ChartShell>
          <div className="grid md:grid-cols-2 gap-3">
            <MetricCard title="High stress" value={stressHigh != null ? Math.round(stressHigh/60) : null} unit="min" icon={Brain} source={sourceLabel(endpoints.stress)} />
            <MetricCard title="Restorative time" value={recoveryHigh != null ? Math.round(recoveryHigh/60) : null} unit="min" icon={ShieldCheck} source={sourceLabel(endpoints.stress)} />
          </div>
        </div>}

        {tab === 'sleep' && <div className="space-y-4">
          <ScopeNotice label="Detailed sleep" endpoint={endpoints.sleep_sessions}/><ScopeNotice label="SpO₂" endpoint={endpoints.spo2}/>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard title="Total sleep" value={sleep.totalSleepSec != null ? (sleep.totalSleepSec/3600).toFixed(1) : null} unit="h" icon={BedDouble} source={sourceLabel(endpoints.sleep_sessions)} />
            <MetricCard title="Efficiency" value={sleep.efficiency} unit="%" icon={Gauge} source={sourceLabel(endpoints.sleep_sessions)} />
            <MetricCard title="Sleep HRV" value={sleep.averageHrv != null ? Math.round(sleep.averageHrv) : null} unit="ms" icon={Heart} source={sourceLabel(endpoints.sleep_sessions)} />
            <MetricCard title="SpO₂" value={spo2Value != null ? spo2Value.toFixed(1) : null} unit="%" icon={Wind} source={sourceLabel(endpoints.spo2)} />
          </div>
          <ChartShell title="Last sleep stages" subtitle={`Time in bed ${fmtHours(sleep.timeInBedSec)} · latency ${fmtMin(sleep.latencySec)}`}>
            <ResponsiveContainer width="100%" height="100%"><BarChart data={sleepStages}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/><XAxis dataKey="name" tick={{fontSize:10,fill:'#6b7280'}}/><YAxis tick={{fontSize:10,fill:'#6b7280'}}/><Tooltip contentStyle={{background:'#111827',border:'1px solid rgba(255,255,255,.1)',fontSize:11}}/><Bar dataKey="minutes" fill="currentColor" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>
          </ChartShell>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="text-sm font-semibold text-white">Sleep contributors</div><ContributorGrid contributors={latestDaily.sleep_contributors}/></div>
        </div>}

        {tab === 'activity' && <div className="space-y-4">
          <ScopeNotice label="Oura workouts" endpoint={endpoints.workouts}/>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard title="Steps" value={latestDaily.steps?.toLocaleString?.() ?? latestDaily.steps} icon={Footprints} source="Oura" />
            <MetricCard title="Active calories" value={latestDaily.active_calories} unit="kcal" icon={Flame} source="Oura" />
            <MetricCard title="Movement" value={latestDaily.movement_min} unit="min" icon={Activity} source="Oura" />
            <MetricCard title="Sedentary" value={latestDaily.sedentary_min} unit="min" icon={BedDouble} source="Oura" />
          </div>
          <ChartShell title="Daily activity" subtitle="Steps over the selected period"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyChart}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/><XAxis dataKey="day" tick={{fontSize:10,fill:'#6b7280'}}/><YAxis tick={{fontSize:10,fill:'#6b7280'}}/><Tooltip contentStyle={{background:'#111827',border:'1px solid rgba(255,255,255,.1)',fontSize:11}}/><Bar dataKey="steps" fill="currentColor" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></ChartShell>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3"><Dumbbell className="w-4 h-4 text-cyan-300"/><div className="text-sm font-semibold text-white">Recent workouts</div></div>
            {!workouts.length ? <div className="text-xs text-gray-600">No workouts returned by the current Oura scope.</div> : <div className="space-y-2">{workouts.slice(-8).reverse().map((w,i)=><div key={w.id || i} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/15 px-3 py-2"><div><div className="text-xs font-medium text-gray-200 capitalize">{w.activity || w.type || 'Workout'}</div><div className="text-[10px] text-gray-600">{w.day || String(w.start_datetime || '').slice(0,10)}</div></div><div className="text-xs text-gray-400">{w.calories != null ? `${Math.round(w.calories)} kcal` : ''}</div></div>)}</div>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"><div className="text-sm font-semibold text-white">Activity contributors</div><ContributorGrid contributors={latestDaily.activity_contributors}/></div>
        </div>}

        <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-gray-600">
          <span className="px-2 py-1 rounded border border-white/5">Oura daily: {sourceLabel(endpoints.daily)}</span>
          <span className="px-2 py-1 rounded border border-white/5">Heart: {sourceLabel(endpoints.heartrate)}</span>
          <span className="px-2 py-1 rounded border border-white/5">Stress: {sourceLabel(endpoints.stress)}</span>
          <span className="px-2 py-1 rounded border border-white/5">SpO₂: {sourceLabel(endpoints.spo2)}</span>
          <span className="px-2 py-1 rounded border border-white/5">Apple bridge: {data?.appleHealth?.configured ? 'connected' : 'not ingested locally'}</span>
        </div>
      </> : null}
    </div>
  </section>;
}
