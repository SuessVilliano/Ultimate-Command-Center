import React, { useEffect, useState } from 'react';
import { Briefcase, ExternalLink, Target, Users, TrendingUp, CalendarDays, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import AffiliateHub from '../components/affiliates/AffiliateHub';

const WORK_LINKS = [
  ['Affiliate EXPAND Sheet','https://docs.google.com/spreadsheets/d/1FhqNEO_K2yvd9RAieCbMR42Wc2Pa5RdE59uvVXqYuNs/edit?gid=1126268514#gid=1126268514','Affiliate portfolio, segmentation, reactivation and performance data','📊'],
  ['First Promoters','https://firstpromoter.com/login','Affiliate tracking, referrals and payouts','🚀'],
  ['HighLevel','https://app.gohighlevel.com/','Product / platform workspace','⚡'],
  ['HQ','https://support.leadconnectorhq.com/login','LeadConnector / HighLevel HQ','🏢'],
  ['Twilio','https://www.twilio.com/login?g=%2Fconsole-zen%2Fhttps%3A%2F%2Fconsole.twilio.com%2F&t=2d94b9e4c79e07a34a2fac4a2be87b4517b42f35aa88738462dfee82b084af25','Twilio Console','📞'],
  ['Gemini','https://gemini.google.com/gem/a3f972a495f7','Google Gemini AI','🌟'],
  ['ChatGPT','https://chatgpt.com/g/g-68b6f4f1844881918c4892febc6e9a44-highlevel-support-agent','HighLevel GPT workspace','🤖'],
  ['Google Calendar','https://calendar.google.com/calendar/u/0/r?cid=jamaur.johnson@gohighlevel.com&pli=1','Partner calls, internal meetings and events','📅'],
  ['Senior Zoom','https://us02web.zoom.us/j/3297827881','Senior team Zoom room','🎥'],
  ['BambooHR','https://gohighlevel.bamboohr.com/home','HR portal','🎋'],
  ['Slack','https://app.slack.com/client/E098GV8SRC2/GMBP6HAPM','GHL Slack workspace','💬'],
  ['Knowledgebase','https://help.gohighlevel.com/support/home','HighLevel Help Center','📚'],
  ['ClickUp','https://app.clickup.com','Project management','✅'],
  ['ADP','https://workforcenow.adp.com/theme/index.html#/home','Payroll / workforce','💰'],
  ['Darwinbox','https://gohighlevel.darwinbox.com/','Darwinbox HR','📦'],
  ['Nifty','https://niftypm.com/','Canonical Affiliate Career tasks and project execution','🗂️'],
];

const LEGACY_SUPPORT_LINKS = [
  ['Freshdesk','https://gohighlevelassist.freshdesk.com/a/dashboard/default','Legacy Freshdesk dashboard','🎫'],
  ['Fresh Chat','https://highlevel-team.freshchat.com/a/309618592266199/inbox/3/0','Legacy Freshchat inbox','🆘'],
  ['Support Dashboard','https://docs.google.com/spreadsheets/d/1oD_dS_A4b3lNW7cWEdv6QYeb3zJakV_PoKweyhFgaNs/edit?pli=1&gid=1182538947#gid=1182538947','Legacy support Google Sheet','📊'],
];

const STORAGE = {
  workToolsOpen: 'liv8_ghl_work_tools_open',
  legacyOpen: 'liv8_ghl_legacy_links_open',
  affiliateHubOpen: 'liv8_ghl_affiliate_hub_open',
};

function loadOpenState(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : raw === 'true';
  } catch { return fallback; }
}

function QuickLink({ item }) {
  const [name, url, description, icon] = item;
  return <button
    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    className="text-left rounded-xl border border-cyan-500/10 bg-[#080d10] p-4 hover:border-cyan-500/30 hover:bg-[#0b1317] transition-colors shadow-inner shadow-black/30"
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0"><span className="text-lg" aria-hidden="true">{icon}</span><div className="font-semibold text-gray-100 truncate">{name}</div></div>
      <ExternalLink className="w-4 h-4 text-cyan-700 shrink-0"/>
    </div>
    <div className="text-xs text-slate-500 mt-2">{description}</div>
  </button>;
}

