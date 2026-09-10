import { highlevel } from '../lib/highlevel-integration.js';
import { nifty } from '../lib/nifty-integration.js';

const tools = [
  { name: 'highlevel_search_contacts', description: 'Search HighLevel contacts/affiliates', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'highlevel_get_contact', description: 'Get one HighLevel contact by ID', inputSchema: { type: 'object', required: ['contactId'], properties: { contactId: { type: 'string' } } } },
  { name: 'highlevel_search_opportunities', description: 'Search HighLevel opportunities in the configured location', inputSchema: { type: 'object', properties: { q: { type: 'string' }, contactId: { type: 'string' }, status: { type: 'string' }, pipelineId: { type: 'string' }, pipelineStageId: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'highlevel_add_contact_note', description: 'Add an internal note to a HighLevel contact', inputSchema: { type: 'object', required: ['contactId', 'body'], properties: { contactId: { type: 'string' }, body: { type: 'string' } } } },
  { name: 'nifty_create_followup_task', description: 'Create a Nifty follow-up task', inputSchema: { type: 'object', required: ['projectId', 'name'], properties: { projectId: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, dueDate: { type: 'string' } } } },
];

async function callTool(name, args = {}) {
  switch (name) {
    case 'highlevel_search_contacts': return highlevel.searchContacts(args.query || '', { limit: args.limit });
    case 'highlevel_get_contact': return highlevel.getContact(args.contactId);
    case 'highlevel_search_opportunities': return highlevel.searchOpportunities(args);
    case 'highlevel_add_contact_note': return highlevel.addContactNote(args.contactId, args.body);
    case 'nifty_create_followup_task': return nifty.createTask(args.projectId, { name: args.name, description: args.description || '', ...(args.dueDate ? { due_date: args.dueDate } : {}) });
    default: throw Object.assign(new Error(`Unknown LIV8 Connect tool: ${name}`), { status: 400 });
  }
}

export function registerLiv8ConnectMcpRoutes(app) {
  app.get('/api/liv8-connect/mcp/tools', (_req, res) => res.json({ tools }));
  app.post('/api/liv8-connect/mcp/call', async (req, res) => {
    try {
      const { tool, name, arguments: args = {} } = req.body || {};
      const toolName = tool || name;
      if (!toolName) return res.status(400).json({ error: 'tool is required' });
      const result = await callTool(toolName, args);
      res.json({ success: true, tool: toolName, result });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, error: error.message, details: error.data || null });
    }
  });
}

export default registerLiv8ConnectMcpRoutes;
