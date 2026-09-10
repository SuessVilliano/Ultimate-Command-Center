const HIGHLEVEL_API_BASE = process.env.HIGHLEVEL_API_BASE || 'https://services.leadconnectorhq.com';

function readConfig() {
  return {
    token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN || process.env.GHL_AFFILIATE_SANDBOX_PIT || process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || process.env.GHL_AFFILIATE_SANDBOX_LOCATION_ID || '',
    primaryPhoneNumber: process.env.GHL_PRIMARY_PHONE_NUMBER || '',
  };
}

function ensureConfigured() {
  const cfg = readConfig();
  if (!cfg.token) throw Object.assign(new Error('HighLevel Private Integration Token is not configured'), { status: 503 });
  if (!cfg.locationId) throw Object.assign(new Error('HighLevel location ID is not configured'), { status: 503 });
  return cfg;
}

async function highLevelRequest(path, options = {}) {
  const { token } = ensureConfigured();
  const response = await fetch(`${HIGHLEVEL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: options.version || 'v3',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `HighLevel HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function withLocation(params = {}) {
  const { locationId } = ensureConfigured();
  return { locationId, ...params };
}

function toParams(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return params;
}

export const highlevel = {
  getConfigStatus() {
    const cfg = readConfig();
    return {
      configured: Boolean(cfg.token && cfg.locationId),
      authType: 'Private Integration Token',
      locationConfigured: Boolean(cfg.locationId),
      tokenConfigured: Boolean(cfg.token),
      primaryPhoneConfigured: Boolean(cfg.primaryPhoneNumber),
      primaryPhoneNumber: cfg.primaryPhoneNumber || null,
      locationId: cfg.locationId || null,
      apiBase: HIGHLEVEL_API_BASE,
    };
  },

  request: highLevelRequest,

  async searchContacts(query = '', options = {}) {
    const params = new URLSearchParams(withLocation({
      query: String(query || '').trim(),
      limit: String(Math.min(Number(options.limit || 20), 100)),
    }));
    return highLevelRequest(`/contacts/?${params.toString()}`);
  },

  async getContact(contactId) {
    if (!contactId) throw Object.assign(new Error('contactId is required'), { status: 400 });
    return highLevelRequest(`/contacts/${encodeURIComponent(contactId)}`);
  },

  async createContact(data = {}) {
    const payload = withLocation(data);
    return highLevelRequest('/contacts/', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateContact(contactId, data = {}) {
    if (!contactId) throw Object.assign(new Error('contactId is required'), { status: 400 });
    return highLevelRequest(`/contacts/${encodeURIComponent(contactId)}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async addContactNote(contactId, body) {
    if (!contactId || !String(body || '').trim()) throw Object.assign(new Error('contactId and note body are required'), { status: 400 });
    return highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: String(body).trim() }),
    });
  },

  async searchOpportunities(filters = {}) {
    const params = new URLSearchParams();
    const merged = withLocation({ limit: Math.min(Number(filters.limit || 20), 100), ...filters });
    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    return highLevelRequest(`/opportunities/search?${params.toString()}`);
  },

  async createOpportunity(data = {}) {
    return highLevelRequest('/opportunities/', {
      method: 'POST',
      body: JSON.stringify(withLocation(data)),
    });
  },

  async searchConversations(options = {}) {
    const { locationId } = ensureConfigured();
    const params = toParams({
      locationId,
      limit: Math.min(Math.max(Number(options.limit || 100), 1), 100),
      sort: options.sort || 'desc',
      status: options.status || 'all',
      contactId: options.contactId,
      query: options.query,
      lastMessageType: options.lastMessageType,
    });
    return highLevelRequest(`/conversations/search?${params.toString()}`);
  },

  async exportMessages(options = {}) {
    const { locationId } = ensureConfigured();
    const params = toParams({
      locationId,
      channel: options.channel,
      limit: Math.min(Math.max(Number(options.limit || 100), 10), 1000),
      cursor: options.cursor,
      sortBy: options.sortBy || 'createdAt',
      sortOrder: options.sortOrder || 'desc',
      conversationId: options.conversationId,
      contactId: options.contactId,
      startDate: options.startDate,
      endDate: options.endDate,
    });
    return highLevelRequest(`/conversations/messages/export?${params.toString()}`);
  },

  async getConversationMessages(conversationId, options = {}) {
    if (!conversationId) throw Object.assign(new Error('conversationId is required'), { status: 400 });
    const params = toParams({
      limit: Math.min(Math.max(Number(options.limit || 100), 1), 100),
      lastMessageId: options.lastMessageId,
      type: options.type,
    });
    return highLevelRequest(`/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`);
  },

  async sendConversationMessage(data = {}) {
    const { primaryPhoneNumber } = ensureConfigured();
    const type = String(data.type || '').trim();
    if (!['SMS', 'WhatsApp', 'Email'].includes(type)) throw Object.assign(new Error('type must be SMS, WhatsApp, or Email'), { status: 400 });
    if (!data.contactId) throw Object.assign(new Error('contactId is required'), { status: 400 });
    if (!String(data.message || data.html || '').trim()) throw Object.assign(new Error('message is required'), { status: 400 });

    const payload = {
      type,
      contactId: data.contactId,
      status: data.status || 'pending',
      message: data.message,
      html: data.html,
      subject: data.subject,
      replyMessageId: data.replyMessageId,
      threadId: data.threadId,
      conversationProviderId: data.conversationProviderId,
      emailTo: data.emailTo,
      emailFrom: data.emailFrom,
      emailReplyMode: data.emailReplyMode,
      fromNumber: data.fromNumber || (type !== 'Email' ? primaryPhoneNumber || undefined : undefined),
      toNumber: data.toNumber,
      attachments: data.attachments,
    };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    return highLevelRequest('/conversations/messages', { method: 'POST', body: JSON.stringify(payload) });
  },
};

export default highlevel;
