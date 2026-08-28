import React,{useEffect,useState} from 'react';
import {Brain,Search,Database,RefreshCw,Archive,Tag} from 'lucide-react';
import {API_URL} from '../config';

export default function MemoryVault(){
 const [items,setItems]=useState([]),[stats,setStats]=useState(null),[q,setQ]=useState(''),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const [a,b]=await Promise.all([fetch(`${API_URL}/api/memory/vault?limit=300&q=${encodeURIComponent(q)}`).then(r=>r.json()),fetch(`${API_URL}/api/memory/vault/stats`).then(r=>r.json())]);setItems(a.items||[]);setStats(b.stats||null);}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 return <div className="space-y-5 max-w-6xl">
  <div><div className="text-xs tracking-[.18em] uppercase text-purple-300 flex items-center gap-2"><Brain className="w-4 h-4"/>AI memory</div><h1 className="text-3xl font-bold text-white mt-1">Memory Vault</h1><p className="text-sm text-gray-400 mt-1">Juno, specialist agents, imported LLM conversations, decisions and durable context—one searchable memory layer.</p></div>
  <div className="grid sm:grid-cols-3 gap-3">{[['Memories',stats?.total],['High importance',stats?.highImportance],['Sources',stats?.bySource?.length]].map(([l,v])=><div key={l} className="rounded-xl border border-white/10 bg-white/[.03] p-4"><div className="text-[10px] uppercase tracking-wider text-gray-500">{l}</div><div className="text-2xl font-bold text-white mt-1">{v??'—'}</div></div>)}</div>
  <div className="flex gap-2"><div className="flex-1 relative"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-500"/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Search decisions, projects, people, health, trading, anything…" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[.03] text-white"/></div><button onClick={load} className="px-4 rounded-xl border border-white/10 bg-white/5 text-gray-300"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></button></div>
  <div className="space-y-2">{items.length?items.map(x=><article key={x.id} className="rounded-xl border border-white/10 bg-[#0d1017] p-4"><div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-gray-500"><Database className="w-3.5 h-3.5"/><span>{x.source}</span><span>•</span><span>{x.domain}</span><span>•</span><span>{x.item_type}</span><span className="ml-auto">importance {x.importance}/10</span></div><h3 className="text-white font-semibold mt-2">{x.title||x.summary||'Memory'}</h3>{x.summary&&x.title&&<p className="text-sm text-gray-400 mt-1">{x.summary}</p>}<p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap line-clamp-5">{x.content}</p><div className="text-[10px] text-gray-600 mt-3">{x.ts}</div></article>):<div className="rounded-xl border border-white/10 p-8 text-center text-gray-500">No memories match yet. Juno and imports will build this over time.</div>}</div>
 </div>;
}
