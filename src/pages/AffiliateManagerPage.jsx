import React from 'react';
import { BriefcaseBusiness, ExternalLink, Target, Users, TrendingUp, CalendarDays, BookOpen } from 'lucide-react';
import AffiliateHub from '../components/affiliates/AffiliateHub';

const LINKS=[
 ['FirstPromoter','https://firstpromoter.com/login','Affiliate tracking, referrals and payouts'],
 ['HighLevel','https://app.gohighlevel.com/','Product / platform workspace'],
 ['Google Calendar','https://calendar.google.com/','Partner calls, internal meetings and events'],
 ['Nifty','https://niftypm.com/','Canonical Affiliate Career tasks and project execution'],
];
export default function AffiliateManagerPage(){return <div className="space-y-5">
 <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-[#0b0d12] to-purple-950/20 p-5"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-cyan-500/15 grid place-items-center"><BriefcaseBusiness className="w-5 h-5 text-cyan-300"/></div><div><div className="text-xs uppercase tracking-[.18em] text-cyan-300">GoHighLevel career</div><h1 className="text-2xl font-bold text-white">Affiliate Manager OS</h1><p className="text-sm text-gray-500 mt-1">Customer Support Specialist / Freshdesk is legacy. Active work is partner growth, affiliate portfolio management, enablement, product mastery, reporting, events and relationship development.</p></div></div>
 <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5"><P icon={Target} t="Scorecard" d="Know the role metrics and promotion path"/><P icon={Users} t="Portfolio" d="Prioritize partners and next best actions"/><P icon={TrendingUp} t="Growth" d="Enable partners and grow referred revenue"/><P icon={CalendarDays} t="Cadence" d="Run outreach, reviews, follow-ups and events"/></div></section>
 <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{LINKS.map(([n,u,d])=><button key={n} onClick={()=>window.open(u,'_blank','noopener,noreferrer')} className="text-left rounded-xl border border-white/10 bg-white/[.03] p-4 hover:bg-white/[.06]"><div className="flex items-center justify-between"><div className="font-semibold text-white">{n}</div><ExternalLink className="w-4 h-4 text-gray-500"/></div><div className="text-xs text-gray-500 mt-1">{d}</div></button>)}</section>
 <div className="rounded-xl border border-amber-500/15 bg-amber-500/[.04] p-3 text-xs text-gray-400"><BookOpen className="w-4 h-4 inline mr-2 text-amber-300"/>Freshdesk ticket queues, ticket-response tasks, support SLAs and support-training workflows are intentionally excluded from the active workspace.</div>
 <AffiliateHub/>
 </div>}
function P({icon:Icon,t,d}){return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><Icon className="w-4 h-4 text-cyan-300"/><div className="font-semibold text-white text-sm mt-2">{t}</div><div className="text-xs text-gray-500 mt-1">{d}</div></div>}
