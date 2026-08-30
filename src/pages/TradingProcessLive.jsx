import React,{useEffect,useState} from 'react';
import { RefreshCw, ShieldCheck, PlugZap, Wrench, AlertTriangle, ExternalLink, Radio } from 'lucide-react';
import { API_URL } from '../config';
import TradingProcess from './TradingProcess';

export default function TradingProcessLive(){
 const [status,setStatus]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch(`${API_URL}/api/trading/hybrid-journal/status`);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);setStatus(j)}catch(e){setError(e.message||'Hybrid MCP status failed')}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 const tools=status?.tools||[]; const names=tools.map(t=>t.name); const newContract=['place_trade','get_positions','get_account_status']; const modern=newContract.every(n=>names.includes(n));
 return <div className="space-y-5">
   <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-purple-950/20 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-[.18em] text-cyan-300">Hybrid Journal MCP</div><h2 className="text-xl font-bold text-white mt-1">Trading connection</h2><p className="text-sm text-gray-500 mt-1">This reads the real MCP handshake/tool list. Live execution remains confirmation-gated.</p></div><button onClick={load} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300"><RefreshCw className={`w-4 h-4 inline mr-2 ${loading?'animate-spin':''}`}/>Retest MCP</button></div>
    {error?<div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><AlertTriangle className="w-4 h-4 inline mr-2"/>{error}</div>:<div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-4 gap-3"><K label="Configured" value={status?.mcp?.configured?'Yes':'No'} ok={status?.mcp?.configured}/><K label="Session" value={status?.mcp?.hasSession?'Active':status?.mcp?.initialized?'Initialized':'Not initialized'} ok={status?.mcp?.initialized}/><K label="Tool contract" value={modern?'Hybrid MCP v2':'Legacy / partial'} ok={modern}/><K label="Execution gateway" value={status?.executionGateway?.reachable?'Reachable':status?.executionGateway?.configured?'Configured':'Not configured'} ok={status?.executionGateway?.reachable}/></div>}
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Wrench className="w-4 h-4 text-cyan-300"/>Tools returned by Hybrid Journal</div>{tools.length?<div className="mt-3 flex flex-wrap gap-2">{tools.map(t=><span key={t.name} title={t.description||''} className={`px-2.5 py-1 rounded-full border text-xs ${newContract.includes(t.name)?'border-emerald-500/25 bg-emerald-500/10 text-emerald-300':'border-white/10 bg-white/5 text-gray-300'}`}>{t.name}</span>)}</div>:<p className="text-sm text-gray-600 mt-3">No MCP tools returned. Check HYBRID_JOURNAL_MCP_URL and HYBRID_JOURNAL_MCP_TOKEN on the Command Center server.</p>}</div>
    {modern&&<div className="mt-3 text-xs text-emerald-300 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/>Updated Hybrid MCP detected: trade preview/execution, positions, and account status are exposed by the journal. Live orders still require explicit confirmation.</div>}
   </section>
   <TradingProcess/>
 </div>
}
function K({label,value,ok}){return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-wide text-gray-600">{label}</div><div className={`font-semibold mt-1 ${ok?'text-emerald-300':'text-gray-300'}`}>{value}</div></div>}
