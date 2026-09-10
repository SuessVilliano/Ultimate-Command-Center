import { highlevel } from '../lib/highlevel-integration.js';

const safeJson = (v, fallback = {}) => { try { return JSON.parse(v); } catch { return fallback; } };

function connectorConfig() {
  return {
    bridgeUrl: process.env.CONNECTOR_BRIDGE_URL || '',
    bridgeKey: process.env.CONNECTOR_BRIDGE_KEY || '',
    mcpUrl: process.env.CONNECTOR_MCP_URL || '',
    mcpToken: process.env.CONNECTOR_MCP_TOKEN || process.env.TASKMAGIC_MCP_TOKEN || '',
    mcpHeaders: safeJson(process.env.CONNECTOR_MCP_HEADERS_JSON || '{}', {}),
    gmailListTool: process.env.CONNECTOR_GMAIL_LIST_TOOL || '',
    gmailSendTool: process.env.CONNECTOR_GMAIL_SEND_TOOL || '',
    calendarListTool: process.env.CONNECTOR_CALENDAR_LIST_TOOL || '',
    calendarCreateTool: process.env.CONNECTOR_CALENDAR_CREATE_TOOL || '',
  };
}

async function parseMcpResponse(response) {
  const text = await response.text();
  const type = response.headers.get('content-type') || '';
  if (!response.ok) throw new Error(`Connector HTTP ${response.status}: ${text.slice(0, 500)}`);
  if (type.includes('text/event-stream')) {
    const lines = text.split(/\r?\n/).filter(x => x.startsWith('data:'));
    const payloads = lines.map(x => safeJson(x.replace(/^data:\s*/, ''), null)).filter(Boolean);
    const last = payloads[payloads.length - 1];
    if (last?.error) throw new Error(last.error.message || 'MCP error');
    return last?.result ?? last ?? {};
  }
  const json = safeJson(text, null);
  if (!json) throw new Error('Connector returned non-JSON data');
  if (json.error) throw new Error(json.error.message || 'MCP error');
  return json.result ?? json;
}

async function mcpToolCall(name, args = {}) {
  const cfg = connectorConfig();
  if (!cfg.mcpUrl) throw new Error('CONNECTOR_MCP_URL is not configured');
  if (!name) throw new Error('Connector tool name is not configured');
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...cfg.mcpHeaders,
    ...(cfg.mcpToken ? { Authorization: `Bearer ${cfg.mcpToken}` } : {}),
  };
  const response = await fetch(cfg.mcpUrl, {
    method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: `${Date.now()}`, method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(25000),
  });
  return parseMcpResponse(response);
}

