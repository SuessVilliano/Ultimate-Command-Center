import crypto from 'crypto';

const upper = v => v == null ? null : String(v).trim().toUpperCase();
const asNum = v => Number.isFinite(Number(v)) ? Number(v) : null;

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v == null) return fallback;
  return ['1','true','yes','on'].includes(String(v).toLowerCase());
}

function redact(value) {
  if (!value) return null;
  const s = String(value);
  return s.length <= 8 ? '***' : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function mapSymbol(accountId, symbol) {
  const raw = upper(symbol || '');
  return process.env[`JUNO_SYMBOL_${accountId}_${raw}`] || process.env[`JUNO_SYMBOL_${raw}`] || raw;
}

function sizeFor(accountId, symbol, fallback = 1) {
  const raw = upper(symbol || '');
  return asNum(process.env[`JUNO_SIZE_${accountId}_${raw}`] ?? process.env[`JUNO_SIZE_${raw}`]) ?? fallback;
}

export function brokerAccounts() {
  return [
    { id: 'JUNO_DEMO', provider: 'internal', environment: 'paper', live: false, configured: true, enabled: true, capabilities: ['ledger','shadow','journal'] },
    {
      id: 'KRAKEN_FUTURES_DEMO', provider: 'kraken_futures', environment: 'demo', live: false,
      configured: Boolean(process.env.KRAKEN_FUTURES_DEMO_API_KEY && process.env.KRAKEN_FUTURES_DEMO_API_SECRET),
      enabled: envBool('KRAKEN_FUTURES_DEMO_ENABLED', false),
      baseUrl: process.env.KRAKEN_FUTURES_DEMO_BASE_URL || 'https://demo-futures.kraken.com/derivatives/api/v3',
      key: redact(process.env.KRAKEN_FUTURES_DEMO_API_KEY), capabilities: ['orders','positions','demo']
    },
    {
      id: 'TRADOVATE_DEMO', provider: 'tradovate', environment: 'demo', live: false,
      configured: Boolean(process.env.TRADOVATE_DEMO_ACCESS_TOKEN && process.env.TRADOVATE_DEMO_ACCOUNT_ID && process.env.TRADOVATE_DEMO_USERNAME),
      enabled: envBool('TRADOVATE_DEMO_ENABLED', false),
      baseUrl: process.env.TRADOVATE_DEMO_BASE_URL || 'https://demo.tradovateapi.com/v1', capabilities: ['orders','demo']
    },
    {
      id: 'DXTRADE_DEMO', provider: 'dxtrade', environment: 'demo', live: false,
      configured: Boolean(process.env.DXTRADE_DEMO_ORDER_URL && process.env.DXTRADE_DEMO_ACCESS_TOKEN),
      enabled: envBool('DXTRADE_DEMO_ENABLED', false), capabilities: ['provider_specific','demo'],
      note: 'DXtrade APIs vary by broker/prop provider; configure the exact demo order endpoint supplied by that provider.'
    },
    { id: 'KRAKEN_FUTURES_LIVE', provider: 'kraken_futures', environment: 'live', live: true, configured: Boolean(process.env.KRAKEN_FUTURES_LIVE_API_KEY), enabled: false, capabilities: ['status_only'], note: 'Registered for future confirmed live routing; automatic live placement is intentionally disabled.' },
    { id: 'KRAKEN_SPOT_LIVE', provider: 'kraken_spot', environment: 'live', live: true, configured: Boolean(process.env.KRAKEN_SPOT_API_KEY), enabled: false, capabilities: ['status_only'], note: 'Spot live account is tracked but not available to automatic signal execution.' },
    { id: 'TRADOVATE_LIVE', provider: 'tradovate', environment: 'live', live: true, configured: Boolean(process.env.TRADOVATE_LIVE_ACCESS_TOKEN), enabled: false, capabilities: ['status_only'], note: 'Registered for future confirmed live routing; automatic live placement is intentionally disabled.' },
    { id: 'DXTRADE_LIVE', provider: 'dxtrade', environment: 'live', live: true, configured: Boolean(process.env.DXTRADE_LIVE_ORDER_URL), enabled: false, capabilities: ['status_only'], note: 'Registered for future provider-specific confirmed live routing.' }
  ];
}

export function brokerStatus() {
  return { ok: true, demoExecutionOnly: true, accounts: brokerAccounts() };
}

function krakenAuthent(postData, nonce, endpointPath, secretBase64) {
  const sha = crypto.createHash('sha256').update(`${postData}${nonce}${endpointPath}`).digest();
  const secret = Buffer.from(secretBase64, 'base64');
  return crypto.createHmac('sha512', secret).update(sha).digest('base64');
}

async function krakenDemoRequest(endpoint, params = {}, method = 'POST') {
  const account = brokerAccounts().find(a => a.id === 'KRAKEN_FUTURES_DEMO');
  const key = process.env.KRAKEN_FUTURES_DEMO_API_KEY;
  const secret = process.env.KRAKEN_FUTURES_DEMO_API_SECRET;
  if (!key || !secret) throw new Error('KRAKEN_FUTURES_DEMO credentials are not configured');
  const nonce = String(Date.now());
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const postData = qs.toString();
  const endpointPath = `/derivatives/api/v3/${endpoint}`;
  const authent = krakenAuthent(postData, nonce, endpointPath, secret);
  const url = `${account.baseUrl}/${endpoint}${postData ? `?${postData}` : ''}`;
  const response = await fetch(url, { method, headers: { Accept: 'application/json', APIKey: key, Authent: authent, Nonce: nonce }, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.result === 'error') throw new Error(data?.error || data?.message || `Kraken demo HTTP ${response.status}`);
  return data;
}

async function placeKrakenDemo(alert) {
  const accountId = 'KRAKEN_FUTURES_DEMO';
  const symbol = mapSymbol(accountId, alert.symbol);
  const size = sizeFor(accountId, alert.symbol, 1);
  const data = await krakenDemoRequest('sendorder', {
    orderType: 'mkt', symbol, side: alert.direction === 'BUY' ? 'buy' : 'sell', size,
    cliOrdId: String(alert.signalId || `juno-${Date.now()}`).slice(0, 100), reduceOnly: false
  });
  return { ok: true, account: accountId, provider: 'kraken_futures', environment: 'demo', brokerSymbol: symbol, size, orderId: data?.sendStatus?.order_id || null, raw: data, protection: { trackedByJuno: true, sl: alert.sl, tp1: alert.tp1, tp2: alert.tp2, tp3: alert.tp3 } };
}

async function tradovateDemoRequest(path, body) {
  const account = brokerAccounts().find(a => a.id === 'TRADOVATE_DEMO');
  const token = process.env.TRADOVATE_DEMO_ACCESS_TOKEN;
  if (!token) throw new Error('TRADOVATE_DEMO access token is not configured');
  const response = await fetch(`${account.baseUrl}${path}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data?.failureReason && data.failureReason !== 'Success')) throw new Error(data?.failureText || data?.errorText || data?.failureReason || `Tradovate demo HTTP ${response.status}`);
  return data;
}

async function placeTradovateDemo(alert) {
  const accountId = 'TRADOVATE_DEMO';
  const symbol = mapSymbol(accountId, alert.symbol);
  const orderQty = Math.max(1, Math.trunc(sizeFor(accountId, alert.symbol, 1)));
  const data = await tradovateDemoRequest('/order/placeorder', {
    accountSpec: process.env.TRADOVATE_DEMO_USERNAME,
    accountId: Number(process.env.TRADOVATE_DEMO_ACCOUNT_ID),
    action: alert.direction === 'BUY' ? 'Buy' : 'Sell', symbol, orderQty, orderType: 'Market', isAutomated: true
  });
  return { ok: true, account: accountId, provider: 'tradovate', environment: 'demo', brokerSymbol: symbol, size: orderQty, orderId: data?.orderId || null, raw: data, protection: { trackedByJuno: true, sl: alert.sl, tp1: alert.tp1, tp2: alert.tp2, tp3: alert.tp3 } };
}

async function placeDxtradeDemo(alert) {
  const url = process.env.DXTRADE_DEMO_ORDER_URL;
  const token = process.env.DXTRADE_DEMO_ACCESS_TOKEN;
  if (!url || !token) throw new Error('DXTRADE_DEMO provider-specific endpoint/token is not configured');
  const payload = { externalSignalId: alert.signalId, symbol: mapSymbol('DXTRADE_DEMO', alert.symbol), side: alert.direction, quantity: sizeFor('DXTRADE_DEMO', alert.symbol, 1), type: 'MARKET', entry: alert.entry, stopLoss: alert.sl, takeProfit: alert.tp1 };
  const response = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || `DXtrade demo HTTP ${response.status}`);
  return { ok: true, account: 'DXTRADE_DEMO', provider: 'dxtrade', environment: 'demo', orderId: data?.orderId || data?.id || null, raw: data };
}

export async function placeOnDemoAccount(accountId, alert) {
  const account = brokerAccounts().find(a => a.id === accountId);
  if (!account) return { ok: false, account: accountId, error: 'Unknown broker account' };
  if (account.live) return { ok: false, account: account.id, error: 'Live accounts cannot be routed by the demo engine' };
  if (account.provider === 'internal') return { ok: true, account: account.id, skipped: true, note: 'Internal JUNO_DEMO ledger is handled separately.' };
  if (!account.configured) return { ok: false, account: account.id, error: 'Demo adapter is not configured' };
  if (!account.enabled) return { ok: false, account: account.id, error: 'Demo adapter is disabled' };
  try {
    if (account.id === 'KRAKEN_FUTURES_DEMO') return await placeKrakenDemo(alert);
    if (account.id === 'TRADOVATE_DEMO') return await placeTradovateDemo(alert);
    if (account.id === 'DXTRADE_DEMO') return await placeDxtradeDemo(alert);
    return { ok: false, account: account.id, error: 'No demo adapter available' };
  } catch (error) {
    return { ok: false, account: account.id, provider: account.provider, environment: account.environment, error: error?.message || 'Demo broker execution failed' };
  }
}

export async function routeDemoSignal(alert, targetAccounts = []) {
  const ids = Array.isArray(targetAccounts) ? targetAccounts : [];
  const results = [];
  for (const id of ids) results.push(await placeOnDemoAccount(id, alert));
  return { ok: results.every(r => r.ok || r.skipped), attempted: results.length, succeeded: results.filter(r => r.ok && !r.skipped).length, results };
}

export async function testBrokerConnection(accountId) {
  const account = brokerAccounts().find(a => a.id === accountId);
  if (!account) return { ok: false, error: 'Unknown broker account' };
  if (account.live) return { ok: true, account: account.id, configured: account.configured, executionEnabled: false, note: account.note || 'Live adapter is status-only.' };
  if (account.provider === 'internal') return { ok: true, account: account.id, note: 'Internal ledger ready' };
  if (!account.configured) return { ok: false, account: account.id, error: 'Credentials/configuration missing' };
  try {
    if (account.id === 'KRAKEN_FUTURES_DEMO') {
      const data = await krakenDemoRequest('openorders', {}, 'GET');
      return { ok: true, account: account.id, provider: account.provider, environment: account.environment, response: data };
    }
    if (account.id === 'TRADOVATE_DEMO') {
      const response = await fetch(`${account.baseUrl}/account/list`, { headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.TRADOVATE_DEMO_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(15000) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.errorText || data?.message || `HTTP ${response.status}`);
      return { ok: true, account: account.id, provider: account.provider, environment: account.environment, accounts: Array.isArray(data) ? data.map(a => ({ id: a.id, name: a.name, active: a.active })) : data };
    }
    if (account.id === 'DXTRADE_DEMO') return { ok: true, account: account.id, configured: true, note: 'Endpoint/token present; provider-specific read test is not standardized.' };
    return { ok: false, account: account.id, error: 'No test implemented' };
  } catch (error) {
    return { ok: false, account: account.id, provider: account.provider, environment: account.environment, error: error?.message || 'Connection test failed' };
  }
}
