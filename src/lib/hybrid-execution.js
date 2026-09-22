// Shared Hybrid Execution primitives for Command Center. Never store broker secrets in browser code.
export const HYBRID_EXECUTION_VERSION = '2026-08-29';

export function createTradeIntent(i = {}) {
  const broker = String(i.broker || 'kraken').toLowerCase();
  return {
    version: HYBRID_EXECUTION_VERSION,
    intentId: i.intentId || crypto.randomUUID(),
    source: i.source || window.location.host,
    broker,
    accountId: i.accountId || null,
    instrumentType: i.instrumentType || i.assetClass || i.metadata?.instrumentType || i.metadata?.assetClass || null,
    mode: String(i.mode || (broker === 'public' ? 'live' : 'paper')).toLowerCase(),
    symbol: String(i.symbol || i.pair || '').toUpperCase().replace('/', ''),
    side: String(i.side || '').toLowerCase(),
    orderType: String(i.orderType || i.type || 'market').toLowerCase(),
    quantity: Number(i.quantity ?? i.volume ?? 0),
    price: i.price == null ? null : Number(i.price),
    stopLoss: i.stopLoss == null ? null : Number(i.stopLoss),
    takeProfit: i.takeProfit == null ? null : Number(i.takeProfit),
    openCloseIndicator: i.openCloseIndicator || i.metadata?.openCloseIndicator || null,
    riskUsd: i.riskUsd == null ? null : Number(i.riskUsd),
    rationale: i.rationale || null,
    strategy: i.strategy || null,
    confirmation: i.confirmation || 'preview',
    metadata: i.metadata || {},
    createdAt: i.createdAt || new Date().toISOString(),
  };
}

export function validateTradeIntent(i) {
  const e = [];
  if (!i?.symbol) e.push('Symbol is required');
  if (!['buy', 'sell'].includes(i?.side)) e.push('Side must be buy or sell');
  if (!['market', 'limit'].includes(i?.orderType)) e.push('Order type must be market or limit');
  if (!['paper', 'live'].includes(i?.mode)) e.push('Mode must be paper or live');
  if (!(Number(i?.quantity) > 0)) e.push('Quantity must be greater than zero');
  if (i?.orderType === 'limit' && !(Number(i?.price) > 0)) e.push('Limit price is required');
  if (i?.mode === 'live' && i?.confirmation !== 'CONFIRM_LIVE_TRADE') e.push('Live mode requires explicit confirmation');
  return { ok: e.length === 0, errors: e };
}

export function tradeReadback(i) {
  if (!i) return '';
  const p = i.orderType === 'limit' ? ` at ${i.price}` : ' at market';
  const protection = [i.stopLoss ? `stop ${i.stopLoss}` : null, i.takeProfit ? `target ${i.takeProfit}` : null].filter(Boolean).join(', ');
  return `${i.mode.toUpperCase()} ${i.side.toUpperCase()} ${i.quantity} ${i.symbol}${p}${protection ? `, ${protection}` : ''} via ${i.broker}.`;
}

export class HybridExecutionClient {
  constructor({ baseUrl = '', getAccessToken = null } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getAccessToken = getAccessToken;
  }
  async request(path, { method = 'GET', body } = {}) {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const r = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || d.errors?.join('; ') || `Execution request failed (${r.status})`);
    return d;
  }
  status() { return this.request('/api/execution/status'); }
  capabilities() { return this.request('/api/execution/capabilities'); }
  parse(text, context = {}) { return this.request('/api/execution/parse', { method: 'POST', body: { text, ...context } }); }
  preview(intent) { return this.request('/api/execution/intents/preview', { method: 'POST', body: createTradeIntent(intent) }); }
  paperExecute(intent) { return this.request('/api/execution/intents/execute', { method: 'POST', body: createTradeIntent({ ...intent, mode: 'paper', confirmation: 'preview' }) }); }
  liveExecute(intent) { return this.request('/api/execution/intents/execute', { method: 'POST', body: createTradeIntent({ ...intent, mode: 'live', confirmation: 'CONFIRM_LIVE_TRADE' }) }); }
  accountSnapshot({ broker = 'kraken', mode, accountId } = {}) {
    const resolvedMode = mode || (broker === 'public' ? 'live' : 'paper');
    const qs = new URLSearchParams({ broker, mode: resolvedMode });
    if (accountId) qs.set('accountId', accountId);
    return this.request(`/api/execution/account-snapshot?${qs}`);
  }
  positions({ broker = 'kraken', mode, accountId } = {}) {
    const resolvedMode = mode || (broker === 'public' ? 'live' : 'paper');
    const qs = new URLSearchParams({ broker, mode: resolvedMode });
    if (accountId) qs.set('accountId', accountId);
    return this.request(`/api/execution/positions?${qs}`);
  }
  orders({ broker = 'kraken', mode, accountId } = {}) {
    const resolvedMode = mode || (broker === 'public' ? 'live' : 'paper');
    const qs = new URLSearchParams({ broker, mode: resolvedMode });
    if (accountId) qs.set('accountId', accountId);
    return this.request(`/api/execution/orders?${qs}`);
  }
  history({ broker = 'public', accountId, start, end, pageSize, nextToken } = {}) {
    const qs = new URLSearchParams({ broker });
    if (accountId) qs.set('accountId', accountId);
    if (start) qs.set('start', start);
    if (end) qs.set('end', end);
    if (pageSize) qs.set('pageSize', String(pageSize));
    if (nextToken) qs.set('nextToken', nextToken);
    return this.request(`/api/execution/history?${qs}`);
  }
  optionExpirations({ symbol, broker = 'public', accountId, instrumentType = 'EQUITY' } = {}) {
    const qs = new URLSearchParams({ broker, instrumentType });
    if (accountId) qs.set('accountId', accountId);
    return this.request(`/api/execution/options/${encodeURIComponent(symbol)}/expirations?${qs}`);
  }
  optionChain({ symbol, expirationDate, broker = 'public', accountId, instrumentType = 'EQUITY' } = {}) {
    const qs = new URLSearchParams({ broker, expirationDate, instrumentType });
    if (accountId) qs.set('accountId', accountId);
    return this.request(`/api/execution/options/${encodeURIComponent(symbol)}/chain?${qs}`);
  }
  orderStatus(orderId, { broker = 'public', accountId } = {}) {
    const qs = new URLSearchParams({ broker });
    if (accountId) qs.set('accountId', accountId);
    return this.request(`/api/execution/orders/${encodeURIComponent(orderId)}?${qs}`);
  }
  cancelOrder(orderId, { broker = 'public', accountId } = {}) {
    return this.request(`/api/execution/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body: { broker, accountId } });
  }
  replaceOrder(orderId, replacement, { broker = 'public', accountId } = {}) {
    return this.request(`/api/execution/orders/${encodeURIComponent(orderId)}/replace`, { method: 'POST', body: { broker, accountId, replacement, confirmation: 'CONFIRM_LIVE_TRADE' } });
  }
}

export function speechRecognitionSupported() { return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition); }
export function listenForTradeCommand({ language = 'en-US', interim = false } = {}) {
  return new Promise((resolve, reject) => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return reject(new Error('Speech recognition is not supported in this browser'));
    const x = new R();
    x.lang = language;
    x.interimResults = interim;
    x.maxAlternatives = 1;
    x.onresult = e => resolve(e.results[e.results.length - 1][0].transcript.trim());
    x.onerror = e => reject(new Error(e.error || 'Speech recognition failed'));
    x.onnomatch = () => reject(new Error('No trade command was recognized'));
    x.start();
  });
}
