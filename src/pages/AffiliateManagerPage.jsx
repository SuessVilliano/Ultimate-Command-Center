import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  GripVertical,
  LayoutDashboard,
  RefreshCw,
  RotateCcw,
  Save,
  Target,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import AffiliateHub from '../components/affiliates/AffiliateHub';
import LiveAffiliateCrmSync from '../components/affiliates/LiveAffiliateCrmSync';
import ReactivationPortfolio from '../components/affiliates/ReactivationPortfolio';
import AffiliateInteractionCapture from '../components/affiliates/AffiliateInteractionCapture';
import AffiliateOpsFields from '../components/affiliates/AffiliateOpsFields';
import AffiliateSegmentation from '../components/affiliates/AffiliateSegmentation';
import AffiliateIntelligenceWorkspace, { ClosedLoopWorkflow } from '../components/affiliates/AffiliateIntelligenceWorkspace';
import PortfolioIntelligence from '../components/affiliates/PortfolioIntelligence';
import OlivMeetingInbox from '../components/affiliates/OlivMeetingInbox';
import WeeklyAffiliateBrief from '../components/affiliates/WeeklyAffiliateBrief';
import AffiliateDataImport from '../components/affiliates/AffiliateDataImport';
import { getCloudState, setCloudState } from '../lib/liv8-cloud-state';

const WORK_LINKS = [
  ['Affiliate Command Center (ACC)','https://expand-command-center.vercel.app/leadership#home','Open the Affiliate Command Center for leadership, sessions and partner operations','🧭'],
  ['Affiliate Hub','https://affiliates.gohighlevel.com/','HighLevel affiliate resources, enablement and partner hub','🤝'],
  ['Affiliate Community','https://affiliatecommunity.gohighlevel.com/communities/groups/highlevel-affiliate-community/learning','HighLevel Affiliate Community learning, discussions and community resources','👥'],
  ['My Book','https://docs.google.com/spreadsheets/d/1FhqNEO_K2yvd9RAieCbMR42Wc2Pa5RdE59uvVXqYuNs/edit?gid=2031531288#gid=2031531288','Jamaur’s assigned affiliate book with notes, status, forecasting and performance data','📊'],
  ['Gamification','https://docs.google.com/spreadsheets/d/12RGwzP7YAkr0aBrl3Ra40Xk7BvwaBTb9oo5ljFgrnpU/edit?gid=1207811217#gid=1207811217','Xavier-provided gamification tracker for offers, performance, completion and payouts','🎯'],
  ['Trials Goals','https://docs.google.com/spreadsheets/d/12RGwzP7YAkr0aBrl3Ra40Xk7BvwaBTb9oo5ljFgrnpU/edit?gid=1673541902#gid=1673541902','Trial-goal workspace for setting and tracking affiliate production goals','📈'],
  ['Endorsement Sheet','https://docs.google.com/spreadsheets/d/1Km3xLBqkiyzLCqh2I25LV34GKtF4rImngRUAOM-aY-g/edit?gid=2101000012#gid=2101000012','Affiliate endorsement tracking and reference sheet','🏅'],
  ['Affiliate SOPs','https://docs.google.com/spreadsheets/d/1DnYn1NCarQFWd-2LCt2QGP4LmPBXCoVbDEG4GiEWSVg/edit?gid=1220225360#gid=1220225360','Affiliate team procedures, operating guidance and reference material','📚'],
  ['First Promoters','https://firstpromoter.com/login','Affiliate tracking, referrals and payouts','🚀'],
  ['HighLevel','https://app.gohighlevel.com/v2/location/jL84BEwDKwPefLU4YQYR/dashboard','Product / platform workspace','⚡'],
  ['HQ','https://support.leadconnectorhq.com/login','LeadConnector / HighLevel HQ','🏢'],
  ['Darwinbox','https://gohighlevel.darwinbox.com/','HighLevel employee HR and workforce portal','📦'],
  ['Gemini','https://gemini.google.com/gem/a3f972a495f7','Google Gemini AI','🌟'],
  ['Google Calendar','https://calendar.google.com/calendar/u/0/r?cid=jamaur.johnson@gohighlevel.com&pli=1','Partner calls, internal meetings and events','📅'],
  ['Weekly Affiliate Q&A','https://speakwith.us/affiliate-qa-page752776','Share this registration page with affiliates for the weekly sessions','🎙️'],
  ['Slack','https://app.slack.com/client/E098GV8SRC2/GMBP6HAPM','GHL Slack workspace','💬'],
  ['Knowledgebase','https://help.gohighlevel.com/support/home','HighLevel Help Center','📚'],
  ['ClickUp','https://app.clickup.com','Project management','✅'],
  ['Nifty','https://niftypm.com/','Canonical Affiliate Career tasks and project execution','🗂️'],
  ['Affiliate Follow-Up Log','https://docs.google.com/document/d/18zpSQcsZ-D6DxdwUulCusrXr-kPwYUKE36G6bLZoo34/edit','Shared interaction log connected to the Nifty and TaskMagic workflow','📝'],
  ['TaskMagic','https://app.taskmagic.com/','Route approved affiliate follow-ups and external automations','🪄'],
];

