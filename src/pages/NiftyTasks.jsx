import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, RefreshCw, Search, CalendarDays, UserRound, FolderKanban, ListTodo, Clock3, AlertTriangle } from 'lucide-react';
import { API_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

function rows(payload, keys = ['tasks','data','items','projects']) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}
function dt(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
function dateLabel(v) { const d=dt(v); return d ? d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:d.getFullYear()!==new Date().getFullYear()?'numeric':undefined}) : '—'; }
function assigneeNames(task) {
  const raw = task.assignees || task.assignedTo || task.members || task.taskAssignees || task.assignedMembers || [];
  if (typeof raw === 'string') return raw;
  if (!Array.isArray(raw)) return task.assignee?.name || task.assignee?.email || 'Unassigned';
  const names = raw.map(x => x?.member?.name || x?.name || x?.email || x?.member?.email).filter(Boolean);
  return names.length ? names.join(', ') : 'Unassigned';
}
function statusName(task) { return task.status?.name || task.statusName || task.status || (task.completed ? 'Completed' : 'Open'); }
function listName(task) { return task.list?.name || task.listName || task.milestone?.name || task.milestoneName || 'No list'; }
function priority(task) { return task.priority?.name || task.priority || task.storyPoints || null; }

export default function NiftyTasks() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tasks,setTasks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [projectFilter,setProjectFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState('open');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const pRes = await fetch(`${API_URL}/api/nifty/projects`);
      if (!pRes.ok) throw new Error(`Nifty projects HTTP ${pRes.status}`);
      const projects = rows(await pRes.json());
      const active = projects.filter(p => p && p.archived !== true);
      const results = await Promise.all(active.map(async project => {
        try {
          const r = await fetch(`${API_URL}/api/nifty/projects/${encodeURIComponent(project.id)}/tasks`);
          if (!r.ok) return [];
          const payload = await r.json();
          return rows(payload).filter(t => t?.archived !== true).map(t => ({...t, _project: project}));
        } catch { return []; }
      }));
      setTasks(results.flat());
    } catch (e) { setError(e.message || 'Could not load Nifty tasks'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);

  const projects = useMemo(()=>{
    const map=new Map(); tasks.forEach(t=>{if(t._project?.id) map.set(t._project.id,t._project.name||'Project');});
    return [...map.entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  },[tasks]);

  const visible = useMemo(()=>tasks.filter(t=>{
    if(projectFilter!=='all' && t._project?.id!==projectFilter) return false;
    if(statusFilter==='open' && t.completed) return false;
    if(statusFilter==='completed' && !t.completed) return false;
    const hay=[t.name,t.title,t.description,t._project?.name,statusName(t),listName(t),assigneeNames(t)].filter(Boolean).join(' ').toLowerCase();
    return !query || hay.includes(query.toLowerCase());
  }).sort((a,b)=>{
    const ad=dt(a.dueDate||a.due_date), bd=dt(b.dueDate||b.due_date);
    if(ad&&bd) return ad-bd; if(ad) return -1; if(bd) return 1;
    return String(b.updatedAt||b.updated_at||'').localeCompare(String(a.updatedAt||a.updated_at||''));
  }),[tasks,query,projectFilter,statusFilter]);

  const complete = async (task) => {
    if(task.completed) return;
    const r=await fetch(`${API_URL}/api/nifty/tasks/${encodeURIComponent(task.id)}/complete`,{method:'POST'});
    if(!r.ok) return window.alert(`Nifty update failed (${r.status})`);
    setTasks(prev=>prev.map(t=>t.id===task.id?{...t,completed:true,status:{...(t.status||{}),name:'Completed'}}:t));
  };

  const card=isDark?'bg-[#111716] border-[#25302f]':'bg-white border-gray-200';
  return <div className="space-y-5 max-w-7xl">
    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
      <div><div className="text-xs uppercase tracking-[.18em] text-teal-400">Nifty source of truth</div><h1 className={`text-2xl font-bold ${isDark?'text-white':'text-gray-900'}`}>Tasks</h1><p className="text-sm text-gray-500 mt-1">Live tasks from the 2026 ACTIVE — LIV8 OS portfolio. No local duplicate task database.</p></div>
      <button onClick={load} disabled={loading} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-gray-300"><RefreshCw className={`w-4 h-4 inline mr-2 ${loading?'animate-spin':''}`}/>Sync Nifty</button>
    </div>

    <div className={`rounded-xl border p-3 grid md:grid-cols-[1fr_220px_160px] gap-2 ${card}`}>
      <label className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-gray-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search task, project, status, assignee…" className="w-full pl-9 pr-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-white"/></label>
      <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-gray-300"><option value="all">All active projects</option>{projects.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-gray-300"><option value="open">Open</option><option value="completed">Completed</option><option value="all">All</option></select>
    </div>

    <div className="grid sm:grid-cols-4 gap-3">
      {[['Open',tasks.filter(t=>!t.completed).length],['Completed',tasks.filter(t=>t.completed).length],['Due dated',tasks.filter(t=>t.dueDate||t.due_date).length],['Visible',visible.length]].map(([l,v])=><div key={l} className={`rounded-xl border p-4 ${card}`}><div className="text-2xl font-bold text-white">{v}</div><div className="text-xs text-gray-500">{l}</div></div>)}
    </div>

    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm"><AlertTriangle className="w-4 h-4 inline mr-2"/>{error}</div>}
    {!loading && !error && visible.length===0 && <div className={`rounded-xl border p-10 text-center text-gray-500 ${card}`}>No matching Nifty tasks.</div>}

    <div className="space-y-3">{visible.map(task=>{
      const due=task.dueDate||task.due_date; const overdue=due && !task.completed && dt(due)<new Date(); const desc=task.description||task.notes||'';
      return <article key={task.id} className={`rounded-xl border p-4 ${card}`}>
        <div className="flex gap-3">
          <button onClick={()=>complete(task)} title={task.completed?'Completed':'Complete in Nifty'} className="mt-0.5 shrink-0">{task.completed?<CheckCircle2 className="w-5 h-5 text-emerald-400"/>:<Circle className="w-5 h-5 text-gray-500 hover:text-teal-400"/>}</button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className={`font-semibold ${task.completed?'line-through text-gray-500':'text-white'}`}>{task.name||task.title||'Untitled task'}</h3><div className="text-xs text-teal-400 mt-1 flex items-center gap-1"><FolderKanban className="w-3 h-3"/>{task._project?.name||'Nifty'}</div></div><span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-gray-300">{statusName(task)}</span></div>
            {desc && <p className="text-sm text-gray-400 mt-3 whitespace-pre-wrap">{desc}</p>}
            <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-5 gap-2 text-xs">
              <Meta icon={ListTodo} label="List / milestone" value={listName(task)}/>
              <Meta icon={UserRound} label="Assigned to" value={assigneeNames(task)}/>
              <Meta icon={CalendarDays} label="Due" value={dateLabel(due)} danger={overdue}/>
              <Meta icon={Clock3} label="Updated" value={dateLabel(task.updatedAt||task.updated_at)}/>
              <Meta icon={AlertTriangle} label="Priority / points" value={priority(task)||'—'}/>
            </div>
          </div>
        </div>
      </article>;
    })}</div>
  </div>;
}

function Meta({icon:Icon,label,value,danger}) { return <div className="rounded-lg bg-black/15 border border-white/5 p-2.5"><div className="text-[10px] uppercase tracking-wide text-gray-600 flex items-center gap-1"><Icon className="w-3 h-3"/>{label}</div><div className={`mt-1 truncate ${danger?'text-red-300':'text-gray-300'}`}>{value||'—'}</div></div>; }
