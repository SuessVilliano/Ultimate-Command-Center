import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Copy, Check, RefreshCw, Play, Pause, AlertTriangle, Clock, Inbox, CheckCircle } from 'lucide-react';
import { API_URL } from '../config';

const BACKEND_URL = API_URL;

// Bucket definitions in the order the user works them.
const BUCKETS = [
  { id: 'needs_you', label: 'Needs you', icon: AlertTriangle, color: 'text-red-400', desc: 'Urgent / escalations / edits' },
  { id: 'ready', label: 'Ready to copy', icon: CheckCircle, color: 'text-emerald-400', desc: 'Draft passed QA — copy & send' },
  { id: 'new', label: 'New', icon: Inbox, color: 'text-blue-400', desc: 'Arrived in the last 24h' },
  { id: 'recent', label: 'Recent', icon: Clock, color: 'text-amber-400', desc: 'Updated in the last 24h' }
];

export default function SmartQueue({ isDark = true, onSelectTicket }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBucket, setActiveBucket] = useState('needs_you');
  const [copiedId, setCopiedId] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/queue/priority`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Smart queue fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Land the user on the first bucket that actually has items.
  useEffect(() => {
    if (!data) return;
    const firstWithItems = BUCKETS.find(b => (data.counts?.[b.id] || 0) > 0);
    if (firstWithItems && (data.counts?.[activeBucket] || 0) === 0) {
      setActiveBucket(firstWithItems.id);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyDraft = async (item) => {
    if (!item.draftText) return;
    try {
      await navigator.clipboard.writeText(item.draftText);
      setCopiedId(item.ticketId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      await fetch(`${BACKEND_URL}/api/worker/run-now`, { method: 'POST' });
      await fetchQueue();
    } catch (e) {
      console.error('Run-now failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const toggleWorker = async () => {
    if (!data?.worker) return;
    setBusy(true);
    try {
      await fetch(`${BACKEND_URL}/api/worker/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !data.worker.enabled })
      });
      await fetchQueue();
    } catch (e) {
      console.error('Worker toggle failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const card = isDark ? 'bg-[#0a0a0f] border-purple-900/30' : 'bg-white border-gray-200';
  const worker = data?.worker;
  const items = data?.buckets?.[activeBucket] || [];

  return (
    <div className={`rounded-xl border ${card} p-4`}>
      {/* Header + worker status */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Zap className="w-4 h-4 text-purple-400" /> Smart Queue
          {worker && (
            <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${worker.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
              {worker.running ? 'Working…' : worker.enabled ? `Auto · every ${worker.intervalMinutes}m` : 'Auto off'}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          <button onClick={runNow} disabled={busy} title="Draft now"
            className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} disabled:opacity-50`}>
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''} text-purple-400`} />
          </button>
          <button onClick={toggleWorker} disabled={busy} title={worker?.enabled ? 'Pause auto-drafting' : 'Start auto-drafting'}
            className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} disabled:opacity-50`}>
            {worker?.enabled ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {worker?.lastError && (
        <div className="mb-2 text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1">
          Last run error: {worker.lastError}
        </div>
      )}

      {/* Bucket tabs */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {BUCKETS.map(b => {
          const Icon = b.icon;
          const count = data?.counts?.[b.id] || 0;
          const active = activeBucket === b.id;
          return (
            <button key={b.id} onClick={() => setActiveBucket(b.id)} title={b.desc}
              className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                active
                  ? (isDark ? 'bg-purple-600/30 text-white' : 'bg-purple-100 text-purple-900')
                  : (isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
              }`}>
              <Icon className={`w-3.5 h-3.5 ${active ? b.color : ''}`} />
              {b.label}
              <span className={`px-1.5 rounded-full text-[10px] ${count > 0 ? 'bg-purple-500/30 text-purple-200' : 'bg-gray-500/20 text-gray-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Items */}
      {loading ? (
        <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-purple-500" /></div>
      ) : items.length === 0 ? (
        <div className={`text-center py-8 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Nothing here right now. {activeBucket === 'ready' ? 'Drafts will appear as the worker finishes them.' : 'Clear queue 🎉'}
        </div>
      ) : (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {items.map(item => (
            <div key={item.ticketId} className={`p-3 rounded-lg border ${isDark ? 'border-gray-800 bg-black/20' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => onSelectTicket?.(item.ticketId)} className="text-left min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {item.subject || `Ticket #${item.freshdeskId || item.ticketId}`}
                  </div>
                  <div className={`text-[11px] mt-0.5 flex items-center gap-2 flex-wrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {item.requester && <span>{item.requester}</span>}
                    {item.urgency > 0 && <span className={item.urgency >= 8 ? 'text-red-400' : ''}>urgency {item.urgency}</span>}
                    {item.escalationType && <span className="px-1.5 rounded bg-purple-500/20 text-purple-300">{item.escalationType}</span>}
                    {item.hasDraft && <span className={item.draftReady ? 'text-emerald-400' : 'text-amber-400'}>{item.draftStatus?.replace(/_/g, ' ').toLowerCase()}</span>}
                  </div>
                  {item.summary && <div className={`text-[11px] mt-1 line-clamp-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.summary}</div>}
                </button>
                {item.draftText && (
                  <button onClick={() => copyDraft(item)} title="Copy draft reply"
                    className={`flex-shrink-0 px-2 py-1.5 rounded text-xs flex items-center gap-1 ${
                      copiedId === item.ticketId ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white hover:bg-purple-500'
                    }`}>
                    {copiedId === item.ticketId ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
