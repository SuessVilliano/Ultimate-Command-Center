import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, BarChart3, Brain, CheckCircle2, Mic, MicOff, RefreshCw, ShieldCheck, Target, TrendingUp, WalletCards, Zap } from 'lucide-react';
import { API_URL } from '../config';
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
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.errors?.join('; ') || `Request failed (${response.status})`);
    return body;
  }, []);

  const loadStatus = useCallback(async () => {
    try { setStatus(await api('/api/trading/hybrid-journal/status')); }
    catch (e) { setError(e.message); }
  }, [api]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const run = async (name, fn) => {
    setBusy(name); setError('');
    try { await fn(); } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
  const connected = Boolean(status?.mcp?.configured);
  const fallback = Boolean(status?.fallback?.configured);
  const gatewayReady = Boolean(status?.executionGateway?.reachable);

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
  };

  const executeLive = async () => {
    const payload = broker === 'kraken'
      ? { broker, intent: orderPreview, confirmation: 'CONFIRM_LIVE_TRADE' }
      : { broker, text: orderText, confirmation: 'CONFIRM_LIVE_TRADE' };
    const data = await post('/api/trading/hybrid-journal/order-execute', payload);
    setExecutionResult(data.result);
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
            <span className={`px-3 py-1.5 rounded-full text-xs ${gatewayReady ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'}`}>{gatewayReady ? 'Execution Gateway online' : 'Gateway needs config'}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs ${connected ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'}`}>{connected ? 'Journal MCP connected' : 'Journal MCP needs config'}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs ${fallback ? 'bg-cyan-500/15 text-cyan-300' : 'bg-white/10 text-gray-400'}`}>{fallback ? 'REST fallback ready' : 'Fallback off'}</span>
            <button onClick={loadStatus} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

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
              <option value="live">Live</option>
            </select>
          </label>
          {broker === 'kraken' && <button onClick={() => run('account-state', loadKrakenState)} className="self-end px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 flex items-center gap-2"><WalletCards className="w-4 h-4" /> Positions & orders</button>}
        </div>

        <div className="mt-4 relative">
          <textarea value={orderText} onChange={e => { setOrderText(e.target.value); resetTradeState(); }} rows={3} placeholder={broker === 'kraken' ? 'Example: Buy $500 of Bitcoin on Kraken, stop loss at 62000, target at 70000' : 'Example: Buy 1 MNQ with stop loss ...'} className="w-full p-3 pr-14 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-600 outline-none focus:border-purple-500" />
          <button onClick={startVoice} title="Talk to trade" className={`absolute right-3 top-3 p-2 rounded-lg ${listening ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-cyan-300 hover:bg-white/10'}`}>
            {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
        {listening && <div className="mt-2 text-xs text-cyan-300">Listening… say the complete trade command.</div>}

        <div className="mt-3 flex flex-wrap gap-3 items-center">
          <button disabled={!orderText.trim() || busy === 'preview'} onClick={() => run('preview', previewOrder)} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm flex items-center gap-2"><Target className="w-4 h-4" /> Preview order</button>

          {orderPreview && broker === 'kraken' && executionMode === 'paper' &&
            <button disabled={busy === 'paper'} onClick={() => run('paper', executePaper)} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm">Execute paper trade</button>}

          {orderPreview && executionMode === 'live' && <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={liveConfirmed} onChange={e => setLiveConfirmed(e.target.checked)} /> I reviewed this exact order and want it sent live.</label>}
          {orderPreview && executionMode === 'live' && <button disabled={!liveConfirmed || busy === 'execute'} onClick={() => run('execute', executeLive)} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white text-sm">Execute live trade</button>}
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