async function bridgeCall(action, payload = {}) {
  const cfg = connectorConfig();
  if (!cfg.bridgeUrl) throw new Error('CONNECTOR_BRIDGE_URL is not configured');
  const response = await fetch(cfg.bridgeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cfg.bridgeKey ? { Authorization: `Bearer ${cfg.bridgeKey}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }));
  if (!response.ok) throw new Error(data?.error || `Connector bridge HTTP ${response.status}`);
  return data;
}

async function connectorAction(action, toolName, args = {}) {
  const cfg = connectorConfig();
  if (cfg.bridgeUrl) return bridgeCall(action, { args });
  return mcpToolCall(toolName, args);
}

function unwrapRows(payload) {
  if (Array.isArray(payload)) return payload;
  const direct = payload?.items || payload?.messages || payload?.events || payload?.data || payload?.result;
  if (Array.isArray(direct)) return direct;
  const content = payload?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.json && Array.isArray(part.json)) return part.json;
      if (typeof part?.text === 'string') {
        const parsed = safeJson(part.text, null);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed?.items)) return parsed.items;
        if (Array.isArray(parsed?.messages)) return parsed.messages;
        if (Array.isArray(parsed?.events)) return parsed.events;
      }
    }
  }
  return [];
}

function twilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
  };
}

function twilioAuth() {
  const cfg = twilioConfig();
  if (!cfg.accountSid || !cfg.authToken) throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
  return { cfg, Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64')}` };
}

async function twilioList(limit = 100) {
  const { cfg, Authorization } = twilioAuth();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json?PageSize=${Math.min(Math.max(Number(limit) || 100, 1), 200)}`;
  const response = await fetch(url, { headers: { Authorization }, signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `Twilio HTTP ${response.status}`);
  return (data.messages || []).map(m => {
    const whatsapp = String(m.from || '').startsWith('whatsapp:') || String(m.to || '').startsWith('whatsapp:');
    const mine = [cfg.phoneNumber, cfg.whatsappNumber && `whatsapp:${cfg.whatsappNumber.replace(/^whatsapp:/, '')}`].filter(Boolean);
    const inbound = mine.includes(m.to);
    const other = inbound ? m.from : m.to;
    return {
      id: m.sid,
      source: whatsapp ? 'whatsapp' : 'sms',
      channel: whatsapp ? 'WhatsApp' : 'SMS',
      transport: 'twilio',
      direction: inbound ? 'inbound' : 'outbound',
      from: m.from,
      to: m.to,
      contact: other,
      identityKey: `twilio:${String(other || '').replace(/^whatsapp:/, '')}`,
      subject: '',
      body: m.body || '',
      status: m.status,
      createdAt: m.date_sent || m.date_created,
    };
  });
}

async function twilioSend({ channel = 'sms', to, body }) {
  const { cfg, Authorization } = twilioAuth();
  const isWhatsApp = channel === 'whatsapp';
  const from = isWhatsApp ? cfg.whatsappNumber : cfg.phoneNumber;
  if (!from) throw new Error(isWhatsApp ? 'TWILIO_WHATSAPP_NUMBER is not configured' : 'TWILIO_PHONE_NUMBER is not configured');
  if (!to || !body) throw new Error('to and body are required');
  const normalizeWa = value => String(value).startsWith('whatsapp:') ? String(value) : `whatsapp:${value}`;
  const form = new URLSearchParams({
    From: isWhatsApp ? normalizeWa(from) : from,
    To: isWhatsApp ? normalizeWa(to) : to,
    Body: body,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`, {
    method: 'POST', headers: { Authorization, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || `Twilio HTTP ${response.status}`);
  return data;
}

function normalizeGmail(row, i) {
  const from = row.from || row.sender || row.payload?.headers?.find?.(h => h.name?.toLowerCase() === 'from')?.value || '';
  const emailMatch = String(from).match(/<([^>]+)>/)?.[1] || String(from).trim().toLowerCase();
  return {
    id: row.id || row.messageId || `gmail-${i}`,
    source: 'gmail', channel: 'Gmail', transport: 'connector', direction: row.direction || 'inbound',
    from,
    to: row.to || '', contact: from,
    identityKey: `email:${emailMatch}`,
    subject: row.subject || row.snippet || '(No subject)',
    body: row.body || row.text || row.snippet || '',
    status: row.unread === false ? 'read' : 'unread',
    createdAt: row.date || row.createdAt || row.internalDate || new Date().toISOString(),
  };
}

function ghlChannel(row) {
  const raw = String(row.messageType || row.type || '').toLowerCase();
  return raw.includes('whatsapp') ? 'whatsapp' : raw.includes('sms') ? 'sms' : null;
}

async function highLevelConversationList(limit = 120) {
  const status = highlevel.getConfigStatus();
  if (!status.configured) throw new Error('HighLevel PIT/location is not configured');

  const conversationResult = await highlevel.searchConversations({ limit: 100 }).catch(() => ({ conversations: [] }));
  const conversations = conversationResult?.conversations || [];
  const byConversation = new Map(conversations.map(c => [c.id, c]));
  const byContact = new Map(conversations.filter(c => c.contactId).map(c => [c.contactId, c]));

  const fetches = await Promise.allSettled([
    highlevel.exportMessages({ channel: 'SMS', limit, sortOrder: 'desc' }),
    highlevel.exportMessages({ channel: 'WhatsApp', limit, sortOrder: 'desc' }),
  ]);
  const rows = fetches.flatMap(r => r.status === 'fulfilled' ? (r.value?.messages || []) : []);
  if (!rows.length && fetches.every(r => r.status === 'rejected')) throw new Error(fetches[0].reason?.message || 'HighLevel conversations unavailable');

  return rows.map((row, i) => {
    const source = ghlChannel(row);
    if (!source) return null;
    const meta = byConversation.get(row.conversationId) || byContact.get(row.contactId) || {};
    const displayName = meta.fullName || meta.contactName || meta.phone || meta.email || (row.direction === 'inbound' ? row.from : row.to) || 'Unknown contact';
    return {
      id: row.id || `ghl-${i}`,
      source,
      channel: source === 'whatsapp' ? 'WhatsApp' : 'SMS',
      transport: 'highlevel',
      direction: row.direction || 'inbound',
      from: row.from || '',
      to: row.to || '',
      contact: displayName,
      contactId: row.contactId || meta.contactId || '',
      conversationId: row.conversationId || meta.id || '',
      contactPhone: meta.phone || '',
      contactEmail: meta.email || '',
      identityKey: row.contactId ? `ghl:${row.contactId}` : `phone:${String(meta.phone || (row.direction === 'inbound' ? row.from : row.to) || '').replace(/\D/g, '')}`,
      subject: '',
      body: row.body || '',
      status: row.status || '',
      createdAt: row.dateAdded || row.createdAt || new Date().toISOString(),
    };
  }).filter(Boolean);
}

async function sendBusinessMessage({ source, contactId, to, body, subject, replyMessageId, threadId }) {
  const ghl = highlevel.getConfigStatus();
  if (ghl.configured && contactId) {
    const type = source === 'whatsapp' ? 'WhatsApp' : 'SMS';
    return highlevel.sendConversationMessage({
      type,
      contactId,
      message: body,
      subject,
      replyMessageId,
      threadId,
      fromNumber: ghl.primaryPhoneNumber || undefined,
      toNumber: to || undefined,
    });
  }
  return twilioSend({ channel: source, to, body });
}

export function registerConnectedOpsRoutes(app) {
  app.get('/api/connectors/status', (_req, res) => {
    const cfg = connectorConfig();
    const tw = twilioConfig();
    const ghl = highlevel.getConfigStatus();
    res.json({
      connector: { configured: !!(cfg.bridgeUrl || cfg.mcpUrl), mode: cfg.bridgeUrl ? 'bridge' : cfg.mcpUrl ? 'mcp' : 'none', gmail: !!cfg.gmailListTool || !!cfg.bridgeUrl, calendar: !!cfg.calendarListTool || !!cfg.bridgeUrl },
      highlevel: { configured: ghl.configured, messaging: ghl.configured, sms: ghl.configured, whatsapp: ghl.configured, primaryPhoneNumber: ghl.primaryPhoneNumber },
      twilio: { configured: !!(tw.accountSid && tw.authToken), sms: !!tw.phoneNumber, whatsapp: !!tw.whatsappNumber, fallbackOnly: true },
      messaging: { primary: ghl.configured ? 'highlevel' : (tw.accountSid && tw.authToken ? 'twilio' : 'none'), businessLine: ghl.primaryPhoneNumber || tw.phoneNumber || tw.whatsappNumber || null },
    });
  });

  app.get('/api/connectors/gmail/messages', async (req, res) => {
    try {
      const cfg = connectorConfig();
      const data = await connectorAction('gmail.list', cfg.gmailListTool, { limit: Number(req.query.limit) || 50, query: req.query.query || '' });
      res.json({ messages: unwrapRows(data) });
    } catch (e) { res.status(503).json({ error: e.message, messages: [] }); }
  });

  app.post('/api/connectors/gmail/send', async (req, res) => {
    try {
      const cfg = connectorConfig();
      const data = await connectorAction('gmail.send', cfg.gmailSendTool, { to: req.body.to, subject: req.body.subject, body: req.body.body });
      res.json({ ok: true, data });
    } catch (e) { res.status(503).json({ error: e.message }); }
  });

  app.get('/api/connectors/calendar/events', async (req, res) => {
    try {
      const cfg = connectorConfig();
      const data = await connectorAction('calendar.list', cfg.calendarListTool, { start: req.query.start, end: req.query.end, limit: Number(req.query.limit) || 100 });
      res.json({ events: unwrapRows(data) });
    } catch (e) { res.status(503).json({ error: e.message, events: [] }); }
  });

  app.post('/api/connectors/calendar/events', async (req, res) => {
    try {
      const { summary, start, end, description = '', calendarId } = req.body || {};
      if (!summary || !start || !end) return res.status(400).json({ error: 'summary, start and end are required' });
      const cfg = connectorConfig();
      const data = await connectorAction('calendar.create', cfg.calendarCreateTool, { summary, start, end, description, calendarId });
      res.json({ ok: true, event: data });
    } catch (e) { res.status(503).json({ error: e.message }); }
  });

  app.get('/api/connectors/highlevel/messages', async (req, res) => {
    try { res.json({ messages: await highLevelConversationList(req.query.limit || 120), provider: 'highlevel' }); }
    catch (e) { res.status(e.status || 503).json({ error: e.message, messages: [] }); }
  });

  app.post('/api/connectors/highlevel/messages', async (req, res) => {
    try {
      const source = String(req.body?.source || '').toLowerCase();
      if (!['sms', 'whatsapp'].includes(source)) return res.status(400).json({ error: 'source must be sms or whatsapp' });
      const data = await sendBusinessMessage({ ...req.body, source });
      res.json({ ok: true, provider: highlevel.getConfigStatus().configured ? 'highlevel' : 'twilio', message: data });
    } catch (e) { res.status(e.status || 503).json({ error: e.message }); }
  });

  app.get('/api/connectors/twilio/messages', async (req, res) => {
    try { res.json({ messages: await twilioList(req.query.limit) }); }
    catch (e) { res.status(503).json({ error: e.message, messages: [] }); }
  });

  app.post('/api/connectors/twilio/messages', async (req, res) => {
    try { res.json({ ok: true, message: await twilioSend(req.body || {}) }); }
    catch (e) { res.status(503).json({ error: e.message }); }
  });

  app.get('/api/conversations/unified', async (req, res) => {
    const ghlConfigured = highlevel.getConfigStatus().configured;
    const businessPromise = ghlConfigured ? highLevelConversationList(req.query.limit || 120) : twilioList(req.query.limit || 100);
    const results = await Promise.allSettled([
      businessPromise,
      (async () => { const cfg = connectorConfig(); const data = await connectorAction('gmail.list', cfg.gmailListTool, { limit: Number(req.query.limit) || 50, query: req.query.query || '' }); return unwrapRows(data).map(normalizeGmail); })(),
    ]);
    const business = results[0].status === 'fulfilled' ? results[0].value : [];
    const gm = results[1].status === 'fulfilled' ? results[1].value : [];
    const messages = [...business, ...gm].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json({
      messages,
      sources: { highlevel: ghlConfigured && results[0].status === 'fulfilled', twilio: !ghlConfigured && results[0].status === 'fulfilled', gmail: results[1].status === 'fulfilled' },
      messagingProvider: ghlConfigured ? 'highlevel' : 'twilio',
      businessLine: highlevel.getConfigStatus().primaryPhoneNumber || twilioConfig().phoneNumber || null,
      errors: results.map(r => r.status === 'rejected' ? r.reason?.message : null).filter(Boolean),
    });
  });

  app.post('/api/conversations/send', async (req, res) => {
    try {
      const { source, to, subject, body, contactId, replyMessageId, threadId } = req.body || {};
      if (source === 'gmail') {
        const cfg = connectorConfig();
        const data = await connectorAction('gmail.send', cfg.gmailSendTool, { to, subject, body });
        return res.json({ ok: true, provider: 'connector', data });
      }
      if (source === 'sms' || source === 'whatsapp') {
        const data = await sendBusinessMessage({ source, to, subject, body, contactId, replyMessageId, threadId });
        return res.json({ ok: true, provider: highlevel.getConfigStatus().configured && contactId ? 'highlevel' : 'twilio', data });
      }
      res.status(400).json({ error: 'source must be gmail, sms, or whatsapp' });
    } catch (e) { res.status(e.status || 503).json({ error: e.message }); }
  });
}

export default registerConnectedOpsRoutes;
