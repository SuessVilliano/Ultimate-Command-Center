import React, { useEffect, useState } from 'react';
import {
  Briefcase, Lightbulb, Plus, Trash2, TrendingUp, Archive, Pause,
  Circle, Rocket, Coins, Gem, AlertTriangle, ArrowRight, DollarSign
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import * as svc from '../services/highestSelfService';

const TYPE = {
  cash_flow: { label: 'Cash Flow', color: '#2dd4bf', icon: Coins },
  asset: { label: 'Asset', color: '#60a5fa', icon: Gem },
  moonshot: { label: 'Moonshot', color: '#f472b6', icon: Rocket },
};
const STATE = {
  active: { label: 'Active', color: '#2dd4bf' },
  maintenance: { label: 'Maintenance', color: '#60a5fa' },
  parked: { label: 'Parked', color: '#f59e0b' },
  idea: { label: 'Idea', color: '#a78bfa' },
  archived: { label: 'Archived', color: '#8b93a7' },
};
const STAGES = ['idea', 'research', 'validated', 'project', 'active'];

export default function BusinessOS() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [ov, setOv] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [tab, setTab] = useState('projects');
  const [projForm, setProjForm] = useState({ name: '', strategic_type: 'cash_flow', operating_state: 'idea', domain: 'wealth' });
  const [ideaTitle, setIdeaTitle] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => { setOv(await svc.getProjects()); setIdeas(await svc.getIdeas()); };
  useEffect(() => { load(); }, []);

  const flash = (m) => { setNotice(m); setTimeout(() => setNotice(''), 2500); };
  const addProject = async () => { if (!projForm.name) return; await svc.addProject(projForm); setProjForm({ ...projForm, name: '' }); load(); };
  const setState = async (id, operating_state) => { await svc.updateProject(id, { operating_state }); load(); };
  const setType = async (id, strategic_type) => { await svc.updateProject(id, { strategic_type }); load(); };
  const removeProject = async (id) => { await svc.deleteProject(id); load(); };
  const addIdea = async () => { if (!ideaTitle) return; await svc.addIdea({ title: ideaTitle }); setIdeaTitle(''); load(); };
  const advanceIdea = async (idea) => {
    const i = STAGES.indexOf(idea.stage);
    if (i >= STAGES.length - 1) return;
    const nextStage = STAGES[i + 1];
    if (nextStage === 'project' || nextStage === 'active') {
      const r = await svc.promoteIdea(idea.id, { operating_state: nextStage === 'active' ? 'active' : 'idea' });
      if (r?.error === 'over_capacity') { flash(`You're at your active-project cap (${r.cap}). Park or archive one before activating another.`); return; }
      flash(`Promoted "${idea.title}" to a project.`);
    } else {
      await svc.updateIdea(idea.id, { stage: nextStage });
    }
    load();
  };
  const removeIdea = async (id) => { await svc.deleteIdea(id); load(); };

  const card = isDark ? 'bg-[#121817] border-[#243130]' : 'bg-white border-gray-200';
  const inp = `px-3 py-2 rounded-lg border bg-transparent text-sm ${isDark ? 'border-[#243130] text-white placeholder-gray-600' : 'border-gray-200 text-gray-900 placeholder-gray-400'}`;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}><Briefcase className="w-6 h-6 text-blue-400" /> Business &amp; Creation</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>See what's active, and deliberately stop doing things. Ideas land without becoming obligations.</p>
        </div>
        {notice && <span className="text-xs px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 max-w-xs">{notice}</span>}
      </div>

      {/* capacity banner */}
      {ov && (
        <div className={`rounded-2xl border p-4 ${ov.overCapacity ? 'border-amber-500/40' : card}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {ov.overCapacity ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : <Circle className="w-5 h-5 text-teal-400" />}
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{ov.activeCount} active {ov.activeCount === 1 ? 'project' : 'projects'} · cap {ov.cap}</p>
                <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{ov.overCapacity ? 'Over capacity — protect focus, park or archive something.' : 'Within focus capacity.'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {Object.entries(TYPE).map(([k, t]) => (
                <div key={k} className="text-center">
                  <div className="text-lg font-bold tabular-nums" style={{ color: t.color }}>{ov.byType[k] || 0}</div>
                  <div className={`text-[9px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t.label}</div>
                </div>
              ))}
              {ov.recurring > 0 && <div className="text-center"><div className="text-lg font-bold text-teal-400 tabular-nums">${ov.recurring}</div><div className={`text-[9px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>MRR</div></div>}
            </div>
          </div>
        </div>
      )}

      {/* tabs */}
      <div className="flex items-center gap-2">
        <Tab active={tab === 'projects'} onClick={() => setTab('projects')} icon={Briefcase} label="Projects" isDark={isDark} />
        <Tab active={tab === 'ideas'} onClick={() => setTab('ideas')} icon={Lightbulb} label={`Idea Orbit (${ideas.filter(i => i.stage !== 'project').length})`} isDark={isDark} />
      </div>

      {tab === 'projects' && ov && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {ov.projects.map(p => {
              const t = TYPE[p.strategic_type] || TYPE.cash_flow; const s = STATE[p.operating_state] || STATE.idea; const TIcon = t.icon;
              const dim = p.operating_state === 'parked' || p.operating_state === 'archived';
              return (
                <div key={p.id} className={`rounded-2xl border p-4 ${card} ${dim ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TIcon className="w-4 h-4 flex-shrink-0" style={{ color: t.color }} />
                      <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.name}</span>
                    </div>
                    <button onClick={() => removeProject(p.id)} className="text-gray-500 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {p.next_milestone && <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Next: {p.next_milestone}</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <select value={p.strategic_type} onChange={e => setType(p.id, e.target.value)} className={`${inp} !py-1 text-xs`}>
                      {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k} className={isDark ? 'bg-[#121817]' : ''}>{v.label}</option>)}
                    </select>
                    <select value={p.operating_state} onChange={e => setState(p.id, e.target.value)} className={`${inp} !py-1 text-xs`} style={{ color: s.color }}>
                      {Object.entries(STATE).map(([k, v]) => <option key={k} value={k} className={isDark ? 'bg-[#121817]' : ''}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`rounded-2xl border p-4 ${card}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input value={projForm.name} onChange={e => setProjForm({ ...projForm, name: e.target.value })} placeholder="New project name" className={`${inp} flex-1 min-w-[160px]`} />
              <select value={projForm.strategic_type} onChange={e => setProjForm({ ...projForm, strategic_type: e.target.value })} className={inp}>
                {Object.entries(TYPE).map(([k, v]) => <option key={k} value={k} className={isDark ? 'bg-[#121817]' : ''}>{v.label}</option>)}
              </select>
              <select value={projForm.operating_state} onChange={e => setProjForm({ ...projForm, operating_state: e.target.value })} className={inp}>
                {Object.entries(STATE).map(([k, v]) => <option key={k} value={k} className={isDark ? 'bg-[#121817]' : ''}>{v.label}</option>)}
              </select>
              <button onClick={addProject} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"><Plus className="w-4 h-4" /> Add</button>
            </div>
          </div>
        </>
      )}

      {tab === 'ideas' && (
        <>
          <div className={`rounded-2xl border p-4 ${card}`}>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-400 flex-shrink-0" />
              <input value={ideaTitle} onChange={e => setIdeaTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addIdea()} placeholder="Capture an idea — it stays an idea until you promote it…" className={`${inp} flex-1`} />
              <button onClick={addIdea} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"><Plus className="w-4 h-4" /> Capture</button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STAGES.filter(s => s !== 'active').map(stage => (
              <div key={stage} className={`rounded-2xl border p-3 ${card}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stage}</p>
                <div className="space-y-2">
                  {ideas.filter(i => i.stage === stage).map(i => (
                    <div key={i.id} className={`rounded-lg border p-2.5 ${isDark ? 'border-[#243130] bg-[#0e1413]' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-xs ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{i.title}</span>
                        <button onClick={() => removeIdea(i.id)} className="text-gray-500 hover:text-red-400 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      {stage !== 'project' && (
                        <button onClick={() => advanceIdea(i)} className="mt-2 flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300">
                          {stage === 'validated' ? 'Promote to project' : `Move to ${STAGES[STAGES.indexOf(stage) + 1]}`} <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {ideas.filter(i => i.stage === stage).length === 0 && <p className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>—</p>}
                </div>
              </div>
            ))}
          </div>
          <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Promotion gates: an idea earns Research (worth 30–60 min), then Validated (real problem + audience), then becomes a Project. Activating one respects your focus cap.</p>
        </>
      )}
    </div>
  );
}

function Tab({ active, onClick, icon: Icon, label, isDark }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${active ? 'border-transparent bg-blue-600 text-white' : isDark ? 'border-[#243130] text-gray-400' : 'border-gray-200 text-gray-500'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
