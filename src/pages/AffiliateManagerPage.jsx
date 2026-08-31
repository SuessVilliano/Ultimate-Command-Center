import React, { useState } from 'react';
import { Briefcase, ExternalLink, Target, Users, TrendingUp, CalendarDays, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import AffiliateHub from '../components/affiliates/AffiliateHub';

const WORK_LINKS = [
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

function QuickLink({ item }) {
  const [name, url, description, icon] = item;
  return (
    <button
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      className="text-left rounded-xl border border-white/10 bg-white/[.03] p-4 hover:bg-white/[.07] transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg" aria-hidden="true">{icon}</span>
          <div className="font-semibold text-white truncate">{name}</div>
        </div>
        <ExternalLink className="w-4 h-4 text-gray-500 shrink-0"/>
      </div>
      <div className="text-xs text-gray-500 mt-2">{description}</div>
    </button>
  );
}

export default function AffiliateManagerPage(){
  const [legacyOpen, setLegacyOpen] = useState(false);

  return <div className="space-y-5">
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-[#0b0d12] to-purple-950/20 p-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-cyan-500/15 grid place-items-center"><Briefcase className="w-5 h-5 text-cyan-300"/></div>
        <div>
          <div className="text-xs uppercase tracking-[.18em] text-cyan-300">GoHighLevel career</div>
          <h1 className="text-2xl font-bold text-white">Affiliate Manager OS</h1>
          <p className="text-sm text-gray-500 mt-1">Active work is partner growth, affiliate portfolio management, enablement, product mastery, reporting, events and relationship development. Support-ticket work is legacy, but useful GHL employee tools stay accessible.</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
        <P icon={Target} t="Scorecard" d="Know the role metrics and promotion path"/>
        <P icon={Users} t="Portfolio" d="Prioritize partners and next best actions"/>
        <P icon={TrendingUp} t="Growth" d="Enable partners and grow referred revenue"/>
        <P icon={CalendarDays} t="Cadence" d="Run outreach, reviews, follow-ups and events"/>
      </div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-white">GHL Work Tools</div>
          <div className="text-xs text-gray-500 mt-1">Quick access to the employee tools you used before the Affiliate Manager pivot.</div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {WORK_LINKS.map(item => <QuickLink key={item[0]} item={item}/>) }
      </div>
    </section>

    <section className="rounded-xl border border-amber-500/15 bg-amber-500/[.04] overflow-hidden">
      <button onClick={() => setLegacyOpen(v => !v)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
        <div className="text-xs text-gray-400"><BookOpen className="w-4 h-4 inline mr-2 text-amber-300"/>Legacy Support Links — accessible, but no active ticket queues, alerts, SLAs, schedules or support tasks.</div>
        {legacyOpen ? <ChevronUp className="w-4 h-4 text-gray-500"/> : <ChevronDown className="w-4 h-4 text-gray-500"/>}
      </button>
      {legacyOpen && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 pt-0">
        {LEGACY_SUPPORT_LINKS.map(item => <QuickLink key={item[0]} item={item}/>) }
      </div>}
    </section>

    <AffiliateHub/>
  </div>
}

function P({icon:Icon,t,d}){
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><Icon className="w-4 h-4 text-cyan-300"/><div className="font-semibold text-white text-sm mt-2">{t}</div><div className="text-xs text-gray-500 mt-1">{d}</div></div>
}
