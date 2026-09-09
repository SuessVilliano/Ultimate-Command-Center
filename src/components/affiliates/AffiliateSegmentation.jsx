import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flag, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

const BOOK_KEY = 'liv8_ghl_reactivation_book_v1';
const OPS_KEY = 'liv8_ghl_affiliate_ops_fields_v1';
const BOOK_UPDATED_EVENT = 'liv8:affiliate-book-updated';

const read = (key, fallback) => { try { return JSON.parse((key === BOOK_KEY ? sessionStorage : localStorage).getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
const text = a => [a.activeStatus, a.story, a.dnc, a.outcome, a.nextMove, a.endorsement].join(' ').toLowerCase();

function segment(a, ops = {}) {
  const t = text(a);
  if (a.stopOutreach || /suspend|do not contact|do-not-contact|removal|off limits|indefinite|hold outreach/.test(t)) return { key:'hold', label:'Leadership Hold / Do Not Contact', reason:'Existing notes contain a stop, suspension, removal, or leadership-review signal.' };
  if (/do not pursue|no longer an opportunity|exhausted|dead\b|inactive/.test(t)) return { key:'close', label:'No Longer an Opportunity', reason:'Current status/notes indicate the account should not be actively pursued.' };
  if (/needs attention/.test(t)) return { key:'priority', label:'Priority Winback', reason:'The source book explicitly marks this affiliate as needing attention.' };
  if (/reactivation/.test(t)) return { key:'reactivation', label:'Reactivation — Work Now', reason:'The source book explicitly marks this affiliate for reactivation.' };
  if (ops.handedOff) return { key:'handoff', label:'Warm Handoff', reason:`Handoff recorded${ops.handedOffBy ? ` from ${ops.handedOffBy}` : ''}. Preserve relationship context before outreach.` };
  if (/previously endorsed|endorsed/.test(t) && !/not endorsed/.test(t)) return { key:'endorsement', label:'Endorsement Opportunity', reason:'Existing endorsement history makes this a relationship/endorsement opportunity to review.' };
  if ((a.mtd || 0) > 0 || (a.currQ || 0) > 0) return { key:'signal', label:'Early Production Signal', reason:'Recent trial production is already visible in the source book.' };
  return { key:'research', label:'Research / Qualify', reason:'No stronger operational signal is supported by the current imported fields.' };
}

const order = ['priority','handoff','reactivation','endorsement','signal','research','hold','close'];

export default function AffiliateSegmentation() {
  const [book, setBook] = useState(() => read(BOOK_KEY, []));
  const [ops, setOps] = useState(() => read(OPS_KEY, {}));
  const refresh = () => { setBook(read(BOOK_KEY, [])); setOps(read(OPS_KEY, {})); };
  useEffect(() => { window.addEventListener(BOOK_UPDATED_EVENT, refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener(BOOK_UPDATED_EVENT, refresh); window.removeEventListener('storage', refresh); }; }, []);
  const groups = useMemo(() => {
    const out = Object.fromEntries(order.map(k => [k, []]));
    book.forEach(a => { const s = segment(a, ops[a.id] || {}); out[s.key].push({ ...a, segment:s }); });
    return out;
  }, [book, ops]);
  if (!book.length) return null;
  const icon = key => key === 'hold' ? ShieldAlert : key === 'priority' ? Flag : key === 'signal' ? Sparkles : key === 'close' ? AlertTriangle : CheckCircle2;
  return <section className="rounded-2xl border border-cyan-500/20 bg-[#070c0f] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-[.18em] text-cyan-300">Xavier visibility view</div><h2 className="mt-1 text-xl font-bold text-white">Book Segmentation</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Rule-based from the imported Book View, existing notes/status, and your handoff fields. This does not invent relationship context; ambiguous accounts stay in Research / Qualify.</p></div><button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button></div>
    <div className="mt-4 grid gap-3 xl:grid-cols-2">{order.map(key => {
      const items = groups[key] || []; if (!items.length) return null; const Icon = icon(key);
      return <div key={key} className={`rounded-xl border p-4 ${key==='hold'?'border-red-500/25 bg-red-500/[.05]':key==='priority'?'border-amber-500/25 bg-amber-500/[.05]':'border-white/10 bg-white/[.025]'}`}>
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Icon className="h-4 w-4"/>{items[0].segment.label}</div><span className="rounded-full bg-black/30 px-2 py-1 text-xs text-slate-400">{items.length}</span></div>
        <div className="mt-3 space-y-2">{items.map(a => <div key={a.id} className="rounded-lg border border-white/5 bg-black/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-white">{a.name}</div><div className="text-[10px] text-slate-500">MTD {a.mtd || 0} · QTD {a.currQ || 0}</div></div><div className="mt-1 text-xs text-slate-500">{a.email} · Promoter {a.id}</div><div className="mt-2 text-xs leading-5 text-slate-300">{a.segment.reason}</div>{a.nextMove ? <div className="mt-2 text-xs text-cyan-300">Next move: {a.nextMove}</div> : null}</div>)}</div>
      </div>;
    })}</div>
  </section>;
}
