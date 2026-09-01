const PORT = () => process.env.PORT || 3005;

export const ACTION_POLICIES = Object.freeze({
  AUTO_READ: 'auto_read',
  AUTO_PRIVATE_WRITE: 'auto_private_write',
  AUTO_TASK_WRITE: 'auto_task_write',
  REPORT_AFTER_WRITE: 'report_after_write',
  CONFIRM: 'confirm',
  LIVE_TRADE_CONFIRM: 'live_trade_confirm',
});

function clean(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function restAfter(message, pattern) {
  return clean(message.replace(pattern, '').replace(/^\s*(?:that|this|to|in|:|-)+\s*/i, ''));
}

function projectFrom(message) {
  return clean(message.match(/(?:in|to)\s+(?:my\s+)?([\w -]+?)\s+project\b/i)?.[1], 160) || null;
}

function parseTrade(message) {
  const upper = message.toUpperCase();
  return {
    text: clean(message),
    mode: /\b(live|real)\b/i.test(message) ? 'live' : 'paper',
    broker: clean(message.match(/\b(kraken|tradovate|ctrader|rithmic)\b/i)?.[1], 40).toLowerCase() || 'kraken',
    side: /\b(sell|short)\b/i.test(message) ? 'sell' : /\b(buy|long)\b/i.test(message) ? 'buy' : null,
    symbol: upper.match(/\b(MNQ|NQ|MES|ES|BTC|XBT|ETH|SOL|XAUUSD|GOLD|EURUSD|GBPUSD)\b/)?.[1] || null,
    quantity: Number(message.match(/\b(?:qty|quantity|size|contracts?)\s*[:=]?\s*(\d+(?:\.\d+)?)\b/i)?.[1] || message.match(/\b(\d+(?:\.\d+)?)\s+(?:[A-Z0-9]+\s+)?(?:contracts?|shares?|coins?)\b/i)?.[1]) || null,
    orderType: /\blimit\b/i.test(message) ? 'limit' : /\bstop\b/i.test(message) ? 'stop' : 'market',
    limitPrice: Number(message.match(/\b(?:at|@|limit)\s*\$?([\d.]+)\b/i)?.[1]) || null,
  };
}

export function resolveAction(message = '', requestedAction, requestedParams = {}) {
  const text = clean(message);
  if (requestedAction) return { name: clean(requestedAction, 120), params: requestedParams || {}, confidence: 1, explicit: true };

  if (/\b(remember|save (?:this|that)|add .*memory)\b/i.test(text)) {
    return { name: 'memory.remember', params: { content: restAfter(text, /^.*?\b(?:remember|save (?:this|that))\b/i), source: 'juno_gateway' }, confidence: .9 };
  }
  if (/\b(journal|log (?:this|that)|save .*journal)\b/i.test(text)) {
    return { name: 'journal.save', params: { text: restAfter(text, /^.*?\b(?:journal|log (?:this|that))\b/i), source: 'juno_gateway' }, confidence: .88 };
  }
  if (/\b(?:add|create|make)\b.*\b(?:task|to-?do)\b/i.test(text)) {
    const title = restAfter(text, /^.*?\b(?:task|to-?do)\b/i).replace(/\s+(?:in|to)\s+(?:my\s+)?[\w -]+?\s+project\b.*$/i, '').trim();
    return { name: 'nifty.task.create', params: { title, projectId: requestedParams.projectId || null, projectName: projectFrom(text) }, confidence: .82 };
  }
  if (/\b(?:start|begin)\b.*\b(?:obs\s+)?record/i.test(text)) return { name: 'obs.record.start', params: {}, confidence: .95 };
  if (/\b(?:stop|end)\b.*\b(?:obs\s+)?record/i.test(text)) return { name: 'obs.record.stop', params: {}, confidence: .95 };
  if (/\b(?:switch|change)\b.*\bscene\b/i.test(text)) return { name: 'obs.scene.switch', params: { sceneName: clean(text.match(/\bscene\s+(?:to\s+)?["']?(.+?)["']?$/i)?.[1], 160) }, confidence: .88 };
  if (/\b(?:trade|order|buy|sell|long|short)\b/i.test(text) && /\b(?:preview|paper|live|execute|place|submit|buy|sell|long|short)\b/i.test(text)) {
    const trade = parseTrade(text);
    const name = /\b(preview|show|draft)\b/i.test(text) ? 'hybrid.trade.preview' : trade.mode === 'live' ? 'hybrid.trade.execute' : 'hybrid.trade.paper';
    return { name, params: trade, confidence: .86 };
  }
  return null;
}

async function localFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`http://127.0.0.1:${PORT()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }));
  if (!response.ok) throw new Error(data?.error || `${method} ${path} returned HTTP ${response.status}`);
  return data;
}

async function externalJson(url, body, headers = {}) {
  if (!url) throw new Error('Adapter URL is not configured');
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }));
  if (!response.ok) throw new Error(data?.error || `Adapter returned HTTP ${response.status}`);
  return data;
}

const definitions = [
  { name: 'memory.remember', policy: ACTION_POLICIES.AUTO_PRIVATE_WRITE, required: ['content'], execute: p => localFetch('/api/memory/vault', { method: 'POST', body: { content: p.content, domain: p.domain || 'general', source: p.source || 'juno_gateway', type: p.type || 'fact', metadata: p.metadata || {} } }) },
  { name: 'journal.save', policy: ACTION_POLICIES.AUTO_PRIVATE_WRITE, required: ['text'], execute: p => localFetch('/api/life/journal', { method: 'POST', body: { text: p.text, category: p.category || 'note', source: p.source || 'juno_gateway', tags: p.tags || ['juno_gateway'] } }) },
  { name: 'nifty.task.create', policy: ACTION_POLICIES.AUTO_TASK_WRITE, required: ['title'], execute: async p => {
    let projectId = p.projectId;
    if (!projectId && p.projectName) {
      const payload = await localFetch('/api/nifty/projects');
      const projects = Array.isArray(payload) ? payload : payload.projects || payload.data || [];
      const needle = p.projectName.toLowerCase();
      const matches = projects.filter(x => String(x.name || x.title || '').toLowerCase().includes(needle));
      if (matches.length !== 1) throw new Error(matches.length ? `Project name is ambiguous: ${p.projectName}` : `Nifty project not found: ${p.projectName}`);
      projectId = matches[0].id;
    }
    if (!projectId) throw new Error('projectId or an unambiguous projectName is required');
    return localFetch(`/api/nifty/projects/${encodeURIComponent(projectId)}/tasks`, { method: 'POST', body: { name: p.title, title: p.title, description: p.description || '' } });
  } },
  { name: 'nifty.task.update', policy: ACTION_POLICIES.AUTO_TASK_WRITE, required: ['taskId'], execute: p => localFetch(`/api/nifty/tasks/${encodeURIComponent(p.taskId)}`, { method: 'PUT', body: p.changes || p }) },
  { name: 'nifty.task.complete', policy: ACTION_POLICIES.AUTO_TASK_WRITE, required: ['taskId'], execute: p => localFetch(`/api/nifty/tasks/${encodeURIComponent(p.taskId)}/complete`, { method: 'POST', body: {} }) },
  { name: 'obs.record.start', policy: ACTION_POLICIES.AUTO_TASK_WRITE, execute: p => externalJson(process.env.OBS_BRIDGE_URL && `${process.env.OBS_BRIDGE_URL.replace(/\/$/, '')}/record/start`, p, process.env.OBS_BRIDGE_KEY ? { Authorization: `Bearer ${process.env.OBS_BRIDGE_KEY}` } : {}) },
  { name: 'obs.record.stop', policy: ACTION_POLICIES.AUTO_TASK_WRITE, execute: p => externalJson(process.env.OBS_BRIDGE_URL && `${process.env.OBS_BRIDGE_URL.replace(/\/$/, '')}/record/stop`, p, process.env.OBS_BRIDGE_KEY ? { Authorization: `Bearer ${process.env.OBS_BRIDGE_KEY}` } : {}) },
  { name: 'obs.scene.switch', policy: ACTION_POLICIES.AUTO_TASK_WRITE, required: ['sceneName'], execute: p => externalJson(process.env.OBS_BRIDGE_URL && `${process.env.OBS_BRIDGE_URL.replace(/\/$/, '')}/scene`, p, process.env.OBS_BRIDGE_KEY ? { Authorization: `Bearer ${process.env.OBS_BRIDGE_KEY}` } : {}) },
  { name: 'calendar.create', policy: ACTION_POLICIES.CONFIRM, required: ['summary', 'start', 'end'], execute: p => externalJson(process.env.CALENDAR_WRITE_ADAPTER_URL, p, process.env.CALENDAR_WRITE_ADAPTER_KEY ? { Authorization: `Bearer ${process.env.CALENDAR_WRITE_ADAPTER_KEY}` } : {}) },
  { name: 'gmail.send', policy: ACTION_POLICIES.CONFIRM, required: ['to', 'subject', 'body'], execute: p => externalJson(process.env.GMAIL_SEND_ADAPTER_URL, p, process.env.GMAIL_SEND_ADAPTER_KEY ? { Authorization: `Bearer ${process.env.GMAIL_SEND_ADAPTER_KEY}` } : {}) },
  { name: 'github.patch', policy: ACTION_POLICIES.REPORT_AFTER_WRITE, required: ['repository', 'patch'], execute: p => externalJson(process.env.GITHUB_WRITE_ADAPTER_URL, p, process.env.GITHUB_WRITE_ADAPTER_KEY ? { Authorization: `Bearer ${process.env.GITHUB_WRITE_ADAPTER_KEY}` } : {}) },
  { name: 'hybrid.trade.preview', policy: ACTION_POLICIES.AUTO_READ, execute: p => localFetch('/api/trading/hybrid-journal/order-preview', { method: 'POST', body: p }) },
  { name: 'hybrid.trade.paper', policy: ACTION_POLICIES.AUTO_TASK_WRITE, execute: p => localFetch('/api/trading/hybrid-journal/order-paper', { method: 'POST', body: { ...p, mode: 'paper' } }) },
  { name: 'hybrid.trade.execute', policy: ACTION_POLICIES.LIVE_TRADE_CONFIRM, execute: p => localFetch('/api/trading/hybrid-journal/order-execute', { method: 'POST', body: { ...p, mode: 'live', confirmation: 'CONFIRM_LIVE_TRADE' } }) },
];

const registry = new Map(definitions.map(x => [x.name, Object.freeze(x)]));

export function listActions() {
  return definitions.map(({ execute, ...definition }) => definition);
}

export function getAction(name) {
  return registry.get(name) || null;
}

export function validateAction(action) {
  const definition = getAction(action?.name);
  if (!definition) return { ok: false, error: `Unknown action: ${action?.name || 'none'}` };
  const missing = (definition.required || []).filter(key => action.params?.[key] === undefined || action.params?.[key] === null || action.params?.[key] === '');
  return missing.length ? { ok: false, error: `Missing required parameters: ${missing.join(', ')}`, definition } : { ok: true, definition };
}

export async function executeAction(action, context = {}) {
  const validation = validateAction(action);
  if (!validation.ok) throw new Error(validation.error);
  const started = Date.now();
  const data = await validation.definition.execute(action.params || {}, context);
  return { name: action.name, ok: true, ms: Date.now() - started, data };
}

export default { listActions, getAction, resolveAction, validateAction, executeAction };
