import React,{useEffect,useState} from 'react';
import { Activity, AlertTriangle, BookOpen, Building2, Copy, ExternalLink, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import TradingProcess from './TradingProcess';

const APPS={
  journal:{label:'Hybrid Journal',url:import.meta.env.VITE_HYBRID_JOURNAL_URL||'https://hybridjournal.co',description:'Journal, signals, analytics, AI review and trading history.'},
  funding:{label:'Hybrid Funding',url:import.meta.env.VITE_HYBRID_FUNDING_URL||'https://hybridfunding.co',description:'Prop-firm accounts, programs, funding operations and account access.'},
  abatev:{label:'ABATEV',url:import.meta.env.VITE_ABATEV_URL||'https://abatev.tradehybrid.co',description:'Trade Hybrid strategy / execution workspace.'},
  kraken:{label:'Kraken Pro',url:'https://pro.kraken.com',description:'Kraken advanced trading terminal. Secure sites may block iframe embedding.'},
  copy:{label:'Hybrid Copy',url:import.meta.env.VITE_HYBRID_COPY_URL||'https://copy.tradehybrid.co',description:'Master/follower copy relationships, sizing, risk controls and execution bridges.'}
};

const TABS=[['overview','Overview'],['journal','Hybrid Journal'],['funding','Hybrid Funding'],['abatev','ABATEV'],['kraken','Kraken Pro'],['copy','Hybrid Copy']];

export default function TradeHybridTerminal({status,error,loading,onRetest}){
 const [tab,setTab]=useState(()=>localStorage.getItem('trade_hybrid_terminal_tab')||'overview');
 const choose=id=>{setTab(id);localStorage.setItem('trade_hybrid_terminal_tab',id)};
 return <div className="space-y-4">
  <section className="rounded-2xl border border-cyan-500/20 bg-[#080b12] overflow-hidden">
   <div className="px-4 py-4 border-b border-white/10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
    <div><div className="text-[10px] uppercase tracking-[.22em] text-cyan-300">LIV8FX workspace</div><h1 className="text-2xl font-bold text-white mt-1">Trade Hybrid Terminal</h1><p className="text-sm text-gray-500 mt-1">Journal · funding · strategy · broker · copy execution · guardian intelligence.</p></div>
    <div className="flex flex-wrap gap-2">{TABS.map(([id,label])=><button key={id} onClick={()=>choose(id)} className={`px-3 py-2 rounded-lg border text-xs sm:text-sm ${tab===id?'bg-cyan-500/15 border-cyan-400/35 text-cyan-100':'bg-white/[.03] border-white/10 text-gray-400 hover:text-white'}`}>{label}</button>)}</div>
   </div>
   {tab==='overview'?<Overview status={status} error={error} loading={loading} onRetest={onRetest}/>:<RemoteTradingApp id={tab} app={APPS[tab]}/>} 
  </section>
  {tab==='overview'&&<TradingProcess/>}
 </div>
}

function Overview({status,error,loading,onRetest}){
 const tools=status?.tools||[],names=tools.map(t=>t.name),modern=['place_trade','get_positions','get_account_status'].every(n=>names.includes(n));
 return <div className="p-4 sm:p-5 space-y-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-[.18em] text-cyan-300">Hybrid MCP + Guardian</div><h2 className="text-lg font-bold text-white mt-1">Trading intelligence connection</h2><p className="text-sm text-gray-500 mt-1">Read/account tools can be automatic. Live execution remains explicit-confirmation gated.</p></div><button onClick={onRetest} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300"><RefreshCw className={`w-4 h-4 inline mr-2 ${loading?'animate-spin':''}`}/>Retest MCP</button></div>
  {error?<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><AlertTriangle className="w-4 h-4 inline mr-2"/>{error}</div>:<div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3"><K label="MCP configured" value={status?.mcp?.configured?'Yes':'No'} ok={status?.mcp?.configured}/><K label="Session" value={status?.mcp?.hasSession?'Active':status?.mcp?.initialized?'Initialized':'Not initialized'} ok={status?.mcp?.initialized}/><K label="Contract" value={modern?'Hybrid MCP v2':'Legacy / partial'} ok={modern}/><K label="Execution gateway" value={status?.executionGateway?.reachable?'Reachable':status?.executionGateway?.configured?'Configured':'Not configured'} ok={status?.executionGateway?.reachable}/></div>}
  <div className="grid md:grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Wrench className="w-4 h-4 text-cyan-300"/>MCP tools</div>{tools.length?<div className="mt-3 flex flex-wrap gap-2">{tools.map(t=><span key={t.name} title={t.description||''} className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-gray-300">{t.name}</span>)}</div>:<p className="text-sm text-gray-600 mt-3">No tools returned yet.</p>}</div><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.06] p-4"><ShieldCheck className="w-5 h-5 text-emerald-300"/><div className="font-semibold text-white mt-2">Execution safety</div><p className="text-sm text-gray-400 mt-1">Hybrid Copy and Hybrid MCP can prepare, size, route and preview trades, but live account execution must remain behind your explicit confirmation gate until each bridge/account is validated.</p></div></div>
  <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3"><Launch title="Journal" text="Signals + AI + history" tab="journal" icon={BookOpen}/><Launch title="Funding" text="Prop account ops" tab="funding" icon={Building2}/><Launch title="ABATEV" text="Strategy workspace" tab="abatev" icon={Activity}/><Launch title="Kraken" text="Broker terminal" tab="kraken" icon={ExternalLink}/><Launch title="Hybrid Copy" text="Copy engine — validate first" tab="copy" icon={Copy}/></div>
 </div>
}

