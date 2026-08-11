import React, { useEffect, useState } from 'react';
import {
  Target, Zap, CheckCircle2, XCircle, Bell, Plus, Activity,
  ShieldCheck, Webhook, TrendingUp, Copy, Clock
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';
import * as svc from '../services/highestSelfService';

const DAY_TYPES = {
  Sunday: { type: 'no_trade', label: 'No-trade · family & reset' },
  Monday: { type: 'setup', label: 'Research / setup · A+ only' },
  Tuesday: { type: 'execute', label: 'Primary execution' },
  Wednesday: { type: 'execute', label: 'Primary execution' },
  Thursday: { type: 'execute', label: 'Primary execution' },
  Friday: { type: 'review', label: 'Review / no-trade' },
  Saturday: { type: 'no_trade', label: 'Life' },
};
const TYPE_STYLE = {
  no_trade: { c: '#f87171', t: 'No Trade' },
  setup: { c: '#f59e0b', t: 'Setup Day' },
  execute: { c: '#2dd4bf', t: 'Execute' },
  review: { c: '#60a5fa', t: 'Review' },
};

export default function TradingProcess() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [alerts, setAlerts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [adh, setAdh] = useState(null);
  const [tradeForm, setTradeForm] = useState({ symbol: '', direction: 'long', pnl: '', on_setup: true, followed_plan: true, setup_type: 'order_block', alert_id: '' });

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const dt = DAY_TYPES[dayName] || DAY_TYPES.Monday;
  const hour = new Date().getHours();
  const tradingClosed = hour >= 12;

  const load = async () => {
    setAlerts(await svc.getAlerts(50));
    setTrades(await svc.getTrades(50));
    setAdh(await svc.getAdherence(30));
  };
  useEffect(() => { load(); }, []);

  const webhookUrl = `${API_URL}/api/hs/trading/webhook`;

  const markAlert = async (id, status) => { await svc.setAlertStatus(id, status); setAlerts(await svc.getAlerts(50)); };
  const logTrade = async () => {
    if (!tradeForm.symbol) return;
    await svc.addTrade({
      symbol: tradeForm.symbol.toUpperCase(), direction: tradeForm.direction,
      pnl: tradeForm.pnl === '' ? null : +tradeForm.pnl,
      on_setup: tradeForm.on_setup, followed_plan: tradeForm.followed_plan,
      setup_type: tradeForm.setup_type, alert_id: tradeForm.alert_id || null,
    });
    setTradeForm({ ...tradeForm, symbol: '', pnl: '' });
    load();
  };
  const seedTestAlert = async () => { await svc.addAlert({ source: 'hybrid_ai', symbol: 'NQ', setup_type: 'order_block', direction: 'long', message: 'Order block formed — setup appeared' }); setAlerts(await svc.getAlerts(50)); };

  const card = isDark ? 'bg-[#121817] border-[#243130]' : 'bg-white border-gray-200';
  const inp = `px-3 py-2 rounded-lg border bg-transparent text-sm ${isDark ? 'border-[#243130] text-white placeholder-gray-600' : 'border-gray-200 text-gray-900 placeholder-gray-400'}`;
  const ts = TYPE_STYLE[dt.type];

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}><Target className="w-6 h-6 text-teal-400" /> Trading Process</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Did I trade my setup — or did I trade random? Process over P&amp;L.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-white" style={{ background: ts.c }}>{dayName}: {ts.t}</span>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${tradingClosed ? 'border-red-500/40 text-red-400' : 'border-teal-500/40 text-teal-400'}`}>
            <Clock className="w-3 h-3 inline mr-1" />{tradingClosed ? 'Trading Closed (after 12pm)' : 'Session Open'}
          </span>
        </div>
      </div>

      {/* Adherence scorecard */}
      <section className={`rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-teal-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Setup adherence · last 30 days</h2></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Score label="On-setup trades" value={adh?.onSetupPct == null ? '—' : `${adh.onSetupPct}%`} sub={`${adh?.onSetup || 0}/${adh?.trades || 0}`} color="#2dd4bf" isDark={isDark} big />
          <Score label="Followed plan" value={adh?.followedPlanPct == null ? '—' : `${adh.followedPlanPct}%`} color="#60a5fa" isDark={isDark} />
          <Score label="Random trades" value={adh?.random ?? '—'} color="#f87171" isDark={isDark} />
          <Score label="Net P&L (log)" value={adh?.pnl != null ? `$${adh.pnl}` : '—'} color={adh?.pnl >= 0 ? '#2dd4bf' : '#f87171'} isDark={isDark} />
        </div>
        <p className={`text-[11px] mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Adherence is your real score. P&amp;L is tracked separately and never drives it.</p>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Alerts */}
        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Bell className="w-5 h-5 text-amber-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hybrid AI alerts</h2></div>
            <button onClick={seedTestAlert} className={`text-xs px-2 py-1 rounded-lg border ${card} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>+ test alert</button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {alerts.length === 0 && <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No alerts yet. Point your Hybrid AI / TradingView webhook at the URL below and setups will land here.</p>}
            {alerts.map(a => (
              <div key={a.id} className={`rounded-xl border p-3 ${isDark ? 'border-[#243130] bg-[#0e1413]' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{a.symbol || '—'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{a.setup_type || 'setup'}</span>
                    {a.direction && <span className={`text-[10px] ${a.direction === 'long' ? 'text-teal-400' : 'text-red-400'}`}>{a.direction}</span>}
                  </div>
                  <StatusPill status={a.status} />
                </div>
                {a.message && <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{a.message}</p>}
                <div className="flex items-center gap-1.5 mt-2">
                  <button onClick={() => markAlert(a.id, 'prepared')} className="text-[11px] px-2 py-1 rounded-md bg-blue-500/15 text-blue-400">Prepared</button>
                  <button onClick={() => markAlert(a.id, 'taken')} className="text-[11px] px-2 py-1 rounded-md bg-teal-500/15 text-teal-400">Taken</button>
                  <button onClick={() => markAlert(a.id, 'skipped')} className="text-[11px] px-2 py-1 rounded-md bg-gray-500/15 text-gray-400">Skipped</button>
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-4 rounded-xl border p-3 ${isDark ? 'border-[#243130] bg-[#0e1413]' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-1.5 mb-1"><Webhook className="w-3.5 h-3.5 text-teal-400" /><span className={`text-[11px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Your webhook URL (records only, never trades)</span></div>
            <div className="flex items-center gap-2">
              <code className={`text-[11px] flex-1 truncate ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{webhookUrl}</code>
              <button onClick={() => navigator.clipboard?.writeText(webhookUrl)} className={isDark ? 'text-gray-400' : 'text-gray-500'}><Copy className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </section>

        {/* Log trade */}
        <section className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-4"><Zap className="w-5 h-5 text-purple-400" /><h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Log a trade</h2></div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={tradeForm.symbol} onChange={e => setTradeForm({ ...tradeForm, symbol: e.target.value })} placeholder="Symbol (NQ)" className={inp} />
            <select value={tradeForm.direction} onChange={e => setTradeForm({ ...tradeForm, direction: e.target.value })} className={inp}>
              <option value="long" className={isDark ? 'bg-[#121817]' : ''}>Long</option>
              <option value="short" className={isDark ? 'bg-[#121817]' : ''}>Short</option>
            </select>
            <select value={tradeForm.setup_type} onChange={e => setTradeForm({ ...tradeForm, setup_type: e.target.value })} className={inp}>
              {['order_block', 'fvg', 'bias_break', 'liquidity_sweep', 'other'].map(s => <option key={s} value={s} className={isDark ? 'bg-[#121817]' : ''}>{s}</option>)}
            </select>
            <input value={tradeForm.pnl} onChange={e => setTradeForm({ ...tradeForm, pnl: e.target.value })} type="number" placeholder="P&L ($)" className={inp} />
          </div>
          <select value={tradeForm.alert_id} onChange={e => setTradeForm({ ...tradeForm, alert_id: e.target.value })} className={`${inp} w-full mb-2`}>
            <option value="" className={isDark ? 'bg-[#121817]' : ''}>Link to alert (optional)…</option>
            {alerts.map(a => <option key={a.id} value={a.id} className={isDark ? 'bg-[#121817]' : ''}>{a.symbol} · {a.setup_type} · {new Date(a.ts).toLocaleTimeString()}</option>)}
          </select>
          <div className="flex items-center gap-3 mb-3">
            <Toggle label="On my setup" value={tradeForm.on_setup} onChange={v => setTradeForm({ ...tradeForm, on_setup: v })} isDark={isDark} />
            <Toggle label="Followed plan" value={tradeForm.followed_plan} onChange={v => setTradeForm({ ...tradeForm, followed_plan: v })} isDark={isDark} />
          </div>
          <button onClick={logTrade} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"><Plus className="w-4 h-4" /> Log trade</button>

          <div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto">
            {trades.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  {t.on_setup ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{t.symbol} {t.direction}</span>
                  <span className={`${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{t.setup_type}</span>
                </span>
                <span className={`font-medium tabular-nums ${(+t.pnl || 0) >= 0 ? 'text-teal-400' : 'text-red-400'}`}>{t.pnl != null ? `$${t.pnl}` : '—'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Score({ label, value, sub, color, isDark, big }) {
  return (
    <div className={`rounded-xl p-3 ${isDark ? 'bg-[#0e1413]' : 'bg-gray-50'}`}>
      <p className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`${big ? 'text-2xl' : 'text-xl'} font-bold tabular-nums`} style={{ color }}>{value}</p>
      {sub && <p className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  );
}
function StatusPill({ status }) {
  const map = { fired: ['#f59e0b', 'fired'], prepared: ['#60a5fa', 'prepared'], taken: ['#2dd4bf', 'taken'], skipped: ['#8b93a7', 'skipped'], expired: ['#8b93a7', 'expired'] };
  const [c, t] = map[status] || map.fired;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: c + '26', color: c }}>{t}</span>;
}
function Toggle({ label, value, onChange, isDark }) {
  return (
    <button onClick={() => onChange(!value)} className="flex items-center gap-1.5">
      <span className={`w-9 h-5 rounded-full relative transition-colors ${value ? 'bg-teal-500' : isDark ? 'bg-[#243130]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-4' : 'left-0.5'}`} />
      </span>
      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{label}</span>
    </button>
  );
}
