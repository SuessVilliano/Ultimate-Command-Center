import React, { useState } from 'react';
import { Activity, Bot, ExternalLink, Send, ShieldCheck, Wrench } from 'lucide-react';
import { API_URL } from '../config';
import TradingCommandCenter from './TradingCommandCenter';
import TradingProcessLive from './TradingProcessLive';

const ABATEV_URL = import.meta.env.VITE_ABATEV_URL || 'https://abatev.tradehybrid.co';

const TABS = [
  ['terminal', 'Trade Terminal'],
  ['abatev', 'ABATEV'],
  ['chat', 'Trader Chat'],
  ['ecosystem', 'Ecosystem'],
];

export default function TradingHub() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('liv8_trading_hub_tab') || 'terminal'; } catch { return 'terminal'; }
  });

  const choose = (id) => {
    setTab(id);
    try { localStorage.setItem('liv8_trading_hub_tab', id); } catch {}
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-500/20 bg-[#080b12] overflow-hidden">
        <div className="px-4 py-4 border-b border-white/10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[.22em] text-cyan-300">LIV8 Trading OS</div>
            <h1 className="text-2xl font-bold text-white mt-1">Trading Hub</h1>
            <p className="text-sm text-gray-500 mt-1">Execution terminal · ABATEV · source-backed trader chat · Hybrid ecosystem.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => choose(id)}
                className={`px-3 py-2 rounded-lg border text-xs sm:text-sm ${tab === id
                  ? 'bg-cyan-500/15 border-cyan-400/35 text-cyan-100'
                  : 'bg-white/[.03] border-white/10 text-gray-400 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {tab === 'terminal' && <TradingCommandCenter />}
      {tab === 'abatev' && <AbatevPanel />}
      {tab === 'chat' && <TradingLeadChat />}
      {tab === 'ecosystem' && <TradingProcessLive />}
    </div>
  );
}

function AbatevPanel() {
  const [frameKey, setFrameKey] = useState(0);

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-[#080b12] overflow-hidden">
      <header className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white font-semibold"><Activity className="w-4 h-4 text-cyan-300" />ABATEV</div>
          <p className="text-xs text-gray-500 mt-1">Strategy, account and execution workspace inside Trading Hub.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFrameKey(v => v + 1)} className="px-3 py-2 rounded-lg bg-white/5 text-xs text-gray-300">Reload</button>
          <button onClick={() => window.open(ABATEV_URL, '_blank', 'noopener,noreferrer')} className="px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-xs text-cyan-100">
            <ExternalLink className="w-3.5 h-3.5 inline mr-1" />Open full ABATEV
          </button>
        </div>
      </header>
      <div className="m-4 rounded-xl border border-amber-500/20 bg-amber-500/[.06] p-3 text-xs text-amber-100">
        If ABATEV blocks iframe embedding, use “Open full ABATEV.” Trading Hub remains the controlling surface for Juno, risk checks and broker execution.
      </div>
      <div className="relative h-[760px] bg-black">
        <iframe
          key={frameKey}
          src={ABATEV_URL}
          title="ABATEV"
          className="absolute inset-0 w-full h-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      </div>
    </section>
  );
}

function TradingLeadChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setError('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    const context = [
      'You are the LIV8 Trading Lead inside the Trading Hub.',
      'Stay focused on trading, Hybrid Journal, Trading Guardian, QQE, market regime, positions, orders, risk, ABATEV, Hybrid Copy, Kraken, cTrader, futures and broker state.',
      'Use live connected sources when relevant and never fabricate market/account data.',
      'Do not silently place a live trade from chat. If the user wants to trade, help formulate or analyze the order and direct live execution through the Trading Hub terminal with its explicit confirmation gate.',
      '',
    ].join(' ');

    try {
      const response = await fetch(`${API_URL}/api/commander/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `${context}${text}` }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `AI HTTP ${response.status}`);

      const content = data.response?.content || data.response || data.message || 'No response returned.';
      setMessages(prev => [...prev, {
        role: 'agent',
        content,
        toolsUsed: data.toolsUsed || [],
        approvalRequired: data.approvalRequired,
      }]);
    } catch (e) {
      setError(e.message || 'Trading Lead request failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-purple-500/20 bg-[#0b0d14] overflow-hidden min-h-[720px] flex flex-col">
      <header className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-white"><Bot className="w-4 h-4 text-purple-300" />Trading Lead</div>
          <div className="text-xs text-gray-500 mt-1">Juno trading specialist · source-backed reads · live execution stays in the terminal.</div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300"><ShieldCheck className="w-4 h-4" />Guarded execution</div>
      </header>

      <div className="flex-1 p-4 space-y-3 overflow-auto bg-black/10">
        {messages.length === 0 && (
          <div className="h-full grid place-items-center text-center">
            <div>
              <Bot className="w-10 h-10 text-purple-400 mx-auto" />
              <div className="text-white font-medium mt-3">Talk to your Trading Lead</div>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">Ask for MNQ/QQE context, current signals, market cause, open positions, performance, broker status, ABATEV logic or help preparing an order.</p>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`max-w-3xl rounded-xl p-3 ${m.role === 'user'
            ? 'ml-auto bg-purple-600/20 border border-purple-500/20'
            : 'bg-white/[.04] border border-white/10'}`}>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{m.role === 'user' ? 'You' : 'Trading Lead'}</div>
            <div className="text-sm text-gray-200 whitespace-pre-wrap">{m.content}</div>
            {m.toolsUsed?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.toolsUsed.map((t, j) => (
                  <span key={j} className={`text-[10px] px-2 py-1 rounded-full border ${t.ok ? 'text-emerald-300 border-emerald-500/20' : 'text-amber-300 border-amber-500/20'}`}>
                    <Wrench className="w-3 h-3 inline mr-1" />{t.name}
                  </span>
                ))}
              </div>
            )}
            {m.approvalRequired && <div className="mt-2 text-xs text-amber-300">Action requires approval / terminal confirmation.</div>}
          </div>
        ))}

        {sending && <div className="text-sm text-gray-500">Trading Lead is checking live systems…</div>}
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      </div>

      <footer className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask Trading Lead about a setup, account, position, signal or trade plan…"
            className="min-h-[56px] max-h-36 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white resize-none"
          />
          <button onClick={send} disabled={sending || !input.trim()} className="px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </section>
  );
}
