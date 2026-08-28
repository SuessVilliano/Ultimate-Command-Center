import React, { useMemo, useState } from 'react';
import { Bot, ExternalLink, Film, Maximize2, MonitorPlay, Radio, Sparkles, Users, Wand2 } from 'lucide-react';
import ContentEngine from './ContentEngine';

const CLIPPEDIT_URL = import.meta.env.VITE_CLIPPEDIT_URL || 'http://localhost:3102';
const OBS_REMOTE_URL = import.meta.env.VITE_OBS_REMOTE_URL || 'http://localhost:3101';

const TABS = [
  { id: 'engine', label: 'Content Engine', icon: Sparkles },
  { id: 'clippedit', label: 'Clipped It', icon: Film },
  { id: 'obs', label: 'OBS Remote', icon: Radio },
  { id: 'agents', label: 'Agent Studio', icon: Users },
];

function AppFrame({ title, url, description }) {
  const [frameKey, setFrameKey] = useState(0);
  return <div className="rounded-2xl border border-white/10 bg-[#090a10] overflow-hidden min-h-[760px]">
    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
      <div><div className="text-sm font-semibold text-white">{title}</div><div className="text-xs text-gray-500">{description}</div></div>
      <div className="flex gap-2">
        <button onClick={() => setFrameKey(x => x + 1)} className="px-3 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-300">Reload</button>
        <button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="px-3 py-2 text-xs rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-200 hover:bg-purple-500/25"><ExternalLink className="w-3.5 h-3.5 inline mr-1" />Open full app</button>
      </div>
    </div>
    <div className="relative h-[700px] bg-black">
      <iframe key={frameKey} src={url} title={title} className="absolute inset-0 w-full h-full border-0" allow="camera; microphone; clipboard-read; clipboard-write; autoplay; fullscreen" />
      <div className="pointer-events-none absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/70 text-[10px] text-gray-500 border border-white/10">If the app blocks embedding, use Open full app.</div>
    </div>
  </div>;
}

const LEADS = [
  { name: 'Content Lead', mission: 'Scripts, clipping, repurposing, video pipeline, distribution', workers: ['Clip Scout', 'Script Writer', 'Video Producer', 'Distribution Agent'] },
  { name: 'Trading Lead', mission: 'Hybrid Journal, QQE, Guardian, review, risk/process', workers: ['Signal Analyst', 'Market Cause', 'Risk Coach', 'Journal Reviewer'] },
  { name: 'Business Lead', mission: 'Affiliate, Smart Life Brokers, GHL, growth and follow-up', workers: ['Affiliate Ops', 'CRM Ops', 'Growth Analyst', 'Follow-up Agent'] },
  { name: 'Systems Lead', mission: 'GitHub, Mac workspace, MCP, deployments and reliability', workers: ['DevOps', 'QA Agent', 'Integration Agent', 'File/Knowledge Agent'] },
  { name: 'Personal Lead', mission: 'Calendar, family, health habits, Highest Self and life alignment', workers: ['Health Signal', 'Calendar Guard', 'Family Planner', 'Self Scorekeeper'] },
];

function AgentStudio() {
  return <div className="space-y-5">
    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/30 to-cyan-950/10 p-5">
      <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-purple-500/20 grid place-items-center"><Bot className="w-6 h-6 text-purple-300" /></div><div><div className="text-lg font-bold text-white">Juno — Executive Assistant / Commander</div><div className="text-sm text-gray-400">Receives your intent, protects your attention, delegates to leads, collects results, and only brings you decisions/approvals that need you.</div></div></div>
      <div className="mt-4 grid sm:grid-cols-4 gap-2 text-xs"><div className="rounded-lg bg-white/5 p-3"><div className="text-gray-500">Default</div><div className="text-white font-semibold">Proactive</div></div><div className="rounded-lg bg-white/5 p-3"><div className="text-gray-500">Safe reads</div><div className="text-emerald-300 font-semibold">Automatic</div></div><div className="rounded-lg bg-white/5 p-3"><div className="text-gray-500">External writes</div><div className="text-amber-300 font-semibold">Approval gated</div></div><div className="rounded-lg bg-white/5 p-3"><div className="text-gray-500">Live trades</div><div className="text-rose-300 font-semibold">Explicit confirm</div></div></div>
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      {LEADS.map(lead => <div key={lead.name} className="rounded-xl border border-white/10 bg-[#11131a] p-4"><div className="font-semibold text-white">{lead.name}</div><div className="text-xs text-gray-500 mt-1">{lead.mission}</div><div className="mt-3 flex flex-wrap gap-2">{lead.workers.map(w => <span key={w} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">{w}</span>)}</div></div>)}
    </div>
    <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[.04] p-4 text-sm text-gray-300"><Wand2 className="w-4 h-4 inline mr-2 text-cyan-300" />Continuous work should be scheduled through the existing proactive engine and Nifty first. Taskade/TaskMagic can remain an execution connector where it adds unique value rather than becoming a second task database.</div>
  </div>;
}

export default function CreatorControlRoom() {
  const [tab, setTab] = useState('engine');
  const active = useMemo(() => TABS.find(x => x.id === tab), [tab]);
  return <div className="space-y-5">
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div><div className="text-xs uppercase tracking-[.2em] text-purple-300">Creator Operations</div><h1 className="text-2xl font-bold text-white">Content & Broadcast Control Room</h1><p className="text-sm text-gray-500 mt-1">Idea → voice → AI team → clip/video → OBS → distribution, from one cockpit.</p></div>
      <div className="flex flex-wrap gap-2">{TABS.map(t => { const Icon=t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${tab===t.id?'bg-purple-500/20 border-purple-400/40 text-white':'bg-white/[.03] border-white/10 text-gray-400 hover:text-white'}`}><Icon className="w-4 h-4" />{t.label}</button>; })}</div>
    </div>
    {active?.id === 'engine' && <ContentEngine />}
    {active?.id === 'clippedit' && <AppFrame title="Clipped It — Livestream Intelligence" url={CLIPPEDIT_URL} description="Live radar, trending, emerging moments and rights-aware clip intelligence." />}
    {active?.id === 'obs' && <AppFrame title="OBS Remote — Broadcast Console" url={OBS_REMOTE_URL} description="Program confidence view, scenes, audio, stream/record, sounds, playlists and preflight." />}
    {active?.id === 'agents' && <AgentStudio />}
  </div>;
}
