const asNum = v => Number.isFinite(Number(v)) ? Number(v) : null;
const upper = v => v == null ? null : String(v).trim().toUpperCase();

function enabled() {
  return ['1','true','yes','on'].includes(String(process.env.DX_FUTURES_HF_ENABLED || '').toLowerCase());
}

function authHeaders() {
  const token = process.env.DX_FUTURES_HF_ACCESS_TOKEN;
  const scheme = process.env.DX_FUTURES_HF_AUTH_SCHEME || 'Bearer';
  const extraHeader = process.env.DX_FUTURES_HF_AUTH_HEADER;
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `${scheme} ${token}`.trim();
  if (extraHeader && token) headers[extraHeader] = token;
  return headers;
}

export function dxFuturesHybridFundingStatus() {
  return {
    id: 'DX_FUTURES_HYBRID_FUNDING',
    provider: 'dx_futures',
    environment: process.env.DX_FUTURES_HF_ENVIRONMENT || 'demo',
    live: String(process.env.DX_FUTURES_HF_ENVIRONMENT || 'demo').toLowerCase() === 'live',
    enabled: enabled(),
    orderConfigured: Boolean(process.env.DX_FUTURES_HF_ORDER_URL && process.env.DX_FUTURES_HF_ACCESS_TOKEN),
    publicTrackingConfigured: Boolean(process.env.DX_FUTURES_HF_PUBLIC_URL),
    importTrackingSupported: true,
    capabilities: ['orders_if_provider_api_enabled','public_tracking','account_import','positions_if_endpoint_enabled'],
    note: 'DXtrade API availability is controlled by the broker/prop firm. This adapter uses provider-supplied endpoints only and falls back to public/read-only tracking or imported account data.'
  };
}

export function mapDxFuturesSymbol(symbol) {
  const raw = upper(symbol || '');
  return process.env[`JUNO_SYMBOL_DX_FUTURES_HYBRID_FUNDING_${raw}`] || process.env[`JUNO_SYMBOL_${raw}`] || raw;
}

export function dxFuturesSize(symbol, fallback = 1) {
  const raw = upper(symbol || '');
  return asNum(process.env[`JUNO_SIZE_DX_FUTURES_HYBRID_FUNDING_${raw}`] ?? process.env[`JUNO_SIZE_${raw}`]) ?? fallback;
}

