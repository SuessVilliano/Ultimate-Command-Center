import React, { useEffect, useState } from 'react';
import {
  Sun, Moon, Brain, Dumbbell, BookOpen, Sparkles, Target, Heart,
  Users, TrendingUp, Ban, Save, CheckCircle2, Circle, Wind
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import * as svc from '../services/highestSelfService';

const todayStr = () => new Date().toISOString().slice(0, 10);
const dayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

const HOUR_BLOCKS = [
  { key: 'mind', label: 'Mind', icon: Brain, hint: 'Meditation · breathing · stillness', color: '#a78bfa' },
  { key: 'identity', label: 'Identity', icon: Sparkles, hint: 'Affirmations · visualization · journal', color: '#f472b6' },
  { key: 'body', label: 'Body', icon: Dumbbell, hint: 'Mobility · light movement · stretch', color: '#2dd4bf' },
  { key: 'knowledge', label: 'Knowledge', icon: BookOpen, hint: 'Reading · study', color: '#60a5fa' },
];

export default function HighestSelf() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const date = todayStr();

  const [intention, setIntention] = useState({ identity: '', top_outcomes: ['', '', ''], trading_rule: '', health_commitment: '', family_commitment: '', not_doing: '' });
  const [hom, setHom] = useState({});
  const [reflection, setReflection] = useState({ went_well: '', did_not: '', alignment: 60, adjustment: '' });
  const [savedFlash, setSavedFlash] = useState('');

  useEffect(() => {
    (async () => {
      const i = await svc.getIntention(date);
      if (i && (i.identity !== undefined)) {
        setIntention({
          identity: i.identity || '',
          top_outcomes: safeArr(i.top_outcomes_json, ['', '', '']),
          trading_rule: i.trading_rule || '', health_commitment: i.health_commitment || '',
          family_commitment: i.family_commitment || '', not_doing: i.not_doing || '',
        });
      }
      const h = await svc.getHourOfMe(date);
      setHom(safeObj(h?.blocks_json, {}));
      const r = await svc.getReflection(date);
      if (r && r.went_well !== undefined) setReflection({ went_well: r.went_well || '', did_not: r.did_not || '', alignment: r.alignment ?? 60, adjustment: r.adjustment || '' });
    })();
  }, [date]);

  const flash = (m) => { setSavedFlash(m); setTimeout(() => setSavedFlash(''), 1800); };

  const saveIntention = async () => {
    await svc.saveIntention(date, { ...intention, top_outcomes: intention.top_outcomes.filter(Boolean) });
    flash('Intention saved');
  };
  const toggleBlock = async (key) => {
    const next = { ...hom, [key]: { done: !hom[key]?.done } };
    setHom(next);
    const total = Object.values(next).filter(b => b?.done).length * 15;
    await svc.saveHourOfMe(date, { blocks: next, total_minutes: total });
  };
  const saveReflection = async () => { await svc.saveReflection(date, reflection); flash('Reflection saved'); };

  const card = isDark ? 'bg-[#121817] border-[#243130]' : 'bg-white border-gray-200';
  const inp = `w-full px-3 py-2 rounded-lg border bg-transparent text-sm ${isDark ? 'border-[#243130] text-white placeholder-gray-600' : 'border-gray-200 text-gray-900 placeholder-gray-400'}`;
  const homDone = Object.values(hom).filter(b => b?.done).length;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{dayName()} — Highest Self</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Set the intention, protect your Hour of Me, close the day with truth.</p>
        </div>
        {savedFlash && <span className="text-xs px-3 py-1.5 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/30">{savedFlash}</span>}
      </div>

      {/* Morning intention */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4"><Sun className="w-5 h-5 text-amber-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Morning intention</h2></div>
        <label className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Who do I intend to be today?</label>
        <input value={intention.identity} onChange={e => setIntention({ ...intention, identity: e.target.value })} placeholder="Today I move like my Highest Self…" className={`${inp} mt-1 mb-4`} />

        <label className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>The 1–3 outcomes that matter (max 3)</label>
        <div className="space-y-2 mt-1 mb-4">
          {intention.top_outcomes.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>{i + 1}</span>
              <input value={o} onChange={e => { const t = [...intention.top_outcomes]; t[i] = e.target.value; setIntention({ ...intention, top_outcomes: t }); }} placeholder={`Priority ${i + 1}`} className={inp} />
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field icon={TrendingUp} color="#60a5fa" label="Today's trading rule" value={intention.trading_rule} onChange={v => setIntention({ ...intention, trading_rule: v })} isDark={isDark} inp={inp} placeholder="Wait for the order block. No chasing." />
          <Field icon={Heart} color="#2dd4bf" label="Health commitment" value={intention.health_commitment} onChange={v => setIntention({ ...intention, health_commitment: v })} isDark={isDark} inp={inp} placeholder="45-min ride + hit protein" />
          <Field icon={Users} color="#f59e0b" label="Family presence" value={intention.family_commitment} onChange={v => setIntention({ ...intention, family_commitment: v })} isDark={isDark} inp={inp} placeholder="Present with Jovi tonight" />
          <Field icon={Ban} color="#f87171" label="Deliberately NOT doing" value={intention.not_doing} onChange={v => setIntention({ ...intention, not_doing: v })} isDark={isDark} inp={inp} placeholder="No new projects. No revenge trades." />
        </div>
        <button onClick={saveIntention} className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium"><Save className="w-4 h-4" /> Save intention</button>
      </section>

      {/* Hour of Me */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Wind className="w-5 h-5 text-purple-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hour of Me</h2></div>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{homDone}/4 · ~{homDone * 15} min</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {HOUR_BLOCKS.map(b => {
            const Icon = b.icon; const done = hom[b.key]?.done;
            return (
              <button key={b.key} onClick={() => toggleBlock(b.key)}
                className={`text-left rounded-xl border p-4 transition-all ${done ? 'border-transparent' : isDark ? 'border-[#243130] hover:border-[#31423f]' : 'border-gray-200 hover:border-gray-300'}`}
                style={done ? { background: b.color + '1f', borderColor: b.color } : {}}>
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5" style={{ color: b.color }} />
                  {done ? <CheckCircle2 className="w-4 h-4" style={{ color: b.color }} /> : <Circle className="w-4 h-4 text-gray-500" />}
                </div>
                <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{b.label}</p>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{b.hint}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Night reflection */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4"><Moon className="w-5 h-5 text-indigo-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Night reflection</h2></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>What went well?</label>
            <textarea rows={3} value={reflection.went_well} onChange={e => setReflection({ ...reflection, went_well: e.target.value })} className={`${inp} mt-1`} />
          </div>
          <div>
            <label className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>What didn't?</label>
            <textarea rows={3} value={reflection.did_not} onChange={e => setReflection({ ...reflection, did_not: e.target.value })} className={`${inp} mt-1`} />
          </div>
        </div>
        <div className="mt-4">
          <label className={`text-xs uppercase tracking-wider flex items-center justify-between ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <span>Did I act like my Highest Self?</span><span className="text-teal-400 font-bold">{reflection.alignment}%</span>
          </label>
          <input type="range" min="0" max="100" value={reflection.alignment} onChange={e => setReflection({ ...reflection, alignment: +e.target.value })} className="w-full mt-2 accent-teal-500" />
        </div>
        <div className="mt-3">
          <label className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>What adjusts tomorrow?</label>
          <input value={reflection.adjustment} onChange={e => setReflection({ ...reflection, adjustment: e.target.value })} className={`${inp} mt-1`} />
        </div>
        <button onClick={saveReflection} className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"><Save className="w-4 h-4" /> Save reflection</button>
      </section>
    </div>
  );
}

function Field({ icon: Icon, color, label, value, onChange, isDark, inp, placeholder }) {
  return (
    <div>
      <label className={`text-xs uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <Icon className="w-3.5 h-3.5" style={{ color }} /> {label}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${inp} mt-1`} />
    </div>
  );
}
function safeArr(json, fallback) { try { const a = JSON.parse(json || '[]'); const out = [...a]; while (out.length < 3) out.push(''); return out.slice(0, 3); } catch { return fallback; } }
function safeObj(json, fallback) { try { return JSON.parse(json || '{}'); } catch { return fallback; } }
