import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, Smartphone, Zap } from 'lucide-react';
import { API_URL } from '../config';

const MOTIVATION = [
  'Pulling your world into one view…',
  'Clarity first. Then execution.',
  'Updating the systems that support you…',
  'Turning fresh data into better decisions…',
  'Your operating system is catching up to real life…',
];

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

export default function SyncAllButton({ compact = false }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [line, setLine] = useState(MOTIVATION[0]);

  const sync = async () => {
    if (loading) return;
    setLoading(true); setResult(null);
    setLine(MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)]);
    try {
      const body = {
        days: 14,
        goals: readJson('liv8_user_goals', []),
        todayFocus: localStorage.getItem('liv8_today_focus') || null,
        completedToday: readJson('liv8_completed_today', []),
      };
      const res = await fetch(`${API_URL}/api/sync/all`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await res.json();
      setResult(data);
      window.dispatchEvent(new CustomEvent('liv8:sync-complete', { detail: data }));
    } catch (error) {
      setResult({ ok: false, error: error?.message || 'Sync failed', succeeded: [], failed: [] });
    } finally { setLoading(false); }
  };

  if (compact) {
    return <button onClick={sync} disabled={loading} title={loading ? line : 'Sync all connected systems'} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[.07] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-60 text-xs font-medium">
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Syncing…' : 'Sync All'}
    </button>;
  }

  const successCount = result?.succeeded?.length || 0;
  const failedCount = result?.failed?.length || 0;
  const appleReady = result?.appleHealth?.shortcutConfigured;

  return <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[.06] via-cyan-500/[.04] to-purple-500/[.04] p-4">
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
      <div>
        <div className="flex items-center gap-2 text-white font-semibold"><Zap className="w-4 h-4 text-emerald-300" /> Update Command Center</div>
        <div className="text-xs text-gray-400 mt-1">One press refreshes Oura, Nifty, Hybrid Journal, live health views and Juno intelligence.</div>
      </div>
      <button onClick={sync} disabled={loading} className="min-w-[150px] inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-sm hover:brightness-110 disabled:opacity-70">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Updating…' : 'Sync All'}
      </button>
    </div>
    {loading && <div className="mt-3 text-xs text-cyan-200 animate-pulse">{line}</div>}
    {result && <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
      {result.ok && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/15"><CheckCircle2 className="w-3 h-3" />{successCount} sources updated</span>}
      {!!failedCount && <span className="rounded-full px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/15">{failedCount} source{failedCount === 1 ? '' : 's'} unavailable</span>}
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 border ${appleReady ? 'bg-cyan-500/10 border-cyan-500/15 text-cyan-300' : 'bg-white/[.03] border-white/10 text-gray-400'}`}><Smartphone className="w-3 h-3" />Apple Health {appleReady ? 'Shortcut ready' : 'needs Shortcut token'}</span>
    </div>}
  </div>;
}