const AFFILIATE_APP_URL = 'https://expand-command-center.vercel.app/leadership#home';
const LEGACY_SUPPORT_LINKS = [
  ['Senior Zoom','https://us02web.zoom.us/j/3297827881','Legacy senior support team Zoom room','🎥'],
  ['Freshdesk','https://gohighlevelassist.freshdesk.com/a/dashboard/default','Legacy Freshdesk dashboard','🎫'],
  ['Fresh Chat','https://highlevel-team.freshchat.com/a/309618592266199/inbox/3/0','Legacy Freshchat inbox','🆘'],
];

const LAYOUT_STORAGE_KEY = 'liv8_ghl_dashboard_layout_v2';
const LAYOUT_CLOUD_KEY = 'ghl.dashboard.layout';

const SECTION_META = [
  { id:'weekly', title:'Weekly Affiliate', subtitle:'Weekly brief, priorities, movement and manager-ready summary.', icon:CalendarDays, defaultOpen:true },
  { id:'career', title:'GoHighLevel Career', subtitle:'Your Affiliate Manager operating goals and weekly cadence.', icon:Briefcase, defaultOpen:true },
  { id:'work-tools', title:'GHL Work Tools', subtitle:'Quick links for recurring AFM work, employee systems and references.', icon:LayoutDashboard, defaultOpen:false },
  { id:'acc', title:'Affiliate Command Center (ACC)', subtitle:'The full affiliate leadership workspace embedded on demand.', icon:Briefcase, defaultOpen:false, flush:true },
  { id:'crm', title:'Affiliate CRM', subtitle:'Live staff-scoped HighLevel contacts, notes, activity and follow-up context.', icon:Database, defaultOpen:true },
  { id:'hub', title:'Affiliate Hub', subtitle:'Analytics, outreach tools and enablement workflows without duplicating the live CRM.', icon:Users, defaultOpen:false },
  { id:'intelligence', title:'Top Affiliate Intelligence', subtitle:'Company benchmarks, research cohorts, My Book comparisons and Proof Lab.', icon:Brain, defaultOpen:false },
  { id:'portfolio', title:'Portfolio Intelligence', subtitle:'Action-first prioritization, risk signals, benchmarks and outreach queue.', icon:BarChart3, defaultOpen:false },
  { id:'closed-loop', title:'Closed-Loop Workflow', subtitle:'Segment → research → compare → recommend → create → measure.', icon:Workflow, defaultOpen:false },
  { id:'reactivation', title:'Reactivation Portfolio', subtitle:'Recover dormant and declining affiliates without losing relationship context.', icon:RefreshCw, defaultOpen:false },
  { id:'segmentation', title:'Affiliate Segmentation', subtitle:'Cohorts and operating segments for the affiliate book.', icon:Target, defaultOpen:false },
  { id:'oliv', title:'Oliv Meeting Inbox', subtitle:'Meeting intelligence and reviewed CRM-note workflow.', icon:CalendarDays, defaultOpen:false },
  { id:'ops-fields', title:'Affiliate Operations Fields', subtitle:'Operational metadata used to keep affiliate work structured.', icon:Target, defaultOpen:false },
  { id:'interaction-capture', title:'Affiliate Interaction Capture', subtitle:'Capture notes, commitments, next actions and follow-up dates.', icon:Users, defaultOpen:false },
  { id:'legacy', title:'Legacy Support Links', subtitle:'Historical support links, collapsed by default.', icon:BookOpen, defaultOpen:false },
];