function CollapsibleHeader({ title, subtitle, open, onToggle, accent = 'text-cyan-400', icon: Icon }) {
  return <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 text-left">
    <div className="min-w-0">
      <div className="text-sm font-semibold text-gray-100 flex items-center gap-2">{Icon ? <Icon className={`w-4 h-4 ${accent}`}/> : null}{title}</div>
      {subtitle ? <div className="text-xs text-slate-500 mt-1">{subtitle}</div> : null}
    </div>
    {open ? <ChevronUp className="w-4 h-4 text-cyan-700 shrink-0"/> : <ChevronDown className="w-4 h-4 text-cyan-700 shrink-0"/>}
  </button>;
}

export default function AffiliateManagerPage(){
  const [workToolsOpen, setWorkToolsOpen] = useState(() => loadOpenState(STORAGE.workToolsOpen, true));
  const [legacyOpen, setLegacyOpen] = useState(() => loadOpenState(STORAGE.legacyOpen, false));
  const [affiliateHubOpen, setAffiliateHubOpen] = useState(() => loadOpenState(STORAGE.affiliateHubOpen, true));

  useEffect(() => { try { localStorage.setItem(STORAGE.workToolsOpen, String(workToolsOpen)); } catch {} }, [workToolsOpen]);
  useEffect(() => { try { localStorage.setItem(STORAGE.legacyOpen, String(legacyOpen)); } catch {} }, [legacyOpen]);
  useEffect(() => { try { localStorage.setItem(STORAGE.affiliateHubOpen, String(affiliateHubOpen)); } catch {} }, [affiliateHubOpen]);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#071217] via-[#080c11] to-[#120b1b] p-5 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl border border-cyan-500/20 bg-cyan-500/10 grid place-items-center"><Briefcase className="w-5 h-5 text-cyan-300"/></div>
        <div><div className="text-xs uppercase tracking-[.18em] text-cyan-300">GoHighLevel career</div><h1 className="text-2xl font-bold text-gray-100">Affiliate Manager OS</h1><p className="text-sm text-slate-500 mt-1">Partner growth, portfolio management, enablement, product mastery, reporting, events and relationship development.</p></div>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5"><P icon={Target} t="Scorecard" d="Know the role metrics and promotion path"/><P icon={Users} t="Portfolio" d="Prioritize partners and next best actions"/><P icon={TrendingUp} t="Growth" d="Enable partners and grow referred revenue"/><P icon={CalendarDays} t="Cadence" d="Run outreach, reviews, follow-ups and events"/></div>
    </section>

    <section className="rounded-2xl border border-[#173039] bg-[#070c0f] p-4">
      <CollapsibleHeader title="GHL Work Tools" subtitle="Quick access to employee tools. Collapse this when you want a cleaner workspace." open={workToolsOpen} onToggle={() => setWorkToolsOpen(v => !v)} />
      {workToolsOpen && <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-4">{WORK_LINKS.map(item => <QuickLink key={item[0]} item={item}/>)}</div>}
    </section>

    <section className="rounded-2xl border border-amber-500/15 bg-[#0d0d09] p-4">
      <CollapsibleHeader title="Legacy Support Links" subtitle="Accessible when needed; no active ticket queues, alerts, SLAs, schedules or support tasks." open={legacyOpen} onToggle={() => setLegacyOpen(v => !v)} accent="text-amber-300" icon={BookOpen} />
      {legacyOpen && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">{LEGACY_SUPPORT_LINKS.map(item => <QuickLink key={item[0]} item={item}/>)}</div>}
    </section>

    <section className="rounded-2xl border border-[#173039] bg-[#070c0f] p-4">
      <CollapsibleHeader title="Affiliate Hub" subtitle="Partner portfolio, enablement and affiliate-management workspace." open={affiliateHubOpen} onToggle={() => setAffiliateHubOpen(v => !v)} />
      {affiliateHubOpen && <div className="mt-4"><AffiliateHub/></div>}
    </section>
  </div>;
}

function P({icon:Icon,t,d}){
  return <div className="rounded-xl border border-cyan-500/10 bg-[#080d10] p-3"><Icon className="w-4 h-4 text-cyan-300"/><div className="font-semibold text-gray-100 text-sm mt-2">{t}</div><div className="text-xs text-slate-500 mt-1">{d}</div></div>;
}
