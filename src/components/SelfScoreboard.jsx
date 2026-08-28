import React, { useEffect, useState } from 'react';
import { Activity, Brain, BriefcaseBusiness, Heart, RefreshCw, TrendingUp, Users, Utensils } from 'lucide-react';
import { API_URL } from '../config';

const DIMENSIONS = [
  ['self', 'Self', Brain],
  ['healthHabits', 'Health habits', Heart],
  ['work', 'Work', BriefcaseBusiness],
  ['family', 'Family', Users],
  ['tradingProcess', 'Trading process', TrendingUp],
];

function scoreTone(v) {
  if (v == null) return 'text-gray-500 border-white/10 bg-white/[0.025]';
  if (v >= 75) return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.05]';
  if (v >= 50) return 'text-amber-300 border-amber-500/20 bg-amber-500/[0.05]';
  return 'text-rose-300 border-rose-500/20 bg-rose-500/[0.05]';
}

export default function SelfScoreboard() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/life/scoreboard?days=${days}`);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error('Scoreboard API returned a non-JSON response'); }
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json.scoreboard);
    } catch (e) { setError(e.message || 'Scoreboard unavailable'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [days]);

  const wellness = data?.wellness || {};
  const nutrition = data?.nutritionLogged || {};
  const evidence = data?.evidence || {};
  const dims = data?.dimensions || {};

  return <section className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/20 via-[#101412] to-cyan-950/10 overflow-hidden">
    <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2"><Activity className="w-5 h-5 text-purple-300"/><h2 className="font-semibold text-white">Self Scoreboard</h2></div>
        <p className="text-xs text-gray-500 mt-1">Evidence of how you are living — not a judgment of your worth.</p>
      </div>
      <div className="flex gap-2 items-center">
        <select value={days} onChange={e=>setDays(Number(e.target.value))} className="rounded-lg border border-white/10 bg-black/20 text-xs text-gray-300 px-2.5 py-2"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>
        <button onClick={load} className="p-2 rounded-lg border border-white/10 bg-white/5 text-gray-400"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></button>
      </div>
    </div>

    <div className="p-5 space-y-4">
      {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3 text-xs text-rose-300">{error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {DIMENSIONS.map(([key,label,Icon]) => <div key={key} className={`rounded-xl border p-3 ${scoreTone(dims[key])}`}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-70"><Icon className="w-3.5 h-3.5"/>{label}</div>
          <div className="mt-2 text-2xl font-bold">{dims[key] == null ? '—' : dims[key]}</div>
          <div className="text-[10px] opacity-50">evidence score</div>
        </div>)}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-wide text-gray-600">Mood</div><div className="text-xl font-semibold text-white mt-1">{wellness.mood ?? '—'}<span className="text-xs text-gray-600 ml-1">/10</span></div></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-wide text-gray-600">Energy</div><div className="text-xl font-semibold text-white mt-1">{wellness.energy ?? '—'}<span className="text-xs text-gray-600 ml-1">/10</span></div></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="text-[10px] uppercase tracking-wide text-gray-600">Stress</div><div className="text-xl font-semibold text-white mt-1">{wellness.stress ?? '—'}<span className="text-xs text-gray-600 ml-1">/10</span></div></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-600"><Utensils className="w-3 h-3"/>Nutrition logged</div><div className="text-xl font-semibold text-white mt-1">{nutrition.entries ?? 0}<span className="text-xs text-gray-600 ml-1">entries</span></div><div className="text-[10px] text-gray-600 mt-1">{nutrition.protein_g ? `${Math.round(nutrition.protein_g)}g protein logged` : 'Voice logging makes this easier.'}</div></div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/15 p-4">
        <div className="text-xs font-medium text-gray-300">Evidence coverage</div>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
          <span className="px-2 py-1 rounded border border-white/5">{evidence.journalEntries || 0} life signals</span>
          <span className="px-2 py-1 rounded border border-white/5">{evidence.activeJournalDays || 0} logged days</span>
          <span className="px-2 py-1 rounded border border-white/5">{evidence.intentionDays || 0} intentions</span>
          <span className="px-2 py-1 rounded border border-white/5">{evidence.reflectionDays || 0} reflections</span>
          <span className="px-2 py-1 rounded border border-white/5">{evidence.healthDays || 0} health days</span>
          <span className="px-2 py-1 rounded border border-white/5">{evidence.tradingDays || 0} trading days</span>
        </div>
      </div>
    </div>
  </section>;
}
