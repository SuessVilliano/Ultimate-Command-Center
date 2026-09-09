const API_BASE = 'https://services.leadconnectorhq.com';
const SANDBOX_FORM_ID = process.env.GHL_AFFILIATE_SANDBOX_FORM_ID || 'TVI6Ch94dCiqvm94KpFN';

function config() {
  return {
    pit: process.env.GHL_AFFILIATE_SANDBOX_PIT || '',
    locationId: process.env.GHL_AFFILIATE_SANDBOX_LOCATION_ID || '',
  };
}

async function request(path, options = {}) {
  const { pit } = config();
  if (!pit) throw Object.assign(new Error('GHL_AFFILIATE_SANDBOX_PIT is not configured'), { status: 503 });
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${pit}`,
      Version: options.version || '2021-07-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw Object.assign(new Error(data?.message || data?.error || `HighLevel HTTP ${response.status}`), { status: response.status, data });
  return data;
}

function contactsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.contacts || payload?.data?.contacts || payload?.data || [];
}

function customFieldValue(contact, needle) {
  const fields = contact?.customFields || contact?.customField || [];
  const match = fields.find(field => String(field?.name || field?.fieldKey || field?.key || '').toLowerCase().includes(needle));
  return String(match?.value || match?.fieldValue || '').trim();
}

function exactMatches(contacts, { identifier, email, promoterId }) {
  const keys = [identifier, email, promoterId].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
  return contacts.filter(contact => {
    const values = [contact?.email, contact?.id, contact?.contactId, customFieldValue(contact, 'promoter')]
      .map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    return keys.some(key => values.includes(key));
  });
}

async function findExactContact({ identifier, email, promoterId }) {
  const { locationId } = config();
  if (!locationId) throw Object.assign(new Error('GHL_AFFILIATE_SANDBOX_LOCATION_ID is not configured'), { status: 503 });
  const query = String(email || identifier || promoterId || '').trim();
  if (!query) throw Object.assign(new Error('An affiliate email, Promoter ID, or contact ID is required'), { status: 400 });
  const params = new URLSearchParams({ locationId, query, limit: '20' });
  const payload = await request(`/contacts/?${params.toString()}`);
  const matches = exactMatches(contactsFrom(payload), { identifier, email, promoterId });
  if (matches.length !== 1) {
    const message = matches.length ? 'Multiple exact sandbox CRM contacts matched; nothing was written.' : 'No exact sandbox CRM contact matched; nothing was written.';
    throw Object.assign(new Error(message), { status: 409 });
  }
  return matches[0];
}

export function registerAffiliateCrmRoutes(app) {
  app.get('/api/affiliate/crm-note/status', (_req, res) => {
    const { pit, locationId } = config();
    res.json({
      configured: Boolean(pit && locationId),
      sandboxOnly: true,
      authType: 'PIT',
      formId: SANDBOX_FORM_ID,
      locationConfigured: Boolean(locationId),
      pitConfigured: Boolean(pit),
    });
  });

  app.post('/api/affiliate/crm-note', async (req, res) => {
    try {
      const { identifier, email, promoterId, note, source = 'Ultimate Command Center' } = req.body || {};
      if (!String(note || '').trim()) return res.status(400).json({ error: 'note is required' });
      const contact = await findExactContact({ identifier, email, promoterId });
      const contactId = contact.id || contact.contactId;
      if (!contactId) return res.status(409).json({ error: 'Exact contact matched but had no contact ID; nothing was written.' });

      const result = await request(`/contacts/${encodeURIComponent(contactId)}/notes`, {
        method: 'POST',
        version: 'v3',
        body: JSON.stringify({ body: String(note).trim() }),
      });

      res.json({
        success: true,
        sandboxOnly: true,
        authType: 'PIT',
        contactId,
        contactEmail: contact.email || email || null,
        formId: SANDBOX_FORM_ID,
        source,
        noteId: result?.note?.id || result?.id || null,
      });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message, details: error.data || null, sandboxOnly: true });
    }
  });
}

export default registerAffiliateCrmRoutes;
