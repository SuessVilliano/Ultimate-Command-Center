import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, Users, PhoneCall, ListChecks, Clock3, Search, X, ExternalLink,
  Mail, ShieldAlert, ChevronRight, Trash2, Linkedin, Youtube, Instagram,
  Globe2, Save, CheckCircle2, AlertTriangle, TrendingUp, Target, Activity
} from 'lucide-react';

const SESSION_KEY = 'liv8_ghl_reactivation_book_v1';
const BOOK_UPDATED_EVENT = 'liv8:affiliate-book-updated';
const RESEARCH_KEY = 'liv8_ghl_affiliate_research_v1';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1FhqNEO_K2yvd9RAieCbMR42Wc2Pa5RdE59uvVXqYuNs/edit?gid=2031531288#gid=2031531288';

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function num(value) {
  const parsed = Number(String(value || '').replace(/[$,%\s]/g, '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasStopInstruction(row) {
  const text = [row.story, row.dnc, row.activeStatus].join(' ').toLowerCase();
  return /suspend|do not contact|do-not-contact|outreach should stop|no check-in|stop until leadership|not to keep/.test(text);
}

function first(raw, ...keys) {
  for (const key of keys) if (raw[key] != null && String(raw[key]).trim() !== '') return String(raw[key]).trim();
  return '';
}

function mapRow(headers, values) {
  const raw = Object.fromEntries(headers.map((h, i) => [String(h || '').trim(), String(values[i] || '').trim()]));
  const row = {
    id: first(raw, 'Promoter ID', 'PROMOTER ID'),
    name: first(raw, 'Promoter Full Name', 'AFFILIATE', 'Promoter Email', 'EMAIL') || 'Unknown',
    email: first(raw, 'Promoter Email', 'EMAIL'),
    previousAfm: raw.AFM,
    newAfm: raw['NEW AFM'],
    priority: raw.PRIORITY,
    dormantBand: raw['DORMANT BAND'],
    lifetime: num(first(raw, 'Lifetime', 'LIFETIME')),
    prevQ: num(first(raw, 'Prev Q', 'PREV Q')),
    currQ: num(first(raw, 'Curr Q', 'QTD')),
    mtd: num(raw.MTD),
    qoqPacing: num(raw['QoQ PACING']),
    mom: first(raw, 'MoM', 'MOM'),
    activeStatus: first(raw, 'ACTIVE STATUS', 'STATUS'),
    lastMrr: num(raw['Last MRR']),
    endorsement: first(raw, 'Endorsement', 'ENDORSEMENT'),
    award: raw.Award,
    country: raw.Country,
    niche: first(raw, 'Niche', 'NICHE'),
    story: first(raw, 'The story · last note', 'LAST NOTE'),
    promoterProfile: raw['PROMOTER PROFILE'],
    youtube: raw.YOUTUBE,
    instagram: raw.INSTAGRAM,
    endorsementWorkbook: raw['ENDORSEMENT WORKBOOK'],
    forecasting: raw.FORECASTING,
    affiliateDoc: raw['AFFILIATE DOC'],
    highlevelContact: raw['HIGHLEVEL CONTACT'],
    touches: num(raw.TOUCHES),
    valueGiven: raw['VALUE GIVEN?'],
    replied: raw['REPLIED?'],
    dnc: raw['DO NOT CONTACT'],
    exhausted: raw['EXHAUSTED?'],
    outcome: raw.OUTCOME,
    owner: raw.OWNER,
    nextMove: raw['NEXT MOVE + DATE'],
    source: raw.AFFILIATE ? 'Affiliate EXPAND · Book View' : 'Affiliate EXPAND · Reactivation',
  };
  row.stopOutreach = hasStopInstruction(row);
  return row;
}

function importAssignedBook(text) {
  const rows = parseCSV(text);
  const headerIndex = rows.findIndex(r => {
    const cells = r.map(c => String(c).trim());
    return (cells.includes('Promoter Email') && cells.includes('NEW AFM')) ||
      (cells.includes('AFFILIATE') && cells.includes('PROMOTER ID') && cells.includes('ACTIVE STATUS'));
  });
  if (headerIndex < 0) throw new Error('This does not look like the Affiliate EXPAND Reactivation export.');
  const headers = rows[headerIndex];
  const isBookView = headers.includes('AFFILIATE');
  const mapped = rows.slice(headerIndex + 1)
    .filter(r => r.some(Boolean))
    .map(r => mapRow(headers, r))
    .filter(r => (isBookView || r.newAfm.toLowerCase() === 'jamaur johnson') && r.id);
  if (!mapped.length) throw new Error('No affiliates were found in this assigned book export.');
  return mapped;
}

function loadJSON(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function bandKey(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('90+')) return '90+';
  if (v.includes('60-90')) return '60-90';
  return '30';
}

function SearchLink({ href, icon: Icon, children }) {
  return <a href={href} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10">
    <Icon className="h-3.5 w-3.5"/>{children}<ExternalLink className="h-3 w-3"/>
  </a>;
}

export default function ReactivationPortfolio() {
  const fileRef = useRef(null);
  const [book, setBook] = useState(() => loadJSON(SESSION_KEY, []));
  const [research, setResearch] = useState(() => loadJSON(RESEARCH_KEY, {}));
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [band, setBand] = useState('all');
  const [priority, setPriority] = useState('all');
  const [error, setError] = useState('');
  const selected = book.find(a => a.id === selectedId) || null;
  const selectedResearch = selected ? research[selected.id] || {} : {};

  const summary = useMemo(() => ({
    total: book.length,
    quiet30: book.filter(a => bandKey(a.dormantBand) === '30').length,
    quietQuarter: book.filter(a => bandKey(a.dormantBand) === '60-90').length,
    dormant: book.filter(a => bandKey(a.dormantBand) === '90+').length,
    lifetime: book.reduce((s, a) => s + a.lifetime, 0),
    prevQ: book.reduce((s, a) => s + a.prevQ, 0),
    currQ: book.reduce((s, a) => s + a.currQ, 0),
    personal: book.filter(a => a.priority.startsWith('1')).length,
    ladder: book.filter(a => a.priority.startsWith('2')).length,
    sequence: book.filter(a => a.priority.startsWith('3')).length,
    mtd: book.reduce((s, a) => s + a.mtd, 0),
    projectedMonth: book.reduce((s, a) => s + a.mtd, 0) * 4,
    qoqPacing: book.reduce((s, a) => s + a.prevQ, 0) ? Math.round(book.reduce((s, a) => s + a.currQ, 0) / book.reduce((s, a) => s + a.prevQ, 0) * 100) : 0,
    active: book.filter(a => /reactivation|needs attention|active/i.test(a.activeStatus) && !/inactive/i.test(a.activeStatus)).length,
    needsAttention: book.filter(a => /needs attention/i.test(a.activeStatus)).length,
    reactivation: book.filter(a => /reactivation/i.test(a.activeStatus)).length,
    doNotPursue: book.filter(a => /do not pursue/i.test(a.activeStatus)).length,
  }), [book]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return book.filter(a => {
      if (band !== 'all' && bandKey(a.dormantBand) !== band) return false;
      if (priority !== 'all' && !a.priority.startsWith(priority)) return false;
      if (!q) return true;
      return [a.name, a.email, a.country, a.niche, a.story, a.previousAfm, a.award, a.activeStatus, a.endorsement]
        .join(' ').toLowerCase().includes(q);
    }).sort((a, b) => (b.currQ - a.currQ) || (b.prevQ - a.prevQ) || (b.lifetime - a.lifetime));
  }, [book, query, band, priority]);

  async function handleFile(file) {
    if (!file) return;
    setError('');
    try {
      const imported = importAssignedBook(await file.text());
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(imported));
      setBook(imported);
      window.dispatchEvent(new CustomEvent(BOOK_UPDATED_EVENT));
      setSelectedId(imported[0]?.id || null);
    } catch (e) { setError(e.message); }
    if (fileRef.current) fileRef.current.value = '';
  }

  function clearBook() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(RESEARCH_KEY);
    setBook([]); setResearch({}); setSelectedId(null);
    window.dispatchEvent(new CustomEvent(BOOK_UPDATED_EVENT));
  }

  function saveResearch(field, value) {
    if (!selected) return;
    const next = { ...research, [selected.id]: { ...selectedResearch, [field]: value } };
    setResearch(next);
    sessionStorage.setItem(RESEARCH_KEY, JSON.stringify(next));
  }

  if (!book.length) return <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#071217] to-[#100a18] p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-[.18em] text-cyan-300">Private portfolio import</div>
        <h2 className="mt-1 text-xl font-bold text-white">Load Jamaur's Reactivation Book</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Import the authorized Affiliate EXPAND CSV. Both the assigned Reactivation export and Jamaur's 51-account Book View are supported. The file stays in this browser tab session and is never committed to the public repository.</p>
      </div>
      <ShieldAlert className="h-8 w-8 text-cyan-300"/>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
        <Upload className="h-4 w-4"/>Import assigned CSV
      </button>
      <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
        <ExternalLink className="h-4 w-4"/>Open source sheet
      </a>
      <input ref={fileRef} className="hidden" type="file" accept=".csv,text/csv" onChange={e => handleFile(e.target.files?.[0])}/>
    </div>
    {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
  </section>;

  const searchText = selected ? encodeURIComponent([selected.name, selected.niche !== 'Not researched' ? selected.niche : '', selected.country].filter(Boolean).join(' ')) : '';

  return <div className="space-y-4">
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#071217] to-[#100a18] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[.18em] text-cyan-300">Jamaur Johnson · authorized assignment</div>
          <h2 className="text-xl font-bold text-white">Reactivation Portfolio</h2>
          <p className="text-xs text-slate-500">Session-only private data · refresh from the source CSV whenever assignments change</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/10"><Upload className="h-3.5 w-3.5"/>Refresh CSV</button>
          <button onClick={clearBook} className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5"/>Clear private data</button>
          <input ref={fileRef} className="hidden" type="file" accept=".csv,text/csv" onChange={e => handleFile(e.target.files?.[0])}/>
        </div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {[
        ['Book size', summary.total], ['MTD trials', summary.mtd], ['Projected month', summary.projectedMonth], ['QTD trials', summary.currQ],
        ['QoQ pace', `${summary.qoqPacing}%`], ['Needs attention', summary.needsAttention], ['Reactivation', summary.reactivation], ['Do not pursue', summary.doNotPursue]
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
        <div className="text-xl font-bold text-white">{value}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div>
      </div>)}
    </section>

    <section className="rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, niche, country, notes..."
            className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-9 text-sm text-white placeholder:text-slate-600"/>
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"><X className="h-4 w-4"/></button>}
        </div>
        <select value={band} onChange={e => setBand(e.target.value)} className="rounded-lg border border-white/10 bg-[#0b1014] px-3 py-2 text-sm text-slate-300">
          <option value="all">All dormancy bands</option><option value="30">Quiet this month</option><option value="60-90">Quiet this quarter</option><option value="90+">Dormant 90+</option>
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} className="rounded-lg border border-white/10 bg-[#0b1014] px-3 py-2 text-sm text-slate-300">
          <option value="all">All touch levels</option><option value="1">Personal call ({summary.personal})</option><option value="2">Full ladder ({summary.ladder})</option><option value="3">Sequence only ({summary.sequence})</option>
        </select>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-5">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[.03] lg:col-span-3">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Priority queue ({filtered.length})</div>
        <div className="max-h-[680px] divide-y divide-white/5 overflow-y-auto">
          {filtered.map(a => <button key={a.id} onClick={() => setSelectedId(a.id)} className={`w-full p-4 text-left hover:bg-white/[.04] ${selectedId === a.id ? 'bg-cyan-500/10' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{a.name}</span>
                  {a.priority && <span className={`rounded px-2 py-0.5 text-[10px] ${a.priority.startsWith('1') ? 'bg-purple-500/15 text-purple-300' : a.priority.startsWith('2') ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/5 text-slate-400'}`}>{a.priority}</span>}
                  {a.activeStatus && <span className={`rounded px-2 py-0.5 text-[10px] ${/needs attention/i.test(a.activeStatus) ? 'bg-amber-500/15 text-amber-300' : /reactivation/i.test(a.activeStatus) ? 'bg-rose-500/15 text-rose-300' : /do not pursue/i.test(a.activeStatus) ? 'bg-slate-500/20 text-slate-400' : 'bg-emerald-500/15 text-emerald-300'}`}>{a.activeStatus}</span>}
                  {a.stopOutreach && <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300">HOLD OUTREACH</span>}
                </div>
                <div className="mt-1 truncate text-xs text-slate-500">{a.email} · {a.country || 'Country unknown'}</div>
                <div className="mt-2 line-clamp-1 text-xs text-slate-400">{a.niche || 'Niche not researched'}</div>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600"/>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
              <span>{a.lifetime.toLocaleString()} lifetime</span><span>{a.mtd} MTD</span><span>{a.currQ} QTD</span><span>{a.prevQ} prev Q</span>{a.qoqPacing ? <span>{a.qoqPacing}% QoQ</span> : null}
            </div>
          </button>)}
        </div>
      </div>

      <aside className="rounded-xl border border-white/10 bg-white/[.03] lg:col-span-2">
        {!selected ? <div className="grid min-h-[420px] place-items-center p-6 text-sm text-slate-500">Select an affiliate to open the portfolio.</div> :
        <div>
          <div className="border-b border-white/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-lg font-bold text-white">{selected.name}</h3><div className="text-xs text-slate-500">ID {selected.id} · previously {selected.previousAfm}</div></div>
              {selected.stopOutreach ? <ShieldAlert className="h-6 w-6 text-red-400"/> : <CheckCircle2 className="h-6 w-6 text-emerald-400"/>}
            </div>
            {selected.stopOutreach && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300">Do not initiate standard outreach. Review the internal note and obtain leadership direction first.</div>}
          </div>
          <div className="max-h-[620px] space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-2">
              {[['Lifetime', selected.lifetime], ['MTD', selected.mtd], ['QTD', selected.currQ]].map(([l,v]) => <div key={l} className="rounded-lg bg-black/20 p-2 text-center"><div className="font-bold text-white">{v}</div><div className="text-[10px] text-slate-500">{l}</div></div>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 p-2"><div className="text-[10px] uppercase text-slate-600">QoQ pace</div><div className="mt-1 text-sm font-semibold text-white">{selected.qoqPacing || 0}%</div></div>
              <div className="rounded-lg border border-white/10 p-2"><div className="text-[10px] uppercase text-slate-600">Endorsement</div><div className="mt-1 text-sm font-semibold text-white">{selected.endorsement || 'Not Endorsed'}</div></div>
            </div>
            <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Contact</div>
              <a href={selected.stopOutreach ? undefined : `mailto:${selected.email}`} className={`mt-1 inline-flex items-center gap-2 text-sm ${selected.stopOutreach ? 'cursor-not-allowed text-slate-600' : 'text-cyan-300'}`}><Mail className="h-4 w-4"/>{selected.email}</a>
            </div>
            <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Niche</div><p className="mt-1 text-sm text-slate-300">{selected.niche || 'Not researched'}</p></div>
            <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Last internal story</div><p className="mt-1 text-sm leading-6 text-slate-300">{selected.story || 'No note'}</p></div>
            <div><div className="text-[10px] uppercase tracking-wide text-slate-600">Public research launchpad</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <SearchLink href={`https://www.google.com/search?q=${searchText}`} icon={Globe2}>Web</SearchLink>
                <SearchLink href={`https://www.linkedin.com/search/results/all/?keywords=${searchText}`} icon={Linkedin}>LinkedIn</SearchLink>
                <SearchLink href={`https://www.youtube.com/results?search_query=${searchText}`} icon={Youtube}>YouTube</SearchLink>
                <SearchLink href={`https://www.google.com/search?q=${encodeURIComponent('site:instagram.com ' + selected.name)}`} icon={Instagram}>Instagram</SearchLink>
              </div>
            </div>
            <div className="space-y-2"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-600"><Save className="h-3.5 w-3.5"/>Session research notes</div>
              {['website','linkedin','youtube','instagram'].map(field => <input key={field} value={selectedResearch[field] || ''} onChange={e => saveResearch(field, e.target.value)}
                placeholder={field.charAt(0).toUpperCase()+field.slice(1)+' URL'} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-600"/>)}
              <textarea value={selectedResearch.notes || ''} onChange={e => saveResearch('notes', e.target.value)} rows={3} placeholder="Public presence, audience, current offer, outreach angle..."
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-600"/>
              <p className="text-[10px] text-slate-600">Saved only for this browser tab session. Copy verified findings back to the approved company system.</p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5"/>Reconcile the previous AFM's real touches before contacting this account; the export's zero-touch fields may not include earlier emails, calls or WhatsApp activity.
            </div>
          </div>
        </div>}
      </aside>
    </section>
  </div>;
}
