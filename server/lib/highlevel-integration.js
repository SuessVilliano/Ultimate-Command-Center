const HIGHLEVEL_API_BASE = process.env.HIGHLEVEL_API_BASE || 'https://services.leadconnectorhq.com';

function normalizeAccount(account = 'personal') {
  return String(account || 'personal').toLowerCase() === 'company' ? 'company' : 'personal';
}

function readConfig(account = 'personal') {
  const profile = normalizeAccount(account);
  if (profile === 'company') {
    return {
      account: 'company',
      token: process.env.GHL_COMPANY_PIT || process.env.GHL_COMPANY_PRIVATE_INTEGRATION_TOKEN || '',
      locationId: process.env.GHL_COMPANY_LOCATION_ID || '',
      staffUserId: process.env.GHL_STAFF_USER_ID || process.env.GHL_COMPANY_STAFF_USER_ID || '',
      primaryPhoneNumber: process.env.GHL_COMPANY_PRIMARY_PHONE_NUMBER || '',
    };
  }

  return {
    account: 'personal',
    token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN || process.env.GHL_AFFILIATE_SANDBOX_PIT || process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || process.env.GHL_AFFILIATE_SANDBOX_LOCATION_ID || '',
    staffUserId: '',
    primaryPhoneNumber: process.env.GHL_PRIMARY_PHONE_NUMBER || '',
  };
}

function ensureConfigured(account = 'personal') {
  const cfg = readConfig(account);
  if (!cfg.token) throw Object.assign(new Error(`HighLevel ${cfg.account} Private Integration Token is not configured`), { status: 503 });
  if (!cfg.locationId) throw Object.assign(new Error(`HighLevel ${cfg.account} location ID is not configured`), { status: 503 });
  if (cfg.account === 'company' && !cfg.staffUserId) throw Object.assign(new Error('HighLevel company staff user ID is not configured'), { status: 503 });
  return cfg;
}

