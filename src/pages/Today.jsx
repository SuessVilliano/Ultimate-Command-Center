import React, { useEffect, useState } from 'react';
import {
  Sun, Target, TrendingUp, Heart, Users, Briefcase, Activity,
  Sparkles, ArrowRight, Clock, AlertTriangle, Ban
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import * as svc from '../services/highestSelfService';

const DAY_TYPE_LABEL = {
  no_trade: { t: 'No-Trade Day', c: '#f87171' },
  setup: { t: 'Setup / Research', c: '#f59e0b' },
  execute: { t: 'Execution Day', c: '#2dd4bf' },
  review: { t: 'Review Day', c: '#60a5fa' },
};

export default function Today({ onNavigate }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const date = new Date().toISOString().slice(0, 10);

  const [brief, setBrief] = useState(null);
  const [oura, setOura] = useState(null);

  useEffect(() => {
    (async () => {
      let b = await svc.getTodayBrief(date);
      if (!b) {
        // assemble from individual services (offline / no server)
        const [intention, health, horizon, projects] = await Promise.all([
          svc.getIntention(date), svc.getHealthDaily(date), svc.getFamilyHorizon(60), svc.getProjects(),
        ]);
        const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const DT = { Sunday: 'no_trade', Monday: 'setup', Tuesday: 'execute', Wednesday: 'execute', Thursday: 'execute', Friday: 'review', Saturday: 'no_trade' };
        b = {
          date, dayName, dayType: DT[dayName] || 'setup',
          intention: intention && intention.identity ? intention : null,
          topOutcomes: intention?.top_outcomes_json ? safeArr(intention.top_outcomes_json) : (intention?.top_outcomes || []),
          health, readiness: health?.readiness ?? null,
          nextFamily: horizon?.upcoming?.[0] || null,
          activeProjects: projects?.activeCount ?? 0, projectCap: projects?.cap ?? 4, overCapacity: projects?.overCapacity ?? false,
        };
      }
      setBrief(b);
      setOura(await svc.getOuraSnapshot());
    })();
  }, [date]);

  const card = isDark ? 'bg-[#121817] border-[#243130]' : 'bg-white border-gray-200';
  const go = (id) => onNavigate?.(id);

  if (!brief) return <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading today…</div>;

  const dt = DAY_TYPE_LABEL[brief.dayType] || DAY_TYPE_LABEL.setup;
  const hour = new Date().getHours();
  const tradingClosed = hour >= 12;
  const readiness = brief.readiness ?? oura?.latest?.readiness ?? null;
  const outcomes = (brief.topOutcomes || []).filter(Boolean);

  // "What should I do now?" — simple, transparent decision hierarchy.
  const suggestion = (() => {
    if (brief.nextFamily && brief.nextFamily.daysUntil <= 2) return { text: `${brief.nextFamily.title} is ${brief.nextFamily.daysUntil === 0 ? 'today' : `in ${brief.nextFamily.daysUntil}d`} — protect it`, go: 'family-os', why: 'Protected family anchor is near' };
    if (readiness != null && readiness < 65) return { text: 'Recovery is low — keep today light, prioritize rest', go: 'health-os', why: `Oura readiness ${readiness}` };
    if (brief.dayType === 'execute' && !tradingClosed) return { text: 'Execution window — wait for your setup, trade the plan', go: 'trading-process', why: 'Primary execution day, session open' };
    if (!brief.intention) return { text: 'Set your intention for today', go: 'highest-self', why: 'No intention captured yet' };
    if (outcomes.length) return { text: `Deep work on: ${outcomes[0]}`, go: 'life-map', why: 'Your #1 outcome today' };
    return { text: 'Open your Hour of Me', go: 'highest-self', why: 'Protect the operator first' };
  })();

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Hero */}
      <div className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{brief.dayName} — Highest Self</h1>
            </div>
            {brief.intention?.identity && <p className={`text-sm mt-1 italic ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>“{brief.intention.identity}”</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: dt.c }}>{dt.t}</span>
            {readiness != null && <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${readiness >= 85 ? 'border-teal-500/40 text-teal-400' : readiness >= 70 ? 'border-amber-500/40 text-amber-400' : 'border-red-500/40 text-red-400'}`}>Readiness {readiness}</span>}
          </div>
        </div>

        {/* one next action */}
        <button onClick={() => go(suggestion.go)} className="mt-4 w-full text-left rounded-xl p-4 flex items-center justify-between gap-3 transition-colors" style={{ background: dt.c + '14', border: `1px solid ${dt.c}44` }}>
          <div>
            <p className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Do this now</p>
            <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{suggestion.text}</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Why: {suggestion.why}</p>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0" style={{ color: dt.c }} />
        </button>
      </div>

      {/* Top outcomes */}
      <div className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Target className="w-5 h-5 text-teal-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Today's 1–3 outcomes</h2></div>
          <button onClick={() => go('highest-self')} className={`text-xs ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>edit →</button>
        </div>
        {outcomes.length === 0 ? (
          <button onClick={() => go('highest-self')} className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No outcomes set — tap to add up to 3.</button>
        ) : (
          <div className="space-y-2">
            {outcomes.map((o, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>{i + 1}</span>
                <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{o}</span>
              </div>
            ))}
          </div>
        )}
        {brief.intention?.not_doing && (
          <div className={`mt-3 flex items-center gap-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <Ban className="w-3.5 h-3.5 text-red-400" /> Not doing: {brief.intention.not_doing}
          </div>
        )}
      </div>

      {/* Glance grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <GlanceCard onClick={() => go('trading-process')} icon={TrendingUp} color="#60a5fa" title="Trading" isDark={isDark}
          value={dt.t} sub={tradingClosed ? 'Closed after 12pm' : 'Session open'} note={brief.intention?.trading_rule} />
        <GlanceCard onClick={() => go('health-os')} icon={Heart} color="#2dd4bf" title="Health" isDark={isDark}
          value={readiness != null ? `Readiness ${readiness}` : 'Log recovery'} sub={oura?.configured ? 'Oura connected' : 'Manual'} note={brief.intention?.health_commitment} />
        <GlanceCard onClick={() => go('family-os')} icon={Users} color="#f59e0b" title="Family" isDark={isDark}
          value={brief.nextFamily ? `${brief.nextFamily.title}` : 'No anchor soon'} sub={brief.nextFamily ? `in ${brief.nextFamily.daysUntil} days` : ''} note={brief.intention?.family_commitment} />
        <GlanceCard onClick={() => go('business-os')} icon={Briefcase} color={brief.overCapacity ? '#f59e0b' : '#a78bfa'} title="Projects" isDark={isDark}
          value={`${brief.activeProjects}/${brief.projectCap} active`} sub={brief.overCapacity ? 'Over focus capacity' : 'Within capacity'} warn={brief.overCapacity} />
        <GlanceCard onClick={() => go('highest-self')} icon={Sun} color="#f472b6" title="Self" isDark={isDark}
          value="Hour of Me" sub="Mind · Body · Knowledge" />
        <GlanceCard onClick={() => go('life-map')} icon={Sparkles} color="#22d3ee" title="Life Map" isDark={isDark}
          value="Explore the web" sub="Notes → Master Plans" />
      </div>
    </div>
  );
}

function GlanceCard({ onClick, icon: Icon, color, title, value, sub, note, warn, isDark }) {
  return (
    <button onClick={onClick} className={`text-left rounded-2xl border p-4 transition-colors ${warn ? 'border-amber-500/40' : isDark ? 'bg-[#121817] border-[#243130] hover:border-[#31423f]' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><Icon className="w-4 h-4" style={{ color }} /><span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</span></div>
        {warn && <AlertTriangle className="w-4 h-4 text-amber-400" />}
      </div>
      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{sub}</p>}
      {note && <p className={`text-[11px] mt-1.5 italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>“{note}”</p>}
    </button>
  );
}
function safeArr(json) { try { return JSON.parse(json || '[]'); } catch { return []; } }
