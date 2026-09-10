import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, Inbox, RefreshCw, Search, ShieldCheck, UserRoundCheck, XCircle } from 'lucide-react';
import { API_URL } from '../../config';

const BOOK_KEY = 'liv8_ghl_reactivation_book_v1';
const readBook = () => { try { return JSON.parse(sessionStorage.getItem(BOOK_KEY) || '[]'); } catch { return []; } };
const norm = v => String(v || '').trim().toLowerCase();

function findBookMatch(meeting, book) {
  const emails = [meeting.affiliate_email, ...(meeting.candidate_emails || [])].map(norm).filter(Boolean);
  const promoter = norm(meeting.promoter_id);
  const name = norm(meeting.affiliate_name);
  const matches = book.filter(a => emails.includes(norm(a.email)) || (promoter && promoter === norm(a.id)) || (name && name === norm(a.name)));
  return matches.length === 1 ? matches[0] : null;
}

export default function OlivMeetingInbox() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [postingId, setPostingId] = useState(null);
  const [identifierById, setIdentifierById] = useState({});
  const [message, setMessage] = useState('');
  const book = useMemo(() => readBook(), [meetings.length]);
  const webhookUrl = `${API_URL}/api/affiliate/oliv-ingest`;

  async function refresh() {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_URL}/api/affiliate/oliv-meetings?status=pending`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMeetings(data.meetings || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function mark(id, status) {
    const r = await fetch(`${API_URL}/api/affiliate/oliv-meetings/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status }) });
    if (r.ok) setMeetings(v => v.filter(x => x.id !== id));
  }

  async function addToCrm(meeting) {
    const match = findBookMatch(meeting, book);
    const identifier = String(identifierById[meeting.id] || match?.email || match?.id || meeting.affiliate_email || meeting.promoter_id || '').trim();
    if (!identifier) return setMessage('This meeting needs an exact affiliate email or Promoter ID before it can be posted.');
    setPostingId(meeting.id); setMessage('');
    try {
      const r = await fetch(`${API_URL}/api/affiliate/crm-note`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ identifier, email:match?.email || meeting.affiliate_email || '', promoterId:match?.id || meeting.promoter_id || '', note:meeting.crm_note, source:'Oliv.ai → TaskMagic → Command Center' }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `CRM write failed (${r.status})`);
      await mark(meeting.id, 'posted');
      setMessage(`Posted Oliv meeting update to ${data.contactEmail || identifier}.`);
    } catch (e) { setMessage(`${e.message} Nothing was written.`); }
    finally { setPostingId(null); }
  }

  const shown = meetings.filter(m => !query.trim() || [m.subject,m.affiliate_name,m.affiliate_email,m.summary,m.deal_details,m.next_action,...(m.candidate_emails||[])].join(' ').toLowerCase().includes(query.toLowerCase()));

  return <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#0c0912] to-[#071017] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="text-xs uppercase tracking-[.18em] text-violet-300">Meeting automation</div><h2 className="mt-1 text-xl font-bold text-white">Oliv Meeting Inbox</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">TaskMagic can send matching Oliv.ai emails here. The Command Center extracts CRM-ready meeting context, matches it to your Book, and waits for your approval before a CRM write.</p></div>
      <button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"><RefreshCw className={`h-3.5 w-3.5 ${loading?'animate-spin':''}`}/>Refresh</button>
    </div>

    <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[.05] p-3 text-xs text-cyan-100">
      <div className="flex flex-wrap items-center justify-between gap-2"><span><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>TaskMagic webhook destination</span><button onClick={()=>navigator.clipboard.writeText(webhookUrl)} className="inline-flex items-center gap-1 rounded border border-cyan-500/20 px-2 py-1"><ClipboardCopy className="h-3 w-3"/>Copy</button></div>
      <div className="mt-2 break-all font-mono text-[11px] text-cyan-300">{webhookUrl}</div>
      <div className="mt-2 text-slate-400">Send the Oliv email subject/body plus your secret. No LeadConnector OAuth credentials are needed for this ingestion step.</div>
    </div>

    <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search meeting, affiliate, email, deal or next action..." className="w-full rounded-lg border border-white/10 bg-black/20 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-600"/></div>

    {error && <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
    {message && <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}

    <div className="mt-4 space-y-3">
      {!loading && shown.length===0 && <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center text-sm text-slate-500"><Inbox className="mx-auto mb-2 h-6 w-6"/>No pending Oliv meeting updates yet.</div>}
      {shown.map(m => { const match = findBookMatch(m, book); return <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-white">{m.subject || 'Oliv.ai meeting summary'}</div><div className="mt-1 text-xs text-slate-500">{m.received_at || m.created_at}</div></div>{match ? <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"><UserRoundCheck className="h-3.5 w-3.5"/>{match.name}</div> : <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">Match needed</div>}</div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2"><div><div className="text-[10px] uppercase tracking-wide text-slate-500">CRM-ready summary</div><pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-white/[.025] p-3 text-xs leading-5 text-slate-300">{m.crm_note}</pre></div><div className="space-y-2 text-xs text-slate-400">{m.research&&<div><span className="text-slate-500">Research:</span> {m.research}</div>}{m.deal_details&&<div><span className="text-slate-500">Deal details:</span> {m.deal_details}</div>}{m.next_action&&<div><span className="text-slate-500">Next action:</span> {m.next_action}</div>}{m.candidate_emails?.length>0&&<div><span className="text-slate-500">Detected emails:</span> {m.candidate_emails.join(', ')}</div>}<input value={identifierById[m.id] || ''} onChange={e=>setIdentifierById(v=>({...v,[m.id]:e.target.value}))} placeholder={match ? `Matched: ${match.email}` : 'Exact affiliate email or Promoter ID'} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-600"/></div></div>
        <div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>addToCrm(m)} disabled={postingId===m.id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5"/>{postingId===m.id?'Posting…':'Approve & Add CRM Note'}</button><button onClick={()=>mark(m.id,'training')} className="rounded-lg border border-violet-500/20 px-3 py-2 text-xs text-violet-200">Training / Shadow</button><button onClick={()=>mark(m.id,'dismissed')} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400"><XCircle className="h-3.5 w-3.5"/>Dismiss</button></div>
      </div>})}
    </div>
  </section>;
}