async function highLevelRequest(path, options = {}, account = 'personal') {
  const { token } = ensureConfigured(account);
  const { version, ...fetchOptions } = options;
  const response = await fetch(`${HIGHLEVEL_API_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version || '2021-07-28',
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {}),
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

function withLocation(params = {}, account = 'personal') {
  const { locationId } = ensureConfigured(account);
  return { locationId, ...params };
}

function toParams(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return params;
}

function unwrapMessages(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.data?.messages)) return payload.data.messages;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export const highlevel = {
  getConfigStatus(account = 'personal') {
    const cfg = readConfig(account);
    return {
      account: cfg.account,
      configured: Boolean(cfg.token && cfg.locationId && (cfg.account !== 'company' || cfg.staffUserId)),
      authType: 'Private Integration Token',
      locationConfigured: Boolean(cfg.locationId),
      tokenConfigured: Boolean(cfg.token),
      staffUserConfigured: cfg.account === 'company' ? Boolean(cfg.staffUserId) : null,
      primaryPhoneConfigured: Boolean(cfg.primaryPhoneNumber),
      primaryPhoneNumber: cfg.primaryPhoneNumber || null,
      locationId: cfg.locationId || null,
      apiBase: HIGHLEVEL_API_BASE,
    };
  },

  getStaffUserId(account = 'personal') {
    return readConfig(account).staffUserId || null;
  },

  request(path, options = {}, account = 'personal') {
    return highLevelRequest(path, options, account);
  },

  async searchContacts(query = '', options = {}) {
    const account = normalizeAccount(options.account);
    const params = new URLSearchParams(withLocation({
      query: String(query || '').trim(),
      limit: String(Math.min(Number(options.limit || 20), 100)),
    }, account));
    return highLevelRequest(`/contacts/?${params.toString()}`, {}, account);
  },

  async getContact(contactId, options = {}) {
    if (!contactId) throw Object.assign(new Error('contactId is required'), { status: 400 });
    const account = normalizeAccount(options.account);
    return highLevelRequest(`/contacts/${encodeURIComponent(contactId)}`, {}, account);
  },

  async createContact(data = {}, options = {}) {
    const account = normalizeAccount(options.account);
    const payload = withLocation(data, account);
    return highLevelRequest('/contacts/', { method: 'POST', body: JSON.stringify(payload) }, account);
  },

  async updateContact(contactId, data = {}, options = {}) {
    if (!contactId) throw Object.assign(new Error('contactId is required'), { status: 400 });
    const account = normalizeAccount(options.account);
    return highLevelRequest(`/contacts/${encodeURIComponent(contactId)}`, { method: 'PUT', body: JSON.stringify(data) }, account);
  },

  async addContactNote(contactId, body, options = {}) {
    if (!contactId || !String(body || '').trim()) throw Object.assign(new Error('contactId and note body are required'), { status: 400 });
    const account = normalizeAccount(options.account);
    return highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/notes`, {
      method: 'POST', body: JSON.stringify({ body: String(body).trim() }),
    }, account);
  },

  async searchOpportunities(filters = {}, options = {}) {
    const account = normalizeAccount(options.account || filters.account);
    const cleanFilters = { ...filters };
    delete cleanFilters.account;
    const params = new URLSearchParams();
    const merged = withLocation({ limit: Math.min(Number(cleanFilters.limit || 20), 100), ...cleanFilters }, account);
    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    return highLevelRequest(`/opportunities/search?${params.toString()}`, { version: 'v3' }, account);
  },

  async createOpportunity(data = {}, options = {}) {
    const account = normalizeAccount(options.account);
    return highLevelRequest('/opportunities/', {
      version: 'v3', method: 'POST', body: JSON.stringify(withLocation(data, account)),
    }, account);
  },

  async searchConversations(options = {}) {
    const account = normalizeAccount(options.account);
    const { locationId } = ensureConfigured(account);
    const params = toParams({ locationId, limit: Math.min(Math.max(Number(options.limit || 100), 1), 100), sort: options.sort || 'desc', status: options.status || 'all', contactId: options.contactId, query: options.query, lastMessageType: options.lastMessageType });
    return highLevelRequest(`/conversations/search?${params.toString()}`, {}, account);
  },

  async exportMessages(options = {}) {
    const account = normalizeAccount(options.account);
    const { locationId } = ensureConfigured(account);
    const params = toParams({ locationId, channel: options.channel, limit: Math.min(Math.max(Number(options.limit || 100), 10), 1000), cursor: options.cursor, sortBy: options.sortBy || 'createdAt', sortOrder: options.sortOrder || 'desc', conversationId: options.conversationId, contactId: options.contactId, startDate: options.startDate, endDate: options.endDate });
    try {
      return await highLevelRequest(`/conversations/messages/export?${params.toString()}`, {}, account);
    } catch (exportError) {
      const searchParams = toParams({ locationId, limit: Math.min(Math.max(Number(options.limit || 100), 1), 100), sort: 'desc', status: 'all' });
      const search = await highLevelRequest(`/conversations/search?${searchParams.toString()}`, {}, account).catch(() => null);
      const conversations = Array.isArray(search?.conversations) ? search.conversations : [];
      if (!conversations.length) throw exportError;
      const channelNeedle = String(options.channel || '').toLowerCase();
      const selected = conversations.filter(c => {
        if (!channelNeedle) return true;
        const raw = String(c.lastMessageType || c.type || c.channel || '').toLowerCase();
        return !raw || raw.includes(channelNeedle === 'whatsapp' ? 'whatsapp' : 'sms');
      }).slice(0, Math.min(conversations.length, 40));
      const results = await Promise.allSettled(selected.map(async conversation => {
        const messageParams = toParams({ limit: 100 });
        const payload = await highLevelRequest(`/conversations/${encodeURIComponent(conversation.id)}/messages?${messageParams.toString()}`, {}, account);
        return unwrapMessages(payload).map(message => ({ ...message, conversationId: message.conversationId || conversation.id, contactId: message.contactId || conversation.contactId }));
      }));
      const messages = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      if (messages.length) return { messages, fallback: 'conversation-messages' };
      const summaries = selected.map(conversation => ({ id: conversation.lastMessageId || `conversation-${conversation.id}`, conversationId: conversation.id, contactId: conversation.contactId, messageType: conversation.lastMessageType || conversation.type || '', type: conversation.lastMessageType || conversation.type || '', body: conversation.lastMessageBody || conversation.lastMessage || conversation.lastMessageText || '', direction: conversation.lastMessageDirection || '', dateAdded: conversation.lastMessageDate || conversation.lastMessageAt || conversation.updatedAt || conversation.dateUpdated || '', createdAt: conversation.lastMessageDate || conversation.lastMessageAt || conversation.updatedAt || conversation.dateUpdated || '', status: conversation.status || '', from: conversation.from || '', to: conversation.to || '' })).filter(message => message.body || message.messageType);
      if (summaries.length) return { messages: summaries, fallback: 'conversation-search' };
      throw exportError;
    }
  },

  async getConversationMessages(conversationId, options = {}) {
    if (!conversationId) throw Object.assign(new Error('conversationId is required'), { status: 400 });
    const account = normalizeAccount(options.account);
    const params = toParams({ limit: Math.min(Math.max(Number(options.limit || 100), 1), 100), lastMessageId: options.lastMessageId, type: options.type });
    return highLevelRequest(`/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`, {}, account);
  },

  async sendConversationMessage(data = {}, options = {}) {
    const account = normalizeAccount(options.account);
    const { primaryPhoneNumber } = ensureConfigured(account);
    const type = String(data.type || '').trim();
    if (!['SMS', 'WhatsApp', 'Email'].includes(type)) throw Object.assign(new Error('type must be SMS, WhatsApp, or Email'), { status: 400 });
    if (!data.contactId) throw Object.assign(new Error('contactId is required'), { status: 400 });
    if (!String(data.message || data.html || '').trim()) throw Object.assign(new Error('message is required'), { status: 400 });
    const payload = { type, contactId: data.contactId, status: data.status || 'pending', message: data.message, html: data.html, subject: data.subject, replyMessageId: data.replyMessageId, threadId: data.threadId, conversationProviderId: data.conversationProviderId, emailTo: data.emailTo, emailFrom: data.emailFrom, emailReplyMode: data.emailReplyMode, fromNumber: data.fromNumber || (type !== 'Email' ? primaryPhoneNumber || undefined : undefined), toNumber: data.toNumber, attachments: data.attachments };
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    return highLevelRequest('/conversations/messages', { method: 'POST', body: JSON.stringify(payload) }, account);
  },
};

export default highlevel;
