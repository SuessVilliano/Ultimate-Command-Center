import React, { useEffect, useMemo, useState } from 'react';
import { Dumbbell, Plus, Save, Trash2 } from 'lucide-react';
import * as hs from '../services/highestSelfService';

const blankExercise = () => ({ name: '', sets: '3', reps: '8-12', max: '', notes: '' });
const normalizePlans = raw => {
  if (Array.isArray(raw)) return raw;
  try { const parsed = JSON.parse(raw || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

export default function WorkoutPlanManager() {
  const [healthPlan, setHealthPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [saving, setSaving] = useState(false);
  const [sync, setSync] = useState('loading');

  useEffect(() => {
    hs.getHealthPlan().then(plan => {
      setHealthPlan(plan || {});
      const stored = normalizePlans(plan?.training_json ?? plan?.training);
      setPlans(stored);
      setActiveId(stored[0]?.id || '');
      setSync('saved');
    }).catch(() => setSync('offline'));
  }, []);

  const active = useMemo(() => plans.find(p => p.id === activeId) || plans[0] || null, [plans, activeId]);
  const patchActive = patch => setPlans(prev => prev.map(p => p.id === active?.id ? { ...p, ...patch } : p));
  const patchExercise = (index, patch) => patchActive({ exercises: active.exercises.map((e,i) => i===index ? { ...e, ...patch } : e) });

  const addPlan = () => {
    const id = `plan-${Date.now()}`;
    const next = { id, name: 'New Workout Plan', description: '', exercises: [blankExercise()] };
    setPlans(prev => [...prev, next]); setActiveId(id); setSync('unsaved');
  };
  const deletePlan = id => {
    const next = plans.filter(p => p.id !== id); setPlans(next); setActiveId(next[0]?.id || ''); setSync('unsaved');
  };
  const addExercise = () => { patchActive({ exercises: [...(active.exercises || []), blankExercise()] }); setSync('unsaved'); };
  const removeExercise = index => { patchActive({ exercises: active.exercises.filter((_,i) => i!==index) }); setSync('unsaved'); };

  const save = async () => {
    setSaving(true);
    try {
      const targets = typeof healthPlan?.targets_json === 'string' ? JSON.parse(healthPlan.targets_json || '{}') : (healthPlan?.targets || {});
      const nutrition = typeof healthPlan?.nutrition_json === 'string' ? JSON.parse(healthPlan.nutrition_json || '[]') : (healthPlan?.nutrition || []);
      const saved = await hs.saveHealthPlan({ focus: healthPlan?.focus || 'recomposition', targets, nutrition, training: plans });
      setHealthPlan(saved || healthPlan); setSync('saved');
    } catch { setSync('offline'); }
    finally { setSaving(false); }
  };

  const input = 'w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/30';

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2 text-white font-semibold"><Dumbbell className="h-5 w-5 text-cyan-300"/>Workout Plans</div><p className="mt-1 text-xs text-gray-500">Create and revise named routines. Sets, rep targets, max/load targets and notes are saved into Health OS.</p></div>
      <div className="flex items-center gap-2"><span className={`text-[10px] uppercase ${sync==='saved'?'text-emerald-400':sync==='unsaved'?'text-amber-400':'text-gray-500'}`}>{sync}</span><button onClick={addPlan} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:text-white"><Plus className="h-4 w-4"/>Plan</button><button onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Saving':'Save'}</button></div>
    </div>

    {plans.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1">{plans.map(p => <button key={p.id} onClick={()=>setActiveId(p.id)} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-xs ${active?.id===p.id?'border-cyan-500/30 bg-cyan-500/10 text-cyan-300':'border-white/10 text-gray-500'}`}>{p.name || 'Untitled'}</button>)}</div>}

    {!active ? <button onClick={addPlan} className="w-full rounded-xl border border-dashed border-white/15 py-10 text-sm text-gray-500 hover:text-white">+ Create your first workout plan</button> : <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_auto]"><input className={input} value={active.name} onChange={e=>{patchActive({name:e.target.value});setSync('unsaved');}} placeholder="Plan name"/><input className={input} value={active.description || ''} onChange={e=>{patchActive({description:e.target.value});setSync('unsaved');}} placeholder="Goal / description"/><button onClick={()=>deletePlan(active.id)} className="rounded-lg border border-rose-500/20 px-3 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4"/></button></div>
      <div className="space-y-2">{(active.exercises || []).map((e,i)=><div key={`${active.id}-${i}`} className="grid gap-2 rounded-xl border border-white/10 bg-black/15 p-3 md:grid-cols-[1.5fr_.55fr_.75fr_.75fr_1.2fr_auto]">
        <input className={input} value={e.name} onChange={x=>{patchExercise(i,{name:x.target.value});setSync('unsaved');}} placeholder="Exercise"/>
        <input className={input} value={e.sets} onChange={x=>{patchExercise(i,{sets:x.target.value});setSync('unsaved');}} placeholder="Sets"/>
        <input className={input} value={e.reps} onChange={x=>{patchExercise(i,{reps:x.target.value});setSync('unsaved');}} placeholder="Reps"/>
        <input className={input} value={e.max} onChange={x=>{patchExercise(i,{max:x.target.value});setSync('unsaved');}} placeholder="Max/load"/>
        <input className={input} value={e.notes || ''} onChange={x=>{patchExercise(i,{notes:x.target.value});setSync('unsaved');}} placeholder="Notes / tempo"/>
        <button onClick={()=>removeExercise(i)} className="rounded-lg border border-white/10 px-3 text-gray-500 hover:text-rose-300"><Trash2 className="h-4 w-4"/></button>
      </div>)}</div>
      <button onClick={addExercise} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white"><Plus className="h-4 w-4"/>Exercise</button>
    </div>}
  </div>;
}
