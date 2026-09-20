import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Brain, CheckCircle2, ExternalLink, Mic, MicOff, RefreshCw, ShieldCheck, Target, TrendingUp, WalletCards, Zap } from 'lucide-react';
import { API_URL } from '../config';
import { ownerSessionHeaders } from '../context/AuthContext';
import Trading from './Trading';

function ResultCard({ title, result }) {
  if (!result) return null;
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
      <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-80 overflow-y-auto">{text}</pre>
    </div>
  );
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value) {
  const number = asNumber(value);
  return number == null ? null : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(number);
}

function collectionSize(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

function accountDetails(mode, snapshot) {
  if (!snapshot?.ok) return { headline: null, detail: null, positions: 0, orders: 0 };
  if (mode === 'paper') {
    const usd = snapshot.account?.balances?.USD || snapshot.account?.balances?.ZUSD || {};
    const equity = snapshot.summary?.equity ?? usd.total ?? usd.available;
    return {
      headline: money(equity) || 'Paper ledger ready',
      detail: 'Simulated funds · live Kraken prices',
      positions: Math.max(0, Object.keys(snapshot.account?.balances || {}).length - 1),
      orders: collectionSize(snapshot.orders),
    };
  }

  const balances = snapshot.account?.balances || {};
  const tradeBalance = snapshot.account?.tradeBalance || {};
  const funded = Object.entries(balances).filter(([, value]) => (asNumber(value) || 0) > 0);
  const equity = tradeBalance.eb ?? tradeBalance.tb;
  return {
    headline: money(equity) || `${funded.length} funded asset${funded.length === 1 ? '' : 's'}`,
    detail: funded.length ? funded.slice(0, 4).map(([asset, value]) => `${asset} ${Number(value).toLocaleString()}`).join(' · ') : 'Authenticated Kraken account',
    positions: collectionSize(snapshot.positions),
    orders: collectionSize(snapshot.orders?.open || snapshot.orders),
  };
}

function KrakenAccountCard({ mode, snapshot, error, loading, configured, gatewayVerified, onRefresh }) {
  const connected = Boolean(snapshot?.ok);
  const details = accountDetails(mode, snapshot);
  const isLive = mode === 'live';
  let label = 'Not checked';
  let tone = 'border-white/10 bg-white/[.03] text-gray-400';
  if (loading) label = 'Checking broker…';
  else if (connected) { label = 'Connected'; tone = 'border-emerald-500/25 bg-emerald-500/[.06] text-emerald-300'; }
  else if (!gatewayVerified) { label = 'Gateway unavailable'; tone = 'border-red-500/25 bg-red-500/[.06] text-red-300'; }
  else if (isLive && !configured) { label = 'API key required'; tone = 'border-amber-500/25 bg-amber-500/[.06] text-amber-300'; }
  else if (error) { label = 'Authentication failed'; tone = 'border-red-500/25 bg-red-500/[.06] text-red-300'; }

  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[.18em] opacity-75">Kraken {mode}</div>
          <div className="mt-1 text-base font-semibold text-white">{isLive ? 'Funded live account' : 'Paper account'}</div>
        </div>
        <span className="rounded-full border border-current/20 px-2.5 py-1 text-[11px] font-semibold">{label}</span>
      </div>

      {connected ? (
        <>
          <div className="mt-5 text-2xl font-bold text-white">{details.headline}</div>
          <div className="mt-1 text-xs text-gray-400 break-words">{details.detail}</div>
          <div className="mt-4 flex gap-4 text-xs text-gray-400"><span>{details.positions} positions</span><span>{details.orders} open orders</span></div>
        </>
      ) : (
        <div className="mt-5 min-h-[68px] text-sm text-gray-300">
          {error || (isLive && !configured
            ? 'Add a least-privilege Kraken Spot API key to the execution service, then recheck. Withdraw permission is not needed.'
            : 'Waiting for the verified Hybrid Execution gateway.')}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onRefresh} disabled={loading || !gatewayVerified || (isLive && !configured)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-200 disabled:opacity-35">
          <RefreshCw className={`mr-1.5 inline h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Recheck
        </button>
        {isLive && !configured && <a href="https://support.kraken.com/articles/360000919966-how-to-create-an-api-key" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"><ExternalLink className="mr-1.5 inline h-3.5 w-3.5" />API key guide</a>}
      </div>
    </article>
  );
}

export default function TradingCommandCenter() {
  const [status, setStatus] = useState(null);
  const [symbol, setSymbol] = useState('MNQ');
  const [busy, setBusy] = useState('');
  const [briefing, setBriefing] = useState(null);
  const [regime, setRegime] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [broker, setBroker] = useState('kraken');
  const [executionMode, setExecutionMode] = useState('paper');
  const [orderText, setOrderText] = useState('');
  const [orderPreview, setOrderPreview] = useState(null);
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [positions, setPositions] = useState(null);
  const [orders, setOrders] = useState(null);
  const [accountSnapshots, setAccountSnapshots] = useState({ paper: null, live: null });
  const [accountErrors, setAccountErrors] = useState({ paper: '', live: '' });
  const [accountLoading, setAccountLoading] = useState({ paper: false, live: false });
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...ownerSessionHeaders(), ...(options.headers || {}) },
      ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.errors?.join('; ') || `Request failed (${response.status})`);
    return body;
  }, []);

  const loadAccountSnapshot = useCallback(async (mode) => {
    setAccountLoading(current => ({ ...current, [mode]: true }));
    setAccountErrors(current => ({ ...current, [mode]: '' }));
    try {
      const data = await api(`/api/trading/execution/account-snapshot?broker=kraken&mode=${encodeURIComponent(mode)}`);
      setAccountSnapshots(current => ({ ...current, [mode]: data }));
      return data;
    } catch (e) {
      setAccountSnapshots(current => ({ ...current, [mode]: null }));
      setAccountErrors(current => ({ ...current, [mode]: e.message }));
      throw e;
    } finally {
      setAccountLoading(current => ({ ...current, [mode]: false }));
    }
  }, [api]);

  const loadStatus = useCallback(async () => {
    try {
      const next = await api('/api/trading/hybrid-journal/status');
      setStatus(next);
      const verified = Boolean(next?.executionGateway?.reachable && next?.executionGateway?.verified);
      if (!verified) {
        setAccountSnapshots({ paper: null, live: null });
        setExecutionMode('paper');
        setOrderPreview(null);
        setExecutionResult(null);
        setLiveConfirmed(false);
        return;
      }
      const checks = [loadAccountSnapshot('paper')];
      if (next?.executionGateway?.kraken?.liveConfigured) checks.push(loadAccountSnapshot('live'));
      else {
        setAccountSnapshots(current => ({ ...current, live: null }));
        setAccountErrors(current => ({ ...current, live: '' }));
      }
      await Promise.allSettled(checks);
    } catch (e) { setError(e.message); }
  }, [api, loadAccountSnapshot]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const run = async (name, fn) => {
    setBusy(name); setError('');
    try { await fn(); } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
  const connected = Boolean(status?.connected);
  const fallback = Boolean(status?.fallback?.configured);
  const gatewayReady = Boolean(status?.executionGateway?.reachable && status?.executionGateway?.verified);
  const paperReady = Boolean(accountSnapshots.paper?.ok);
  const liveConfigured = Boolean(status?.executionGateway?.kraken?.liveConfigured);
  const liveReady = Boolean(accountSnapshots.live?.ok);

  useEffect(() => {
    if (executionMode !== 'live' || (gatewayReady && liveReady)) return;
    setExecutionMode('paper');
    setOrderPreview(null);
    setExecutionResult(null);
    setLiveConfirmed(false);
  }, [executionMode, gatewayReady, liveReady]);

  const resetTradeState = () => {
    setOrderPreview(null);
    setExecutionResult(null);
    setLiveConfirmed(false);
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Browser speech recognition is unavailable here. Type the trade command instead.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop?.();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { setListening(true); setError(''); };
    recognition.onend = () => setListening(false);
    recognition.onerror = event => { setListening(false); setError(`Voice input failed: ${event.error}`); };
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim();
      if (transcript) {
        setOrderText(transcript);
        resetTradeState();
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const previewOrder = async () => {
    const data = await post('/api/trading/hybrid-journal/order-preview', {
      text: orderText,
      broker,
      mode: executionMode,
    });
    setOrderPreview(data.preview);
    setExecutionResult(null);
    setLiveConfirmed(false);
  };

  const executePaper = async () => {
    const data = await post('/api/trading/hybrid-journal/order-paper', {
      text: orderText,
      broker: 'kraken',
      intent: orderPreview,
    });
    setExecutionResult(data.result);
    await loadAccountSnapshot('paper');
  };

  const executeLive = async () => {
    if (broker === 'kraken' && (!gatewayReady || !liveReady)) throw new Error('Kraken live account verification was lost. Reconnect and preview the order again.');
    const payload = broker === 'kraken'
      ? { broker, intent: orderPreview, confirmation: 'CONFIRM_LIVE_TRADE' }
      : { broker, text: orderText, confirmation: 'CONFIRM_LIVE_TRADE' };
    const data = await post('/api/trading/hybrid-journal/order-execute', payload);
    setExecutionResult(data.result);
    if (broker === 'kraken') await loadAccountSnapshot('live');
  };

  const loadKrakenState = async () => {
    const query = `broker=kraken&mode=${encodeURIComponent(executionMode)}`;
    const [p, o] = await Promise.all([
      api(`/api/trading/execution/positions?${query}`),
      api(`/api/trading/execution/orders?${query}`),
    ]);
    setPositions(p);
    setOrders(o);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-black/20 to-cyan-950/20 p-5">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold uppercase tracking-wider"><Zap className="w-4 h-4" /> Hybrid Trading OS</div>
            <h1 className="mt-2 text-2xl font-bold text-white">Trading Command Center</h1>
            <p className="mt-1 text-sm text-gray-400 max-w-3xl">One operating surface for TradingView intelligence, Hybrid Journal, Kraken, cTrader and futures execution. Orders are normalized into a shared intent before they ever reach a broker.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`px-3 py-1.5 rounded-full text-xs ${gatewayReady ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>{gatewayReady ? 'Execution Gateway verified' : 'Gateway not verified'}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs ${connected ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'}`}>{connected ? 'Journal MCP connected' : 'Journal MCP needs config'}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs ${paperReady ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/10 text-gray-400'}`}>{paperReady ? 'Kraken paper ready' : 'Paper unchecked'}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs ${liveReady ? 'bg-emerald-500/15 text-emerald-300' : liveConfigured ? 'bg-amber-500/15 text-amber-300' : 'bg-white/10 text-gray-400'}`}>{liveReady ? 'Kraken live connected' : liveConfigured ? 'Live auth needs check' : 'Live key needed'}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs ${fallback ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/10 text-gray-400'}`}>{fallback ? 'REST fallback ready' : 'Fallback off'}</span>
            <button onClick={() => run('connections', loadStatus)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"><RefreshCw className={`w-4 h-4 ${busy === 'connections' ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        {status && !gatewayReady && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200"><AlertTriangle className="mr-2 inline h-4 w-4" />{status.executionGateway?.error || 'The configured execution service did not pass its contract check.'}</div>}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <button onClick={() => run('snapshot', async () => setSnapshot(await api('/api/trading/hybrid-journal/snapshot')))} className="text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
            <Activity className="w-5 h-5 text-cyan-300" /><div className="mt-2 text-white font-medium">Sync signals + trades</div><div className="text-xs text-gray-500">Pull the latest Hybrid Journal records</div>
          </button>
          <button onClick={() => run('briefing', async () => setBriefing((await post('/api/trading/hybrid-journal/briefing', { symbol, use_bible: true })).result))} className="text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
            <Brain className="w-5 h-5 text-purple-300" /><div className="mt-2 text-white font-medium">QQE briefing</div><div className="text-xs text-gray-500">Regime + 14-factor trade plan</div>
          </button>
          <button onClick={() => run('regime', async () => setRegime((await post('/api/trading/hybrid-journal/regime', { symbol, action: 'analyze' })).result))} className="text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
            <TrendingUp className="w-5 h-5 text-green-300" /><div className="mt-2 text-white font-medium">Market cause</div><div className="text-xs text-gray-500">What is driving the market now</div>
          </button>
          <button onClick={() => run('analysis', async () => setAnalysis((await post('/api/trading/hybrid-journal/analyze', { analysisType: 'weekly_summary' })).result))} className="text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
            <BarChart3 className="w-5 h-5 text-orange-300" /><div className="mt-2 text-white font-medium">Performance review</div><div className="text-xs text-gray-500">Analyze this week's trading</div>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-500">Focus symbol</label>
          <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className="w-28 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white outline-none focus:border-purple-500" />
          {busy && <span className="text-xs text-cyan-300 flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Running {busy}…</span>}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ResultCard title="Latest sync" result={snapshot} />
        <ResultCard title={`${symbol} QQE briefing`} result={briefing} />
        <ResultCard title={`${symbol} market regime`} result={regime} />
        <ResultCard title="Trading performance analysis" result={analysis} />
      </section>

      <section className="rounded-2xl border border-cyan-500/15 bg-white/[0.025] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-white font-semibold"><WalletCards className="h-5 w-5 text-cyan-300" />Kraken accounts</div>
            <p className="mt-1 text-sm text-gray-500">Paper and funded live are checked independently. “Connected” means a broker account read succeeded—not merely that a server answered.</p>
          </div>
          <button onClick={() => run('accounts', async () => { await Promise.allSettled([loadAccountSnapshot('paper'), ...(liveConfigured ? [loadAccountSnapshot('live')] : [])]); })} disabled={!gatewayReady || busy === 'accounts'} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 disabled:opacity-35"><RefreshCw className={`mr-1.5 inline h-3.5 w-3.5 ${busy === 'accounts' ? 'animate-spin' : ''}`} />Refresh both</button>
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <KrakenAccountCard mode="paper" snapshot={accountSnapshots.paper} error={accountErrors.paper} loading={accountLoading.paper} configured gatewayVerified={gatewayReady} onRefresh={() => loadAccountSnapshot('paper').catch(() => {})} />
          <KrakenAccountCard mode="live" snapshot={accountSnapshots.live} error={accountErrors.live} loading={accountLoading.live} configured={liveConfigured} gatewayVerified={gatewayReady} onRefresh={() => loadAccountSnapshot('live').catch(() => {})} />
        </div>
      </section>

      <section className="rounded-2xl border border-red-500/15 bg-white/[0.03] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-green-300 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Text / Talk to Trade</h2>
            <p className="text-sm text-gray-500 mt-1">Speak or type what you want. Preview creates a broker-neutral TradeIntent; paper execution is immediate after preview, while live execution remains locked behind explicit confirmation.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="text-xs text-gray-500 flex flex-col gap-1">Execution rail
            <select value={broker} onChange={e => { setBroker(e.target.value); resetTradeState(); }} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white">
              <option value="kraken">Kraken</option>
              <option value="hybrid-journal">Hybrid Journal / Futures</option>
            </select>
          </label>
          <label className="text-xs text-gray-500 flex flex-col gap-1">Mode
            <select value={executionMode} onChange={e => { setExecutionMode(e.target.value); resetTradeState(); }} disabled={broker !== 'kraken'} className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white disabled:opacity-50">
              <option value="paper">Paper</option>
              <option value="live" disabled={!liveReady}>Live{liveReady ? '' : ' (connect account first)'}</option>
            </select>
          </label>
          {broker === 'kraken' && <button disabled={!gatewayReady || (executionMode === 'live' && !liveReady)} onClick={() => run('account-state', loadKrakenState)} className="self-end px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-35 text-sm text-gray-300 flex items-center gap-2"><WalletCards className="w-4 h-4" /> Positions & orders</button>}
        </div>

        <div className="mt-4 relative">
          <textarea value={orderText} onChange={e => { setOrderText(e.target.value); resetTradeState(); }} rows={3} placeholder={broker === 'kraken' ? 'Example: Buy $500 of Bitcoin on Kraken, stop loss at 62000, target at 70000' : 'Example: Buy 1 MNQ with stop loss ...'} className="w-full p-3 pr-14 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-600 outline-none focus:border-purple-500" />
          <button onClick={startVoice} title="Talk to trade" className={`absolute right-3 top-3 p-2 rounded-lg ${listening ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-cyan-300 hover:bg-white/10'}`}>
            {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
        {listening && <div className="mt-2 text-xs text-cyan-300">Listening… say the complete trade command.</div>}

        <div className="mt-3 flex flex-wrap gap-3 items-center">
          <button disabled={!orderText.trim() || busy === 'preview' || (broker === 'kraken' && (!gatewayReady || (executionMode === 'live' && !liveReady)))} onClick={() => run('preview', previewOrder)} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm flex items-center gap-2"><Target className="w-4 h-4" /> Preview order</button>

          {orderPreview && broker === 'kraken' && executionMode === 'paper' &&
            <button disabled={busy === 'paper'} onClick={() => run('paper', executePaper)} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm">Execute paper trade</button>}

          {orderPreview && executionMode === 'live' && <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={liveConfirmed} onChange={e => setLiveConfirmed(e.target.checked)} /> I reviewed this exact order and want it sent live.</label>}
          {orderPreview && executionMode === 'live' && <button disabled={!liveConfirmed || !gatewayReady || !liveReady || busy === 'execute'} onClick={() => run('execute', executeLive)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-sm">Execute live trade</button>}
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResultCard title="Order preview — NOT LIVE" result={orderPreview} />
          <ResultCard title="Execution result" result={executionResult} />
          <ResultCard title={`Kraken ${executionMode} positions`} result={positions} />
          <ResultCard title={`Kraken ${executionMode} orders`} result={orders} />
        </div>
        {executionResult && <div className="mt-3 text-xs text-green-300 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Execution returned successfully. Verify the broker/account state above before issuing a follow-up command.</div>}
      </section>

      <section className="pt-2 border-t border-white/10">
        <div className="mb-4"><h2 className="text-lg font-semibold text-white">Markets & research</h2><p className="text-sm text-gray-500">Your existing market-data tools remain below the shared execution layer.</p></div>
        <Trading />
      </section>
    </div>
  );
}