function Launch({title,text,tab,icon:Icon}){return <button onClick={()=>{localStorage.setItem('trade_hybrid_terminal_tab',tab);window.dispatchEvent(new CustomEvent('trade-hybrid-tab',{detail:tab}));location.reload()}} className="text-left rounded-xl border border-white/10 bg-white/[.03] p-3 hover:bg-white/[.06]"><Icon className="w-4 h-4 text-cyan-300"/><div className="font-semibold text-white text-sm mt-2">{title}</div><div className="text-xs text-gray-500 mt-1">{text}</div></button>}

function RemoteTradingApp({id,app}){
 const [frameKey,setFrameKey]=useState(0),[state,setState]=useState('checking');
 useEffect(()=>{let done=false;const c=new AbortController();const timer=setTimeout(()=>{if(!done){c.abort();setState('unknown')}},5000);setState('checking');fetch(app.url,{method:'GET',mode:'no-cors',signal:c.signal}).then(()=>{done=true;clearTimeout(timer);setState('reachable')}).catch(()=>{done=true;clearTimeout(timer);setState('unknown')});return()=>{done=true;clearTimeout(timer);c.abort()}},[app.url,frameKey]);
 return <div className="min-h-[780px]"><div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold text-white">{app.label}</div><div className="text-xs text-gray-500 mt-1">{app.description}</div><div className={`text-[11px] mt-1 ${state==='reachable'?'text-emerald-300':state==='checking'?'text-amber-300':'text-gray-500'}`}>{state==='reachable'?'Endpoint reachable':state==='checking'?'Checking endpoint…':'Embedding/reachability could not be verified from browser'}</div></div><div className="flex gap-2"><button onClick={()=>setFrameKey(x=>x+1)} className="px-3 py-2 text-xs rounded-lg bg-white/5 text-gray-300"><RefreshCw className="w-3.5 h-3.5 inline mr-1"/>Reload</button><button onClick={()=>window.open(app.url,'_blank','noopener,noreferrer')} className="px-3 py-2 text-xs rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-100"><ExternalLink className="w-3.5 h-3.5 inline mr-1"/>Open full app</button></div></div>
  {id==='kraken'&&<div className="mx-4 mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[.07] p-3 text-xs text-amber-200">Kraken may block embedding for login/security. If the frame is blank, use Open full app; the Hybrid MCP/API connection can still surface account/position intelligence in the terminal.</div>}
  {id==='copy'&&<div className="mx-4 mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[.06] p-3 text-xs text-cyan-100">Hybrid Copy is in validation/build mode. Do not treat a relationship as live until its master source, follower account, sizing, symbol mapping, stop/TP propagation and kill switch have passed paper/dry-run tests.</div>}
  <div className="relative h-[700px] mt-3 bg-black"><iframe key={`${id}-${frameKey}`} src={app.url} title={app.label} className="absolute inset-0 w-full h-full border-0" allow="clipboard-read; clipboard-write; fullscreen"/><div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-white/10 bg-black/80 px-2 py-1 text-[10px] text-gray-500">Blank frame? Use Open full app.</div></div></div>
}
function K({label,value,ok}){return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-wide text-gray-600">{label}</div><div className={`font-semibold mt-1 ${ok?'text-emerald-300':'text-gray-300'}`}>{value}</div></div>}
