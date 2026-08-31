import crypto from 'crypto';
import { getSetting, setSetting } from './database.js';

const LEDGER_KEY = 'juno_action_ledger_v1';
const SESSION_PREFIX = 'juno_session_v1:';
const MAX_LEDGER = 500;
const MAX_SESSION_MESSAGES = 80;

export const JUNO_PERMISSION_LEVELS = Object.freeze({
  AUTO_READ: 'auto_read',
  AUTO_PRIVATE_WRITE: 'auto_private_write',
  AUTO_TASK_WRITE: 'auto_task_write',
  REPORT_AFTER_WRITE: 'report_after_write',
  CONFIRM: 'confirm',
  LIVE_TRADE_CONFIRM: 'live_trade_confirm',
});

const READ_RE = /\b(check|show|tell|what|how|summarize|summary|review|analyze|analyse|compare|find|read|look|status|latest|current|today|yesterday|why|list|search|inspect|whether)\b/i;
const WRITE_RE = /\b(add|save|remember|log|journal|create|update|edit|change|move|assign|complete|close|fix|patch|commit|merge|deploy|start|stop|record|send|reply|message|email|delete|remove|archive|cancel|book|schedule|place|execute|buy|sell|trade|withdraw|transfer|pay|purchase|reset|rotate|revoke)\b/i;
const PRIVATE_WRITE_RE = /\b(remember|memory|journal|thought|note|log this|save this)\b/i;
const TASK_WRITE_RE = /\b(nifty|task|project|creator project|to[- ]?do|todo|blocker|milestone)\b/i;
const GITHUB_WRITE_RE = /\b(github|repo|repository|code|bug|fix|patch|commit|pull request|\bpr\b|branch|merge|deploy)\b/i;
const MESSAGE_RE = /\b(send|reply|email|message|text|dm|publish|post)\b/i;
const DESTRUCTIVE_RE = /\b(delete|remove|archive|cancel|destroy|drop|purge|revoke|reset)\b/i;
const MONEY_SECURITY_RE = /\b(withdraw|transfer|pay|purchase|money|bank|card|account security|password|api key|secret|token|rotate key|revoke key)\b/i;
const TRADE_RE = /\b(trade|order|position|buy|sell|long|short|kraken|futures|forex|crypto|mnq|nq|btc|eth|sol|xauusd|gold)\b/i;
const LIVE_RE = /\b(live|real|execute|place|submit|market order|limit order|open position|close position|buy|sell|long|short)\b/i;

