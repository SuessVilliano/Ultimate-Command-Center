import React, { useMemo, useState } from 'react';
import { Mic, Search, ShieldCheck, Send, UserCheck, AlertTriangle, Clock3, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../../config';

const QUEUE_KEY = 'liv8_affiliate_note_review_queue_v1';
const BOOK_KEY = 'liv8_ghl_reactivation_book_v1';
const CHANNELS = ['Phone', 'Zoom', 'WhatsApp', 'Email', 'Social', 'Event'];
const SANDBOX_FORM_ID = 'TVI6Ch94dCiqvm94KpFN';
const emptyForm = () => ({ identifier:'', channel:'Phone', rawNotes:'', affiliateCommitments:'', managerCommitments:'', blocker:'', nextAction:'', followUpDate:'', sensitive:false });
const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } };
const readBook = () => { try { return JSON.parse(sessionStorage.getItem(BOOK_KEY) || '[]'); } catch { return []; } };

function exactBookMatches(identifier) { const key = identifier.trim().toLowerCase(); return readBook().filter(contact => [contact.email, contact.id].some(value => String(value || '').trim().toLowerCase() === key)); }
function lines(value) { return String(value || '').split('\n').map(v => v.trim()).filter(Boolean).map(v => `- ${v}`).join('\n') || '- None recorded'; }
function formatNote(form, contact) {
  const date = new Intl.DateTimeFormat('en-US', { dateStyle:'long' }).format(new Date());
  return `AFFILIATE INTERACTION | ${form.channel} | ${date}\n\nAffiliate: ${contact.name || contact.email}\n\nSummary:\n${form.rawNotes.trim()}\n\nAffiliate commitments:\n${lines(form.affiliateCommitments)}\n\nManager commitments:\n${lines(form.managerCommitments)}\n\nRisk or blocker:\n${form.blocker.trim() || 'None recorded'}\n\nNext action:\n${form.nextAction.trim() || 'None recorded'}${form.followUpDate ? `\n\nFollow-up date:\n${form.followUpDate}` : ''}\n\nSensitivity:\n${form.sensitive ? 'Internal / sensitive' : 'Standard internal CRM note'}\n\nSource:\nUltimate Command Center · sandbox form ${SANDBOX_FORM_ID} · Jamaur`;
}

