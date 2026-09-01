const asNum = v => Number.isFinite(Number(v)) ? Number(v) : null;
const upper = v => v == null ? null : String(v).trim().toUpperCase();

export const HYBRID_FUNDING_PUBLIC_ACCOUNTS = Object.freeze([
  {
    id: 'HF_PUBLIC_36240f5d',
    publicId: '36240f5d-bf00-4e91-ab41-f8604e1e8776',
    provider: 'hybrid_funding_propaccount',
    program: 'hybrid_funding',
    market: 'unclassified',
    platform: 'unclassified',
    accountType: 'unclassified',
    label: 'Hybrid Funding Public Account 36240f5d',
    publicUrl: 'https://hybridfundingdashboard.propaccount.com/public-overview/36240f5d-bf00-4e91-ab41-f8604e1e8776',
    trackingEnabled: true,
  },
  {
    id: 'HF_PUBLIC_83db3117',
    publicId: '83db3117-30c4-434d-819c-df35d1d3b470',
    provider: 'hybrid_funding_propaccount',
    program: 'hybrid_funding',
    market: 'unclassified',
    platform: 'unclassified',
    accountType: 'unclassified',
    label: 'Hybrid Funding Public Account 83db3117',
    publicUrl: 'https://hybridfundingdashboard.propaccount.com/public-overview/83db3117-30c4-434d-819c-df35d1d3b470',
    trackingEnabled: true,
  },
]);

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

export function listHybridFundingPublicAccounts() {
  return HYBRID_FUNDING_PUBLIC_ACCOUNTS.map(account => ({ ...account }));
}

export function dxFuturesHybridFundingStatus() {
  return {
    id: 'DX_FUTURES_HYBRID_FUNDING',
    provider: 'dx_futures',
    environment: process.env.DX_FUTURES_HF_ENVIRONMENT || 'demo',
    live: String(process.env.DX_FUTURES_HF_ENVIRONMENT || 'demo').toLowerCase() === 'live',
    enabled: enabled(),
    orderConfigured: Boolean(process.env.DX_FUTURES_HF_ORDER_URL && process.env.DX_FUTURES_HF_ACCESS_TOKEN),
    publicTrackingConfigured: Boolean(process.env.DX_FUTURES_HF_PUBLIC_URL) || HYBRID_FUNDING_PUBLIC_ACCOUNTS.length > 0,
    trackedPublicAccounts: HYBRID_FUNDING_PUBLIC_ACCOUNTS.length,
    importTrackingSupported: true,
    capabilities: ['orders_if_provider_api_enabled','public_tracking','multi_account_public_tracking','account_import','positions_if_endpoint_enabled'],
    note: 'Hybrid Funding public accounts may represent either DX Futures or DXtrade Forex. Public URLs remain neutral until the account market/platform is positively identified.'
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
    return { ok: true, source: 'public_url_json', url, ...normalizeTrackingPayload(await response.json()) };
  }
  const text = await response.text();
  return {
    ok: true,
    source: 'public_url_html',
    url,
    observedAt: new Date().toISOString(),
    rawHtml: text.slice(0, 250000),
    note: 'Public page is HTML. A site-specific parser can be added once the dashboard response structure is identified.',
  };
}

export async function fetchAllHybridFundingPublicTracking() {
  const results = [];
  for (const account of HYBRID_FUNDING_PUBLIC_ACCOUNTS.filter(a => a.trackingEnabled)) {
    try {
      const tracking = await fetchDxFuturesHybridFundingPublicTracking(account.publicUrl);
      results.push({ account, tracking });
    } catch (error) {
      results.push({ account, tracking: { ok: false, url: account.publicUrl, error: error?.message || 'Tracking fetch failed', observedAt: new Date().toISOString() } });
    }
  }
  return {
    ok: results.every(r => r.tracking?.ok),
    tracked: results.length,
    healthy: results.filter(r => r.tracking?.ok).length,
    results,
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
  if (HYBRID_FUNDING_PUBLIC_ACCOUNTS.length) {
    const all = await fetchAllHybridFundingPublicTracking();
    return { ok: all.healthy > 0 || status.orderConfigured, status, publicAccounts: all };
  }
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
