/**
 * AgentMail adapter for Juno.
 *
 * AgentMail is Juno's native mailbox. Secrets stay server-side in Render.
 * Default inbox: liv8@agentmail.to
 */
const BASE_URL = (process.env.AGENTMAIL_BASE_URL || 'https://api.agentmail.to/v0').replace(/\/$/, '');
const DEFAULT_EMAIL = process.env.AGENTMAIL_EMAIL || 'liv8@agentmail.to';

let cachedInbox = null;
let webhookState = { checkedAt: null, configured: false, webhookId: null, error: null };

function apiKey() {
  const key = String(process.env.AGENTMAIL_API_KEY || '').trim();
  if (!key) throw new Error('AGENTMAIL_API_KEY is not configured');
  return key;
}

function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach(v => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}

async function request(path, { method = 'GET', body, timeout = 20000 } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }));
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || data?.detail || data?.text || `HTTP ${response.status}`;
    throw new Error(`AgentMail ${method} ${path} failed: ${String(detail).slice(0, 300)}`);
  }
  return data;
}

export function status() {
  return {
    configured: Boolean(process.env.AGENTMAIL_API_KEY),
    email: DEFAULT_EMAIL,
    inboxId: cachedInbox?.inbox_id || process.env.AGENTMAIL_INBOX_ID || null,
    webhook: webhookState,
    autonomy: {
      autoDraft: String(process.env.AGENTMAIL_AUTO_DRAFT ?? 'true').toLowerCase() !== 'false',
      autoSend: String(process.env.AGENTMAIL_AUTO_SEND ?? 'false').toLowerCase() === 'true',
    },
  };
}

export async function listInboxes(options = {}) {
  return request(`/inboxes${qs({ limit: options.limit || 100, page_token: options.pageToken, ascending: options.ascending })}`);
}

export async function resolveInbox({ refresh = false } = {}) {
  if (!refresh && cachedInbox) return cachedInbox;
  const explicit = String(process.env.AGENTMAIL_INBOX_ID || '').trim();
  const data = await listInboxes({ limit: 100 });
  const inboxes = data.inboxes || [];
  const inbox = explicit
    ? inboxes.find(x => x.inbox_id === explicit) || { inbox_id: explicit, email: DEFAULT_EMAIL }
    : inboxes.find(x => String(x.email || '').toLowerCase() === DEFAULT_EMAIL.toLowerCase());
  if (!inbox?.inbox_id) throw new Error(`AgentMail inbox not found for ${DEFAULT_EMAIL}`);
  cachedInbox = inbox;
  return inbox;
}

export async function listMessages(options = {}) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/messages${qs({
    limit: options.limit || 50,
    page_token: options.pageToken,
    labels: options.labels,
    before: options.before,
    after: options.after,
    ascending: options.ascending,
    from: options.from,
    to: options.to,
    subject: options.subject,
  })}`);
}

export async function listThreads(options = {}) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/threads${qs({
    limit: options.limit || 50,
    page_token: options.pageToken,
    labels: options.labels,
    before: options.before,
    after: options.after,
    ascending: options.ascending,
    senders: options.senders,
    recipients: options.recipients,
    subject: options.subject,
  })}`);
}

export async function getMessage(messageId) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/messages/${encodeURIComponent(messageId)}`);
}

export async function listDrafts(options = {}) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/drafts${qs({ limit: options.limit || 50, page_token: options.pageToken })}`);
}

export async function createDraft(payload = {}) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/drafts`, {
    method: 'POST',
    body: payload,
  });
}

export async function createReplyDraft(messageId, { text, html, replyAll = false, sendAt = null, labels = [] } = {}) {
  return createDraft({
    in_reply_to: messageId,
    reply_all: Boolean(replyAll),
    text,
    html,
    send_at: sendAt || undefined,
    labels,
  });
}

export async function sendDraft(draftId, options = {}) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/drafts/${encodeURIComponent(draftId)}/send`, {
    method: 'POST',
    body: {
      add_labels: options.addLabels,
      remove_labels: options.removeLabels,
    },
  });
}

export async function sendMessage({ to, subject, text, html, cc, bcc, replyTo, labels, trackOpens = false } = {}) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/messages/send`, {
    method: 'POST',
    body: { to, subject, text, html, cc, bcc, reply_to: replyTo, labels, track_opens: trackOpens },
  });
}

export async function replyToMessage(messageId, { text, html, replyAll = false, labels } = {}) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/messages/${encodeURIComponent(messageId)}/reply`, {
    method: 'POST',
    body: { text, html, reply_all: Boolean(replyAll), labels },
  });
}

export async function listWebhooks() {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/webhooks`);
}

export async function createWebhook({ url, headers = {}, eventTypes = ['message.received'] } = {}) {
  const inbox = await resolveInbox();
  return request(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/webhooks`, {
    method: 'POST',
    body: { url, event_types: eventTypes, headers },
  });
}

export async function ensureWebhook() {
  webhookState = { ...webhookState, checkedAt: new Date().toISOString(), error: null };
  if (!process.env.AGENTMAIL_API_KEY) {
    webhookState = { ...webhookState, configured: false, error: 'AGENTMAIL_API_KEY missing' };
    return webhookState;
  }
  const gatewayKey = String(process.env.JUNO_GATEWAY_KEY || '').trim();
  if (!gatewayKey) {
    webhookState = { ...webhookState, configured: false, error: 'JUNO_GATEWAY_KEY missing' };
    return webhookState;
  }
  const appUrl = String(process.env.APP_URL || 'https://liv8-command-center-api.onrender.com').replace(/\/$/, '');
  const target = `${appUrl}/api/agentmail/webhook`;

  try {
    const existingPayload = await listWebhooks().catch(() => ({ webhooks: [] }));
    const existing = (existingPayload.webhooks || existingPayload.data || []).find(x => x.url === target && x.enabled !== false);
    if (existing) {
      webhookState = {
        checkedAt: new Date().toISOString(),
        configured: true,
        webhookId: existing.webhook_id || existing.id || null,
        url: target,
        error: null,
      };
      return webhookState;
    }

    const created = await createWebhook({
      url: target,
      eventTypes: ['message.received'],
      headers: { 'x-juno-key': gatewayKey },
    });
    webhookState = {
      checkedAt: new Date().toISOString(),
      configured: true,
      webhookId: created.webhook_id || created.id || null,
      url: target,
      error: null,
    };
    return webhookState;
  } catch (error) {
    webhookState = { ...webhookState, configured: false, error: error.message };
    return webhookState;
  }
}

export default {
  status, listInboxes, resolveInbox, listMessages, listThreads, getMessage,
  listDrafts, createDraft, createReplyDraft, sendDraft, sendMessage,
  replyToMessage, listWebhooks, createWebhook, ensureWebhook,
};
