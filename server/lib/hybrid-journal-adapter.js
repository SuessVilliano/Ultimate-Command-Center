/**
 * Hybrid Journal adapter (TradingProvider) — read-only.
 *
 * Pulls trade history from Hybrid Journal and normalizes it into hs_trades for
 * setup-adherence analysis. Configurable via env so it works with your token
 * without hard-coding an endpoint I couldn't verify:
 *
 *   HYBRID_JOURNAL_TOKEN   - bearer/api token (required)
 *   HYBRID_JOURNAL_URL     - API base, e.g. https://journal.tradehybrid.co/api
 *   HYBRID_JOURNAL_TRADES_PATH - path to the trades list (default: /trades)
 *   HYBRID_JOURNAL_AUTH_HEADER - header name (default: Authorization)
 *   HYBRID_JOURNAL_AUTH_SCHEME - prefix (default: "Bearer ")
 *
 * Never places or modifies orders. If the real API shape differs, only the
 * `normalize()` mapper below needs adjusting.
 */

import * as hs from './highest-self-db.js';

function cfg() {
  return {
    token: process.env.HYBRID_JOURNAL_TOKEN || null,
    base: process.env.HYBRID_JOURNAL_URL || '',
    path: process.env.HYBRID_JOURNAL_TRADES_PATH || '/trades',
    header: process.env.HYBRID_JOURNAL_AUTH_HEADER || 'Authorization',
    scheme: process.env.HYBRID_JOURNAL_AUTH_SCHEME ?? 'Bearer ',
  };
}
export function isConfigured() { const c = cfg(); return !!(c.token && c.base); }

/** Map a Hybrid Journal trade record to the internal hs_trades shape. */
function normalize(t = {}) {
  const dir = (t.direction || t.side || t.type || '').toString().toLowerCase();
  const setup = t.setup || t.setup_type || t.strategy || t.tag || null;
  return {
    symbol: t.symbol || t.ticker || t.instrument || t.market,
    direction: dir.includes('sell') || dir.includes('short') ? 'short' : dir ? 'long' : null,
    entry: num(t.entry ?? t.entry_price ?? t.open_price ?? t.avgEntry),
    exit: num(t.exit ?? t.exit_price ?? t.close_price ?? t.avgExit),
    size: num(t.size ?? t.quantity ?? t.qty ?? t.contracts),
    pnl: num(t.pnl ?? t.profit ?? t.realized_pnl ?? t.net),
    setup_type: setup,
    on_setup: t.on_setup != null ? (t.on_setup ? 1 : 0) : (setup ? 1 : 0),
    followed_plan: t.followed_plan != null ? (t.followed_plan ? 1 : 0) : 0,
    journal_ref: (t.id || t._id || t.trade_id || t.ref || '').toString(),
    notes: t.notes || t.comment || '',
  };
}
const num = (v) => (v == null || v === '' ? null : Number(v));

export async function fetchTrades({ limit = 200 } = {}) {
  const c = cfg();
  if (!isConfigured()) return { configured: false, trades: [] };
  try {
    const url = `${c.base.replace(/\/$/, '')}${c.path}?limit=${limit}`;
    const res = await fetch(url, { headers: { [c.header]: `${c.scheme}${c.token}` } });
    if (res.status === 401 || res.status === 403) return { configured: true, ok: false, reason: 'unauthorized', trades: [] };
    if (!res.ok) return { configured: true, ok: false, reason: `http_${res.status}`, trades: [] };
    const json = await res.json();
    const rows = Array.isArray(json) ? json : (json.trades || json.data || json.results || []);
    return { configured: true, ok: true, trades: rows.map(normalize) };
  } catch (e) {
    return { configured: true, ok: false, reason: e.message, trades: [] };
  }
}

/** Import Hybrid Journal trades into hs_trades (dedup by journal_ref). */
export async function sync({ limit = 200 } = {}) {
  const res = await fetchTrades({ limit });
  if (!res.configured) return { ok: false, reason: 'not_configured', imported: 0 };
  if (!res.ok) return { ok: false, reason: res.reason, imported: 0 };
  const existing = new Set(hs.listTrades(1000).map(t => t.journal_ref).filter(Boolean));
  let imported = 0;
  for (const t of res.trades) {
    if (t.journal_ref && existing.has(t.journal_ref)) continue;
    hs.addTrade(t); imported++;
  }
  return { ok: true, imported, fetched: res.trades.length };
}

export function status() {
  const c = cfg();
  return { configured: isConfigured(), base: c.base ? c.base.replace(/\/$/, '') + c.path : null };
}