export default function AffiliateInteractionCapture() {
  const [form, setForm] = useState(emptyForm);
  const [match, setMatch] = useState(null);
  const [state, setState] = useState('capture');
  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState(readQueue);
  const note = useMemo(() => match ? formatNote(form, match) : '', [form, match]);
  const set = (key, value) => setForm(v => ({...v, [key]:value}));

  function findContact() {
    setMessage(''); setMatch(null); setState('matching');
    const matches = exactBookMatches(form.identifier);
    if (matches.length === 1) {
      const contact = matches[0];
      setMatch({ ...contact, promoterId:contact.id, matchSource:'book' });
      setState('matched');
      setMessage('Matched against your private Book View. The sandbox CRM will independently verify this email or Promoter ID before any note is written.');
      return;
    }
    setState('capture');
    setMessage(matches.length > 1 ? 'Multiple Book View records matched. Use the primary email or correct the duplicate Promoter ID.' : 'No exact match in your imported Book View. Refresh the assigned CSV or use the exact affiliate email / Promoter ID from your book.');
  }

  function dictate() { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) return setMessage('Voice dictation is not supported in this browser. Use your device keyboard microphone instead.'); const recognition = new SpeechRecognition(); recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US'; recognition.onresult = e => set('rawNotes', [form.rawNotes, e.results[0][0].transcript].filter(Boolean).join(' ')); recognition.onerror = () => setMessage('Dictation stopped before a transcript was captured.'); recognition.start(); }

  function saveForReview() { if (!match || !form.rawNotes.trim()) return setMessage('Match one contact and enter the interaction summary first.'); const item = { id: crypto.randomUUID(), createdAt:new Date().toISOString(), promoterId:match.promoterId, contactName:match.name || match.email, identifier:form.identifier, note, status:'review' }; const next = [item, ...queue]; setQueue(next); localStorage.setItem(QUEUE_KEY, JSON.stringify(next)); setState('review'); setMessage('Saved to the review queue. Nothing has been posted to HighLevel.'); }

  async function postHeadless() {
    if (!match || !form.rawNotes.trim()) return setMessage('Match one contact and enter the interaction summary first.');
    if (state === 'posting') return;
    setState('posting'); setMessage('Verifying the exact sandbox CRM contact and writing the approved note…');
    try {
      const response = await fetch(`${API_URL}/api/affiliate/crm-note`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ identifier:form.identifier, email:match.email || '', promoterId:match.promoterId || match.id || '', note, source:`ACC FORM ${SANDBOX_FORM_ID}` }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `CRM write failed (${response.status})`);
      setState('posted'); setMessage(`CRM note added headlessly to the exact sandbox contact${data.contactEmail ? ` (${data.contactEmail})` : ''}.`);
      const item = { id:crypto.randomUUID(), createdAt:new Date().toISOString(), contactId:data.contactId, promoterId:match.promoterId || '', contactName:match.name || match.email, identifier:form.identifier, note, status:'posted', sandbox:true, formId:SANDBOX_FORM_ID };
      const next = [item, ...queue]; setQueue(next); localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
    } catch (e) { setState('matched'); setMessage(`${e.message} Nothing was written.`); }
  }

  function reset() { setForm(emptyForm()); setMatch(null); setState('capture'); setMessage(''); }
  const input = 'w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-600';

  return <section className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#100a18] to-[#071217] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-[.18em] text-purple-300">Fast CRM hygiene · sandbox</div><h2 className="mt-1 text-xl font-bold text-white">Affiliate Interaction Capture</h2><p className="mt-1 text-sm text-slate-400">Book match · approval preview · PIT + Location exact verification · headless CRM note</p></div><div className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400"><Clock3 className="mr-1 inline h-3.5 w-3.5"/>{queue.filter(x=>x.status==='review').length} awaiting review</div></div>
    <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[.06] p-3 text-xs text-cyan-100"><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>Sandbox guardrail: the browser never receives your PIT. The API independently exact-matches the contact in your sandbox Location before creating the CRM note. Form reference <b>{SANDBOX_FORM_ID}</b>.</div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="space-y-3">
      <label className="block text-xs text-slate-400">Affiliate email or Promoter ID *</label>
      <div className="flex gap-2"><input className={input} value={form.identifier} onChange={e=>{set('identifier',e.target.value);setMatch(null);setState('capture')}} placeholder="Exact identifier from your Book View"/><button onClick={findContact} disabled={!form.identifier.trim()||state==='matching'} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-40"><Search className="h-4 w-4"/>Match</button></div>
      {match && <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"><UserCheck className="h-4 w-4"/><span><b>Book match:</b> {match.name || match.email} · {match.email}</span></div>}
      <div className="grid gap-3 sm:grid-cols-2"><select className={input} value={form.channel} onChange={e=>set('channel',e.target.value)}>{CHANNELS.map(x=><option key={x}>{x}</option>)}</select><input className={input} type="date" value={form.followUpDate} onChange={e=>set('followUpDate',e.target.value)}/></div>
      <div className="relative"><textarea className={`${input} min-h-28 pr-12`} value={form.rawNotes} onChange={e=>set('rawNotes',e.target.value)} placeholder="Raw notes or voice transcription *"/><button onClick={dictate} title="Dictate notes" className="absolute right-3 top-3 rounded-lg bg-purple-500/15 p-2 text-purple-300"><Mic className="h-4 w-4"/></button></div>
      <textarea className={input} rows="2" value={form.affiliateCommitments} onChange={e=>set('affiliateCommitments',e.target.value)} placeholder="Affiliate commitments — one per line"/><textarea className={input} rows="2" value={form.managerCommitments} onChange={e=>set('managerCommitments',e.target.value)} placeholder="My commitments — one per line"/><input className={input} value={form.blocker} onChange={e=>set('blocker',e.target.value)} placeholder="Risk or blocker"/><input className={input} value={form.nextAction} onChange={e=>set('nextAction',e.target.value)} placeholder="Next action"/><label className="flex items-center gap-2 text-xs text-amber-200"><input type="checkbox" checked={form.sensitive} onChange={e=>set('sensitive',e.target.checked)}/>Sensitive/internal note</label>
    </div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-cyan-300"/>Approval preview</div><pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap text-xs leading-6 text-slate-300">{note || 'Match an affiliate to generate the formatted CRM note.'}</pre></div></div>
    {message && <div className={`mt-4 rounded-lg border p-3 text-sm ${state==='posted' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{state==='posted'?<CheckCircle2 className="mr-2 inline h-4 w-4"/>:<AlertTriangle className="mr-2 inline h-4 w-4"/>}{message}</div>}
    <div className="mt-4 flex flex-wrap gap-2"><button onClick={saveForReview} disabled={!match||!form.rawNotes.trim()||state==='posting'} className="rounded-lg border border-purple-500/30 px-4 py-2 text-sm font-semibold text-purple-200 disabled:opacity-40">Save Draft for Review</button><button onClick={postHeadless} disabled={!match||!form.rawNotes.trim()||state==='posting'} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Send className="h-4 w-4"/>{state==='posting'?'Posting…':'Approve & Add CRM Note'}</button><button onClick={reset} className="px-3 py-2 text-sm text-slate-500">Clear</button></div>
  </section>;
}
