import React, { useMemo, useState } from 'react';
import { BookOpen, Check, Copy, ExternalLink, Search, ShieldCheck, Terminal, Zap } from 'lucide-react';

const SECTIONS = [
  {
    id: 'connect',
    title: 'Connect & verify',
    subtitle: 'Install once, confirm the CLI, then prove your API key can read the funded account.',
    commands: [
      ['Install Kraken CLI', "curl --proto '=https' --tlsv1.2 -LsSf https://github.com/krakenfx/kraken-cli/releases/latest/download/kraken-cli-installer.sh | sh", 'setup'],
      ['Check CLI + exchange', 'kraken status -o json', 'safe'],
      ['Show credential source', 'kraken auth show -o json', 'safe'],
      ['Test live authentication', 'kraken auth test -o json', 'read'],
      ['Show funded balances', 'kraken balance -o json', 'read'],
      ['Show margin / equity', 'kraken trade-balance --asset ZUSD -o json', 'read'],
      ['Show live positions', 'kraken positions --show-pnl -o json', 'read'],
      ['Show live open orders', 'kraken open-orders -o json', 'read'],
    ],
  },
  {
    id: 'paper-spot',
    title: 'Spot paper trading',
    subtitle: 'Real Kraken prices, simulated funds, no API key and no real money.',
    commands: [
      ['Create $10K paper workspace', 'kraken workspace create sandbox --capital 10000 --mode paper -o json', 'paper'],
      ['Use that workspace', 'export KRAKEN_WORKSPACE=sandbox', 'paper'],
      ['Paper balance', 'kraken paper balance -o json', 'paper'],
      ['Paper performance', 'kraken paper status -o json', 'paper'],
      ['Paper market buy', 'kraken paper buy BTCUSD 0.01 --type market -o json', 'paper'],
      ['Paper limit sell', 'kraken paper sell BTCUSD 0.005 --type limit --price 70000 -o json', 'paper'],
      ['Paper open orders', 'kraken paper orders -o json', 'paper'],
      ['Paper history', 'kraken paper history -o json', 'paper'],
      ['Reset paper account', 'kraken paper reset sandbox -o json', 'reset'],
    ],
  },
  {
    id: 'live-spot',
    title: 'Spot live trading',
    subtitle: 'Read first, validate the exact order, then send only after human confirmation.',
    commands: [
      ['Validate buy — does not submit', 'kraken order buy BTCUSD 0.001 --type limit --price 50000 --validate -o json', 'preview'],
      ['Validate sell — does not submit', 'kraken order sell BTCUSD 0.001 --type limit --price 100000 --validate -o json', 'preview'],
      ['LIVE market buy', 'kraken order buy BTCUSD 0.001 --type market -o json', 'live'],
      ['LIVE limit sell', 'kraken order sell BTCUSD 0.001 --type limit --price 100000 -o json', 'live'],
      ['Cancel one live order', 'kraken order cancel <ORDER_ID> -o json', 'live'],
      ['Dead-man switch: 60 seconds', 'kraken order cancel-after 60 -o json', 'live'],
      ['Closed orders', 'kraken closed-orders -o json', 'read'],
      ['Trade history', 'kraken trades-history -o json', 'read'],
    ],
  },
  {
    id: 'paper-futures',
    title: 'Futures paper trading',
    subtitle: 'Practice perpetuals with simulated leverage, margin, liquidation and funding.',
    commands: [
      ['Initialize futures paper', 'kraken futures paper init --balance 10000 -o json', 'paper'],
      ['Paper long BTC perpetual', 'kraken futures paper buy PF_XBTUSD 1 --leverage 10 --type market -o json', 'paper'],
      ['Paper short ETH perpetual', 'kraken futures paper sell PF_ETHUSD 5 --leverage 10 --type market -o json', 'paper'],
      ['Paper futures positions', 'kraken futures paper positions -o json', 'paper'],
      ['Paper futures balance', 'kraken futures paper balance -o json', 'paper'],
      ['Paper futures fills', 'kraken futures paper fills -o json', 'paper'],
      ['Paper futures history', 'kraken futures paper history -o json', 'paper'],
      ['Reset futures paper', 'kraken futures paper reset -o json', 'reset'],
    ],
  },
  {
    id: 'live-futures',
    title: 'Futures live account',
    subtitle: 'Futures uses a separate Kraken key pair from Spot. Start with read-only commands.',
    commands: [
      ['List tradable contracts', 'kraken futures instruments -o json', 'safe'],
      ['BTC perpetual quote', 'kraken futures ticker PF_XBTUSD -o json', 'safe'],
      ['Futures accounts', 'kraken futures accounts -o json', 'read'],
      ['Futures positions', 'kraken futures positions -o json', 'read'],
      ['Futures open orders', 'kraken futures open-orders -o json', 'read'],
      ['LIVE futures market buy', 'kraken futures order buy PF_XBTUSD 1 --type market -o json', 'live'],
      ['LIVE futures cancel', 'kraken futures cancel --order-id <ORDER_ID> -o json', 'live'],
    ],
  },
  {
    id: 'mcp',
    title: 'MCP & agent mode',
    subtitle: 'Give an AI client Kraken tools without wrapping shell commands yourself.',
    commands: [
      ['Default MCP: read + paper', 'kraken mcp', 'safe'],
      ['Guarded MCP: all services', 'kraken mcp -s all', 'guarded'],
      ['Selected MCP services', 'kraken mcp -s market,account,trade,paper,futures,futures-paper', 'guarded'],
      ['Interactive shell', 'kraken shell', 'safe'],
      ['Structured output pattern', 'kraken <command> [args...] -o json 2>/dev/null', 'safe'],
    ],
  },
];

