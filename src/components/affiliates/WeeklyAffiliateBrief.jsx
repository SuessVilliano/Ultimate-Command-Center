import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, PhoneCall, Sparkles, Target, TrendingUp, Users } from 'lucide-react';

const SESSION_KEY = 'liv8_ghl_reactivation_book_v1';
const BOOK_UPDATED_EVENT = 'liv8:affiliate-book-updated';

function loadBook() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || []; }
  catch { return []; }
}

function priorityTier(a) {
  const p = String(a.priority || '');
  if (p.startsWith('1')) return 'PERSONAL CALL';
  if (p.startsWith('2')) return 'FULL LADDER';
  return 'SEQUENCE';
}

function hasText(value, rx) { return rx.test(String(value || '')); }

function scoreAffiliate(a) {
  let score = 0;
  if (a.stopOutreach || hasText(a.activeStatus, /do not pursue/i)) return -999;
  if (String(a.priority || '').startsWith('1')) score += 40;
  else if (String(a.priority || '').startsWith('2')) score += 24;
  else score += 8;
  score += Math.min(Number(a.lifetime || 0) / 25, 30);
  score += Math.min(Number(a.prevQ || 0) * 2, 24);
  score += Math.min(Number(a.currQ || 0) * 5, 30);
  score += Math.min(Number(a.mtd || 0) * 8, 32);
  if (hasText(a.activeStatus, /needs attention/i)) score += 16;
  if (hasText(a.activeStatus, /reactivation/i)) score += 12;
  if (hasText(a.replied, /yes|true|reply|respond/i)) score += 10;
  if (String(a.nextMove || '').trim()) score += 6;
  if (String(a.story || '').trim()) score += 4;
  return Math.round(score);
}

function actionFor(a) {
  if (a.stopOutreach || hasText(a.activeStatus, /do not pursue/i)) return 'HOLD';
  if (Number(a.mtd || 0) > 0 || Number(a.currQ || 0) > 0 || hasText(a.replied, /yes|true|reply|respond/i)) return 'MOVE NOW';
  if (String(a.priority || '').startsWith('1') || String(a.priority || '').startsWith('2')) return 'CALL';
  if (String(a.nextMove || '').trim() || hasText(a.activeStatus, /needs attention|reactivation/i)) return 'NUDGE';
  return 'AUTOMATION';
}

function dueNow(a) {
  const text = String(a.nextMove || '');
  if (!text) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const patterns = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (!patterns) return false;
  const year = patterns[3] ? Number(patterns[3].length === 2 ? `20${patterns[3]}` : patterns[3]) : today.getFullYear();
  const d = new Date(year, Number(patterns[1]) - 1, Number(patterns[2]));
  return !Number.isNaN(d.getTime()) && d <= today;
}

const STATUS_STYLE = {
  'MOVE NOW':'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  CALL:'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',
  NUDGE:'border-amber-500/25 bg-amber-500/10 text-amber-200',
  AUTOMATION:'border-purple-500/25 bg-purple-500/10 text-purple-200',
  HOLD:'border-red-500/25 bg-red-500/10 text-red-200',
};

