import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckSquare,
  Clock,
  RefreshCw,
  Target,
  Zap
} from 'lucide-react';
import { API_URL } from '../config';

function dueState(task) {
  if (!task.dueAt) return 'later';
  const due = new Date(task.dueAt);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  if (due < now) return 'overdue';
  if (due >= startToday && due < endToday) return 'today';
  return 'later';
}

function formatDue(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function TaskCard({ task, completing, onComplete }) {
  const state = dueState(task);
  const status = task.status?.name || 'To Do';
  const list = task.list?.name || (task.parentTaskId ? 'Weekly Execution' : 'Affiliate Career');
  const urgent = state === 'overdue' || task.priority >= 4;

  return (
    <div className={`p-4 rounded-xl border ${urgent ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-white/[0.03]'} hover:bg-white/[0.06] transition-colors`}>
      <div className="flex items-start gap-4">
        <div className={`mt-0.5 p-2 rounded-lg ${urgent ? 'bg-red-500/15 text-red-300' : 'bg-purple-500/15 text-purple-300'}`}>
          <CheckSquare className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-purple-500/20 text-purple-200">Nifty</span>
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-white/10 text-gray-300">{status}</span>
            <span className="px-2 py-0.5 text-[11px] rounded-full bg-cyan-500/10 text-cyan-200">{list}</span>
            {state === 'overdue' && <span className="px-2 py-0.5 text-[11px] rounded-full bg-red-500/20 text-red-300">Overdue</span>}
            {state === 'today' && <span className="px-2 py-0.5 text-[11px] rounded-full bg-yellow-500/20 text-yellow-200">Due today</span>}
          </div>
          <h3 className="text-white font-semibold leading-snug">{task.name}</h3>
          {task.description && <p className="mt-1 text-sm text-gray-400 line-clamp-2">{task.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />{formatDue(task.dueAt)}</span>
            {task.niceId && <span>AFF-{task.niceId}</span>}
          </div>
        </div>
        <button
          onClick={() => onComplete(task)}
          disabled={completing === task.id}
          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 disabled:opacity-50"
          title="Complete in Nifty"
        >
          {completing === task.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span className="hidden md:inline">Complete</span>
        </button>
      </div>
    </div>
  );
}

export default function ActionFeed() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [completing, setCompleting] = useState(null);

  const load = async ({ sync = false } = {}) => {
    setError('');
    try {
      if (sync) {
        await fetch(`${API_URL}/api/nifty/mcp/action-feed/sync`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 200 })
        });
      }
      const response = await fetch(`${API_URL}/api/nifty/mcp/action-feed?limit=200`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Nifty action feed HTTP ${response.status}`);
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      if (data.configured === false) setError('Nifty MCP is not configured on the server yet.');
    } catch (e) {
      setError(e.message || 'Could not load Nifty work.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), 120000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load({ sync: true });
    setRefreshing(false);
  };

  const handleComplete = async (task) => {
    setCompleting(task.id);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/nifty/mcp/tasks/${encodeURIComponent(task.id)}/complete`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not complete Nifty task.');
      setTasks(current => current.filter(item => item.id !== task.id));
    } catch (e) {
      setError(e.message || 'Could not complete Nifty task.');
    } finally {
      setCompleting(null);
    }
  };

  const counts = useMemo(() => {
    const result = { all: tasks.length, today: 0, overdue: 0, waiting: 0 };
    for (const task of tasks) {
      const state = dueState(task);
      if (state === 'today') result.today++;
      if (state === 'overdue') result.overdue++;
      const status = String(task.status?.name || '').toLowerCase();
      if (status.includes('waiting') || status.includes('blocked')) result.waiting++;
    }
    return result;
  }, [tasks]);

  const visible = useMemo(() => tasks.filter(task => {
    if (filter === 'today') return dueState(task) === 'today';
    if (filter === 'overdue') return dueState(task) === 'overdue';
    if (filter === 'waiting') {
      const status = String(task.status?.name || '').toLowerCase();
      return status.includes('waiting') || status.includes('blocked');
    }
    return true;
  }), [tasks, filter]);

  const tabs = [
    { id: 'all', label: 'All Work', count: counts.all, icon: Target },
    { id: 'today', label: 'Today', count: counts.today, icon: Clock },
    { id: 'overdue', label: 'Overdue', count: counts.overdue, icon: AlertCircle },
    { id: 'waiting', label: 'Waiting', count: counts.waiting, icon: CalendarClock }
  ];

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Zap className="w-8 h-8 text-cyan-400" />Action Feed</h1>
          <p className="text-gray-400 mt-1">Your live Affiliate Manager work queue, powered by Nifty.</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Syncing Nifty…' : 'Sync Nifty'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = filter === tab.id;
          return (
            <button key={tab.id} onClick={() => setFilter(tab.id)} className={`p-4 rounded-xl border text-left transition-colors ${active ? 'border-cyan-500/50 bg-cyan-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
              <div className="flex items-center justify-between"><Icon className={`w-5 h-5 ${active ? 'text-cyan-300' : 'text-gray-400'}`} /><span className="text-2xl font-bold text-white">{tab.count}</span></div>
              <p className={`mt-2 text-sm ${active ? 'text-cyan-200' : 'text-gray-400'}`}>{tab.label}</p>
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">{error}</div>}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="text-lg font-semibold text-white">{tabs.find(tab => tab.id === filter)?.label}</h2><p className="text-sm text-gray-500">01 — Affiliate Career · live Nifty source of truth</p></div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14"><RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-14"><Target className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-300">Nothing in this view.</p><p className="text-sm text-gray-500 mt-1">Nifty stays canonical; new work will appear here automatically.</p></div>
        ) : (
          <div className="space-y-3">{visible.map(task => <TaskCard key={task.id} task={task} completing={completing} onComplete={handleComplete} />)}</div>
        )}
      </div>
    </div>
  );
}
