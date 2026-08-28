import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
import { CalendarDays, ChevronRight, RefreshCw, Sparkles, Target, Trophy, TriangleAlert, Zap } from 'lucide-react';

const GROUPS = [
  ['Past', [
    ['yesterday', 'Yesterday'], ['last_week', 'Last week'], ['last_month', 'Last month']
  ]],
  ['Now', [
    ['today', 'Today'], ['this_week', 'This week'], ['this_month', 'This month'], ['this_quarter', 'This quarter'], ['this_year', 'This year']
  ]],
  ['Ahead', [
    ['tomorrow', 'Tomorrow'], ['next_week', 'Next week'], ['next_month', 'Next month']
  ]]
];

const LOADING_LINES = [
  'Reading the signal across your life…',
  'Comparing intention with evidence…',
  'Turning activity into direction…',
  'Momentum comes from knowing what matters next.',
  'Systems create freedom. Clarity creates momentum.',
  'Review the past. Control the next move.'
];

function loadJson(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

function statusClasses(status) {
  if (status === 'on_track') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  if (status === 'off_track') return 'text-red-300 bg-red-500/10 border-red-500/30';
  if (status === 'watch') return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return 'text-gray-300 bg-white/5 border-white/10';
}

function MiniList({ title, icon: Icon, items = [], empty = 'Nothing surfaced.' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-purple-300" />
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, i) => (
            <div key={`${title}-${i}`} className="flex gap-2 text-sm text-gray-300">
              <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" />
              <span>{typeof item === 'string' ? item : item?.goal || item?.evidence || JSON.stringify(item)}</span>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-gray-500">{empty}</p>}
    </div>
  );
}

export default function CommandTimeline() {
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taglineIndex, setTaglineIndex] = useState(0);

  const localContext = useMemo(() => ({
    goals: loadJson('liv8_user_goals', []),
    todayFocus: loadJson('liv8_today_focus', null),
    completedToday: loadJson('liv8_completed_today', []),
    wellness: loadJson('liv8_wellness_data', null)
  }), [period]);

  const fetchPeriod = async (nextPeriod = period, quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/intelligence/period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: nextPeriod, ...localContext })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Timeline failed');
      setData(json);
    } catch (e) {
      setError(e.message || 'Could not build this summary.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { fetchPeriod(period); }, [period]);

  // Keep the selected command window fresh without requiring manual refresh.
  useEffect(() => {
    const interval = setInterval(() => fetchPeriod(period, true), 5 * 60 * 1000);
    const onFocus = () => fetchPeriod(period, true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [period]);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setTaglineIndex(i => (i + 1) % LOADING_LINES.length), 2200);
    return () => clearInterval(t);
  }, [loading]);

  const intelligence = data?.intelligence || {};
  const score = Number.isFinite(Number(intelligence.score)) ? Number(intelligence.score) : null;
  const sourceOk = (data?.sources || []).filter(s => s.ok).length;
  const sourceTotal = (data?.sources || []).length;

  return (
    <section className="mb-6 rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-950/35 via-[#0b0b14] to-cyan-950/20 overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-white/10">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold uppercase tracking-[0.18em] mb-2">
              <Sparkles className="w-4 h-4" /> Time intelligence
            </div>
            <h2 className="text-2xl font-bold text-white">Command Timeline</h2>
            <p className="text-sm text-gray-400 mt-1">Past → present → future, measured against your goals and real system activity.</p>
          </div>
          <button onClick={() => fetchPeriod(period)} disabled={loading} className="self-start xl:self-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh intelligence
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {GROUPS.map(([group, options]) => (
            <div key={group} className="flex items-center gap-1 p-1 rounded-xl bg-black/20 border border-white/5">
              <span className="px-2 text-[10px] uppercase tracking-wider text-gray-600 hidden sm:inline">{group}</span>
              {options.map(([key, label]) => (
                <button key={key} onClick={() => setPeriod(key)} className={`px-3 py-1.5 rounded-lg text-xs transition-all ${period === key ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{label}</button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 sm:p-12 flex flex-col items-center justify-center min-h-[300px]">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border border-purple-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin" />
            <div className="absolute inset-5 rounded-full bg-purple-500/20 flex items-center justify-center"><Sparkles className="w-5 h-5 text-purple-300 animate-pulse" /></div>
          </div>
          <p className="text-white font-medium">Building your command picture…</p>
          <p key={taglineIndex} className="text-sm text-gray-400 mt-2 text-center animate-pulse">{LOADING_LINES[taglineIndex]}</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center"><TriangleAlert className="w-7 h-7 text-amber-400 mx-auto mb-2" /><p className="text-white">Timeline unavailable</p><p className="text-sm text-gray-500 mt-1">{error}</p></div>
      ) : (
        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid lg:grid-cols-[1fr_180px] gap-4">
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${statusClasses(intelligence.status)}`}>{String(intelligence.status || 'insufficient_data').replaceAll('_', ' ')}</span>
                <span className="text-xs text-gray-500">{data?.window?.start} → {data?.window?.end}</span>
                <span className="text-xs text-gray-600">• {sourceOk}/{sourceTotal} sources confirmed</span>
              </div>
              <h3 className="text-xl font-semibold text-white">{intelligence.headline || data?.window?.label}</h3>
              <p className="text-sm leading-6 text-gray-300 mt-3 whitespace-pre-wrap">{intelligence.summary}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-5 flex flex-col justify-center items-center text-center">
              <Target className="w-5 h-5 text-cyan-300 mb-2" />
              <div className="text-xs uppercase tracking-wider text-gray-500">Alignment score</div>
              <div className="text-4xl font-bold text-white mt-1">{score === null ? '—' : score}</div>
              <div className="text-xs text-gray-600 mt-1">out of 100</div>
            </div>
          </div>

          {Array.isArray(intelligence.goalAlignment) && intelligence.goalAlignment.length > 0 && (
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-cyan-300" /><h4 className="text-sm font-semibold text-white">Goal alignment</h4></div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                {intelligence.goalAlignment.slice(0, 6).map((g, i) => (
                  <div key={i} className="p-3 rounded-lg bg-black/20 border border-white/5">
                    <div className="flex items-start justify-between gap-2"><p className="text-sm text-white font-medium">{g.goal}</p><span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClasses(g.status)}`}>{String(g.status || 'unknown').replaceAll('_', ' ')}</span></div>
                    <p className="text-xs text-gray-500 mt-2">{g.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            <MiniList title="Wins" icon={Trophy} items={intelligence.wins} empty="No confirmed wins surfaced for this window." />
            <MiniList title="Needs attention" icon={TriangleAlert} items={intelligence.attention?.length ? intelligence.attention : intelligence.misses} />
            <MiniList title="Opportunity" icon={Zap} items={intelligence.opportunities} />
            <MiniList title="Next moves" icon={CalendarDays} items={intelligence.nextActions} />
          </div>

          {(data?.sources || []).some(s => !s.ok) && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-300">Data coverage</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.sources.map(s => <span key={s.name} className={`px-2 py-1 rounded border ${s.ok ? 'border-emerald-500/20 text-emerald-400/70' : 'border-red-500/20 text-red-400/70'}`}>{s.name}: {s.ok ? 'connected' : 'unavailable'}</span>)}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
