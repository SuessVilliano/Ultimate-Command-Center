/**
 * Hybrid Journal adapter (TradingProvider) — read-only.
 *
 * Hybrid Journal is a Base44 app. Its data API is:
 *   GET https://hybridjournal.base44.app/api/functions/apiData?entity=Trade&action=list
 *   header:  api_key: <your key>
 *
 * Pulls Trades (for setup-adherence) and, best-effort, Signals (into alerts).
 * Configurable via env so nothing secret is hard-coded:
 *
 *   HYBRID_JOURNAL_TOKEN        - the api_key value (required)
 *   HYBRID_JOURNAL_URL          - apiData base (default below)
 *   HYBRID_JOURNAL_ENTITY       - trades entity name (default: Trade)
 *   HYBRID_JOURNAL_SIGNAL_ENTITY- signals entity name (default: Signal)
 *   HYBRID_JOURNAL_AUTH_HEADER  - auth header name (default: api_key)
 *   HYBRID_JOURNAL_AUTH_SCHEME  - value prefix (default: "" — raw key)
 *   HYBRID_JOURNAL_STYLE        - "base44" (default) | "path"
 *   HYBRID_JOURNAL_TRADES_PATH  - only for style=path (default: /trades)
 *
 * Never places or modifies orders.
 */

import * as hs from './highest-self-db.js';

function cfg() {
  return {
    token: process.env.HYBRID_JOURNAL_TOKEN || process.env.HYBRID_JOURNAL_API_KEY || null,
    base: process.env.HYBRID_JOURNAL_URL || 'https://hybridjournal.base44.app/api/functions/apiData',
    entity: process.env.HYBRID_JOURNAL_ENTITY || 'Trade',
    signalEntity: process.env.HYBRID_JOURNAL_SIGNAL_ENTITY || 'Signal',
    header: process.env.HYBRID_JOURNAL_AUTH_HEADER || 'api_key',
    scheme: process.env.HYBRID_JOURNAL_AUTH_SCHEME ?? '',
    style: process.env.HYBRID_JOURNAL_STYLE || 'base44',
    path: process.env.HYBRID_JOURNAL_TRADES_PATH || '/trades',
  };
}
export function isConfigured() { const c = cfg(); return !!(c.token && c.base); }

function buildUrl(c, entity, limit) {
  if (c.style === 'path') return `${c.base.replace(/\/$/, '')}${c.path}?limit=${limit}`;
  const sep = c.base.includes('?') ? '&' : '?';
  return `${c.base}${sep}entity=${encodeURIComponent(entity)}&action=list`;
}

async function fetchEntity(entity, { limit = 200 } = {}) {
  const c = cfg();
  if (!isConfigured()) return { configured: false, rows: [] };
  try {
    const url = buildUrl(c, entity, limit);
    const headers = { [c.header]: c.scheme ? `${c.scheme}${c.token}` : c.token };
    const res = await fetch(url, { headers });
    if (res.status === 401 || res.status === 403) return { configured: true, ok: false, reason: 'unauthorized', rows: [] };
    if (!res.ok) return { configured: true, ok: false, reason: `http_${res.status}`, rows: [] };
    const json = await res.json();
    const rows = Array.isArray(json)
      ? json
      : (json.data || json.records || json.results || json.rows || json.items || json[`${entity}s`] || json[entity] || []);
    return { configured: true, ok: true, rows: Array.isArray(rows) ? rows.slice(0, limit) : [] };
  } catch (e) {
    return { configured: true, ok: false, reason: e.message, rows: [] };
  }
}

const num = (v) => (v == null || v === '' ? null : Number(v));

