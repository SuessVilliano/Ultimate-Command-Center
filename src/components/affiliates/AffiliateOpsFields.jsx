import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, ExternalLink, Flag, Target } from 'lucide-react';

const BOOK_KEY = 'liv8_ghl_reactivation_book_v1';
const BOOK_UPDATED_EVENT = 'liv8:affiliate-book-updated';
const OPS_KEY = 'liv8_ghl_affiliate_ops_fields_v1';

const GAMIFICATION_URL = 'https://docs.google.com/spreadsheets/d/12RGwzP7YAkr0aBrl3Ra40Xk7BvwaBTb9oo5ljFgrnpU/edit?gid=1207811217#gid=1207811217';
const TRIAL_GOALS_URL = 'https://docs.google.com/spreadsheets/d/12RGwzP7YAkr0aBrl3Ra40Xk7BvwaBTb9oo5ljFgrnpU/edit?gid=1673541902#gid=1673541902';

function readBook() {
  try {
    const rows = JSON.parse(sessionStorage.getItem(BOOK_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

function readOps() {
  try { return JSON.parse(localStorage.getItem(OPS_KEY) || '{}'); }
  catch { return {}; }
}

const blankOps = () => ({
  handedOff: false,
  handedOffBy: '',
  handoffDate: '',
  handoffNotes: '',
  trialGoalPeriod: '',
  trialTarget: '',
  actualPerformance: '',
  dateSentSigned: '',
  toolType: '',
  gamificationDetails: '',
  gamificationTotal: '',
  gamificationStrategy: '',
  fileDetails: '',
  longForm: '',
  shortForm: '',
  trialTableauView: '',
  mrrTableauView: '',
  completedGoal: '',
  dateCompleted: '',
  totalPayout: '',
  affiliateManager: 'Jamaur Johnson',
  gamificationNotes: '',
});

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return <label className="block">
    <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
    <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-600"/>
  </label>;
}

export default function AffiliateOpsFields() {
  const [book, setBook] = useState(readBook);
  const [ops, setOps] = useState(readOps);
  const [selectedId, setSelectedId] = useState(() => readBook()[0]?.id || '');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const refresh = () => {
      const rows = readBook();
      setBook(rows);
      setSelectedId(current => current && rows.some(r => r.id === current) ? current : (rows[0]?.id || ''));
    };
    window.addEventListener(BOOK_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(BOOK_UPDATED_EVENT, refresh);
  }, []);

  const selected = useMemo(() => book.find(a => a.id === selectedId) || null, [book, selectedId]);
  const current = selected ? { ...blankOps(), ...(ops[selected.id] || {}) } : blankOps();

  function save(field, value) {
    if (!selected) return;
    const next = { ...ops, [selected.id]: { ...current, [field]: value } };
    setOps(next);
    localStorage.setItem(OPS_KEY, JSON.stringify(next));
  }

  async function copyGamificationRow() {
    if (!selected) return;
    const row = [
      selected.name || '',
      selected.email || '',
      current.dateSentSigned,
      current.toolType,
      current.gamificationDetails,
      current.trialTarget,
      current.actualPerformance,
      current.gamificationTotal,
      current.gamificationStrategy,
      current.fileDetails,
      current.longForm,
      current.shortForm,
      current.trialTableauView,
      current.mrrTableauView,
      current.completedGoal,
      current.dateCompleted,
      current.totalPayout,
      current.affiliateManager || 'Jamaur Johnson',
      current.gamificationNotes,
    ].map(v => String(v ?? '').replace(/\t/g, ' ')).join('\t');
    await navigator.clipboard.writeText(row);
    setCopied('Gamification row copied');
    setTimeout(() => setCopied(''), 1800);
  }

  if (!book.length) return null;

  return <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-[#07110e] to-[#0b0b13] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-[.18em] text-emerald-300">AFM operating fields</div>
        <h2 className="mt-1 text-xl font-bold text-white">Handoff, Trial Goals & Gamification</h2>
        <p className="mt-1 text-sm text-slate-400">Persistent per-affiliate fields for the work Xavier expects you to track and report.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={GAMIFICATION_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/10"><ExternalLink className="h-3.5 w-3.5"/>Gamification Sheet</a>
        <a href={TRIAL_GOALS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/10"><ExternalLink className="h-3.5 w-3.5"/>Trials Goals</a>
      </div>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[320px_1fr]">
      <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
        <label className="block text-[10px] uppercase tracking-wide text-slate-500">Affiliate</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0b1014] px-3 py-2 text-sm text-white">
          {book.map(a => <option key={a.id} value={a.id}>{a.name} · {a.email}</option>)}
        </select>
        {selected && <div className="rounded-lg border border-white/10 p-3 text-xs text-slate-400">
          <div className="font-semibold text-white">{selected.name}</div>
          <div className="mt-1">Promoter ID {selected.id}</div>
          <div>{selected.email}</div>
          {selected.previousAfm ? <div className="mt-1">Previous AFM: {selected.previousAfm}</div> : null}
        </div>}

        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-purple-100">
            <input type="checkbox" checked={!!current.handedOff} onChange={e => save('handedOff', e.target.checked)}/>
            Handed off to me
          </label>
          <div className="mt-3 grid gap-2">
            <Field label="Handed off by" value={current.handedOffBy} onChange={v => save('handedOffBy', v)} placeholder="Kara Rhoads"/>
            <Field label="Handoff date" type="date" value={current.handoffDate} onChange={v => save('handoffDate', v)}/>
            <textarea value={current.handoffNotes || ''} onChange={e => save('handoffNotes', e.target.value)} rows={3} placeholder="Context, intro status, preferred channel, next step..." className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-600"/>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[.03] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Target className="h-4 w-4 text-cyan-300"/>Trial goal tracking</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Goal period" value={current.trialGoalPeriod} onChange={v => save('trialGoalPeriod', v)} placeholder="September 2026"/>
            <Field label="Trial target" value={current.trialTarget} onChange={v => save('trialTarget', v)} placeholder="100"/>
            <Field label="Actual performance" value={current.actualPerformance} onChange={v => save('actualPerformance', v)} placeholder="25"/>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Flag className="h-4 w-4 text-emerald-300"/>Gamification tracker fields</div>
            <button onClick={copyGamificationRow} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"><ClipboardCopy className="h-3.5 w-3.5"/>Copy sheet-ready row</button>
          </div>
          {copied && <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5"/>{copied}</div>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Date sent/signed" type="date" value={current.dateSentSigned} onChange={v => save('dateSentSigned', v)}/>
            <Field label="Tool type" value={current.toolType} onChange={v => save('toolType', v)} placeholder="Performance Based Gamification"/>
            <Field label="Gamification details" value={current.gamificationDetails} onChange={v => save('gamificationDetails', v)} placeholder="20 Trials = $250 or 50 Trials = $500"/>
            <Field label="Gamification total" value={current.gamificationTotal} onChange={v => save('gamificationTotal', v)} placeholder="$250"/>
            <Field label="Gamification strategy" value={current.gamificationStrategy} onChange={v => save('gamificationStrategy', v)} placeholder="Traditional / Content Only"/>
            <Field label="File details" value={current.fileDetails} onChange={v => save('fileDetails', v)}/>
            <Field label="Long form" value={current.longForm} onChange={v => save('longForm', v)} placeholder="URL or status"/>
            <Field label="Short form" value={current.shortForm} onChange={v => save('shortForm', v)} placeholder="URL or status"/>
            <Field label="Trial Tableau view" value={current.trialTableauView} onChange={v => save('trialTableauView', v)} placeholder="URL"/>
            <Field label="MRR Tableau view" value={current.mrrTableauView} onChange={v => save('mrrTableauView', v)} placeholder="URL"/>
            <Field label="Affiliate completed goal?" value={current.completedGoal} onChange={v => save('completedGoal', v)} placeholder="Yes / No / In Progress"/>
            <Field label="Date completed" type="date" value={current.dateCompleted} onChange={v => save('dateCompleted', v)}/>
            <Field label="Total gamification payout" value={current.totalPayout} onChange={v => save('totalPayout', v)} placeholder="$500"/>
            <Field label="Affiliate manager" value={current.affiliateManager} onChange={v => save('affiliateManager', v)} placeholder="Jamaur Johnson"/>
          </div>
          <textarea value={current.gamificationNotes || ''} onChange={e => save('gamificationNotes', e.target.value)} rows={3} placeholder="Notes that should land in the Gamification sheet..." className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-600"/>
          <p className="mt-2 text-[10px] text-slate-500">The copy button outputs one tab-separated row in the same order as the Gamification sheet columns so you can paste directly into the next empty row.</p>
        </div>
      </div>
    </div>
  </section>;
}
