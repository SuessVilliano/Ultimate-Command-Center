import express from 'express';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import { niftyMcp } from '../lib/nifty-mcp-client.js';
import { CAPABILITIES, SOURCE_OF_TRUTH } from '../lib/capability-registry.js';
import { LOCAL_WORKSPACE_MCP_TOOLS, callLocalWorkspaceMcpTool } from './local-workspace-mcp-routes.js';

const PORT = () => process.env.PORT || 3005;
const DEFAULT_AFFILIATE_PROJECT_ID = process.env.NIFTY_AFFILIATE_PROJECT_ID || 'SYXYZ5G8j!';
const MCP_PROTOCOL_VERSION = '2025-11-25';
const SUPPORTED_PROTOCOL_VERSIONS = new Set(['2025-11-25', '2025-06-18', '2025-03-26']);
const READ_SCOPE = 'liv8.read';
const WRITE_SCOPE = 'liv8.write';
const SUPPORTED_SCOPES = [READ_SCOPE, WRITE_SCOPE];
const MAX_TOOL_RESULT_CHARS = 120000;

const jsonSchema = (properties = {}, required = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});
const stringProp = (description, extra = {}) => ({ type: 'string', description, ...extra });
const boolProp = description => ({ type: 'boolean', description });
const numberProp = (description, extra = {}) => ({ type: 'number', description, ...extra });

