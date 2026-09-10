import React, { useState } from 'react';
import { Activity, CheckSquare, Ticket, Briefcase, RefreshCw } from 'lucide-react';
import ActionFeed from './ActionFeed';
import NiftyTasks from './NiftyTasks';

export default function Operations({ onNavigate }) {
  const [view, setView] = useState('tasks');

  const tabs = [
    { id: 'tasks', label: 'Work Queue', icon: CheckSquare },
    { id: 'activity', label: 'Activity Feed', icon: Activity },
  ];

  return (
    <div className="space-y-5 animate-slide-in">
      <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#071217] via-[#0a1012] to-[#100a18] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[.18em] text-cyan-300">Unified operating queue</div>
            <h1 className="mt-1 text-3xl font-bold text-white">Operations</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">One place for work that needs attention across Nifty, GHL / Affiliate, business projects, and Command Center system activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onNavigate?.('tickets')} className="inline-flex items-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-200 hover:bg-purple-500/15"><Ticket className="h-4 w-4"/>Open GHL / Affiliate</button>
            <button onClick={() => onNavigate?.('business-os')} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/15"><Briefcase className="h-4 w-4"/>Open Business OS</button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${view === id ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon className="h-4 w-4"/>{label}
            </button>
          ))}
        </div>
      </section>

      {view === 'tasks' ? <NiftyTasks /> : <ActionFeed />}
    </div>
  );
}
