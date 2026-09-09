import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Flag, RefreshCw, Search, ShieldAlert, Sparkles } from 'lucide-react';

const BOOK_KEY = 'liv8_ghl_reactivation_book_v1';
const OPS_KEY = 'liv8_ghl_affiliate_ops_fields_v1';
const BOOK_UPDATED_EVENT = 'liv8:affiliate-book-updated';
const DEFAULT_LIMIT = 5;

const read = (key, fallback) => { try { return JSON.parse((key === BOOK_KEY ? sessionStorage : localStorage).getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
const text = a => [a.activeStatus, a.story, a.dnc, a.outcome, a.nextMove, a.endorsement, a.priority, a.niche].join(' ').toLowerCase();

function segment(a, ops = {}) {
  const t = text(a);
  if (a.stopOutreach || /suspend|do not contact|do-not-contact|removal|off limits|indefinite|hold outreach/.test(t)) return { key:'hold', label:'Leadership Hold / Do Not Contact', reason:'Existing notes contain a stop, suspension, removal, or leadership-review signal.', action:'Do not contact. Keep leadership context visible.' };
  if (/do not pursue|no longer an opportunity|exhausted|dead\b|inactive/.test(t)) return { key:'close', label:'No Longer an Opportunity', reason:'Current status/notes indicate the account should not be actively pursued.', action:'Document final disposition and remove from active work.' };
  if (/needs attention/.test(t)) return { key:'priority', label:'Priority Winback', reason:'The source book explicitly marks this affiliate as needing attention.', action:'Personal outreach now; capture response, commitment and follow-up date.' };
  if (ops.handedOff) return { key:'handoff', label:'Warm Handoff', reason:`Handoff recorded${ops.handedOffBy ? ` from ${ops.handedOffBy}` : ''}. Preserve relationship context before outreach.`, action:'Complete the warm intro and schedule the first growth conversation.' };
  if (/reactivation/.test(t)) return { key:'reactivation', label:'Reactivation — Work Now', reason:'The source book explicitly marks this affiliate for reactivation.', action:'Run the reactivation motion and log the next action.' };
  if (/previously endorsed|endorsed/.test(t) && !/not endorsed/.test(t)) return { key:'endorsement', label:'Endorsement Opportunity', reason:'Existing endorsement history makes this a relationship/endorsement opportunity to review.', action:'Review relationship history and identify a specific endorsement ask.' };
  if ((a.mtd || 0) > 0 || (a.currQ || 0) > 0) return { key:'signal', label:'Early Production Signal', reason:'Recent trial production is already visible in the source book.', action:'Contact while momentum is visible and learn what is driving the trials.' };
  return { key:'research', label:'Research / Qualify', reason:'No stronger operational signal is supported by the current imported fields.', action:'Qualify quickly: niche, audience, last activity, relationship history and best channel.' };
}

function score(a, ops = {}) {
  let n = 0;
  const t = text(a);
  if (/needs attention/.test(t)) n += 100;
  if (ops.handedOff) n += 90;
  if (/reactivation/.test(t)) n += 80;
  if (/previously endorsed|endorsed/.test(t) && !/not endorsed/.test(t)) n += 60;
  n += Math.min(30, (a.mtd || 0) * 6);
  n += Math.min(25, (a.currQ || 0) * 2);
  n += Math.min(20, Math.round((a.lifetime || 0) / 50));
  if (a.nextMove) n += 8;
  if (/^1/.test(a.priority || '')) n += 12;
  if (/^2/.test(a.priority || '')) n += 6;
  return n;
}

const order = ['priority','handoff','reactivation','endorsement','signal','research','hold','close'];

export default function AffiliateSegmentation() {
  const [book, setBook] = useState(() => read(BOOK_KEY, []));
  const [ops, setOps] = useState(() => read(OPS_KEY, {}));
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({ research:true, hold:true, close:true });
  const [expandedGroups, setExpandedGroups] = useState({});
  const refresh = () => { setBook(read(BOOK_KEY, [])); setOps(read(OPS_KEY, {})); };
  useEffect(() => { window.addEventListener(BOOK_UPDATED_EVENT, refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener(BOOK_UPDATED_EVENT, refresh); window.removeEventListener('storage', refresh); }; }, []);

  const groups = useMemo(() => {
    const out = Object.fromEntries(order.map(k => [k, []]));
    const q = query.trim().toLowerCase();
    book.forEach(a => {
      const s = segment(a, ops[a.id] || {});
      const row = { ...a, segment:s, score:score(a, ops[a.id] || {}) };
      if (q && ![a.name,a.email,a.id,a.story,a.activeStatus,a.niche,a.nextMove,s.label].join(' ').toLowerCase().includes(q)) return;
      out[s.key].push(row);
    });
    order.forEach(k => out[k].sort((a,b) => b.score - a.score || (b.currQ||0)-(a.currQ||0) || (b.lifetime||0)-(a.lifetime||0)));
    return out;
  }, [book, ops, query]);

  if (!book.length) return null;
  const icon = key => key === 'hold' ? ShieldAlert : key === 'priority' ? Flag : key === 'signal' ? Sparkles : key === 'close' ? AlertTriangle : CheckCircle2;
  const toggleAll = () => {
    const anyOpen = order.some(k => (groups[k] || []).length && !collapsed[k]);
    setCollapsed(Object.fromEntries(order.map(k => [k, anyOpen])));
  };

  return <section className="rounded-2xl border border-cyan-500/20 bg-[#070c0f] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="text-xs uppercase tracking-[.18em] text-cyan-300">AFM action board</div><h2 className="mt-1 text-xl font-bold text-white">Book Priorities</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Turns your imported status, notes, handoffs and production into a practical work queue. Higher-value and time-sensitive accounts rise first; ambiguous accounts stay in Research / Qualify.</p></div>
      <div className="flex gap-2"><button onClick={toggleAll} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Collapse / expand all</button><button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button></div>
    </div>

    <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Quick search name, email, Promoter ID, niche, notes, status or next move..." className="w-full rounded-lg border border-white/10 bg-black/20 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-600"/></div>

    <div className="mt-4 grid gap-3 xl:grid-cols-2">{order.map(key => {
      const items = groups[key] || []; if (!items.length) return null; const Icon = icon(key); const isCollapsed = !!collapsed[key]; const showAll = !!expandedGroups[key]; const shown = showAll ? items : items.slice(0, DEFAULT_LIMIT);
      return <div key={key} className={`rounded-xl border p-4 ${key==='hold'?'border-red-500/25 bg-red-500/[.05]':key==='priority'?'border-amber-500/25 bg-amber-500/[.05]':'border-white/10 bg-white/[.025]'}`}>
        <button onClick={()=>setCollapsed(v=>({...v,[key]:!v[key]}))} className="flex w-full items-center justify-between gap-2 text-left"><div className="flex items-center gap-2 text-sm font-semibold text-white">{isCollapsed?<ChevronRight className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}<Icon className="h-4 w-4"/>{items[0].segment.label}</div><span className="rounded-full bg-black/30 px-2 py-1 text-xs text-slate-400">{items.length}</span></button>
        {!isCollapsed && <><div className="mt-3 space-y-2">{shown.map(a => <div key={a.id} className="rounded-lg border border-white/5 bg-black/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-white">{a.name}</div><div className="text-[10px] text-slate-500">MTD {a.mtd || 0} · QTD {a.currQ || 0}</div></div><div className="mt-1 text-xs text-slate-500">{a.email} · Promoter {a.id}</div><div className="mt-2 text-xs leading-5 text-slate-300">{a.segment.reason}</div><div className="mt-2 rounded bg-cyan-500/[.06] px-2 py-1.5 text-xs text-cyan-200">Next best action: {a.nextMove || a.segment.action}</div></div>)}</div>{items.length > DEFAULT_LIMIT && <button onClick={()=>setExpandedGroups(v=>({...v,[key]:!v[key]}))} className="mt-3 text-xs font-semibold text-cyan-300">{showAll ? `Show top ${DEFAULT_LIMIT}` : `Show all ${items.length}`}</button>}</>}
      </div>;
    })}</div>
  </section>;
}