const COMMAND_TOOLS = [
  {
    name: 'command_center_status',
    title: 'Command Center Status',
    description: 'Read live connection and source-system status for LIV8 Command Center, including HighLevel, Nifty, Hybrid Journal, and configured integrations.',
    inputSchema: jsonSchema(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'command_center_today',
    title: 'What Needs Me Today',
    description: 'Return a normalized operator view of today: overdue/today Nifty work, calendar commitments, blockers, and live source status.',
    inputSchema: jsonSchema({
      includeAllOpenTasks: boolProp('When true, include additional open tasks after the urgent/today set.'),
      taskLimit: numberProp('Maximum tasks to return.', { minimum: 1, maximum: 100 }),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'system_capabilities',
    title: 'LIV8 Capability Map',
    description: 'Read the Command Center source-of-truth and capability registry so an AI client knows which system owns each kind of data and which actions are gated.',
    inputSchema: jsonSchema(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'nifty_list_tasks',
    title: 'List Nifty Tasks',
    description: 'Read live Nifty tasks from the connected Nifty MCP source. Supports project, completion, text, and result-limit filtering.',
    inputSchema: jsonSchema({
      projectId: stringProp('Optional Nifty project ID.'),
      search: stringProp('Optional case-insensitive text search across task name, description, project, status, and list.'),
      includeCompleted: boolProp('Include completed tasks.'),
      limit: numberProp('Maximum tasks to return.', { minimum: 1, maximum: 250 }),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'nifty_create_task',
    title: 'Create Nifty Task',
    description: 'Create a task in Nifty. Use Nifty as the canonical task system rather than creating a duplicate local task.',
    inputSchema: jsonSchema({
      projectId: stringProp('Nifty project ID. Defaults to the Affiliate Career project when omitted.'),
      name: stringProp('Task name.', { minLength: 1 }),
      description: stringProp('Task context or rationale.'),
      dueDate: stringProp('Optional ISO 8601 due timestamp.'),
      listId: stringProp('Optional Nifty list ID.'),
      statusId: stringProp('Optional Nifty status ID.'),
      parentTaskId: stringProp('Optional parent task ID for a subtask.'),
    }, ['name']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'nifty_update_task',
    title: 'Update Nifty Task',
    description: 'Update safe operational fields on an existing Nifty task. Does not delete or archive tasks.',
    inputSchema: jsonSchema({
      taskId: stringProp('Nifty task ID.', { minLength: 1 }),
      name: stringProp('Replacement task name.'),
      description: stringProp('Replacement task description.'),
      dueDate: stringProp('ISO 8601 due timestamp.'),
      statusId: stringProp('Nifty status ID.'),
      listId: stringProp('Nifty list ID.'),
      completed: boolProp('Set task completion state.'),
    }, ['taskId']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'nifty_complete_task',
    title: 'Complete Nifty Task',
    description: 'Mark one Nifty task completed.',
    inputSchema: jsonSchema({ taskId: stringProp('Nifty task ID.', { minLength: 1 }) }, ['taskId']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'affiliate_search',
    title: 'Search Affiliate CRM',
    description: 'Search the staff-scoped company HighLevel CRM for affiliates/contacts. Results are restricted to the configured staff user.',
    inputSchema: jsonSchema({
      query: stringProp('Name, email, phone, affiliate ID, or other contact search text.'),
      limit: numberProp('Maximum contacts to return.', { minimum: 1, maximum: 50 }),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'affiliate_brief',
    title: 'Affiliate Brief',
    description: 'Get a staff-scoped affiliate brief from HighLevel including contact data, notes, recent activity, and opportunities.',
    inputSchema: jsonSchema({ identifier: stringProp('Affiliate email, contact ID, or search identifier.', { minLength: 1 }) }, ['identifier']),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'affiliate_add_note',
    title: 'Add Affiliate CRM Note',
    description: 'Add an internal note to a staff-scoped company HighLevel contact. This never sends a message to the affiliate.',
    inputSchema: jsonSchema({
      contactId: stringProp('HighLevel contact ID.', { minLength: 1 }),
      body: stringProp('Internal CRM note body.', { minLength: 1 }),
    }, ['contactId', 'body']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'affiliate_create_followup',
    title: 'Create Affiliate Follow-up',
    description: 'Resolve an affiliate in the staff-scoped HighLevel CRM, create the follow-up in Nifty, and optionally write an internal CRM note. It does not send outbound communication.',
    inputSchema: jsonSchema({
      identifier: stringProp('Affiliate email, contact ID, or search identifier.', { minLength: 1 }),
      taskName: stringProp('Optional Nifty task name.'),
      description: stringProp('Optional Nifty task context.'),
      dueDate: stringProp('Optional ISO 8601 due timestamp.'),
      projectId: stringProp('Optional Nifty project ID. Defaults to Affiliate Career.'),
      writeCrmNote: boolProp('Whether to add a matching internal HighLevel note. Defaults true.'),
      crmNote: stringProp('Optional explicit internal CRM note body.'),
    }, ['identifier']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'calendar_today',
    title: 'Calendar Today',
    description: "Read today's connected calendar events from Command Center.",
    inputSchema: jsonSchema(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'calendar_upcoming',
    title: 'Upcoming Calendar',
    description: 'Read upcoming calendar events for a bounded number of hours.',
    inputSchema: jsonSchema({ hours: numberProp('Hours ahead to read.', { minimum: 1, maximum: 1440 }) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'trading_status',
    title: 'Hybrid Journal Status',
    description: 'Read Hybrid Journal / trading-intelligence connection status. This tool cannot place trades.',
    inputSchema: jsonSchema(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'trading_snapshot',
    title: 'Trading Snapshot',
    description: 'Read the latest Hybrid Journal trading snapshot. This tool is analysis-only and cannot place or modify orders.',
    inputSchema: jsonSchema({ limit: numberProp('Maximum recent items.', { minimum: 1, maximum: 100 }) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'trading_performance',
    title: 'Trading Performance',
    description: 'Read a Hybrid Journal performance analysis. No execution capability is exposed through this MCP gateway.',
    inputSchema: jsonSchema({ analysisType: stringProp('Analysis type. Defaults to weekly_summary.') }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'health_snapshot',
    title: 'Health Snapshot',
    description: 'Read the Command Center health snapshot and Oura snapshot from connected sources. This is data retrieval, not medical diagnosis.',
    inputSchema: jsonSchema(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
];

const TOOLS = [...COMMAND_TOOLS, ...LOCAL_WORKSPACE_MCP_TOOLS];
const TOOL_MAP = new Map(TOOLS.map(tool => [tool.name, tool]));
const WRITE_TOOLS = new Set(TOOLS.filter(tool => !tool.annotations?.readOnlyHint).map(tool => tool.name));
const WORKSPACE_TOOL_NAMES = new Set(LOCAL_WORKSPACE_MCP_TOOLS.map(tool => tool.name));

function publicBaseUrl(req) {
  const configured = String(process.env.LIV8_MCP_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
}
function resourceUrl(req) { return `${publicBaseUrl(req)}/mcp`; }
function authSecret() { return String(process.env.LIV8_MCP_AUTH_SECRET || process.env.LIV8_MCP_API_KEY || '').trim(); }
function ownerPassword() { return String(process.env.LIV8_MCP_OWNER_PASSWORD || '').trim(); }
function apiKey() { return String(process.env.LIV8_MCP_API_KEY || '').trim(); }
function secureEqual(a, b) {
  const left = createHash('sha256').update(String(a || '')).digest();
  const right = createHash('sha256').update(String(b || '')).digest();
  return timingSafeEqual(left, right);
}
function b64urlJson(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function signPayload(payload) {
  const secret = authSecret();
  if (!secret) throw Object.assign(new Error('LIV8 MCP auth secret is not configured.'), { status: 503 });
  const body = b64urlJson(payload);
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}
function verifyPayload(token, expectedKind) {
  const secret = authSecret();
  if (!secret || typeof token !== 'string') return null;
  const [body, signature, ...extra] = token.split('.');
  if (!body || !signature || extra.length) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (!secureEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (expectedKind && payload.kind !== expectedKind) return null;
    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
function scopeSet(value) { return new Set(String(value || '').split(/\s+/).filter(Boolean)); }
function normalizedScope(requested) {
  const wanted = scopeSet(requested);
  const allowed = SUPPORTED_SCOPES.filter(scope => wanted.size === 0 || wanted.has(scope));
  return (allowed.length ? allowed : [READ_SCOPE]).join(' ');
}
function issueTokens({ clientId, scope, req }) {
  const now = Math.floor(Date.now() / 1000);
  const normalized = normalizedScope(scope);
  const common = { sub: 'liv8-owner', clientId, scope: normalized, aud: resourceUrl(req) };
  return {
    access_token: signPayload({ ...common, kind: 'access', iat: now, exp: now + 3600, jti: randomUUID() }),
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: signPayload({ ...common, kind: 'refresh', iat: now, exp: now + 60 * 60 * 24 * 30, jti: randomUUID() }),
    scope: normalized,
  };
}

function isPrivateHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.local')) return true;
  const ipVersion = isIP(h);
  if (!ipVersion) return false;
  if (ipVersion === 4) {
    const [a, b] = h.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127);
  }
  return h === '::1' || h.startsWith('fc') || h.startsWith('fd') ||
    h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb');
}
function validateRedirectUri(value) {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    return url.protocol === 'https:' || loopback;
  } catch {
    return false;
  }
}
function decodeRegisteredClient(clientId) {
  if (!String(clientId || '').startsWith('liv8dcr.')) return null;
  return verifyPayload(String(clientId).slice('liv8dcr.'.length), 'client');
}
async function clientMetadata(clientId) {
  const registered = decodeRegisteredClient(clientId);
  if (registered) return registered.metadata;

  let url;
  try { url = new URL(clientId); }
  catch { throw Object.assign(new Error('Unsupported OAuth client_id.'), { status: 400 }); }
  if (url.protocol !== 'https:' || isPrivateHostname(url.hostname)) {
    throw Object.assign(new Error('OAuth client metadata URL must be public HTTPS.'), { status: 400 });
  }
  const allowedHosts = String(process.env.LIV8_MCP_ALLOWED_CLIENT_HOSTS || '')
    .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (allowedHosts.length && !allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw Object.assign(new Error('OAuth client host is not allowlisted.'), { status: 403 });
  }
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw Object.assign(new Error(`Could not read OAuth client metadata (${response.status}).`), { status: 400 });
  const text = await response.text();
  if (text.length > 65536) throw Object.assign(new Error('OAuth client metadata document is too large.'), { status: 400 });
  let metadata;
  try { metadata = JSON.parse(text); }
  catch { throw Object.assign(new Error('OAuth client metadata is not valid JSON.'), { status: 400 }); }
  return metadata;
}
async function validateOAuthClient(clientId, redirectUri) {
  if (!clientId || !validateRedirectUri(redirectUri)) throw Object.assign(new Error('Invalid OAuth client or redirect URI.'), { status: 400 });
  const metadata = await clientMetadata(clientId);
  const redirects = Array.isArray(metadata?.redirect_uris) ? metadata.redirect_uris : [];
  if (!redirects.includes(redirectUri)) throw Object.assign(new Error('redirect_uri is not registered for this OAuth client.'), { status: 400 });
  return metadata;
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function authorizationForm(params, error = '') {
  const hidden = ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'code_challenge', 'code_challenge_method', 'resource']
    .map(key => `<input type="hidden" name="${key}" value="${escapeHtml(params[key] || '')}">`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize LIV8 Command Center</title><style>body{font-family:Inter,system-ui,sans-serif;background:#07110f;color:#eefaf7;display:grid;place-items:center;min-height:100vh;margin:0}.card{width:min(440px,calc(100vw - 32px));background:#101a18;border:1px solid #263a35;border-radius:18px;padding:28px;box-shadow:0 24px 80px #0008}h1{margin:0 0 8px;font-size:24px}p{color:#9db2ac;line-height:1.5}.scope{background:#08100e;padding:12px;border-radius:10px;font-size:13px;margin:16px 0}input[type=password]{width:100%;box-sizing:border-box;background:#07100e;color:white;border:1px solid #35534b;border-radius:10px;padding:12px;margin:8px 0 16px}button{width:100%;background:#14b8a6;color:#03110e;border:0;border-radius:10px;padding:12px;font-weight:800;cursor:pointer}.error{color:#fca5a5}.foot{font-size:12px;margin-top:16px}</style></head><body><form class="card" method="post" action="/oauth/authorize">${hidden}<h1>LIV8 Command Center</h1><p>An MCP client is requesting access to your private Command Center.</p>${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}<div class="scope">Requested access: ${escapeHtml(normalizedScope(params.scope))}</div><label>Owner password</label><input name="password" type="password" autocomplete="current-password" required><button type="submit">Authorize</button><p class="foot">Only authorize clients you recognize. Live trade execution, outbound messaging, and deletes are not exposed by this gateway.</p></form></body></html>`;
}
function mcpCors(_req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,MCP-Protocol-Version,Mcp-Session-Id,Mcp-Method,Mcp-Name');
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate,MCP-Protocol-Version');
  next();
}
function unauthorized(req, res) {
  const metadata = `${publicBaseUrl(req)}/.well-known/oauth-protected-resource`;
  res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${metadata}"`);
  return res.status(401).json({ error: 'unauthorized', error_description: 'Authenticate to access the LIV8 Command Center MCP server.' });
}
function authenticateMcp(req, res, next) {
  const auth = String(req.get('authorization') || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const key = apiKey();
  if (token && key && secureEqual(token, key)) {
    req.mcpAuth = { sub: 'liv8-owner', scope: `${READ_SCOPE} ${WRITE_SCOPE}`, authType: 'api_key' };
    return next();
  }
  const payload = token ? verifyPayload(token, 'access') : null;
  if (payload) {
    req.mcpAuth = { ...payload, authType: 'oauth' };
    return next();
  }
  if (!authSecret() && !key) return res.status(503).json({ error: 'LIV8 MCP authentication is not configured.' });
  return unauthorized(req, res);
}
function assertWriteScope(auth) {
  if (!scopeSet(auth?.scope).has(WRITE_SCOPE)) throw Object.assign(new Error('This connection does not have liv8.write scope.'), { status: 403 });
}

function rowsFrom(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const key of ['items', 'results', 'data', 'tasks', 'contacts', 'events']) if (Array.isArray(payload[key])) return payload[key];
  return [];
}
function unwrapToolResult(result) {
  if (!result) return null;
  if (result.structuredContent) return result.structuredContent;
  const content = Array.isArray(result.content) ? result.content : [];
  for (const item of content) {
    if (item?.type !== 'text' || !item.text) continue;
    try { return JSON.parse(item.text); } catch {}
  }
  return result;
}
async function internal(path, { method = 'GET', body } = {}) {
  const response = await fetch(`http://127.0.0.1:${PORT()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  let data;
  try { data = await response.json(); }
  catch { data = { text: await response.text().catch(() => '') }; }
  if (!response.ok) throw Object.assign(new Error(data?.error || `HTTP ${response.status}`), { status: response.status, data });
  return data;
}
async function getNiftyTool(exactName, fallback) {
  if (!niftyMcp.configured) throw Object.assign(new Error('Nifty MCP is not configured.'), { status: 503 });
  const tools = await niftyMcp.listTools();
  const tool = tools.find(item => item.name === exactName) || tools.find(item => fallback.test(item.name));
  if (!tool) throw Object.assign(new Error(`Nifty MCP tool ${exactName} is unavailable.`), { status: 501 });
  return tool;
}
async function niftyCreateTask(args) {
  const tool = await getNiftyTool('tasks_mutate', /task.*mutate|task.*create/i);
  const result = await niftyMcp.callTool(tool.name, {
    resource: 'task',
    operation: 'create',
    projectId: args.projectId || DEFAULT_AFFILIATE_PROJECT_ID,
    name: args.name,
    ...(args.description !== undefined ? { description: args.description } : {}),
    ...(args.dueDate ? { dueDate: args.dueDate } : {}),
    ...(args.listId ? { listId: args.listId } : {}),
    ...(args.statusId ? { statusId: args.statusId } : {}),
    ...(args.parentTaskId ? { parentTaskId: args.parentTaskId } : {}),
  });
  return unwrapToolResult(result);
}
async function niftyUpdateTask(args) {
  const tool = await getNiftyTool('tasks_mutate', /task.*mutate|task.*update/i);
  const patch = {};
  for (const key of ['name', 'description', 'dueDate', 'statusId', 'listId', 'completed']) if (args[key] !== undefined) patch[key] = args[key];
  if (!Object.keys(patch).length) throw Object.assign(new Error('Provide at least one task field to update.'), { status: 400 });
  const result = await niftyMcp.callTool(tool.name, { resource: 'task', operation: 'update', id: args.taskId, ...patch });
  return unwrapToolResult(result);
}
function taskProjectId(task) { return task?.projectId || task?.project?.id || null; }
function taskSearchText(task) {
  return [task?.name, task?.description, task?.project?.name, task?.status?.name, task?.list?.name, task?.dueAt, task?.dueDate]
    .filter(Boolean).join(' ').toLowerCase();
}
async function listNiftyTasks(args = {}) {
  const params = new URLSearchParams({
    limit: String(Math.min(Number(args.limit) || 100, 250)),
    includeCompleted: args.includeCompleted ? 'true' : 'false',
  });
  const payload = await internal(`/api/nifty/mcp/tasks?${params}`);
  let tasks = rowsFrom(payload);
  if (args.projectId) tasks = tasks.filter(task => String(taskProjectId(task)) === String(args.projectId));
  if (args.search) {
    const needle = String(args.search).toLowerCase();
    tasks = tasks.filter(task => taskSearchText(task).includes(needle));
  }
  tasks.sort((a, b) => {
    const ad = new Date(a.dueAt || a.dueDate || 8640000000000000).getTime();
    const bd = new Date(b.dueAt || b.dueDate || 8640000000000000).getTime();
    return ad - bd;
  });
  return { source: 'nifty-mcp', total: tasks.length, tasks: tasks.slice(0, Math.min(Number(args.limit) || 100, 250)) };
}
function dateKeyInZone(value = new Date(), timeZone = process.env.COMMAND_CENTER_TIMEZONE || 'America/New_York') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return new Date(value).toISOString().slice(0, 10);
  }
}
function taskDateKey(task) {
  const value = task?.dueAt || task?.dueDate || task?.due_date;
  return value ? dateKeyInZone(value) : null;
}
async function safeSource(name, fn) {
  const started = Date.now();
  try { return { name, ok: true, ms: Date.now() - started, data: await fn() }; }
  catch (error) { return { name, ok: false, ms: Date.now() - started, error: error?.message || 'Unavailable' }; }
}
async function commandCenterStatus() {
  const sources = await Promise.all([
    safeSource('liv8_connect', () => internal('/api/liv8-connect/status?account=company')),
    safeSource('nifty', () => internal('/api/nifty/mcp/status')),
    safeSource('hybrid_journal', () => internal('/api/trading/hybrid-journal/status')),
    safeSource('workspace', () => callLocalWorkspaceMcpTool('workspace_status')),
    safeSource('integrations', () => internal('/api/integrations/status')),
  ]);
  return { generatedAt: new Date().toISOString(), sources, sourceOfTruth: SOURCE_OF_TRUTH };
}
async function commandCenterToday(args = {}) {
  const taskLimit = Math.min(Number(args.taskLimit) || 30, 100);
  const [taskSource, calendar, status] = await Promise.all([
    safeSource('nifty', () => listNiftyTasks({ includeCompleted: false, limit: 250 })),
    safeSource('calendar', () => internal('/api/calendar/today')),
    safeSource('status', commandCenterStatus),
  ]);
  const today = dateKeyInZone();
  const allTasks = taskSource.ok ? taskSource.data.tasks || [] : [];
  const urgent = allTasks.filter(task => {
    const due = taskDateKey(task);
    return due && due <= today;
  });
  const blockers = allTasks.filter(task => /blocked|waiting/i.test(String(task?.status?.name || task?.status || '')));
  const extra = args.includeAllOpenTasks
    ? allTasks.filter(task => !urgent.some(urgentTask => urgentTask.id === task.id)).slice(0, taskLimit)
    : [];
  return {
    generatedAt: new Date().toISOString(),
    date: today,
    urgentTasks: urgent.slice(0, taskLimit),
    blockers: blockers.slice(0, taskLimit),
    additionalOpenTasks: extra,
    taskCounts: { open: allTasks.length, urgentOrOverdue: urgent.length, blockers: blockers.length },
    calendar: calendar.ok ? calendar.data : [],
    sourceStatus: status.ok ? status.data : status,
  };
}
function requireArg(args, name) {
  const value = args?.[name];
  if (value === undefined || value === null || value === '') throw Object.assign(new Error(`${name} is required.`), { status: 400 });
  return value;
}

async function dispatchTool(name, args = {}, auth = {}) {
  if (WRITE_TOOLS.has(name)) assertWriteScope(auth);
  if (WORKSPACE_TOOL_NAMES.has(name)) return callLocalWorkspaceMcpTool(name, args);

  switch (name) {
    case 'command_center_status':
      return commandCenterStatus();
    case 'command_center_today':
      return commandCenterToday(args);
    case 'system_capabilities':
      return {
        sourceOfTruth: SOURCE_OF_TRUTH,
        capabilities: CAPABILITIES,
        safety: { genericMcpExcludes: ['live trade execution', 'outbound messaging', 'deletes', 'bulk destructive changes'] },
      };
    case 'nifty_list_tasks':
      return listNiftyTasks(args);
    case 'nifty_create_task':
      requireArg(args, 'name');
      return niftyCreateTask(args);
    case 'nifty_update_task':
      requireArg(args, 'taskId');
      return niftyUpdateTask(args);
    case 'nifty_complete_task':
      return niftyUpdateTask({ taskId: requireArg(args, 'taskId'), completed: true });
    case 'affiliate_search': {
      const params = new URLSearchParams({
        account: 'company',
        q: String(args.query || ''),
        limit: String(Math.min(Number(args.limit) || 25, 50)),
      });
      return internal(`/api/liv8-connect/highlevel/contacts?${params}`);
    }
    case 'affiliate_brief': {
      const params = new URLSearchParams({ account: 'company', q: String(requireArg(args, 'identifier')) });
      return internal(`/api/liv8-connect/affiliate/brief?${params}`);
    }
    case 'affiliate_add_note': {
      const contactId = requireArg(args, 'contactId');
      return internal(`/api/liv8-connect/highlevel/contacts/${encodeURIComponent(contactId)}/notes?account=company`, {
        method: 'POST',
        body: { body: requireArg(args, 'body') },
      });
    }
    case 'affiliate_create_followup': {
      const identifier = String(requireArg(args, 'identifier'));
      const brief = await internal(`/api/liv8-connect/affiliate/brief?${new URLSearchParams({ account: 'company', q: identifier })}`);
      const affiliate = brief?.affiliate || {};
      const contactId = affiliate.id || affiliate.contactId;
      if (!contactId) throw Object.assign(new Error('Affiliate resolved without a HighLevel contact ID.'), { status: 409 });
      const taskName = args.taskName || `Affiliate follow-up — ${affiliate.name || affiliate.email || identifier}`;
      const description = args.description || [
        'Created through LIV8 Command Center MCP.',
        `HighLevel Contact ID: ${contactId}`,
        affiliate.email ? `Email: ${affiliate.email}` : null,
      ].filter(Boolean).join('\n');
      const task = await niftyCreateTask({
        projectId: args.projectId || DEFAULT_AFFILIATE_PROJECT_ID,
        name: taskName,
        description,
        dueDate: args.dueDate,
      });
      let crmNote = null;
      let crmNoteError = null;
      if (args.writeCrmNote !== false) {
        const noteBody = args.crmNote || `Follow-up created in Nifty via LIV8 Command Center MCP: ${taskName}${args.dueDate ? ` (due ${args.dueDate})` : ''}.`;
        try {
          crmNote = await internal(`/api/liv8-connect/highlevel/contacts/${encodeURIComponent(contactId)}/notes?account=company`, {
            method: 'POST',
            body: { body: noteBody },
          });
        } catch (error) {
          crmNoteError = error.message;
        }
      }
      return { success: true, affiliate, task, crmNote, crmNoteError, partial: Boolean(crmNoteError) };
    }
    case 'calendar_today':
      return internal('/api/calendar/today');
    case 'calendar_upcoming': {
      const hours = Math.max(1, Math.min(Number(args.hours) || 48, 1440));
      return internal(`/api/calendar/upcoming?hours=${hours}`);
    }
    case 'trading_status':
      return internal('/api/trading/hybrid-journal/status');
    case 'trading_snapshot':
      return internal(`/api/trading/hybrid-journal/snapshot?limit=${Math.max(1, Math.min(Number(args.limit) || 50, 100))}`);
    case 'trading_performance':
      return internal('/api/trading/hybrid-journal/analyze', { method: 'POST', body: { analysisType: args.analysisType || 'weekly_summary' } });
    case 'health_snapshot': {
      const [health, oura] = await Promise.all([
        safeSource('health_os', () => internal('/api/hs/health/snapshot')),
        safeSource('oura', () => internal('/api/hs/health/oura/snapshot')),
      ]);
      return { generatedAt: new Date().toISOString(), health, oura };
    }
    case 'highlevel_search_contacts':
      return dispatchTool('affiliate_search', { query: args.query, limit: args.limit }, auth);
    case 'highlevel_get_contact':
      return internal(`/api/liv8-connect/highlevel/contacts/${encodeURIComponent(requireArg(args, 'contactId'))}?account=company`);
    case 'highlevel_search_opportunities': {
      const query = Object.fromEntries(Object.entries(args)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]));
      return internal(`/api/liv8-connect/highlevel/opportunities?${new URLSearchParams({ account: 'company', ...query })}`);
    }
    case 'highlevel_add_contact_note':
      return dispatchTool('affiliate_add_note', { contactId: args.contactId, body: args.body }, auth);
    case 'nifty_create_followup_task':
      return dispatchTool('nifty_create_task', {
        projectId: args.projectId,
        name: args.name,
        description: args.description,
        dueDate: args.dueDate,
      }, auth);
    default:
      throw Object.assign(new Error(`Unknown LIV8 MCP tool: ${name}`), { status: 404 });
  }
}

function clipResult(value) {
  let text;
  try { text = JSON.stringify(value); }
  catch { text = String(value); }
  if (text.length <= MAX_TOOL_RESULT_CHARS) return { text, structured: value };
  const clipped = {
    truncated: true,
    note: `Tool result exceeded ${MAX_TOOL_RESULT_CHARS} characters and was clipped. Narrow the query or lower the limit.`,
    preview: text.slice(0, MAX_TOOL_RESULT_CHARS),
  };
  return { text: JSON.stringify(clipped), structured: clipped };
}
function toolResult(value) {
  const { text, structured } = clipResult(value);
  return { content: [{ type: 'text', text }], structuredContent: structured, isError: false };
}
function toolError(error) {
  const payload = { error: error?.message || 'Tool failed', status: error?.status || 500, details: error?.data || null };
  return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload, isError: true };
}
function rpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } };
}
async function handleRpc(message, req) {
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0' || !message.method) {
    return rpcError(message?.id, -32600, 'Invalid Request');
  }
  const id = message.id;
  const isNotification = id === undefined || id === null;
  if (message.method === 'notifications/initialized') return null;
  if (message.method === 'ping') return isNotification ? null : rpcResult(id, {});
  if (message.method === 'initialize') {
    if (isNotification) return null;
    const requested = message.params?.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requested) ? requested : MCP_PROTOCOL_VERSION;
    return rpcResult(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'liv8-command-center', title: 'LIV8 Command Center', version: '1.0.0' },
      instructions: 'Use LIV8 Command Center as an authenticated operating gateway. Nifty owns tasks, HighLevel owns affiliate CRM data, Hybrid Journal owns trading records, workspace tools are allow-listed, and high-risk actions are intentionally not exposed through this generic MCP server.',
    });
  }
  if (message.method === 'tools/list') {
    if (isNotification) return null;
    return rpcResult(id, { tools: TOOLS });
  }
  if (message.method === 'tools/call') {
    if (isNotification) return null;
    const name = message.params?.name;
    if (!name || !TOOL_MAP.has(name)) return rpcError(id, -32602, `Unknown tool: ${name || '(missing)'}`);
    try {
      const result = await dispatchTool(name, message.params?.arguments || {}, req.mcpAuth || {});
      return rpcResult(id, toolResult(result));
    } catch (error) {
      return rpcResult(id, toolError(error));
    }
  }
  return isNotification ? null : rpcError(id, -32601, `Method not found: ${message.method}`);
}

export function registerLiv8ConnectMcpRoutes(app) {
  app.use('/mcp', mcpCors);

  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    const base = publicBaseUrl(req);
    res.json({
      resource: `${base}/mcp`,
      authorization_servers: [base],
      scopes_supported: SUPPORTED_SCOPES,
      bearer_methods_supported: ['header'],
      resource_name: 'LIV8 Command Center MCP',
    });
  });
  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const base = publicBaseUrl(req);
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      scopes_supported: SUPPORTED_SCOPES,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: true,
    });
  });
  app.post('/oauth/register', express.json({ limit: '32kb' }), (req, res) => {
    try {
      if (!authSecret()) return res.status(503).json({ error: 'server_error', error_description: 'OAuth signing secret is not configured.' });
      const redirects = Array.isArray(req.body?.redirect_uris) ? req.body.redirect_uris : [];
      if (!redirects.length || redirects.length > 10 || redirects.some(uri => !validateRedirectUri(uri))) {
        return res.status(400).json({ error: 'invalid_redirect_uri' });
      }
      const metadata = {
        client_name: String(req.body?.client_name || 'MCP client').slice(0, 120),
        redirect_uris: redirects,
        grant_types: Array.isArray(req.body?.grant_types) && req.body.grant_types.length ? req.body.grant_types : ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      };
      const now = Math.floor(Date.now() / 1000);
      const clientToken = signPayload({ kind: 'client', metadata, iat: now, exp: now + 60 * 60 * 24 * 365 });
      return res.status(201).json({ ...metadata, client_id: `liv8dcr.${clientToken}`, client_id_issued_at: now });
    } catch (error) {
      return res.status(error.status || 500).json({ error: 'server_error', error_description: error.message });
    }
  });
  app.get('/oauth/authorize', async (req, res) => {
    try {
      if (!authSecret() || !ownerPassword()) return res.status(503).send('LIV8 MCP OAuth is not configured.');
      const params = req.query || {};
      if (params.response_type !== 'code') throw Object.assign(new Error('Only response_type=code is supported.'), { status: 400 });
      if (!params.code_challenge || params.code_challenge_method !== 'S256') throw Object.assign(new Error('PKCE S256 is required.'), { status: 400 });
      await validateOAuthClient(params.client_id, params.redirect_uri);
      return res.type('html').send(authorizationForm(params));
    } catch (error) {
      return res.status(error.status || 400).type('html').send(authorizationForm(req.query || {}, error.message));
    }
  });
  app.post('/oauth/authorize', express.urlencoded({ extended: false, limit: '32kb' }), async (req, res) => {
    try {
      if (!authSecret() || !ownerPassword()) return res.status(503).send('LIV8 MCP OAuth is not configured.');
      const params = req.body || {};
      if (params.response_type !== 'code' || !params.code_challenge || params.code_challenge_method !== 'S256') {
        throw Object.assign(new Error('Invalid OAuth authorization request.'), { status: 400 });
      }
      await validateOAuthClient(params.client_id, params.redirect_uri);
      if (!secureEqual(params.password, ownerPassword())) {
        return res.status(401).type('html').send(authorizationForm(params, 'Incorrect owner password.'));
      }
      const now = Math.floor(Date.now() / 1000);
      const code = signPayload({
        kind: 'code',
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        codeChallenge: params.code_challenge,
        scope: normalizedScope(params.scope),
        resource: params.resource || null,
        iat: now,
        exp: now + 300,
        jti: randomUUID(),
      });
      const redirect = new URL(params.redirect_uri);
      redirect.searchParams.set('code', code);
      if (params.state) redirect.searchParams.set('state', params.state);
      redirect.searchParams.set('iss', publicBaseUrl(req));
      return res.redirect(302, redirect.toString());
    } catch (error) {
      return res.status(error.status || 400).type('html').send(authorizationForm(req.body || {}, error.message));
    }
  });
  app.post('/oauth/token', express.urlencoded({ extended: false, limit: '32kb' }), (req, res) => {
    try {
      const body = req.body || {};
      if (body.grant_type === 'authorization_code') {
        const code = verifyPayload(body.code, 'code');
        if (!code || code.clientId !== body.client_id || code.redirectUri !== body.redirect_uri) return res.status(400).json({ error: 'invalid_grant' });
        const verifier = String(body.code_verifier || '');
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        if (!verifier || !secureEqual(challenge, code.codeChallenge)) {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed.' });
        }
        return res.json(issueTokens({ clientId: body.client_id, scope: code.scope, req }));
      }
      if (body.grant_type === 'refresh_token') {
        const refresh = verifyPayload(body.refresh_token, 'refresh');
        if (!refresh) return res.status(400).json({ error: 'invalid_grant' });
        if (body.client_id && refresh.clientId !== body.client_id) return res.status(400).json({ error: 'invalid_client' });
        return res.json(issueTokens({ clientId: refresh.clientId, scope: refresh.scope, req }));
      }
      return res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (error) {
      return res.status(error.status || 500).json({ error: 'server_error', error_description: error.message });
    }
  });

  app.options('/mcp', (_req, res) => res.status(204).end());
  app.get('/mcp', authenticateMcp, (_req, res) => res.status(405).set('Allow', 'POST, OPTIONS').json({ error: 'SSE GET is not enabled. Use Streamable HTTP POST.' }));
  app.delete('/mcp', authenticateMcp, (_req, res) => res.status(405).set('Allow', 'POST, OPTIONS').json({ error: 'This MCP server is stateless; there is no session to delete.' }));
  app.post('/mcp', authenticateMcp, async (req, res) => {
    const body = req.body;
    if (body === undefined || body === null) return res.status(400).json(rpcError(null, -32700, 'Parse error'));
    try {
      if (Array.isArray(body)) {
        const responses = (await Promise.all(body.map(item => handleRpc(item, req)))).filter(Boolean);
        if (!responses.length) return res.status(202).end();
        res.setHeader('MCP-Protocol-Version', MCP_PROTOCOL_VERSION);
        return res.json(responses);
      }
      const response = await handleRpc(body, req);
      if (!response) return res.status(202).end();
      res.setHeader('MCP-Protocol-Version', response?.result?.protocolVersion || MCP_PROTOCOL_VERSION);
      return res.json(response);
    } catch (error) {
      return res.status(500).json(rpcError(body?.id, -32603, 'Internal error', { message: error.message }));
    }
  });

  app.get('/api/liv8-connect/mcp/status', (req, res) => {
    res.json({
      service: 'LIV8 Command Center MCP',
      endpoint: `${publicBaseUrl(req)}/mcp`,
      protocol: MCP_PROTOCOL_VERSION,
      transport: 'streamable-http-json',
      stateless: true,
      unified: true,
      auth: {
        apiKeyConfigured: Boolean(apiKey()),
        oauthConfigured: Boolean(authSecret() && ownerPassword()),
        protectedResourceMetadata: `${publicBaseUrl(req)}/.well-known/oauth-protected-resource`,
      },
      tools: {
        count: TOOLS.length,
        read: TOOLS.filter(tool => tool.annotations?.readOnlyHint).length,
        write: TOOLS.filter(tool => !tool.annotations?.readOnlyHint).length,
        workspace: LOCAL_WORKSPACE_MCP_TOOLS.length,
      },
      safety: { liveTradingExposed: false, outboundMessagingExposed: false, deletesExposed: false },
    });
  });
  app.get('/api/liv8-connect/mcp/tools', (_req, res) => res.json({ tools: TOOLS }));
  app.post('/api/liv8-connect/mcp/call', async (req, res) => {
    try {
      const { tool, name, arguments: args = {} } = req.body || {};
      const toolName = tool || name;
      if (!toolName) return res.status(400).json({ error: 'tool is required' });
      const result = await dispatchTool(toolName, args, { sub: 'internal', scope: `${READ_SCOPE} ${WRITE_SCOPE}`, authType: 'internal' });
      return res.json({ success: true, tool: toolName, result });
    } catch (error) {
      return res.status(error.status || 500).json({ success: false, error: error.message, details: error.data || null });
    }
  });
}

export default registerLiv8ConnectMcpRoutes;