export async function placeDxFuturesHybridFunding(alert) {
  const status = dxFuturesHybridFundingStatus();
  if (status.live) throw new Error('DX Futures Hybrid Funding live routing is not enabled by the demo router');
  if (!status.enabled) throw new Error('DX Futures Hybrid Funding adapter is disabled');
  if (!status.orderConfigured) throw new Error('DX Futures Hybrid Funding order endpoint/token not configured by provider');

  const url = process.env.DX_FUTURES_HF_ORDER_URL;
  const symbol = mapDxFuturesSymbol(alert.symbol);
  const quantity = Math.max(1, Math.trunc(dxFuturesSize(alert.symbol, 1)));
  const template = String(process.env.DX_FUTURES_HF_ORDER_TEMPLATE || 'generic').toLowerCase();

  let payload;
  if (template === 'dxsca') {
    payload = {
      account: process.env.DX_FUTURES_HF_ACCOUNT_CODE || process.env.DX_FUTURES_HF_ACCOUNT_ID,
      orderCode: String(alert.signalId || `juno-${Date.now()}`).slice(0, 100),
      type: 'MARKET',
      instrument: symbol,
      quantity: String(quantity),
      positionEffect: 'OPEN',
      side: alert.direction,
      tif: 'GTC',
    };
  } else {
    payload = {
      externalSignalId: alert.signalId,
      accountId: process.env.DX_FUTURES_HF_ACCOUNT_ID || null,
      symbol,
      side: alert.direction,
      quantity,
      type: 'MARKET',
      entry: alert.entry,
      stopLoss: alert.sl,
      takeProfit: alert.tp1,
      takeProfit2: alert.tp2,
      takeProfit3: alert.tp3,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || `DX Futures HTTP ${response.status}`);
  return {
    ok: true,
    account: 'DX_FUTURES_HYBRID_FUNDING',
    provider: 'dx_futures',
    environment: status.environment,
    brokerSymbol: symbol,
    size: quantity,
    orderId: data?.orderId || data?.id || data?.order?.id || null,
    raw: data,
    protection: { trackedByJuno: true, sl: alert.sl, tp1: alert.tp1, tp2: alert.tp2, tp3: alert.tp3 },
  };
}

function normalizeTrackingPayload(raw) {
  const root = raw?.data || raw?.result || raw;
  const account = root?.account || root?.accountData || root?.summary || root || {};
  const positions = root?.positions || root?.openPositions || account?.positions || [];
  const trades = root?.trades || root?.orders || root?.history || [];
  return {
    accountId: account?.id || account?.accountId || account?.account_code || process.env.DX_FUTURES_HF_ACCOUNT_ID || null,
    balance: asNum(account?.balance ?? account?.cashBalance ?? account?.equity),
    equity: asNum(account?.equity ?? account?.netLiquidation ?? account?.balance),
    pnl: asNum(account?.pnl ?? account?.profitLoss ?? account?.realizedPnl),
    drawdown: asNum(account?.drawdown ?? account?.trailingDrawdown ?? account?.maxDrawdownUsed),
    buyingPower: asNum(account?.buyingPower ?? account?.availableFunds),
    positions: Array.isArray(positions) ? positions : [],
    trades: Array.isArray(trades) ? trades : [],
    raw,
    observedAt: new Date().toISOString(),
  };
}

export async function fetchDxFuturesHybridFundingPublicTracking(urlOverride) {
  const url = urlOverride || process.env.DX_FUTURES_HF_PUBLIC_URL;
  if (!url) throw new Error('DX Futures Hybrid Funding public tracking URL is not configured');
  const response = await fetch(url, { headers: { Accept: 'application/json,text/html;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(15000) });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) throw new Error(`DX Futures public tracking HTTP ${response.status}`);
  if (contentType.includes('application/json')) {
    return { ok: true, source: 'public_url_json', ...normalizeTrackingPayload(await response.json()) };
  }
  const text = await response.text();
  return {
    ok: true,
    source: 'public_url_html',
    observedAt: new Date().toISOString(),
    rawHtml: text.slice(0, 250000),
    note: 'Public page is HTML. Command Center can store/display the page now; a site-specific parser can be added after seeing one real Hybrid Funding public URL.',
  };
}

export function normalizeImportedDxFuturesAccount(input = {}) {
  const root = input?.data || input;
  return {
    ok: true,
    source: 'manual_import',
    ...normalizeTrackingPayload(root),
  };
}

export async function testDxFuturesHybridFundingConnection() {
  const status = dxFuturesHybridFundingStatus();
  if (status.publicTrackingConfigured) {
    try {
      const tracking = await fetchDxFuturesHybridFundingPublicTracking();
      return { ok: true, status, tracking: { ...tracking, rawHtml: tracking.rawHtml ? `[html ${tracking.rawHtml.length} chars]` : undefined, raw: undefined } };
    } catch (error) {
      if (!status.orderConfigured) return { ok: false, status, error: error.message };
    }
  }
  if (process.env.DX_FUTURES_HF_STATUS_URL && process.env.DX_FUTURES_HF_ACCESS_TOKEN) {
    const response = await fetch(process.env.DX_FUTURES_HF_STATUS_URL, { headers: authHeaders(), signal: AbortSignal.timeout(15000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status, error: data?.message || data?.error || `HTTP ${response.status}` };
    return { ok: true, status, data };
  }
  return { ok: status.orderConfigured || status.publicTrackingConfigured, status, note: 'No standardized DX Futures read endpoint supplied yet. Public URL or provider status endpoint can be used.' };
}
