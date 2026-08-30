import React,{useMemo,useState} from 'react';
import { Bot, Send, RefreshCw, ShieldCheck, Wrench, AlertTriangle } from 'lucide-react';
import { API_URL } from '../config';
import { COMMANDER_AGENT, SPECIALIZED_AGENTS } from '../data/agents';
import { useTheme } from '../context/ThemeContext';

const AGENTS=[COMMANDER_AGENT,...SPECIALIZED_AGENTS].filter(Boolean);

export default function AgentTeamLive(){
  const {theme}=useTheme(); const isDark=theme==='dark';
  const [selected,setSelected]=useState(AGENTS[0]||{id:'juno',name:'Juno',description:'Executive operator'});
  const [messages,setMessages]=useState([]); const [input,setInput]=useState(''); const [sending,setSending]=useState(false); const [error,setError]=useState('');
  const selectedName=selected?.name||'Juno';
  const card=isDark?'bg-[#11131a] border-white/10':'bg-white border-gray-200';

  const systemContext=useMemo(()=>selected?.id===COMMANDER_AGENT?.id?'' : `You are operating as the ${selectedName} specialist inside Juno's agent team. Specialty: ${selected?.description||selected?.role||'specialist work'}. Use live connected tools when relevant. Do not invent source data. `,[selected,selectedName]);

  const send=async()=>{
    const text=input.trim(); if(!text||sending)return;
    setInput(''); setSending(true); setError('');
    setMessages(prev=>[...prev,{role:'user',content:text,ts:new Date().toISOString()}]);
    try{
      const r=await fetch(`${API_URL}/api/commander/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`${systemContext}${text}`})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||`AI HTTP ${r.status}`);
      const content=data.response?.content||data.response||data.message||'No response returned.';
      setMessages(prev=>[...prev,{role:'agent',content,agent:selectedName,provider:data.provider,model:data.model,toolsUsed:data.toolsUsed||[],approvalRequired:data.approvalRequired,ts:new Date().toISOString()}]);
    }catch(e){setError(e.message||'Live agent request failed');}
    finally{setSending(false);}
  };

  return <div className="grid xl:grid-cols-[280px_1fr] gap-4 min-h-[720px]">
    <aside className={`rounded-2xl border p-3 ${card}`}>
      <div className="px-2 py-2"><div className="text-xs uppercase tracking-[.18em] text-purple-300">Live operator fabric</div><h1 className="text-xl font-bold text-white mt-1">Agent Team</h1><p className="text-xs text-gray-500 mt-1">Every reply goes through the real Juno/operator route. No canned offline responses.</p></div>
      <div className="space-y-1 mt-3 max-h-[620px] overflow-auto">{AGENTS.map(a=><button key={a.id||a.name} onClick={()=>setSelected(a)} className={`w-full text-left rounded-xl p-3 border ${selected?.id===a.id?'bg-purple-500/15 border-purple-400/30':'bg-white/[.02] border-white/5 hover:bg-white/[.05]'}`}><div className="flex items-center gap-2"><Bot className="w-4 h-4 text-purple-300"/><div className="text-sm font-semibold text-white">{a.name}</div></div><div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{a.description||a.role}</div></button>)}</div>
    </aside>

    <section className={`rounded-2xl border flex flex-col overflow-hidden ${card}`}>
      <header className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold text-white">{selectedName}</div><div className="text-xs text-gray-500">Live Juno operator · safe reads automatic · writes approval-gated</div></div><div className="flex items-center gap-2 text-[11px] text-emerald-300"><ShieldCheck className="w-4 h-4"/>Source-backed mode</div></header>
      <div className="flex-1 p-4 space-y-3 overflow-auto bg-black/10">{messages.length===0&&<div className="h-full grid place-items-center text-center"><div><Bot className="w-10 h-10 text-purple-400 mx-auto"/><p className="text-white mt-3 font-medium">Talk to {selectedName}</p><p className="text-sm text-gray-500 mt-1 max-w-lg">Ask for current Nifty work, trading data, GHL/affiliate context, health, calendar, GitHub, or a specific specialist analysis. If a source is unavailable, the agent should say so instead of fabricating an answer.</p></div></div>}
        {messages.map((m,i)=><div key={i} className={`max-w-3xl rounded-xl p-3 ${m.role==='user'?'ml-auto bg-purple-600/20 border border-purple-500/20':'bg-white/[.04] border border-white/10'}`}><div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{m.role==='user'?'You':m.agent||selectedName}</div><div className="text-sm text-gray-200 whitespace-pre-wrap">{m.content}</div>{m.toolsUsed?.length>0&&<div className="mt-3 flex flex-wrap gap-1.5">{m.toolsUsed.map((t,j)=><span key={j} className={`text-[10px] px-2 py-1 rounded-full border ${t.ok?'text-emerald-300 border-emerald-500/20':'text-amber-300 border-amber-500/20'}`}><Wrench className="w-3 h-3 inline mr-1"/>{t.name}</span>)}</div>}{m.approvalRequired&&<div className="mt-2 text-xs text-amber-300">Approval required before that external write.</div>}</div>)}
        {sending&&<div className="flex items-center gap-2 text-sm text-gray-500"><RefreshCw className="w-4 h-4 animate-spin"/>{selectedName} is checking live systems…</div>}
        {error&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><AlertTriangle className="w-4 h-4 inline mr-2"/>{error}. No fake fallback response was generated.</div>}
      </div>
      <footer className="p-3 border-t border-white/10"><div className="flex gap-2"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} placeholder={`Ask ${selectedName}…`} className="min-h-[52px] max-h-32 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white resize-none"/><button onClick={send} disabled={sending||!input.trim()} className="px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white"><Send className="w-5 h-5"/></button></div></footer>
    </section>
  </div>;
}
