import React, { useEffect, useState } from 'react';
import {
  Heart, Dumbbell, Apple, FlaskConical, Scale, Plus, TrendingDown,
  TrendingUp, Minus, Activity, Droplet, Brain
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import * as svc from '../services/highestSelfService';

const todayStr = () => new Date().toISOString().slice(0, 10);

// Common markers the user cares about, pre-labeled with sensible goal directions.
const MARKER_PRESETS = [
  { marker: 'total_cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', target: 200, goal_direction: 'lower' },
  { marker: 'ldl', label: 'LDL', unit: 'mg/dL', target: 100, goal_direction: 'lower' },
  { marker: 'hdl', label: 'HDL', unit: 'mg/dL', target: 45, goal_direction: 'higher' },
  { marker: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', target: 150, goal_direction: 'lower' },
  { marker: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', target: 14, goal_direction: 'higher' },
  { marker: 'ferritin', label: 'Ferritin (iron)', unit: 'ng/mL', target: 50, goal_direction: 'higher' },
];

export default function HealthOS() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const date = todayStr();

  const [snap, setSnap] = useState(null);
  const [daily, setDaily] = useState({ movement_min: 0, meditation_min: 0, mobility_min: 0, protein_g: 0, strength: 0 });
  const [labForm, setLabForm] = useState(MARKER_PRESETS[0]);
  const [labValue, setLabValue] = useState('');
  const [metricForm, setMetricForm] = useState({ weight: '', body_fat: '', waist: '' });
  const [oura, setOura] = useState(null);
  const [ouraSyncing, setOuraSyncing] = useState(false);

  const loadOura = async () => setOura(await svc.getOuraSnapshot());
  const syncOura = async () => { setOuraSyncing(true); await svc.syncOura(14); await loadOura(); await load(); setOuraSyncing(false); };

  const load = async () => setSnap(await svc.getHealthSnapshot());
  useEffect(() => { load(); loadOura(); (async () => { const d = await svc.getHealthDaily(date); if (d && d.date) setDaily({ movement_min: d.movement_min || 0, meditation_min: d.meditation_min || 0, mobility_min: d.mobility_min || 0, protein_g: d.protein_g || 0, strength: d.strength || 0 }); })(); }, [date]);

  const saveDaily = async (patch) => { const next = { ...daily, ...patch }; setDaily(next); await svc.saveHealthDaily(date, next); };
  const addLab = async () => { if (labValue === '') return; await svc.addLab({ ...labForm, value: +labValue, date }); setLabValue(''); load(); };
  const addMetric = async () => {
    const m = { date }; ['weight', 'body_fat', 'waist'].forEach(k => { if (metricForm[k] !== '') m[k] = +metricForm[k]; });
    if (Object.keys(m).length === 1) return;
    await svc.addBodyMetric(m); setMetricForm({ weight: '', body_fat: '', waist: '' }); load();
  };

  const card = isDark ? 'bg-[#121817] border-[#243130]' : 'bg-white border-gray-200';
  const inp = `px-3 py-2 rounded-lg border bg-transparent text-sm ${isDark ? 'border-[#243130] text-white placeholder-gray-600' : 'border-gray-200 text-gray-900 placeholder-gray-400'}`;

  const plan = snap?.plan;
  const targets = safe(plan?.targets_json, {});
  const training = safe(plan?.training_json, []);
  const nutrition = safe(plan?.nutrition_json, []);
  const latest = snap?.latestMetrics;

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}><Heart className="w-6 h-6 text-teal-400" /> Health OS</h1>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Fighter-lean, sustainably. Build muscle, move the labs that matter, recover on purpose. <span className="opacity-70">Not medical advice — supportive, evidence-based.</span></p>
      </div>

      {/* Goal + latest metrics */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2"><Dumbbell className="w-5 h-5 text-teal-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>The formula</h2></div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/30">Focus: {plan?.focus || 'recomposition'}</span>
        </div>
        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{targets.goal || 'Lean, strong, sustainable.'}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat label="Latest weight" value={latest?.weight ? `${latest.weight}` : '—'} unit="lb" isDark={isDark} />
          <Stat label="Body fat" value={latest?.body_fat ? `${latest.body_fat}` : '—'} unit="%" isDark={isDark} />
          <Stat label="Protein target" value={targets.protein_g_per_day || 180} unit="g/day" isDark={isDark} />
          <Stat label="Training" value={targets.training_days_per_week || 4} unit="days/wk" isDark={isDark} />
        </div>
      </section>

      {/* Oura connect / recovery */}
      <section className={`rounded-2xl border p-4 ${card}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Oura recovery</h2>
              <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {oura?.configured
                  ? (oura?.unauthorized ? 'Token set but unauthorized — check scopes.' : 'Connected · read-only')
                  : 'Not connected — add OURA_ACCESS_TOKEN in the server env, then Sync.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {oura?.configured && oura?.latest && (
              <div className="flex items-center gap-3">
                <MiniStat label="Readiness" value={oura.latest.readiness} isDark={isDark} />
                <MiniStat label="Sleep" value={oura.latest.sleep} isDark={isDark} />
                <MiniStat label="Activity" value={oura.latest.activity} isDark={isDark} />
              </div>
            )}
            <button onClick={syncOura} disabled={ouraSyncing}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${oura?.configured ? 'bg-teal-600 hover:bg-teal-500 text-white' : isDark ? 'bg-[#0e1413] text-gray-400 border border-[#243130]' : 'bg-gray-100 text-gray-600'}`}>
              {ouraSyncing ? 'Syncing…' : oura?.configured ? 'Sync Oura' : 'Connect Oura'}
            </button>
          </div>
        </div>
      </section>

      {/* Labs — cholesterol & anemia focus */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4"><FlaskConical className="w-5 h-5 text-pink-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Labs & biomarkers</h2></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {(snap?.markerSummary || []).length === 0 && <p className={`text-xs col-span-full ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Log a value below — start with total cholesterol, LDL, and ferritin/hemoglobin for the anemia.</p>}
          {(snap?.markerSummary || []).map(m => <LabCard key={m.marker} m={m} isDark={isDark} />)}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Marker</span>
            <select value={labForm.marker} onChange={e => setLabForm(MARKER_PRESETS.find(p => p.marker === e.target.value))}
              className={`${inp} mt-1 block`}>
              {MARKER_PRESETS.map(p => <option key={p.marker} value={p.marker} className={isDark ? 'bg-[#121817]' : ''}>{p.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Value ({labForm.unit})</span>
            <input value={labValue} onChange={e => setLabValue(e.target.value)} type="number" className={`${inp} mt-1 block w-32`} placeholder="e.g. 190" />
          </label>
          <button onClick={addLab} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium"><Plus className="w-4 h-4" /> Log lab</button>
          <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>target {labForm.goal_direction === 'higher' ? '≥' : '≤'} {labForm.target} {labForm.unit}</span>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Training split */}
        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4"><Activity className="w-5 h-5 text-blue-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Weekly training</h2></div>
          <div className="space-y-2">
            {training.map((t, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg p-2.5 ${isDark ? 'bg-[#0e1413]' : 'bg-gray-50'}`}>
                <span className={`text-xs font-bold w-9 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{t.day}</span>
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.focus}</p>
                  <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Nutrition */}
        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4"><Apple className="w-5 h-5 text-green-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Nutrition principles</h2></div>
          <ul className="space-y-2">
            {nutrition.map((n, i) => (
              <li key={i} className={`flex gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <span className="text-green-400 mt-0.5">•</span><span>{n}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Today's inputs + body metrics */}
      <div className="grid lg:grid-cols-2 gap-5">
        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4"><Brain className="w-5 h-5 text-purple-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Today</h2></div>
          <div className="grid grid-cols-2 gap-3">
            <Counter label="Movement (min)" value={daily.movement_min} onChange={v => saveDaily({ movement_min: v })} step={15} isDark={isDark} icon={Activity} />
            <Counter label="Meditation (min)" value={daily.meditation_min} onChange={v => saveDaily({ meditation_min: v })} step={5} isDark={isDark} icon={Brain} />
            <Counter label="Mobility/stretch (min)" value={daily.mobility_min} onChange={v => saveDaily({ mobility_min: v })} step={5} isDark={isDark} icon={Activity} />
            <Counter label="Protein (g)" value={daily.protein_g} onChange={v => saveDaily({ protein_g: v })} step={20} isDark={isDark} icon={Droplet} />
          </div>
          <button onClick={() => saveDaily({ strength: daily.strength ? 0 : 1 })}
            className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${daily.strength ? 'border-transparent bg-teal-500/20 text-teal-400' : isDark ? 'border-[#243130] text-gray-400' : 'border-gray-200 text-gray-600'}`}>
            <Dumbbell className="w-4 h-4" /> {daily.strength ? 'Strength session done ✓' : 'Mark strength session'}
          </button>
        </section>

        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4"><Scale className="w-5 h-5 text-amber-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Log body metrics</h2></div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[['weight', 'Weight (lb)'], ['body_fat', 'Body fat %'], ['waist', 'Waist (in)']].map(([k, l]) => (
              <label key={k} className="block">
                <span className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{l}</span>
                <input type="number" value={metricForm[k]} onChange={e => setMetricForm({ ...metricForm, [k]: e.target.value })} className={`${inp} mt-1 block w-full`} />
              </label>
            ))}
          </div>
          <button onClick={addMetric} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"><Plus className="w-4 h-4" /> Log</button>
          {snap?.metrics?.length > 1 && (
            <p className={`text-[11px] mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{snap.metrics.length} entries logged · latest {snap.metrics[0].date}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function LabCard({ m, isDark }) {
  const good = m.onTarget === true;
  const bad = m.onTarget === false;
  const TrendIcon = m.trend == null ? Minus : m.trend < 0 ? TrendingDown : TrendingUp;
  const improving = m.trend != null && ((m.goal_direction === 'lower' && m.trend < 0) || (m.goal_direction === 'higher' && m.trend > 0));
  return (
    <div className={`rounded-xl border p-3 ${isDark ? 'border-[#243130] bg-[#0e1413]' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label(m.marker)}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${good ? 'bg-teal-500/15 text-teal-400' : bad ? 'bg-red-500/15 text-red-400' : 'bg-gray-500/15 text-gray-400'}`}>
          {good ? 'on target' : bad ? 'work on it' : '—'}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.value}</span>
        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{m.unit}</span>
        {m.trend != null && <span className={`ml-auto flex items-center gap-0.5 text-[11px] ${improving ? 'text-teal-400' : 'text-amber-400'}`}><TrendIcon className="w-3 h-3" />{Math.abs(m.trend)}</span>}
      </div>
      <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>target {m.goal_direction === 'higher' ? '≥' : '≤'} {m.target ?? '—'}</p>
    </div>
  );
}
function MiniStat({ label, value, isDark }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold tabular-nums ${value >= 85 ? 'text-teal-400' : value >= 70 ? 'text-amber-400' : value != null ? 'text-red-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}>{value ?? '—'}</div>
      <div className={`text-[9px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</div>
    </div>
  );
}
function Stat({ label, value, unit, isDark }) {
  return (
    <div className={`rounded-xl p-3 ${isDark ? 'bg-[#0e1413]' : 'bg-gray-50'}`}>
      <p className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value} <span className="text-xs font-normal opacity-60">{unit}</span></p>
    </div>
  );
}
function Counter({ label, value, onChange, step, isDark, icon: Icon }) {
  return (
    <div className={`rounded-xl border p-3 ${isDark ? 'border-[#243130]' : 'border-gray-200'}`}>
      <div className="flex items-center gap-1.5 mb-2"><Icon className="w-3.5 h-3.5 text-gray-400" /><span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span></div>
      <div className="flex items-center justify-between">
        <button onClick={() => onChange(Math.max(0, value - step))} className={`w-7 h-7 rounded-lg ${isDark ? 'bg-[#0e1413] text-gray-300' : 'bg-gray-100 text-gray-600'}`}>−</button>
        <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
        <button onClick={() => onChange(value + step)} className={`w-7 h-7 rounded-lg ${isDark ? 'bg-[#0e1413] text-gray-300' : 'bg-gray-100 text-gray-600'}`}>+</button>
      </div>
    </div>
  );
}
function label(marker) {
  const p = MARKER_PRESETS.find(x => x.marker === marker);
  return p ? p.label : marker.replace(/_/g, ' ');
}
function safe(json, fallback) { try { return JSON.parse(json ?? 'null') ?? fallback; } catch { return fallback; } }
