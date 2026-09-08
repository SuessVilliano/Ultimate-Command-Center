import React, { useMemo, useState } from 'react';
import { Mic, Search, ShieldCheck, Send, UserCheck, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { API_URL } from '../../config';

const QUEUE_KEY = 'liv8_affiliate_note_review_queue_v1';
const CHANNELS = ['Phone', 'Zoom', 'WhatsApp', 'Email', 'Social', 'Event'];
const FOLLOW_UP_LOG_URL = 'https://docs.google.com/document/d/18zpSQcsZ-D6DxdwUulCusrXr-kPwYUKE36G6bLZoo34/edit';
const emptyForm = () => ({ identifier:'', channel:'Phone', rawNotes:'', affiliateCommitments:'', managerCommitments:'', blocker:'', nextAction:'', followUpDate:'', sensitive:false });
const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } };

function contactList(payload) {
  return payload?.contacts || payload?.data?.contacts || payload?.data || [];
}
function fieldValue(contact, needle) {
  const fields = contact.customFields || contact.customField || [];
  const found = fields.find(f => String(f.name || f.fieldKey || f.key || '').toLowerCase().includes(needle));
  return String(found?.value || found?.fieldValue || '').trim();
}
function exactMatches(contacts, identifier) {
  const key = identifier.trim().toLowerCase();
  return contacts.filter(c => [c.email, c.id, c.contactId, fieldValue(c, 'promoter')].some(v => String(v || '').trim().toLowerCase() === key));
}
function lines(value) {
  return String(value || '').split('\n').map(v => v.trim()).filter(Boolean).map(v => `- ${v}`).join('\n') || '- None recorded';
}
function formatNote(form, contact) {
  const date = new Intl.DateTimeFormat('en-US', { dateStyle:'long' }).format(new Date());
  return `AFFILIATE INTERACTION | ${form.channel} | ${date}\n\nAffiliate: ${contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email}\n\nSummary:\n${form.rawNotes.trim()}\n\nAffiliate commitments:\n${lines(form.affiliateCommitments)}\n\nManager commitments:\n${lines(form.managerCommitments)}\n\nRisk or blocker:\n${form.blocker.trim() || 'None recorded'}\n\nNext action:\n${form.nextAction.trim() || 'None recorded'}${form.followUpDate ? `\n\nFollow-up date:\n${form.followUpDate}` : ''}\n\nSensitivity:\n${form.sensitive ? 'Internal / sensitive' : 'Standard internal CRM note'}\n\nSource:\nInteraction Capture submitted by Jamaur`;
}