export default function WeeklyAffiliateBrief() {
  const [book, setBook] = useState(loadBook);
  useEffect(() => {
    const refresh = () => setBook(loadBook());
    window.addEventListener(BOOK_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(BOOK_UPDATED_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);

  const data = useMemo(() => {
    const ranked = book.map(a => ({...a, _score:scoreAffiliate(a), _action:actionFor(a)})).sort((a,b) => b._score - a._score);
    const actionable = ranked.filter(a => a._score > -999);
    return {
      ranked,
      top10: actionable.slice(0,10),
      trials: book.reduce((s,a) => s + Number(a.mtd || 0), 0),
      active: book.filter(a => Number(a.mtd || 0) > 0 || Number(a.currQ || 0) > 0).length,
      conversations: book.filter(a => hasText(a.replied, /yes|true|reply|respond/i)).length,
      overdue: book.filter(dueNow).length,
      atRisk: book.filter(a => hasText(a.activeStatus, /needs attention|reactivation/i) && !a.stopOutreach).length,
      calls: actionable.filter(a => actionFor(a) === 'CALL').length,
      moveNow: actionable.filter(a => actionFor(a) === 'MOVE NOW').length,
    };
  }, [book]);

  const week = [
    ['Monday','Triage + Top 10','Refresh the book, inspect movement, clear overdue follow-ups, and personally contact Priority 1 accounts.'],
    ['Tuesday','Reactivation calls','Work the strongest Full Ladder accounts and diagnose why production slowed or stopped.'],
    ['Wednesday','Enablement','Finish Full Ladder outreach and give interested affiliates a concrete campaign, resource, or next move.'],
    ['Thursday','Second touch + blockers','Follow up with responders, remove tracking/funnel/product blockers, and escalate legitimate internal issues.'],
    ['Friday','Close + report','Chase commitments, clean CRM/Nifty follow-ups, score outcomes, and set next week’s Top 10.'],
  ];

  if (!book.length) return <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-[#080d16] to-[#110b1b] p-5">
    <div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-indigo-300"/><div><div className="text-xs uppercase tracking-[.18em] text-indigo-300">Weekly affiliate brief</div><h2 className="mt-1 text-xl font-bold text-white">Import your affiliate book to generate this week automatically</h2><p className="mt-2 text-sm text-slate-400">Once the Reactivation Portfolio CSV is loaded, this panel scores the book, creates your Top 10, assigns action lanes, counts follow-ups and turns the data into a Monday-Friday operating plan.</p></div></div>
  </section>;

  return <section className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-[#080d16] via-[#080c12] to-[#120b1a] p-5 shadow-xl shadow-black/20">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="text-xs uppercase tracking-[.18em] text-indigo-300">Weekly affiliate brief</div><h2 className="mt-1 text-2xl font-bold text-white">Your book already tells you what to do next</h2><p className="mt-2 max-w-3xl text-sm text-slate-400">Auto-prioritized from the current imported affiliate book. Refresh the CSV and this brief recalculates immediately.</p></div>
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">{book.length} affiliates loaded</div>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {[
        ['MTD trials',data.trials,TrendingUp],['Affiliates producing',data.active,Activity],['Meaningful replies',data.conversations,Users],['Follow-ups due',data.overdue,CalendarDays],['At risk',data.atRisk,AlertTriangle],['Move now',data.moveNow,Target]
      ].map(([label,value,Icon]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[.03] p-3"><Icon className="h-4 w-4 text-indigo-300"/><div className="mt-2 text-2xl font-bold text-white">{value}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></div>)}
    </div>

    <div className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-xl border border-white/10 bg-black/15 p-4">
        <div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-[.16em] text-cyan-300">Top 10 opportunities</div><div className="mt-1 text-sm text-slate-400">Highest-value human interventions first.</div></div><Target className="h-5 w-5 text-cyan-300"/></div>
        <div className="mt-3 space-y-2">{data.top10.map((a,i) => <div key={a.id || a.email || i} className="grid gap-2 rounded-xl border border-white/10 bg-white/[.025] p-3 md:grid-cols-[34px_minmax(0,1.2fr)_.7fr_.65fr_minmax(0,1fr)] md:items-center">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-sm font-bold text-slate-300">{i+1}</div>
          <div className="min-w-0"><div className="truncate font-semibold text-white">{a.name}</div><div className="truncate text-[11px] text-slate-500">{a.email || a.id}</div></div>
          <div className="text-xs"><div className="text-slate-500">Tier</div><div className="mt-0.5 text-slate-200">{priorityTier(a)}</div></div>
          <div className="text-xs"><div className="text-slate-500">Trials</div><div className="mt-0.5 text-slate-200">MTD {a.mtd || 0} · QTD {a.currQ || 0}</div></div>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLE[a._action]}`}>{a._action}</span><span className="text-[11px] text-slate-500">Score {a._score}</span></div>
        </div>)}</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/15 p-4">
        <div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-[.16em] text-emerald-300">This week</div><div className="mt-1 text-sm text-slate-400">Daily operating cadence.</div></div><CheckCircle2 className="h-5 w-5 text-emerald-300"/></div>
        <div className="mt-3 space-y-3">{week.map(([day,title,body]) => <div key={day} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="flex items-center gap-2"><div className="text-xs font-bold text-emerald-300">{day}</div><div className="text-xs font-semibold text-white">{title}</div></div><div className="mt-1.5 text-xs leading-5 text-slate-400">{body}</div></div>)}</div>
      </div>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3"><PhoneCall className="h-4 w-4 text-cyan-300"/><div className="mt-2 text-sm font-semibold text-white">Human-touch target</div><div className="mt-1 text-xs text-slate-400">Priority 1 + Full Ladder accounts get individual handling before sequence-only work.</div></div>
      <div className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-3"><Sparkles className="h-4 w-4 text-purple-300"/><div className="mt-2 text-sm font-semibold text-white">Automation target</div><div className="mt-1 text-xs text-slate-400">Sequence accounts stay moving without stealing focus from the highest-value relationships.</div></div>
      <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3"><AlertTriangle className="h-4 w-4 text-amber-300"/><div className="mt-2 text-sm font-semibold text-white">Guardrail</div><div className="mt-1 text-xs text-slate-400">Do-not-contact / do-not-pursue records are excluded from the Top 10 and human outreach queue.</div></div>
    </div>
  </section>;
}
