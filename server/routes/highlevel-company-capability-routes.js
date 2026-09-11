import { highlevel } from '../lib/highlevel-integration.js';

function rows(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function check(name, fn, key) {
  try {
    const payload = await fn();
    return { name, ok: true, status: 200, count: rows(payload, key).length };
  } catch (error) {
    return {
      name,
      ok: false,
      status: error.status || null,
      error: error.message,
      authorizationFailure: error.status === 401 || error.status === 403,
    };
  }
}

async function operatorSample() {
  try {
    const contactPayload = await highlevel.searchContacts('David Summer', { account: 'company', limit: 20 });
    const contacts = rows(contactPayload, 'contacts');
    const staffUserId = String(highlevel.getStaffUserId('company') || '');
    const normalized = contacts.map(contact => ({
      contact,
      name: String(contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || '').trim(),
      assignedTo: String(contact.assignedTo || contact.assignedUserId || ''),
    }));
    const candidate = normalized.find(item => item.name.toLowerCase() === 'david summer') || normalized[0] || null;
    if (!candidate) return { affiliate: 'David Summer', found: false, staffScoped: false, conversationsReadable: false, conversationCount: 0 };

    const staffScoped = Boolean(staffUserId && candidate.assignedTo === staffUserId);
    if (!staffScoped) return { affiliate: 'David Summer', found: true, staffScoped: false, conversationsReadable: false, conversationCount: 0 };

    const contactId = candidate.contact.id || candidate.contact.contactId;
    const conversationPayload = contactId
      ? await highlevel.searchConversations({ account: 'company', contactId, limit: 5 })
      : { conversations: [] };
    const conversations = rows(conversationPayload, 'conversations');
    return {
      affiliate: 'David Summer',
      found: true,
      staffScoped: true,
      conversationsReadable: true,
      conversationCount: conversations.length,
    };
  } catch (error) {
    return {
      affiliate: 'David Summer',
      found: false,
      staffScoped: false,
      conversationsReadable: false,
      conversationCount: 0,
      status: error.status || null,
      error: error.message,
    };
  }
}

export async function getCompanyCapabilityStatus() {
  const status = highlevel.getConfigStatus('company');
  if (!status.configured) {
    return {
      configured: false,
      tokenConfigured: status.tokenConfigured,
      locationConfigured: status.locationConfigured,
      staffUserConfigured: status.staffUserConfigured,
      capabilities: [],
      operatorSample: null,
    };
  }

  const capabilities = [
    await check('contacts.readonly', () => highlevel.searchContacts('', { account: 'company', limit: 5 }), 'contacts'),
    await check('conversations.readonly', () => highlevel.searchConversations({ account: 'company', limit: 5 }), 'conversations'),
    await check('opportunities.readonly', () => highlevel.searchOpportunities({ limit: 5 }, { account: 'company' }), 'opportunities'),
  ];
  const sample = await operatorSample();

  return {
    configured: true,
    tokenConfigured: status.tokenConfigured,
    locationConfigured: status.locationConfigured,
    staffUserConfigured: status.staffUserConfigured,
    allRequiredReadsWorking: capabilities.every(item => item.ok),
    capabilities,
    operatorSample: sample,
    generatedAt: new Date().toISOString(),
  };
}

export function registerHighLevelCompanyCapabilityRoutes(app) {
  app.get('/api/highlevel/company-capabilities', async (_req, res) => {
    const result = await getCompanyCapabilityStatus();
    res.status(result.configured ? 200 : 503).json(result);
  });

  getCompanyCapabilityStatus()
    .then(result => {
      const summary = (result.capabilities || []).map(item => `${item.name}:${item.ok ? 'ok' : `fail-${item.status || 'error'}`}`).join(', ');
      const sample = result.operatorSample;
      const operatorSummary = sample
        ? `DavidSummer:found=${sample.found},staffScoped=${sample.staffScoped},conversations=${sample.conversationCount}`
        : 'DavidSummer:not-tested';
      console.log(`HighLevel company read-scope QA: ${result.configured ? summary || 'configured' : 'not configured'} | ${operatorSummary}`);
    })
    .catch(error => console.log(`HighLevel company read-scope QA failed: ${error.message}`));
}

export default registerHighLevelCompanyCapabilityRoutes;