export default function AffiliateInteractionCapture() {
  const [form, setForm] = useState(emptyForm);
  const [match, setMatch] = useState(null);
  const [state, setState] = useState('capture');
  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState(readQueue);
  const note = useMemo(() => match ? formatNote(form, match) : '', [form, match]);
  const set = (key, value) => setForm(v => ({...v, [key]:value}));

  async function findContact() {
    setMessage(''); setMatch(null); setState('matching');
    try {
      const res = await fetch(`${API_URL}/api/ghl/contacts?query=${encodeURIComponent(form.identifier.trim())}&limit=10`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Contact lookup failed');
      const matches = exactMatches(contactList(data), form.identifier);
      if (matches.length !== 1) {
        setState('capture');
        setMessage(matches.length ? 'Multiple exact contacts matched. Tighten the identifier before continuing.' : 'No exact contact matched. Use the primary email, CRM contact ID, or populated Promoter ID.');
        return;
      }
      setMatch({...matches[0], name: matches[0].name || [matches[0].firstName, matches[0].lastName].filter(Boolean).join(' ')});
      setState('matched');
    } catch (e) { setState('capture'); setMessage(e.message); }
  }

  function dictate() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return setMessage('Voice dictation is not supported in this browser. Use your device keyboard microphone instead.');
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
    recognition.onresult = e => set('rawNotes', [form.rawNotes, e.results[0][0].transcript].filter(Boolean).join(' '));
    recognition.onerror = () => setMessage('Dictation stopped before a transcript was captured.');
    recognition.start();
  }

  function saveForReview() {
    if (!match || !form.rawNotes.trim()) return setMessage('Match one contact and enter the interaction summary first.');
    const item = { id: crypto.randomUUID(), createdAt:new Date().toISOString(), contactId:match.id || match.contactId, contactName:match.name || match.email, identifier:form.identifier, note, status:'review' };
    const next = [item, ...queue]; setQueue(next); localStorage.setItem(QUEUE_KEY, JSON.stringify(next)); setState('review'); setMessage('Saved to the review queue. Nothing has been posted to HighLevel.');
  }

  async function approveAndPost() {
    if (!match) return;
    setState('posting'); setMessage('');
    try {
      const id = match.id || match.contactId;
      const res = await fetch(`${API_URL}/api/ghl/contacts/${encodeURIComponent(id)}/notes`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ approved:true, title:`Affiliate Interaction — ${form.channel}`, body:note, color:form.sensitive ? '#F59E0B' : '#06B6D4', pinned:false, routing:{ source:'liv8-command-center', affiliateName:match.name || '', affiliateEmail:match.email || '', identifier:form.identifier, channel:form.channel, nextAction:form.nextAction, followUpDate:form.followUpDate, sensitive:form.sensitive, googleDocUrl:FOLLOW_UP_LOG_URL } }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'CRM note post failed');
      const routed = data?.automation?.taskMagic;
      setState('posted'); setMessage(`Note posted to ${match.name || match.email}.${routed === 'routed' ? ' TaskMagic routing completed.' : routed === 'skipped_sensitive' ? ' Sensitive note was not routed outside HighLevel.' : ' TaskMagic routing is awaiting webhook configuration.'}`);
      setQueue(q => { const next=q.map(x => x.contactId===id && x.note===note ? {...x,status:'posted'} : x); localStorage.setItem(QUEUE_KEY,JSON.stringify(next)); return next; });
    } catch(e) { setState('review'); setMessage(e.message); }
  }

  function reset() { setForm(emptyForm()); setMatch(null); setState('capture'); setMessage(''); }
  const input = 'w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-600';

  return <section className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#100a18] to-[#071217] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-[.18em] text-purple-300">Fast CRM hygiene</div><h2 className="mt-1 text-xl font-bold text-white">Affiliate Interaction Capture</h2><p className="mt-1 text-sm text-slate-400">One affiliate per submission · exact match · review before posting</p></div><div className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400"><Clock3 className="mr-1 inline h-3.5 w-3.5"/>{queue.filter(x=>x.status==='review').length} awaiting review</div></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block text-xs text-slate-400">Affiliate email, Promoter ID, or CRM contact ID *</label>
        <div className="flex gap-2"><input className={input} value={form.identifier} onChange={e=>{set('identifier',e.target.value);setMatch(null);setState('capture')}} placeholder="Exact identifier"/><button onClick={findContact} disabled={!form.identifier.trim()||state==='matching'} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-40"><Search className="h-4 w-4"/>{state==='matching'?'Matching…':'Match'}</button></div>
        {match && <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"><UserCheck className="h-4 w-4"/><span><b>Exact match:</b> {match.name || match.email} · {match.email}</span></div>}
        <div className="grid gap-3 sm:grid-cols-2"><select className={input} value={form.channel} onChange={e=>set('channel',e.target.value)}>{CHANNELS.map(x=><option key={x}>{x}</option>)}</select><input className={input} type="date" value={form.followUpDate} onChange={e=>set('followUpDate',e.target.value)}/></div>
        <div className="relative"><textarea className={`${input} min-h-28 pr-12`} value={form.rawNotes} onChange={e=>set('rawNotes',e.target.value)} placeholder="Raw notes or voice transcription *"/><button onClick={dictate} title="Dictate notes" className="absolute right-3 top-3 rounded-lg bg-purple-500/15 p-2 text-purple-300"><Mic className="h-4 w-4"/></button></div>
        <textarea className={input} rows="2" value={form.affiliateCommitments} onChange={e=>set('affiliateCommitments',e.target.value)} placeholder="Affiliate commitments — one per line"/>
        <textarea className={input} rows="2" value={form.managerCommitments} onChange={e=>set('managerCommitments',e.target.value)} placeholder="My commitments — one per line"/>
        <input className={input} value={form.blocker} onChange={e=>set('blocker',e.target.value)} placeholder="Risk or blocker"/>
        <input className={input} value={form.nextAction} onChange={e=>set('nextAction',e.target.value)} placeholder="Next action"/>
        <label className="flex items-center gap-2 text-xs text-amber-200"><input type="checkbox" checked={form.sensitive} onChange={e=>set('sensitive',e.target.checked)}/>Sensitive/internal note</label>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-cyan-300"/>Approval preview</div><pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap text-xs leading-6 text-slate-300">{note || 'Match an affiliate to generate the formatted CRM note.'}</pre></div>
    </div>
    {message && <div className={`mt-4 rounded-lg border p-3 text-sm ${state==='posted' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{state==='posted'?<CheckCircle2 className="mr-2 inline h-4 w-4"/>:<AlertTriangle className="mr-2 inline h-4 w-4"/>}{message}</div>}
    <div className="mt-4 flex flex-wrap gap-2"><button onClick={saveForReview} disabled={!match||!form.rawNotes.trim()} className="rounded-lg border border-purple-500/30 px-4 py-2 text-sm font-semibold text-purple-200 disabled:opacity-40">Submit for Review</button><button onClick={approveAndPost} disabled={!match||!form.rawNotes.trim()||state==='posting'||state==='posted'} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Send className="h-4 w-4"/>{state==='posting'?'Posting…':'Approve & Add to HighLevel'}</button><button onClick={reset} className="px-3 py-2 text-sm text-slate-500">Clear</button></div>
  </section>;
}
