import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, MessageCircle, RefreshCw, Send, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { API_URL } from '../config';
import PersistentPanel from '../components/PersistentPanel';

const channelMeta = {
  gmail: { label: 'Gmail', icon: Mail },
  sms: { label: 'SMS', icon: Smartphone },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
};

const contactKey = m => `${m.source}:${String(m.contact || m.from || m.to || 'unknown').toLowerCase()}`;

export default function UnifiedConversations() {
  const [messages, setMessages] = useState([]);
  const [sources, setSources] = useState({});
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [reply, setReply] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/conversations/unified?limit=120`);
      const data = await r.json();
      setMessages(data.messages || []);
      setSources(data.sources || {});
      setErrors(data.errors || []);
      if (!selected && data.messages?.length) setSelected(contactKey(data.messages[0]));
    } catch (e) {
      setErrors([e.message || 'Conversation sync failed']);
    } finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const threads = useMemo(() => {
    const map = new Map();
    for (const m of messages) {
      if (filter !== 'all' && m.source !== filter) continue;
      const key = contactKey(m);
      if (!map.has(key)) map.set(key, { key, source: m.source, contact: m.contact || m.from || m.to, subject: m.subject, latest: m, count: 0 });
      map.get(key).count += 1;
    }
    return [...map.values()].sort((a,b) => new Date(b.latest.createdAt || 0) - new Date(a.latest.createdAt || 0));
  }, [messages, filter]);

  const active = threads.find(t => t.key === selected) || threads[0];
  const activeMessages = useMemo(() => active ? messages.filter(m => contactKey(m) === active.key).sort((a,b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) : [], [messages, active]);

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`${API_URL}/api/conversations/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: active.source, to: active.contact, subject: subject || `Re: ${active.subject || ''}`, body: reply.trim() })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Send failed');
      setReply(''); setSubject(''); await load();
    } catch (e) { window.alert(e.message); }
    finally { setSending(false); }
  };

  return <div className="space-y-5 animate-slide-in">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-[.18em] text-cyan-300">Connected communications</div>
        <h1 className="mt-1 text-3xl font-bold text-white">Conversations</h1>
        <p className="mt-1 text-sm text-gray-500">Gmail through your connector/MCP layer, plus Twilio SMS and WhatsApp in one inbox.</p>
      </div>
      <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:text-white"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh</button>
    </div>

    <div className="flex flex-wrap gap-2">
      {[['all','All'],['gmail','Gmail'],['sms','SMS'],['whatsapp','WhatsApp']].map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={`rounded-lg px-3 py-2 text-xs border ${filter===id?'border-cyan-500/30 bg-cyan-500/10 text-cyan-300':'border-white/10 text-gray-500 hover:text-white'}`}>{label}</button>)}
      <div className="ml-auto flex items-center gap-3 text-[11px]">
        <span className={sources.gmail ? 'text-emerald-400' : 'text-gray-600'}>{sources.gmail ? <Wifi className="inline h-3 w-3"/> : <WifiOff className="inline h-3 w-3"/>} Gmail</span>
        <span className={sources.twilio ? 'text-emerald-400' : 'text-gray-600'}>{sources.twilio ? <Wifi className="inline h-3 w-3"/> : <WifiOff className="inline h-3 w-3"/>} Twilio</span>
      </div>
    </div>

    {errors.length > 0 && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">{errors.join(' · ')}</div>}

    <div className="grid min-h-[650px] grid-cols-[300px_minmax(0,1fr)] gap-4">
      <PersistentPanel id="conversations-list" title="Threads" subtitle={`${threads.length} active conversations`} defaultOpen>
        <div className="-m-2 max-h-[560px] overflow-y-auto space-y-1">
          {threads.map(t => {
            const meta = channelMeta[t.source] || channelMeta.sms; const Icon = meta.icon;
            return <button key={t.key} onClick={() => setSelected(t.key)} className={`w-full rounded-xl p-3 text-left border ${active?.key===t.key?'border-cyan-500/30 bg-cyan-500/10':'border-transparent hover:bg-white/5'}`}>
              <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-cyan-300"/><span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{t.contact || 'Unknown'}</span><span className="text-[9px] uppercase text-gray-600">{meta.label}</span></div>
              <div className="mt-1 truncate text-xs text-gray-500">{t.latest.subject || t.latest.body || 'No preview'}</div>
            </button>;
          })}
          {!threads.length && <div className="p-8 text-center text-sm text-gray-600">No connected conversations yet.</div>}
        </div>
      </PersistentPanel>

      <PersistentPanel id="conversation-thread" title={active?.contact || 'Select a thread'} subtitle={active ? channelMeta[active.source]?.label : 'Conversation'} defaultOpen>
        <div className="flex h-[560px] flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {activeMessages.map(m => <div key={m.id} className={`max-w-[82%] rounded-2xl border px-4 py-3 ${m.direction==='outbound'?'ml-auto border-cyan-500/20 bg-cyan-500/10':'border-white/10 bg-white/5'}`}>
              {m.subject && <div className="mb-1 text-xs font-semibold text-white">{m.subject}</div>}
              <div className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{m.body || '—'}</div>
              <div className="mt-2 text-[10px] text-gray-600">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''} · {m.status || m.source}</div>
            </div>)}
          </div>
          {active && <div className="mt-4 border-t border-white/10 pt-3">
            {active.source==='gmail' && <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder={`Re: ${active.subject || 'Subject'}`} className="mb-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"/>}
            <div className="flex gap-2"><textarea rows={3} value={reply} onChange={e=>setReply(e.target.value)} placeholder={`Reply via ${channelMeta[active.source]?.label || active.source}...`} className="flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/30"/><button disabled={sending || !reply.trim()} onClick={sendReply} className="self-end rounded-xl bg-cyan-600 p-3 text-white hover:bg-cyan-500 disabled:opacity-40"><Send className="h-4 w-4"/></button></div>
          </div>}
        </div>
      </PersistentPanel>
    </div>
  </div>;
}