function parseJson(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function safeSet(key, value) {
  try {
    setSetting(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('[Juno Gateway] persistence failed:', error?.message || 'unknown');
    return false;
  }
}

export function gatewayConfigured() {
  return Boolean(process.env.JUNO_GATEWAY_KEY);
}

export function authenticateGateway(req) {
  const expected = process.env.JUNO_GATEWAY_KEY;
  if (!expected) return { ok: false, status: 503, error: 'JUNO_GATEWAY_KEY is not configured' };

  const auth = req.get?.('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = req.get?.('x-juno-key') || bearer || '';
  if (!supplied) return { ok: false, status: 401, error: 'Missing Juno gateway credentials' };

  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 403, error: 'Invalid Juno gateway credentials' };
  }
  return { ok: true };
}

export function normalizeIdentity(input = {}) {
  const source = String(input.source || 'command_center').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'command_center';
  const externalId = String(input.externalId || input.chatId || input.sessionId || 'primary').trim().slice(0, 160) || 'primary';
  const userId = String(input.userId || 'owner').trim().slice(0, 120) || 'owner';
  return {
    source,
    externalId,
    userId,
    sessionKey: `${source}:${externalId}`,
    actorKey: `${userId}:${source}:${externalId}`,
  };
}

export function classifyPermission(message = '') {
  const text = String(message).trim();
  const isWrite = WRITE_RE.test(text) && !(/^\s*(what|how|why|can|could|would|should|is|are|do|does|did)\b/i.test(text) && READ_RE.test(text));

  if (!isWrite) {
    return { level: JUNO_PERMISSION_LEVELS.AUTO_READ, requiresConfirmation: false, reason: 'Read/analysis request' };
  }

  if (TRADE_RE.test(text) && LIVE_RE.test(text)) {
    return { level: JUNO_PERMISSION_LEVELS.LIVE_TRADE_CONFIRM, requiresConfirmation: true, reason: 'Live trading always requires explicit confirmation' };
  }

  if (MONEY_SECURITY_RE.test(text) || MESSAGE_RE.test(text) || DESTRUCTIVE_RE.test(text)) {
    return { level: JUNO_PERMISSION_LEVELS.CONFIRM, requiresConfirmation: true, reason: 'Outbound, destructive, money-moving, account, or security action' };
  }

  if (PRIVATE_WRITE_RE.test(text)) {
    return { level: JUNO_PERMISSION_LEVELS.AUTO_PRIVATE_WRITE, requiresConfirmation: false, reason: 'Private journal/memory write' };
  }

  if (TASK_WRITE_RE.test(text)) {
    return { level: JUNO_PERMISSION_LEVELS.AUTO_TASK_WRITE, requiresConfirmation: false, reason: 'Trusted project/task update class' };
  }

  if (GITHUB_WRITE_RE.test(text)) {
    return { level: JUNO_PERMISSION_LEVELS.REPORT_AFTER_WRITE, requiresConfirmation: false, reason: 'GitHub edits allowed with exact change reporting' };
  }

  return { level: JUNO_PERMISSION_LEVELS.CONFIRM, requiresConfirmation: true, reason: 'Unclassified external write fails closed' };
}

export function appendLedger(entry = {}) {
  const current = parseJson(getSetting(LEDGER_KEY, '[]'), []);
  const row = {
    id: entry.id || crypto.randomUUID(),
    createdAt: entry.createdAt || new Date().toISOString(),
    source: entry.source || 'command_center',
    sessionKey: entry.sessionKey || null,
    actorKey: entry.actorKey || null,
    request: entry.request || '',
    permission: entry.permission || null,
    status: entry.status || 'received',
    tools: Array.isArray(entry.tools) ? entry.tools : [],
    resultSummary: entry.resultSummary || null,
    error: entry.error || null,
    metadata: entry.metadata || {},
  };
  current.push(row);
  safeSet(LEDGER_KEY, current.slice(-MAX_LEDGER));
  return row;
}

export function updateLedger(id, patch = {}) {
  const current = parseJson(getSetting(LEDGER_KEY, '[]'), []);
  const index = current.findIndex(x => x.id === id);
  if (index < 0) return null;
  current[index] = { ...current[index], ...patch, id, updatedAt: new Date().toISOString() };
  safeSet(LEDGER_KEY, current.slice(-MAX_LEDGER));
  return current[index];
}

export function getLedger({ limit = 50, source, status } = {}) {
  let rows = parseJson(getSetting(LEDGER_KEY, '[]'), []);
  if (source) rows = rows.filter(x => x.source === source);
  if (status) rows = rows.filter(x => x.status === status);
  return rows.slice(-Math.max(1, Math.min(Number(limit) || 50, 200))).reverse();
}

export function getSession(identityInput = {}) {
  const identity = normalizeIdentity(identityInput);
  const stored = parseJson(getSetting(`${SESSION_PREFIX}${identity.sessionKey}`, '{}'), {});
  return {
    identity,
    createdAt: stored.createdAt || null,
    updatedAt: stored.updatedAt || null,
    messages: Array.isArray(stored.messages) ? stored.messages : [],
    memoryRefs: Array.isArray(stored.memoryRefs) ? stored.memoryRefs : [],
    metadata: stored.metadata || {},
  };
}

export function appendSessionMessage(identityInput, message) {
  const session = getSession(identityInput);
  const now = new Date().toISOString();
  const next = {
    createdAt: session.createdAt || now,
    updatedAt: now,
    messages: [...session.messages, { ...message, at: message.at || now }].slice(-MAX_SESSION_MESSAGES),
    memoryRefs: session.memoryRefs,
    metadata: session.metadata,
  };
  safeSet(`${SESSION_PREFIX}${session.identity.sessionKey}`, next);
  return { ...next, identity: session.identity };
}

export function gatewayStatus() {
  return {
    ok: true,
    configured: gatewayConfigured(),
    version: 1,
    architecture: 'one_juno_many_interfaces_one_tool_layer',
    interfaces: ['command_center', 'telegram', 'openclaw', 'voice', 'siri_shortcut'],
    permissions: JUNO_PERMISSION_LEVELS,
    ledgerEntries: getLedger({ limit: 500 }).length,
  };
}