const DEFAULT_LAYOUT = SECTION_META.map(section => ({ id: section.id, open: section.defaultOpen }));

function sanitizeLayout(parsed) {
  if (!Array.isArray(parsed)) return DEFAULT_LAYOUT.map(item => ({ ...item }));
  const known = new Set(SECTION_META.map(section => section.id));
  const sanitized = parsed
    .filter(item => item && known.has(item.id))
    .map(item => ({ id: item.id, open: item.open !== false }));
  const present = new Set(sanitized.map(item => item.id));
  const missing = DEFAULT_LAYOUT.filter(item => !present.has(item.id));
  return [...sanitized, ...missing];
}

function loadLayout() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || 'null');
    return sanitizeLayout(parsed);
  } catch {
    return DEFAULT_LAYOUT.map(item => ({ ...item }));
  }
}

export default function AffiliateManagerPage(){
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [layout,setLayout] = useState(loadLayout);
  const [draggingId,setDraggingId] = useState(null);
  const [saved,setSaved] = useState(false);
  const [affiliateAppKey,setAffiliateAppKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getCloudState(LAYOUT_CLOUD_KEY, null).then(state => {
      const cloudLayout = state?.value?.layout;
      if (!alive || !Array.isArray(cloudLayout)) return;
      const next = sanitizeLayout(cloudLayout);
      setLayout(next);
      try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next)); } catch {}
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const persistLayout = next => {
    setLayout(next);
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next)); } catch {}
    setCloudState(LAYOUT_CLOUD_KEY, { layout: next }).catch(() => {});
    setSaved(true);
    window.clearTimeout(persistLayout._timer);
    persistLayout._timer = window.setTimeout(() => setSaved(false), 1600);
  };

  const toggleSection = id => persistLayout(layout.map(item => item.id === id ? { ...item, open: !item.open } : item));
  const setAllOpen = open => persistLayout(layout.map(item => ({ ...item, open })));
  const resetLayout = () => persistLayout(DEFAULT_LAYOUT.map(item => ({ ...item })));

  const moveSection = (id, delta) => {
    const from = layout.findIndex(item => item.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= layout.length) return;
    const next = [...layout];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistLayout(next);
  };

  const dropSection = targetId => {
    if (!draggingId || draggingId === targetId) return setDraggingId(null);
    const next = [...layout];
    const from = next.findIndex(item => item.id === draggingId);
    if (from < 0) return setDraggingId(null);
    const [moved] = next.splice(from, 1);
    const target = next.findIndex(item => item.id === targetId);
    next.splice(target < 0 ? next.length : target, 0, moved);
    setDraggingId(null);
    persistLayout(next);
  };

  const renderContent = id => {
    switch (id) {
      case 'weekly': return <WeeklyAffiliateBrief/>;
      case 'career': return <CareerOverview isDark={isDark}/>;
      case 'work-tools': return <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">{WORK_LINKS.map(item=><QuickLink key={item[0]} item={item} isDark={isDark}/>)}</div>;
      case 'acc': return <iframe key={affiliateAppKey} src={AFFILIATE_APP_URL} title="Affiliate EXPAND Command Center" allow="microphone; clipboard-read; clipboard-write" referrerPolicy="strict-origin-when-cross-origin" className={`h-[78vh] min-h-[720px] w-full border-0 ${isDark?'bg-[#030305]':'bg-white'}`}/>;
      case 'crm': return <LiveAffiliateCrmSync isDark={isDark}/>;
      case 'hub': return <AffiliateHub isDark={isDark} showCrm={false}/>;
      case 'intelligence': return <AffiliateIntelligenceWorkspace showPortfolio={false} showClosedLoop={false}/>;
      case 'portfolio': return <PortfolioIntelligence/>;
      case 'closed-loop': return <ClosedLoopWorkflow/>;
      case 'reactivation': return <ReactivationPortfolio/>;
      case 'segmentation': return <AffiliateSegmentation/>;
      case 'oliv': return <OlivMeetingInbox/>;
      case 'ops-fields': return <AffiliateOpsFields/>;
      case 'interaction-capture': return <AffiliateInteractionCapture/>;
      case 'legacy': return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{LEGACY_SUPPORT_LINKS.map(item=><QuickLink key={item[0]} item={item} isDark={isDark}/>)}</div>;
      default: return null;
    }
  };

  return <div data-affiliate-manager-page className="space-y-4">
    <div className={`rounded-2xl border p-4 ${isDark?'border-cyan-500/15 bg-[#070c0f] shadow-xl shadow-black/20':'border-slate-200 bg-white shadow-sm'}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className={`flex items-center gap-2 text-xs uppercase tracking-[.18em] ${isDark?'text-cyan-300':'text-cyan-700'}`}><LayoutDashboard className="h-4 w-4"/>Customizable GHL dashboard</div>
          <h1 className={`mt-1 text-xl font-bold ${isDark?'text-white':'text-slate-950'}`}>Your affiliate workspace, in your order</h1>
          <p className={`mt-1 text-sm ${isDark?'text-slate-500':'text-slate-600'}`}>Collapse anything you do not need, drag sections into your preferred order, or use the arrow controls on mobile. Local changes are saved immediately and sync to your LIV8 account when connected.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AffiliateDataImport isDark={isDark} buttonClass={toolbarButton(isDark)} />
          <button onClick={()=>setAllOpen(true)} className={toolbarButton(isDark)}>Expand all</button>
          <button onClick={()=>setAllOpen(false)} className={toolbarButton(isDark)}>Collapse all</button>
          <button onClick={resetLayout} className={toolbarButton(isDark)}><RotateCcw className="h-3.5 w-3.5"/>Reset</button>
          <button onClick={()=>persistLayout([...layout])} className={`${toolbarButton(isDark)} ${saved ? (isDark?'border-emerald-400/30 text-emerald-200':'border-emerald-300 text-emerald-700') : ''}`}>{saved?<Check className="h-3.5 w-3.5"/>:<Save className="h-3.5 w-3.5"/>}{saved?'Saved':'Save layout'}</button>
        </div>
      </div>
    </div>

    {layout.map((item,index) => {
      const meta = SECTION_META.find(section => section.id === item.id);
      if (!meta) return null;
      const actions = item.id === 'acc' ? <div className="flex items-center gap-2">
        {item.open&&<button onClick={()=>setAffiliateAppKey(v=>v+1)} className={smallButton(isDark)}><RefreshCw className="h-3.5 w-3.5"/>Refresh</button>}
        <a href={AFFILIATE_APP_URL} target="_blank" rel="noopener noreferrer" className={smallButton(isDark)}><ExternalLink className="h-3.5 w-3.5"/>Open</a>
      </div> : null;
      return <DashboardSection
        key={item.id}
        meta={meta}
        open={item.open}
        isDark={isDark}
        index={index}
        total={layout.length}
        dragging={draggingId===item.id}
        onToggle={()=>toggleSection(item.id)}
        onMoveUp={()=>moveSection(item.id,-1)}
        onMoveDown={()=>moveSection(item.id,1)}
        onDragStart={()=>setDraggingId(item.id)}
        onDragEnd={()=>setDraggingId(null)}
        onDrop={()=>dropSection(item.id)}
        actions={actions}
      >{renderContent(item.id)}</DashboardSection>;
    })}
  </div>;
}

function DashboardSection({meta,open,isDark,index,total,dragging,onToggle,onMoveUp,onMoveDown,onDragStart,onDragEnd,onDrop,actions,children}){
  const Icon = meta.icon;
  return <section
    onDragOver={event=>event.preventDefault()}
    onDrop={onDrop}
    className={`overflow-hidden rounded-2xl border transition-all ${dragging?'opacity-50 scale-[.995]':''} ${isDark?'border-white/10 bg-[#070c0f] shadow-lg shadow-black/10':'border-slate-200 bg-white shadow-sm'}`}
  >
    <div className={`flex items-center gap-2 p-3 sm:p-4 ${open ? (isDark?'border-b border-white/10':'border-b border-slate-200') : ''}`}>
      <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} className={`cursor-grab rounded-lg p-2 active:cursor-grabbing ${isDark?'text-slate-600 hover:bg-white/5 hover:text-slate-300':'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`} title="Drag to reorder"><GripVertical className="h-4 w-4"/></div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${isDark?'text-cyan-300':'text-cyan-700'}`}/>
          <span className={`truncate text-sm font-semibold ${isDark?'text-gray-100':'text-slate-950'}`}>{meta.title}</span>
        </div>
        <div className={`mt-1 hidden text-xs sm:block ${isDark?'text-slate-500':'text-slate-600'}`}>{meta.subtitle}</div>
      </button>
      {actions}
      <div className="flex items-center gap-1">
        <button type="button" onClick={onMoveUp} disabled={index===0} className={iconButton(isDark)} title="Move up"><ArrowUp className="h-3.5 w-3.5"/></button>
        <button type="button" onClick={onMoveDown} disabled={index===total-1} className={iconButton(isDark)} title="Move down"><ArrowDown className="h-3.5 w-3.5"/></button>
      </div>
      <button type="button" onClick={onToggle} className={iconButton(isDark)} aria-label={open?`Collapse ${meta.title}`:`Expand ${meta.title}`}>{open?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}</button>
    </div>
    {open&&<div className={meta.flush?'':'p-3 sm:p-4'}>{children}</div>}
  </section>;
}

function CareerOverview({isDark}){
  return <section className={`rounded-2xl border p-5 ${isDark?'border-cyan-500/20 bg-gradient-to-br from-[#071217] via-[#080c11] to-[#120b1b] shadow-xl shadow-black/20':'border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-purple-50 shadow-sm'}`}>
    <div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-xl border ${isDark?'border-cyan-500/20 bg-cyan-500/10':'border-cyan-200 bg-cyan-100'}`}><Briefcase className={`h-5 w-5 ${isDark?'text-cyan-300':'text-cyan-700'}`}/></div><div><div className={`text-xs uppercase tracking-[.18em] ${isDark?'text-cyan-300':'text-cyan-700'}`}>GoHighLevel career</div><h2 className={`text-2xl font-bold ${isDark?'text-gray-100':'text-slate-950'}`}>Affiliate Manager OS</h2><p className={`mt-1 text-sm ${isDark?'text-slate-500':'text-slate-600'}`}>Deliverables first: book read, outreach, relationship signals, forecasting, CRM hygiene, trials and gamification reporting.</p></div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><P icon={Target} t="Forecast" d="Know what is moving the book and why" isDark={isDark}/><P icon={Users} t="Portfolio" d="Prioritize affiliates and preserve handoff context" isDark={isDark}/><P icon={TrendingUp} t="Movement" d="Track trials, replies, meetings and commitments" isDark={isDark}/><P icon={CalendarDays} t="Cadence" d="Keep weekly notes and next actions current" isDark={isDark}/></div>
  </section>;
}

function QuickLink({item,isDark}){
  const [name,url,description,icon]=item;
  return <button onClick={()=>window.open(url,'_blank','noopener,noreferrer')} className={`text-left rounded-xl border p-4 transition-colors ${isDark?'border-cyan-500/10 bg-[#080d10] hover:border-cyan-500/30 hover:bg-[#0b1317] shadow-inner shadow-black/30':'border-slate-200 bg-slate-50 hover:border-cyan-300 hover:bg-white shadow-sm'}`}><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="text-lg" aria-hidden="true">{icon}</span><div className={`truncate font-semibold ${isDark?'text-gray-100':'text-slate-900'}`}>{name}</div></div><ExternalLink className={`h-4 w-4 shrink-0 ${isDark?'text-cyan-700':'text-cyan-600'}`}/></div><div className={`mt-2 text-xs ${isDark?'text-slate-500':'text-slate-600'}`}>{description}</div></button>;
}

function P({icon:Icon,t,d,isDark}){
  return <div className={`rounded-xl border p-3 ${isDark?'border-cyan-500/10 bg-[#080d10]':'border-slate-200 bg-white'}`}><Icon className={`h-4 w-4 ${isDark?'text-cyan-300':'text-cyan-700'}`}/><div className={`mt-2 text-sm font-semibold ${isDark?'text-gray-100':'text-slate-900'}`}>{t}</div><div className={`mt-1 text-xs ${isDark?'text-slate-500':'text-slate-600'}`}>{d}</div></div>;
}

function toolbarButton(isDark){ return `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${isDark?'border-white/10 text-slate-300 hover:border-cyan-400/25 hover:text-white':'border-slate-200 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50'}`; }
function smallButton(isDark){ return `inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${isDark?'border-white/10 text-slate-300 hover:text-white':'border-slate-200 text-slate-700 hover:bg-slate-50'}`; }
function iconButton(isDark){ return `rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${isDark?'text-slate-500 hover:bg-white/5 hover:text-white':'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`; }
