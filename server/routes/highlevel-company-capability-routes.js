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

export async function getCompanyCapabilityStatus() {
  const status = highlevel.getConfigStatus('company');
  if (!status.configured) {
    return {
      configured: false,
      tokenConfigured: status.tokenConfigured,
      locationConfigured: status.locationConfigured,
      staffUserConfigured: status.staffUserConfigured,
      capabilities: [],
    };
  }

  const capabilities = [
    await check('contacts.readonly', () => highlevel.searchContacts('', { account: 'company', limit: 5 }), 'contacts'),
    await check('conversations.readonly', () => highlevel.searchConversations({ account: 'company', limit: 5 }), 'conversations'),
    await check('opportunities.readonly', () => highlevel.searchOpportunities({ limit: 5 }, { account: 'company' }), 'opportunities'),
  ];

  return {
    configured: true,
    tokenConfigured: status.tokenConfigured,
    locationConfigured: status.locationConfigured,
    staffUserConfigured: status.staffUserConfigured,
    allRequiredReadsWorking: capabilities.every(item => item.ok),
    capabilities,
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
      console.log(`HighLevel company read-scope QA: ${result.configured ? summary || 'configured' : 'not configured'}`);
    })
    .catch(error => console.log(`HighLevel company read-scope QA failed: ${error.message}`));
}

export default registerHighLevelCompanyCapabilityRoutes;
