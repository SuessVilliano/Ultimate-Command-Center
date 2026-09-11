import { highlevel } from '../lib/highlevel-integration.js';
import { registerHighLevelCompanyCapabilityRoutes } from './highlevel-company-capability-routes.js';

function contactsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.contacts || payload?.data?.contacts || payload?.data || [];
}

function assignedUserId(contact = {}) {
  return contact.assignedTo || contact.assignedUserId || null;
}

export function registerHighLevelCompanyHealthRoutes(app) {
  registerHighLevelCompanyCapabilityRoutes(app);

  app.get('/api/highlevel/company-health', async (_req, res) => {
    const account = 'company';
    const status = highlevel.getConfigStatus(account);

    if (!status.configured) {
      return res.status(503).json({
        success: false,
        account,
        configured: false,
        tokenConfigured: status.tokenConfigured,
        locationConfigured: status.locationConfigured,
        staffUserConfigured: status.staffUserConfigured,
        apiReachable: false,
        generatedAt: new Date().toISOString(),
      });
    }

    try {
      const payload = await highlevel.searchContacts('', { account, limit: 100 });
      const contacts = contactsFrom(payload);
      const staffUserId = highlevel.getStaffUserId(account);
      const assigned = contacts.filter(contact => String(assignedUserId(contact) || '') === String(staffUserId || ''));

      return res.json({
        success: true,
        account,
        configured: true,
        tokenConfigured: status.tokenConfigured,
        locationConfigured: status.locationConfigured,
        staffUserConfigured: status.staffUserConfigured,
        apiReachable: true,
        contactsReturnedInSample: contacts.length,
        staffAssignedInSample: assigned.length,
        assignmentFieldPresent: contacts.some(contact => Boolean(assignedUserId(contact))),
        sample: assigned.slice(0, 5).map(contact => ({
          id: contact.id || contact.contactId || null,
          name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null,
        })),
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(error.status || 502).json({
        success: false,
        account,
        configured: true,
        tokenConfigured: status.tokenConfigured,
        locationConfigured: status.locationConfigured,
        staffUserConfigured: status.staffUserConfigured,
        apiReachable: false,
        upstreamStatus: error.status || null,
        error: error.message,
        generatedAt: new Date().toISOString(),
      });
    }
  });
}

export default registerHighLevelCompanyHealthRoutes;
