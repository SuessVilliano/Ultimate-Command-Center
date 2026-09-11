import React, { useState } from 'react';
import { Brain, FlaskConical, Search, ShieldCheck, TrendingUp, Users } from 'lucide-react';

const cohorts = [
  ['Top Producers',15],['Fast Growers',10],['Strong / Declining',10],['High-Potential Creators',10]
];
const questions = [
  'Who are the top current trial producers?',
  'Who is growing fastest and who is declining?',
  'Which channels and niches dominate the top cohorts?',
  'Which videos outperform each creator baseline?',
  'Which topics, hooks, formats and CTAs repeat among winners?',
  'Who responds fastest to new HighLevel releases?',
  'Which evergreen tutorials continue attracting traffic?',
  'How does each affiliate in My Book compare with similar top performers?'
];

export default function AffiliateIntelligenceWorkspace(){
  const [tab,setTab]=useState('benchmark');
  return <section className="space-y-4">
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#071217] via-[#080c11] to-[#120b1b] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div><div className="flex items-center gap-2 text-xs uppercase tracking-[.18em] text-cyan-300"><Brain className="h-4 w-4"/>Affiliate intelligence engine</div><h2 className="mt-2 text-xl font-bold text-white">Top Affiliate Intelligence</h2><p className="mt-1 text-sm text-slate-400">Company-wide benchmark research plus a separate action layer for My Book.</p></div>
        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">{[['benchmark','Company Benchmark'],['book','My Book'],['proof','Proof Lab']].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab===id?'bg-cyan-500/15 text-cyan-200':'text-slate-500'}`}>{label}</button>)}</div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[[Users,'Company universe','398','Research benchmark'],[ShieldCheck,'Assigned to Jamaur','51','Current operating book'],[Search,'Known social URLs','212','YouTube or Instagram'],[FlaskConical,'Research cohort','45','ClippedIt deep research']].map(([Icon,l,v,d])=><div key={l} className="rounded-xl border border-cyan-500/10 bg-[#080d10] p-4"><Icon className="h-4 w-4 text-cyan-300"/><div className="mt-2 text-2xl font-bold text-white">{v}</div><div className="text-xs font-semibold text-slate-300">{l}</div><div className="mt-1 text-xs text-slate-600">{d}</div></div>)}</div>
    </div>
    {tab==='benchmark'&&<div className="grid gap-4 xl:grid-cols-2"><Panel title="45-person research cohorts"><div className="grid gap-2 sm:grid-cols-2">{cohorts.map(([name,count])=><div key={name} className="rounded-xl border border-white/5 bg-white/[.02] p-3"><div className="flex justify-between text-sm"><span className="font-semibold text-slate-200">{name}</span><span className="text-purple-300">{count}</span></div></div>)}</div></Panel><Panel title="Questions the engine answers">{questions.map(q=><div key={q} className="mb-2 rounded-lg border border-white/5 bg-white/[.02] p-2 text-xs text-slate-400">{q}</div>)}</Panel></div>}
    {tab==='book'&&<Panel title="My Book comparison + coaching"><p className="text-sm text-slate-400">Compare every assigned affiliate with relevant company peers by promotion channel, niche, language, content footprint and production level. Show company percentile, book percentile, closest successful peers, trial/content gaps and one recommended next action.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{[['Benchmark','Percentiles + closest successful peers'],['Gap','Trials + cadence + topic + channel gaps'],['Action','Coach, contact, create, investigate, reactivate or no action']].map(([a,b])=><div key={a} className="rounded-xl border border-emerald-500/10 bg-emerald-500/[.03] p-3"><div className="text-sm font-semibold text-emerald-200">{a}</div><div className="mt-1 text-xs text-slate-500">{b}</div></div>)}</div></Panel>}
    {tab==='proof'&&<Panel title="Zero-to-growth Proof Lab"><p className="text-sm text-slate-400">Test whether benchmark patterns transfer to a fresh account. Compare faceless AI content, narrated screen tutorials and selective expert-led content. Track impressions, CTR, views, retention, subscribers, clicks, trials and attributable conversions.</p><div className="mt-4 flex items-center gap-2 text-xs text-fuchsia-200"><TrendingUp className="h-4 w-4"/>Observed patterns become validated playbooks only after measured tests.</div></Panel>}
    <Panel title="Closed-loop workflow"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">{['Segment','Research','Genome','Compare','Recommend','Create','Measure'].map((x,i)=><div key={x} className="rounded-xl border border-white/5 bg-white/[.02] p-3"><div className="text-[10px] font-bold text-cyan-400">{i+1}</div><div className="mt-1 text-sm font-semibold text-slate-200">{x}</div></div>)}</div></Panel>
  </section>;
}
function Panel({title,children}){return <div className="rounded-2xl border border-cyan-500/15 bg-[#070c0f] p-4"><h3 className="mb-3 font-semibold text-white">{title}</h3>{children}</div>}
