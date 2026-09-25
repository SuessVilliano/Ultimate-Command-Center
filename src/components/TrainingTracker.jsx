import React, { useEffect, useState } from 'react';
import { Bike, CheckCircle2, Dumbbell, Gauge, Save, Timer, TrendingUp, Cloud, CloudOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import * as trainingSvc from '../services/trainingService';

const STRENGTH_DAYS = [
  { id:'day1', title:'Day 1 · Upper Body', exercises:[
    ['Dumbbell Bench Press','3 × 8–15','Bench or floor. Smooth, controlled reps.'],
    ['One-Arm Dumbbell Row','3 × 8–15 / side','Use the bench for support.'],
    ['Seated Dumbbell Shoulder Press','3 × 8–15','Back supported when possible.'],
    ['Band Lat Pulldown','3 × 10–15','Door anchor or pull-up bar anchor.'],
    ['Band Face Pull','3 × 12–20','Pull toward eye level; squeeze upper back.'],
    ['Hammer Curl','3 × 10–15','Dumbbells or band.'],
    ['Triceps Extension / Pressdown','3 × 10–15','Band or dumbbell variation.']] },
  { id:'day2', title:'Day 2 · Midbody + Core', exercises:[
    ['Pallof Press','3 × 10–15 / side','Band anchored around chest height.'],
    ['Dead Bug','3 × 8–12 / side','Slow reps; keep torso controlled.'],
    ['Plank','3 × 30–60 sec','Stop before form breaks.'],
    ['Russian Twist','3 × 12–20 / side','Bodyweight or light dumbbell.'],
    ['Suitcase Hold / Carry','3 × 30–45 sec / side','One dumbbell; stay tall and square.'],
    ['Glute Bridge','3 × 12–20','Bodyweight, band, or dumbbell resistance.']] },
  { id:'day3', title:'Day 3 · Legs', exercises:[
    ['Goblet Squat','3 × 10–15','Dumbbell at chest; controlled depth.'],
    ['Bulgarian Split Squat','3 × 8–12 / leg','Bench-supported setup.'],
    ['Bench Step-Up','3 × 8–12 / leg','Drive through the working leg.'],
    ['Hip Thrust / Glute Bridge','3 × 10–15','Bench optional; dumbbell or band resistance.'],
    ['Band Hamstring Curl','3 × 12–20','Anchor low; slow return.'],
    ['Calf Raise','3 × 15–25','Pause at the top.']] },
];

const BIKE_PLAN = [
  { id:'base', title:'Base / Recovery Ride', target:'30–45 min', effort:'RPE 3–4', detail:'Easy conversational pace. Build consistency and aerobic base.' },
  { id:'interval', title:'Speed / Interval Ride', target:'35–50 min', effort:'RPE 7–8 work', detail:'10 min easy → 8 × (1 min hard + 2 min easy) → easy cooldown.' },
  { id:'endurance', title:'Long Endurance Ride', target:'60–90 min', effort:'RPE 4–5', detail:'Steady ride. Increase time or distance gradually, not both at once.' },
];

export default function TrainingTracker() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState('strength');
  const [selectedDay, setSelectedDay] = useState('day1');
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ strengthSessions:0, rides:0, bikeMiles:0, bikeMinutes:0, avgRideSpeed:0, longestRide:0, strengthCompletionPct:0 });
  const [strengthData, setStrengthData] = useState({});
  const [sessionDate, setSessionDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [sessionNotes, setSessionNotes] = useState('');
  const [ride, setRide] = useState({ type:'base', duration:'', distance:'', avgSpeed:'', rpe:'', notes:'' });
  const [syncState, setSyncState] = useState('loading');

  const activeDay = STRENGTH_DAYS.find(d => d.id === selectedDay);
  const card = isDark ? 'bg-[#121817] border-[#243130]' : 'bg-white border-gray-200';
  const sub = isDark ? 'bg-[#0e1413] border-[#243130]' : 'bg-gray-50 border-gray-200';
  const input = `w-full rounded-lg border px-2.5 py-2 text-sm bg-transparent ${isDark ? 'border-[#2b3937] text-white placeholder-gray-600' : 'border-gray-200 text-gray-900 placeholder-gray-400'}`;

  const load = async () => {
    const [sessions, nextStats] = await Promise.all([trainingSvc.getTrainingSessions(100), trainingSvc.getTrainingStats(30)]);
    setEntries(sessions || []);
    setStats(nextStats || {});
    setSyncState(nextStats?.offline ? 'offline' : 'online');
  };
  useEffect(() => { load(); }, []);

  const updateExercise = (idx, patch) => setStrengthData(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...patch } }));

  const saveStrength = async () => {
    const completed = activeDay.exercises.filter((_, i) => strengthData[i]?.done).length;
    const now = Date.now();
    const performedAt = new Date(`${sessionDate}T12:00:00`).toISOString();
    const item = {
      id:`${now}-strength`, clientId:`${now}-strength`, type:'strength', date:performedAt,
      programId:activeDay.id, dayId:activeDay.id, title:activeDay.title, completed, total:activeDay.exercises.length,
      notes:sessionNotes,
      exercises:activeDay.exercises.map((e,i)=>({ name:e[0], target:e[1], cue:e[2], ...(strengthData[i]||{}) })), source:'command-center'
    };
    const res = await trainingSvc.saveTrainingSession(item);
    setSyncState(res.offline ? 'offline' : 'online');
    setStrengthData({});
    setSessionNotes('');
    await load();
  };

  const saveRide = async () => {
    if (!ride.duration && !ride.distance) return;
    const plan = BIKE_PLAN.find(p => p.id === ride.type);
    const now = Date.now();
    const item = {
      id:`${now}-bike`, clientId:`${now}-bike`, type:'bike', date:new Date().toISOString(), programId:ride.type,
      rideType:ride.type, title:plan.title, duration:Number(ride.duration||0), distance:Number(ride.distance||0),
      avgSpeed:Number(ride.avgSpeed||0), rpe:Number(ride.rpe||0), notes:ride.notes, source:'command-center'
    };
    const res = await trainingSvc.saveTrainingSession(item);
    setSyncState(res.offline ? 'offline' : 'online');
    setRide({ type:ride.type, duration:'', distance:'', avgSpeed:'', rpe:'', notes:'' });
    await load();
  };

  return <section className={`rounded-2xl border p-5 ${card}`}>
    <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
      <div>
        <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-teal-400"/><h2 className={`font-semibold ${isDark?'text-white':'text-gray-900'}`}>Training Command Center</h2>{syncState==='online'?<Cloud className="w-4 h-4 text-teal-400"/>:syncState==='offline'?<CloudOff className="w-4 h-4 text-amber-400"/>:null}</div>
        <p className={`text-xs mt-1 ${isDark?'text-gray-500':'text-gray-500'}`}>Shared training history across Command Center. Strength, cycling, progression and recovery context.</p>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Metric label="Strength" value={stats.strengthSessions||0} unit="30d" isDark={isDark}/><Metric label="Rides" value={stats.rides||0} unit="30d" isDark={isDark}/><Metric label="Miles" value={Number(stats.bikeMiles||0).toFixed(1)} unit="30d" isDark={isDark}/><Metric label="Bike" value={Math.round(stats.bikeMinutes||0)} unit="min" isDark={isDark}/>
      </div>
    </div>

    <div className={`inline-flex rounded-xl border p-1 mb-4 ${sub}`}>
      {[['strength','Strength'],['bike','Bike'],['progress','Progress']].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab===id?'bg-teal-600 text-white':isDark?'text-gray-400':'text-gray-600'}`}>{label}</button>)}
    </div>

    {tab==='strength' && <div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">{STRENGTH_DAYS.map((d,i)=><button key={d.id} onClick={()=>{setSelectedDay(d.id);setStrengthData({});}} className={`whitespace-nowrap px-3 py-2 rounded-lg border text-xs ${selectedDay===d.id?'border-teal-500 bg-teal-500/10 text-teal-400':isDark?'border-[#243130] text-gray-400':'border-gray-200 text-gray-600'}`}>Day {i+1}</button>)}</div>
      <h3 className={`text-sm font-semibold mb-3 ${isDark?'text-white':'text-gray-900'}`}>{activeDay.title}</h3>
      <div className="space-y-2">{activeDay.exercises.map((ex,i)=>{const row=strengthData[i]||{};return <div key={ex[0]} className={`rounded-xl border p-3 ${sub}`}>
        <div className="flex items-start gap-3"><button onClick={()=>updateExercise(i,{done:!row.done})} className={`mt-0.5 ${row.done?'text-teal-400':isDark?'text-gray-600':'text-gray-300'}`}><CheckCircle2 className="w-5 h-5"/></button><div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><p className={`text-sm font-medium ${isDark?'text-white':'text-gray-900'}`}>{ex[0]}</p><span className="text-[11px] text-teal-400">{ex[1]}</span></div><p className={`text-[11px] mb-2 ${isDark?'text-gray-500':'text-gray-400'}`}>{ex[2]}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><input className={input} placeholder="Sets done" inputMode="numeric" value={row.sets||''} onChange={e=>updateExercise(i,{sets:e.target.value})}/><input className={input} placeholder="Reps / time" value={row.reps||''} onChange={e=>updateExercise(i,{reps:e.target.value})}/><input className={input} placeholder="Resistance optional" value={row.resistance||row.load||''} onChange={e=>updateExercise(i,{resistance:e.target.value,load:''})}/><input className={input} placeholder="RPE 1-10" type="number" min="1" max="10" value={row.rpe||''} onChange={e=>updateExercise(i,{rpe:e.target.value})}/></div>
        </div></div></div>})}</div>
      <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto]">
        <label><span className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Workout date</span><input className={input} type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)}/></label>
        <label><span className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Session notes</span><input className={input} value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="Bands, dumbbells, how it felt, substitutions…"/></label>
        <button onClick={()=>setStrengthData(Object.fromEntries(activeDay.exercises.map((_,i)=>[i,{...(strengthData[i]||{}),done:true}]))) } className="self-end rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:text-white">Mark all done</button>
      </div>
      <div className={`mt-3 rounded-xl border p-3 text-xs ${sub} ${isDark?'text-gray-400':'text-gray-600'}`}>Weight is optional. For bands/bodyweight/dumbbells, sets + reps + resistance note are enough. Progress can come from more reps, cleaner reps, more band tension, slower tempo, or heavier dumbbells.</div>
      <button onClick={saveStrength} className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-teal-600 hover:bg-teal-500 text-white py-2.5 text-sm font-medium"><Save className="w-4 h-4"/> Save strength session</button>
    </div>}

    {tab==='bike' && <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-2">{BIKE_PLAN.map(p=><button key={p.id} onClick={()=>setRide({...ride,type:p.id})} className={`text-left rounded-xl border p-3 ${ride.type===p.id?'border-teal-500 bg-teal-500/10':sub}`}><div className="flex items-center gap-2"><Bike className="w-4 h-4 text-teal-400"/><p className={`text-sm font-medium ${isDark?'text-white':'text-gray-900'}`}>{p.title}</p></div><p className="text-[11px] text-teal-400 mt-1">{p.target} · {p.effort}</p><p className={`text-[11px] mt-1 ${isDark?'text-gray-500':'text-gray-500'}`}>{p.detail}</p></button>)}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><Field icon={Timer} label="Duration (min)" value={ride.duration} set={v=>setRide({...ride,duration:v})} input={input}/><Field icon={Bike} label="Distance (mi)" value={ride.distance} set={v=>setRide({...ride,distance:v})} input={input}/><Field icon={Gauge} label="Avg mph" value={ride.avgSpeed} set={v=>setRide({...ride,avgSpeed:v})} input={input}/><Field icon={TrendingUp} label="RPE 1–10" value={ride.rpe} set={v=>setRide({...ride,rpe:v})} input={input}/></div>
      <textarea className={`${input} min-h-20`} placeholder="Route, weather, how legs felt, pain/tightness, battery use, notes…" value={ride.notes} onChange={e=>setRide({...ride,notes:e.target.value})}/>
      <button onClick={saveRide} className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-2.5 text-sm font-medium"><Save className="w-4 h-4"/> Save bike ride</button>
    </div>}

    {tab==='progress' && <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3"><Metric label="Avg speed" value={Number(stats.avgRideSpeed||0).toFixed(1)} unit="mph" isDark={isDark}/><Metric label="Longest" value={Number(stats.longestRide||0).toFixed(1)} unit="mi" isDark={isDark}/><Metric label="Strength" value={stats.strengthCompletionPct||0} unit="% done" isDark={isDark}/><Metric label="Sync" value={syncState==='online'?'Cloud':'Local'} unit="data" isDark={isDark}/></div>
      {entries.length===0?<p className={`text-sm ${isDark?'text-gray-500':'text-gray-500'}`}>No training logged yet.</p>:<div className="space-y-2">{entries.slice(0,20).map(e=><div key={e.clientId||e.id} className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${sub}`}><div className="flex items-center gap-2">{e.type==='bike'?<Bike className="w-4 h-4 text-blue-400"/>:<Dumbbell className="w-4 h-4 text-teal-400"/>}<div><p className={`text-sm font-medium ${isDark?'text-white':'text-gray-900'}`}>{e.title}</p><p className={`text-[11px] ${isDark?'text-gray-500':'text-gray-400'}`}>{new Date(e.date).toLocaleString()}</p>{e.notes&&<p className="text-[10px] text-gray-600 mt-0.5">{e.notes}</p>}</div></div><div className="text-right text-xs text-teal-400">{e.type==='bike'?`${e.distance||0} mi · ${e.duration||0} min · RPE ${e.rpe||'—'}`:`${e.completed||0}/${e.total||0} exercises`}</div></div>)}</div>}
    </div>}
  </section>;
}

function Metric({label,value,unit,isDark}){return <div className={`rounded-lg px-2 py-1.5 ${isDark?'bg-[#0e1413]':'bg-gray-50'}`}><div className={`text-sm font-bold ${isDark?'text-white':'text-gray-900'}`}>{value}</div><div className="text-[9px] text-gray-500 uppercase">{label} · {unit}</div></div>}
function Field({icon:Icon,label,value,set,input}){return <label><span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500 mb-1"><Icon className="w-3 h-3"/>{label}</span><input className={input} type="number" value={value} onChange={e=>set(e.target.value)}/></label>}