const PLAIN_ENGLISH = [
  'Show my funded Kraken balances and open positions.',
  'Show my Kraken paper balance, open orders, and P&L.',
  'Preview buying $50 of SOL on Kraken paper. Do not send it live.',
  'Validate a live BTCUSD order, but do not execute it.',
  'List Kraken futures contracts that give Nasdaq or QQQ exposure.',
  'Compare BTC, ETH, and SOL using ticker, order book, and 1-hour candles.',
];

const TONES = {
  safe: 'text-cyan-200 border-cyan-500/20 bg-cyan-500/[.07]',
  setup: 'text-purple-200 border-purple-500/20 bg-purple-500/[.07]',
  read: 'text-emerald-200 border-emerald-500/20 bg-emerald-500/[.07]',
  paper: 'text-blue-200 border-blue-500/20 bg-blue-500/[.07]',
  preview: 'text-amber-200 border-amber-500/20 bg-amber-500/[.07]',
  guarded: 'text-amber-200 border-amber-500/20 bg-amber-500/[.07]',
  reset: 'text-orange-200 border-orange-500/20 bg-orange-500/[.07]',
  live: 'text-red-200 border-red-500/25 bg-red-500/[.08]',
};

function CopyButton({ text, id, copied, onCopy }) {
  return (
    <button onClick={() => onCopy(text, id)} className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:text-white" title="Copy command">
      {copied === id ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export default function KrakenCommandGuide() {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const normalized = query.trim().toLowerCase();
  const sections = useMemo(() => SECTIONS.map(section => ({
    ...section,
    commands: section.commands.filter(([label, command]) => !normalized || `${section.title} ${label} ${command}`.toLowerCase().includes(normalized)),
  })).filter(section => section.commands.length), [normalized]);

  const copy = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(current => current === id ? '' : current), 1500);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/35 via-[#080b12] to-cyan-950/25 p-5">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-purple-300"><Terminal className="h-4 w-4" />Official Kraken CLI</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Commands, shortcuts & safety map</h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">Copy exact commands for market research, Spot paper, funded Spot, Futures paper, funded Futures and Kraken’s built-in MCP server. Paper and live are deliberately separated.</p>
          </div>
          <a href="https://github.com/krakenfx/kraken-cli" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100"><ExternalLink className="h-3.5 w-3.5" />Official repository</a>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[.06] p-3"><div className="text-xs font-semibold text-blue-200">PAPER</div><p className="mt-1 text-xs text-gray-400">No keys. Live prices. Simulated fills and balances.</p></div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[.06] p-3"><div className="text-xs font-semibold text-amber-200">VALIDATE</div><p className="mt-1 text-xs text-gray-400">Checks a live order without submitting it.</p></div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/[.06] p-3"><div className="text-xs font-semibold text-red-200">LIVE</div><p className="mt-1 text-xs text-gray-400">Real money. Command Center confirmation remains required.</p></div>
        </div>

        <label className="relative mt-5 block max-w-2xl">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search: balance, SOL, futures, paper, MCP…" className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-purple-500" />
        </label>
      </section>

      <section className="rounded-2xl border border-emerald-500/15 bg-white/[.025] p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" /><div><h3 className="font-semibold text-white">Your default operating rule</h3><p className="mt-1 text-sm text-gray-400">Read account → paper trade → validate live order → review exact size and pair → confirm in the Trade Terminal. Withdrawal, transfer, and autonomous live shortcuts are intentionally excluded.</p></div></div>
        <p className="mt-3 border-t border-white/10 pt-3 text-xs text-gray-500">Architecture note: run the official Kraken MCP locally on your Mac/Juno. The cloud Trade Terminal uses the authenticated Hybrid Execution gateway; the local-first MCP should not be exposed publicly.</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map(section => (
          <section key={section.id} className="rounded-2xl border border-white/10 bg-[#0b0e15] p-4">
            <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-cyan-300" /><h3 className="font-semibold text-white">{section.title}</h3></div>
            <p className="mt-1 text-xs text-gray-500">{section.subtitle}</p>
            <div className="mt-4 space-y-2">
              {section.commands.map(([label, command, tone], index) => {
                const id = `${section.id}-${index}`;
                return (
                  <div key={id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-medium text-gray-200">{label}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TONES[tone] || TONES.safe}`}>{tone}</span></div>
                    <div className="flex items-start gap-2"><code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-lg bg-black/35 px-3 py-2 text-[11px] text-cyan-100">{command}</code><CopyButton text={command} id={id} copied={copied} onCopy={copy} /></div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-purple-500/15 bg-white/[.025] p-5">
        <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-300" /><h3 className="font-semibold text-white">Plain-English shortcuts for Juno</h3></div>
        <p className="mt-1 text-xs text-gray-500">Use these after the Kraken MCP connection reports authenticated. Any live-order request should end at the terminal confirmation screen.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {PLAIN_ENGLISH.map((phrase, index) => <button key={phrase} onClick={() => copy(phrase, `phrase-${index}`)} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left text-sm text-gray-200 hover:border-purple-500/30"><span>“{phrase}”</span>{copied === `phrase-${index}` ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4 shrink-0 text-gray-500" />}</button>)}
        </div>
      </section>
    </div>
  );
}
