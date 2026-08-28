// Canonical event contract for Hybrid AI / TradingView alerts entering Command Center.
// This file exists so future webhook, email, Hybrid Journal and agent routes share one schema.

export function normalizeTradingAlert({ source = 'hybrid_ai', type, symbol, side, price, receivedAt, raw, metadata = {} } = {}) {
  return {
    source,
    type: type || 'UNKNOWN',
    symbol: symbol ? String(symbol).toUpperCase() : null,
    side: side || null,
    price: Number.isFinite(Number(price)) ? Number(price) : null,
    receivedAt: receivedAt || new Date().toISOString(),
    raw: raw || null,
    metadata,
    classification: String(type || '').startsWith('ENTRY_') ? 'entry_candidate' : String(type || '').includes('HIT') ? 'trade_lifecycle' : 'unknown',
    requiresGuardianQualification: String(type || '').startsWith('ENTRY_'),
    executionIntent: false,
  };
}
