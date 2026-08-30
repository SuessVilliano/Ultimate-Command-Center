import React,{useEffect,useState} from 'react';
import { API_URL } from '../config';
import TradeHybridTerminal from './TradeHybridTerminal';

export default function TradingProcessLive(){
 const [status,setStatus]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const r=await fetch(`${API_URL}/api/trading/hybrid-journal/status`);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);setStatus(j)}catch(e){setError(e.message||'Hybrid MCP status failed')}finally{setLoading(false)}};
 useEffect(()=>{load()},[]);
 return <TradeHybridTerminal status={status} error={error} loading={loading} onRetest={load}/>;
}
