const HIGHLEVEL_API_BASE = process.env.HIGHLEVEL_API_BASE || 'https://services.leadconnectorhq.com';

function readConfig() {
  return {
    token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN || process.env.GHL_AFFILIATE_SANDBOX_PIT || process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || process.env.GHL_AFFILIATE_SANDBOX_LOCATION_ID || '',
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

export const highlevel = {
  getConfigStatus() {
    const cfg = readConfig();
    return {
      configured: Boolean(cfg.token && cfg.locationId),
      authType: 'Private Integration Token',
      locationConfigured: Boolean(cfg.locationId),
      tokenConfigured: Boolean(cfg.token),
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
};

export default highlevel;