/** Map a Hybrid Journal trade record to hs_trades shape (tolerant of naming). */
function normalizeTrade(t = {}) {
  const dir = (t.direction || t.side || t.type || t.position || '').toString().toLowerCase();
  const setup = t.setup || t.setup_type || t.strategy || t.pattern || t.tag || null;
  return {
    symbol: t.symbol || t.ticker || t.instrument || t.market || t.pair,
    direction: dir.includes('sell') || dir.includes('short') ? 'short' : dir ? 'long' : null,
    entry: num(t.entry ?? t.entry_price ?? t.entryPrice ?? t.open_price ?? t.avgEntry),
    exit: num(t.exit ?? t.exit_price ?? t.exitPrice ?? t.close_price ?? t.avgExit),
    size: num(t.size ?? t.quantity ?? t.qty ?? t.contracts ?? t.lots),
    pnl: num(t.pnl ?? t.profit ?? t.realized_pnl ?? t.realizedPnl ?? t.net ?? t.result),
    setup_type: setup,
    on_setup: t.on_setup != null ? (t.on_setup ? 1 : 0) : (setup ? 1 : 0),
    followed_plan: t.followed_plan != null ? (t.followed_plan ? 1 : 0) : (t.followedPlan ? 1 : 0),
    journal_ref: (t.id || t._id || t.trade_id || t.ref || t.uid || '').toString(),
    notes: t.notes || t.comment || t.description || '',
  };
}

/** Map a Hybrid Journal signal record to hs_trade_alerts shape. */
function normalizeSignal(s = {}) {
  const dir = (s.direction || s.side || s.action || s.type || '').toString().toLowerCase();
  return {
    source: 'hybrid_journal',
    symbol: s.symbol || s.ticker || s.pair || s.instrument,
    setup_type: s.setup || s.setup_type || s.pattern || s.strategy || null,
    level: num(s.level ?? s.price ?? s.entry),
    direction: dir.includes('sell') || dir.includes('short') ? 'short' : dir.includes('buy') || dir.includes('long') ? 'long' : null,
    timeframe: s.timeframe || s.tf || null,
    message: s.message || s.comment || s.text || s.note || '',
    status: 'fired',
    ref: (s.id || s._id || s.signal_id || '').toString(),
  };
}

export async function fetchTrades({ limit = 200 } = {}) {
  const c = cfg();
  const r = await fetchEntity(c.entity, { limit });
  return { ...r, trades: (r.rows || []).map(normalizeTrade) };
}

/** Import trades into hs_trades (dedup by journal_ref). */
export async function sync({ limit = 200 } = {}) {
  const res = await fetchTrades({ limit });
  if (!res.configured) return { ok: false, reason: 'not_configured', imported: 0 };
  if (!res.ok) return { ok: false, reason: res.reason, imported: 0 };
  const existing = new Set(hs.listTrades(2000).map(t => t.journal_ref).filter(Boolean));
  let imported = 0;
  for (const t of res.trades) {
    if (t.journal_ref && existing.has(t.journal_ref)) continue;
    hs.addTrade(t); imported++;
  }
  // Best-effort signals -> alerts (ignore if the Signal entity doesn't exist).
  let signals = 0;
  const c = cfg();
  const sr = await fetchEntity(c.signalEntity, { limit });
  if (sr.ok) {
    const seen = new Set(hs.listAlerts(500).map(a => a.message));
    for (const raw of sr.rows) {
      const s = normalizeSignal(raw);
      if (s.message && seen.has(s.message)) continue;
      hs.addAlert(s); signals++;
    }
  }
  return { ok: true, imported, fetched: res.trades.length, signals };
}

/**
 * Preview: fetch the first Trade record and report its FIELD NAMES only (no
 * values) plus which internal fields resolved — so mapping can be finalized
 * without exposing trade data.
 */
export async function preview() {
  const c = cfg();
  const r = await fetchEntity(c.entity, { limit: 1 });
  if (!r.configured) return { configured: false };
  if (!r.ok) return { configured: true, ok: false, reason: r.reason };
  const first = r.rows[0];
  if (!first) return { configured: true, ok: true, count: 0, rawKeys: [], resolved: {} };
  const mapped = normalizeTrade(first);
  const resolved = Object.fromEntries(Object.entries(mapped).map(([k, v]) => [k, v != null && v !== '']));
  return { configured: true, ok: true, count: r.rows.length, rawKeys: Object.keys(first), resolved };
}

export function status() {
  const c = cfg();
  return { configured: isConfigured(), base: c.base, entity: c.entity, style: c.style, header: c.header };
}
