import { highlevel } from '../lib/highlevel-integration.js';
import { nifty } from '../lib/nifty-integration.js';

function fail(res, error) {
  res.status(error.status || 500).json({ success: false, error: error.message, details: error.data || null });
}

function contactsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.contacts || payload?.data?.contacts || payload?.data || [];
}

function opportunityRows(payload) { return payload?.opportunities || payload?.data?.opportunities || []; }
function accountFrom(req) { return String(req.query?.account || req.body?.account || 'personal').toLowerCase() === 'company' ? 'company' : 'personal'; }
function normalizeAffiliate(contact = {}) {
  return { id: contact.id || contact.contactId || null, name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null, email: contact.email || null, phone: contact.phone || null, tags: contact.tags || [], assignedTo: contact.assignedTo || contact.assignedUserId || null, dateAdded: contact.dateAdded || contact.createdAt || null, customFields: contact.customFields || contact.customField || [] };
}
function assertCompanyOwnership(account, contact) {
  if (account !== 'company') return;
  const staffId = highlevel.getStaffUserId('company');
  if (staffId && String(contact?.assignedTo || contact?.assignedUserId || '') !== String(staffId)) {
    const err = new Error('Company contact is not assigned to the configured staff user'); err.status = 403; throw err;
  }
}

export function registerLiv8ConnectRoutes(app) {
  app.get('/api/liv8-connect/status', async (req, res) => {
    const account = accountFrom(req); const niftyStatus = nifty.getTokenStatus();
    res.json({ service: 'LIV8 Connect', account, highlevel: highlevel.getConfigStatus(account), staffUserConfigured: account === 'company' ? Boolean(highlevel.getStaffUserId('company')) : null, nifty: { configured: Boolean(niftyStatus.hasAccessToken), authenticated: Boolean(niftyStatus.hasAccessToken && !niftyStatus.isExpired), hasRefreshToken: Boolean(niftyStatus.hasRefreshToken) }, capabilities: ['highlevel.contacts.search','highlevel.contacts.get','highlevel.contacts.notes.create','highlevel.opportunities.search','affiliate.brief','affiliate.followup.create'] });
  });

  app.get('/api/liv8-connect/highlevel/contacts', async (req, res) => {
    try {
      const account = accountFrom(req); const payload = await highlevel.searchContacts(req.query.q || '', { limit: req.query.limit }, account);
      if (account !== 'company') return res.json(payload);
      const staffId = highlevel.getStaffUserId('company'); const contacts = contactsFrom(payload); const mine = staffId ? contacts.filter(c => String(c.assignedTo || c.assignedUserId || '') === String(staffId)) : [];
      res.json({ account, staffScoped: true, contacts: mine, count: mine.length, sampled: contacts.length });
    } catch (error) { fail(res, error); }
  });

  app.get('/api/liv8-connect/highlevel/contacts/:contactId', async (req, res) => {
    try { const account = accountFrom(req); const payload = await highlevel.getContact(req.params.contactId, account); const contact = payload?.contact || payload; assertCompanyOwnership(account, contact); res.json(payload); }
    catch (error) { fail(res, error); }
  });

  app.post('/api/liv8-connect/highlevel/contacts', async (req, res) => {
    try { const account = accountFrom(req); if (account === 'company') return res.status(403).json({ error: 'Creating company contacts is disabled from LIV8 Connect' }); res.status(201).json(await highlevel.createContact(req.body || {}, account)); }
    catch (error) { fail(res, error); }
  });

  app.put('/api/liv8-connect/highlevel/contacts/:contactId', async (req, res) => {
    try { const account = accountFrom(req); const existing = await highlevel.getContact(req.params.contactId, account); assertCompanyOwnership(account, existing?.contact || existing); res.json(await highlevel.updateContact(req.params.contactId, req.body || {}, account)); }
    catch (error) { fail(res, error); }
  });

  app.post('/api/liv8-connect/highlevel/contacts/:contactId/notes', async (req, res) => {
    try { const account = accountFrom(req); const existing = await highlevel.getContact(req.params.contactId, account); assertCompanyOwnership(account, existing?.contact || existing); res.status(201).json(await highlevel.addContactNote(req.params.contactId, req.body?.body || req.body?.note, account)); }
    catch (error) { fail(res, error); }
  });

  app.get('/api/liv8-connect/highlevel/opportunities', async (req, res) => { try { res.json(await highlevel.searchOpportunities(req.query, accountFrom(req))); } catch (error) { fail(res, error); } });
  app.post('/api/liv8-connect/highlevel/opportunities', async (req, res) => { try { const account = accountFrom(req); if (account === 'company') return res.status(403).json({ error: 'Creating company opportunities is disabled from LIV8 Connect' }); res.status(201).json(await highlevel.createOpportunity(req.body || {}, account)); } catch (error) { fail(res, error); } });

  app.get('/api/liv8-connect/affiliate/brief', async (req, res) => {
    try {
      const account = accountFrom(req); const identifier = String(req.query.q || req.query.email || req.query.contactId || '').trim(); if (!identifier) return res.status(400).json({ error: 'q, email, or contactId is required' });
      let contactPayload = req.query.contactId ? await highlevel.getContact(req.query.contactId, account) : await highlevel.searchContacts(identifier, { limit: 20 }, account);
      const contacts = req.query.contactId ? [contactPayload?.contact || contactPayload] : contactsFrom(contactPayload); const contact = contacts.find(c => String(c.email || '').toLowerCase() === identifier.toLowerCase()) || contacts[0]; if (!contact) return res.status(404).json({ error: 'Affiliate/contact not found' }); assertCompanyOwnership(account, contact);
      const contactId = contact.id || contact.contactId; const opportunities = contactId ? opportunityRows(await highlevel.searchOpportunities({ contactId, limit: 100, getNotes: true, getTasks: true, getCalendarEvents: true }, account)) : [];
      res.json({ account, affiliate: normalizeAffiliate(contact), opportunities, opportunityCount: opportunities.length, openOpportunityCount: opportunities.filter(o => o.status === 'open').length, wonOpportunityCount: opportunities.filter(o => o.status === 'won').length, generatedAt: new Date().toISOString() });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/liv8-connect/affiliate/followup', async (req, res) => {
    try {
      const account = accountFrom(req); const { projectId, contactId, email, promoterId, taskName, description, dueDate, writeCrmNote = true } = req.body || {}; if (!projectId) return res.status(400).json({ error: 'projectId is required' }); if (!contactId && !email && !promoterId) return res.status(400).json({ error: 'contactId, email, or promoterId is required' });
      let contact; if (contactId) { const payload = await highlevel.getContact(contactId, account); contact = payload?.contact || payload; } else { const payload = await highlevel.searchContacts(email || promoterId, { limit: 20 }, account); const contacts = contactsFrom(payload); const needle = String(email || promoterId).toLowerCase(); contact = contacts.find(c => String(c.email || '').toLowerCase() === needle) || contacts[0]; } if (!contact) return res.status(404).json({ error: 'Affiliate/contact not found' }); assertCompanyOwnership(account, contact);
      const affiliate = normalizeAffiliate(contact); const name = taskName || `Affiliate follow-up — ${affiliate.name || affiliate.email || affiliate.id}`; const taskDescription = description || ['Created automatically by LIV8 Connect.', `HighLevel Contact ID: ${affiliate.id || 'unknown'}`, affiliate.email ? `Email: ${affiliate.email}` : null, promoterId ? `Promoter ID: ${promoterId}` : null].filter(Boolean).join('\n');
      const task = await nifty.createTask(projectId, { name, description: taskDescription, ...(dueDate ? { due_date: dueDate } : {}) }); let crmNote = null; if (writeCrmNote && affiliate.id) crmNote = await highlevel.addContactNote(affiliate.id, `LIV8 Connect created Nifty follow-up: ${name}`, account);
      res.status(201).json({ success: true, account, affiliate, niftyTask: task, crmNote });
    } catch (error) { fail(res, error); }
  });

  console.log('LIV8 Connect routes registered (HighLevel PIT + Nifty, personal + company profiles)');
}

export default registerLiv8ConnectRoutes;
