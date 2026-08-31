import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Brain, Briefcase, CalendarDays,
  CheckCircle2, Circle, Heart, Mail, RefreshCw, ShieldCheck, Sparkles,
  Target, TrendingUp, Users, Zap
} from 'lucide-react';
import { API_URL } from '../config';
import * as svc from '../services/highestSelfService';

const DAY_TYPE = {
  Sunday: ['NO TRADE', 'Recovery / weekly reset', 'rose'],
  Monday: ['OBSERVE', 'Research, range map, no forced entries', 'amber'],
  Tuesday: ['EXECUTE', 'A+ setup only', 'emerald'],
  Wednesday: ['EXECUTE', 'A+ setup only', 'emerald'],
  Thursday: ['EXECUTE', 'A+ setup only', 'emerald'],
  Friday: ['REVIEW', 'Protect gains, review the week', 'sky'],
  Saturday: ['NO TRADE', 'Recovery / review', 'rose'],
};

const pill = {
  emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  rose: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  sky: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  gray: 'border-white/10 bg-white/[.035] text-gray-400',
};

export default function Today({ onNavigate }) {
  const date = new Date().toISOString().slice(0, 10);
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const [brief, setBrief] = useState(null);
  const [oura, setOura] = useState(null);
  const [health, setHealth] = useState(null);
  const [mcp, setMcp] = useState(null);
  const [mcpError, setMcpError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [b, o, h, t] = await Promise.allSettled([
      svc.getTodayBrief(date),
      svc.getOuraSnapshot(),
      svc.getHealthSnapshot(),
      fetch(`${API_URL}/api/trading/hybrid-journal/status`).then(async r => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      }),
    ]);
    setBrief(b.status === 'fulfilled' ? b.value : null);
    setOura(o.status === 'fulfilled' ? o.value : null);
    setHealth(h.status === 'fulfilled' ? h.value : null);
    if (t.status === 'fulfilled') { setMcp(t.value); setMcpError(''); }
    else { setMcp(null); setMcpError(t.reason?.message || 'Unavailable'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [date]);

  const go = id => onNavigate?.(id);
  const [tradeMode, tradeNote, tradeTone] = DAY_TYPE[dayName] || DAY_TYPE.Monday;
  const readiness = num(oura?.latest?.readiness ?? brief?.readiness ?? brief?.health?.readiness);
  const sleepScore = num(oura?.latest?.sleep);
  const activityScore = num(oura?.latest?.activity);
  const sleepHours = num(health?.latestMetrics?.sleep_hours ?? health?.latestMetrics?.sleepHours);
  const weight = num(health?.latestMetrics?.weight);
  const outcomes = useMemo(() => {
    const raw = brief?.topOutcomes || brief?.intention?.top_outcomes || [];
    return Array.isArray(raw) ? raw.filter(Boolean).slice(0, 3) : [];
  }, [brief]);

  const mcpConnected = !!(mcp?.configured || mcp?.connected || mcp?.session?.connected);
  const ouraConfigured = !!oura?.configured;
  const ouraLive = ouraConfigured && [readiness, sleepScore, activityScore].some(v => v != null);
  const healthLive = !!(health?.latestMetrics || health?.metrics?.length);
  const sourceStates = [
    { label: 'Oura', state: ouraLive ? 'LIVE' : ouraConfigured ? 'DEGRADED' : 'AUTH NEEDED', tone: ouraLive ? 'emerald' : 'amber', icon: Activity, nav: 'health-os' },
    { label: 'Apple Health', state: healthLive ? 'INGESTED' : 'AWAITING SYNC', tone: healthLive ? 'emerald' : 'amber', icon: Heart, nav: 'health-os' },
    { label: 'Hybrid MCP', state: mcpConnected ? 'CONNECTED' : 'OFFLINE', tone: mcpConnected ? 'emerald' : 'rose', icon: TrendingUp, nav: 'trading-process' },
    { label: 'Gmail', state: 'BRIDGE REQUIRED', tone: 'amber', icon: Mail, nav: 'integrations' },
    { label: 'Calendar', state: 'BRIDGE REQUIRED', tone: 'amber', icon: CalendarDays, nav: 'integrations' },
    { label: 'GHL', state: 'AUTH REQUIRED', tone: 'rose', icon: Briefcase, nav: 'tickets' },
  ];

  const operatorNote = readiness != null
    ? readiness < 65 ? 'Protect recovery. Reduce load and avoid forcing decisions.' : readiness >= 80 ? 'Recovery supports a normal workload. Stay selective.' : 'Moderate recovery. Keep the plan tight and conserve attention.'
    : 'Readiness is unknown until the Oura bridge returns a current score.';

  const nextMove = outcomes[0] || (dayName === 'Monday' ? 'Map the week, validate systems, and observe the market.' : 'Set today’s top outcome in Highest Self.');

  return <div className="space-y-4 max-w-6xl" data-testid="morning-command">
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-[#080b0f] to-purple-950/15 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[.22em] text-cyan-300">Morning Command</div>
          <h1 className="text-2xl font-bold text-white mt-1">{dayName} operating brief</h1>
          <p className="text-sm text-gray-500 mt-1">One screen: operator state → trading posture → work priorities → source health.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 hover:border-cyan-500/30">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync morning
        </button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <Mini label="META SV" value={readiness != null ? `Readiness ${readiness}` : 'Readiness unknown'} sub={operatorNote} />
        <Mini label="Trade posture" value={tradeMode} sub={tradeNote} tone={tradeTone} />
        <Mini label="Next move" value={nextMove} sub="Highest priority currently visible" />
      </div>
    </section>

    <section className="grid lg:grid-cols-2 gap-4">
      <Card title="Morning reset" icon={Sparkles} action="Open Highest Self" onAction={() => go('highest-self')}>
        <div className="space-y-2 text-sm">
          <ResetLine done={!!brief?.intention} text="Identity / intention" detail={brief?.intention?.identity || 'Set who you are being today'} />
          <ResetLine done={false} text="Affirmations + visualization" detail="2–5 minutes before inputs and markets" />
          <ResetLine done={readiness != null} text="META SV check" detail={operatorNote} />
          <ResetLine done={outcomes.length > 0} text="Choose 1–3 outcomes" detail={outcomes.length ? outcomes.join(' • ') : 'Nothing selected yet'} />
        </div>
      </Card>

      <Card title="Trading command" icon={TrendingUp} action="Open Trade Hybrid" onAction={() => go('trading-process')}>
        <div className="flex items-center gap-2 mb-3">
          <Status tone={tradeTone}>{tradeMode}</Status>
          <Status tone={mcpConnected ? 'emerald' : 'rose'}>{mcpConnected ? 'MCP CONNECTED' : 'MCP OFFLINE'}</Status>
        </div>
        <p className="text-sm text-gray-300">{tradeNote}</p>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-gray-400 space-y-1.5">
          <div>Hybrid Journal MCP: <b className={mcpConnected ? 'text-emerald-300' : 'text-rose-300'}>{mcpConnected ? 'ready for read/analysis checks' : mcpError || 'not connected'}</b></div>
          <div>Execution gate: <b className="text-amber-300">LOCKED until explicit live confirmation</b></div>
          <div>Rule: wait for your MQ/QQE + structure alignment. No setup = no trade.</div>
        </div>
      </Card>
    </section>

    <section className="grid md:grid-cols-3 gap-4">
      <Card title="Body / recovery" icon={Heart} action="Health OS" onAction={() => go('health-os')}>
        <MetricRow label="Readiness" value={readiness != null ? `${readiness}/100` : '—'} source={ouraLive ? 'Oura' : 'Oura unavailable'} />
        <MetricRow label="Sleep score" value={sleepScore != null ? `${sleepScore}/100` : '—'} source={ouraLive ? 'Oura' : 'Oura unavailable'} />
        <MetricRow label="Activity" value={activityScore != null ? `${activityScore}/100` : '—'} source={ouraLive ? 'Oura' : 'Oura unavailable'} />
        <MetricRow label="Sleep hours" value={sleepHours != null ? `${sleepHours} h` : '—'} source={healthLive ? 'Health OS' : 'Awaiting ingest'} />
        <MetricRow label="Weight" value={weight != null ? `${weight} lb` : '—'} source={healthLive ? 'Health OS' : 'Awaiting ingest'} />
      </Card>

      <Card title="GHL / Affiliate" icon={Briefcase} action="Affiliate Manager" onAction={() => go('tickets')}>
        <Priority text="Confirm role scorecard + success metrics" />
        <Priority text="Map affiliate portfolio + priority partners" />
        <Priority text="Build weekly partner operating cadence" />
        <div className="mt-3"><Status tone="rose">GHL AUTH REQUIRED</Status></div>
        <p className="text-[11px] text-gray-500 mt-2">CRM activity should not be treated as live until authorization is repaired.</p>
      </Card>

      <Card title="Build / business" icon={Zap} action="Nifty Tasks" onAction={() => go('actions')}>
        <Priority text="Validate Hybrid Journal MCP + signal flow" />
        <Priority text="Smart Life Brokers landing-page positioning + tracking" />
        <Priority text="Hybrid Funding growth message matrix" />
        <p className="text-[11px] text-gray-500 mt-3">Use Nifty as the canonical task layer; Morning Command surfaces only the next few moves.</p>
      </Card>
    </section>

    <Card title="Source health" icon={ShieldCheck} action="Integrations" onAction={() => go('integrations')}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {sourceStates.map(({ label, state, tone, icon: Icon, nav }) => <button key={label} onClick={() => go(nav)} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#080b0f] p-3 hover:border-cyan-500/20 text-left">
          <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-gray-500"/><span className="text-sm text-gray-300">{label}</span></div>
          <Status tone={tone}>{state}</Status>
        </button>)}
      </div>
      <p className="text-[11px] text-gray-600 mt-3">Truth rule: a source is only marked live when Command Center itself can read it. ChatGPT-side connectors do not automatically count as Command Center integrations.</p>
    </Card>
  </div>;
}

function Card({ title, icon: Icon, action, onAction, children }) {
  return <section className="rounded-2xl border border-[#1a292d] bg-[#0a1012] p-4">
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-cyan-300"/><h2 className="font-semibold text-white text-sm">{title}</h2></div>
      {action && <button onClick={onAction} className="text-[11px] text-cyan-400 hover:text-cyan-300">{action} →</button>}
    </div>{children}
  </section>;
}
function Mini({ label, value, sub, tone='gray' }) { return <div className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="text-[9px] uppercase tracking-wider text-gray-600">{label}</div><div className={`font-semibold mt-1 ${tone==='gray'?'text-white':pill[tone].split(' ').at(-1)}`}>{value}</div><div className="text-[11px] text-gray-500 mt-1 leading-4">{sub}</div></div>; }
function Status({ tone='gray', children }) { return <span className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-bold tracking-wider ${pill[tone] || pill.gray}`}>{children}</span>; }
function ResetLine({ done, text, detail }) { return <div className="flex gap-2"><div className="mt-0.5">{done?<CheckCircle2 className="w-4 h-4 text-emerald-400"/>:<Circle className="w-4 h-4 text-gray-600"/>}</div><div><div className="text-gray-300">{text}</div><div className="text-[11px] text-gray-600">{detail}</div></div></div>; }
function MetricRow({ label, value, source }) { return <div className="flex items-center justify-between py-2 border-b border-white/[.06] last:border-0"><span className="text-xs text-gray-500">{label}</span><div className="text-right"><div className="text-sm font-semibold text-white">{value}</div><div className="text-[9px] text-gray-700">{source}</div></div></div>; }
function Priority({ text }) { return <div className="flex gap-2 py-1.5 text-xs text-gray-300"><ArrowRight className="w-3.5 h-3.5 text-cyan-500 mt-0.5 shrink-0"/>{text}</div>; }
function num(v) { return Number.isFinite(Number(v)) ? Number(v) : null; }
