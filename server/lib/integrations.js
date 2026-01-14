/**
 * LIV8 Command Center - External Integrations
 * Taskade, TaskMagic, GoHighLevel, Supabase
 */

import * as db from './database.js';

// ============================================================================
// TASKADE INTEGRATION
// ============================================================================

const TASKADE_API_BASE = 'https://www.taskade.com/api/v1';

/**
 * Make Taskade API request
 */
async function taskadeRequest(endpoint, options = {}) {
  const apiKey = process.env.TASKADE_API_KEY;
  if (!apiKey) {
    throw new Error('TASKADE_API_KEY not configured');
  }

  const response = await fetch(`${TASKADE_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Taskade API error: ${response.status}`);
  }

  return response.json();
}

export const taskade = {
  // Get all workspaces
  async getWorkspaces() {
    return taskadeRequest('/workspaces');
  },

  // Get workspace folders
  async getFolders(workspaceId) {
    return taskadeRequest(`/workspaces/${workspaceId}/folders`);
  },

  // Get projects in folder
  async getProjects(folderId) {
    return taskadeRequest(`/folders/${folderId}/projects`);
  },

  // Get project details
  async getProject(projectId) {
    return taskadeRequest(`/projects/${projectId}`);
  },

  // Get tasks in project
  async getTasks(projectId) {
    return taskadeRequest(`/projects/${projectId}/tasks`);
  },

  // Create task
  async createTask(projectId, content, options = {}) {
    return taskadeRequest(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        tasks: [{
          content,
          contentType: 'text/markdown',
          placement: options.placement || 'beforeend',
          ...(options.taskId && { taskId: options.taskId })
        }]
      })
    });
  },

  // Complete task
  async completeTask(projectId, taskId) {
    return taskadeRequest(`/projects/${projectId}/tasks/${taskId}/complete`, {
      method: 'POST'
    });
  },

  // Update task
  async updateTask(projectId, taskId, content) {
    return taskadeRequest(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({
        content,
        contentType: 'text/markdown'
      })
    });
  },

  // Add note to task
  async addNote(projectId, taskId, note) {
    return taskadeRequest(`/projects/${projectId}/tasks/${taskId}/note`, {
      method: 'PUT',
      body: JSON.stringify({
        value: note,
        type: 'text/markdown'
      })
    });
  },

  // Set task due date
  async setDueDate(projectId, taskId, startDate, endDate = null) {
    return taskadeRequest(`/projects/${projectId}/tasks/${taskId}/date`, {
      method: 'PUT',
      body: JSON.stringify({
        start: { date: startDate },
        ...(endDate && { end: { date: endDate } })
      })
    });
  },

  // Create project
  async createProject(folderId, content) {
    return taskadeRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({
        folderId,
        content,
        contentType: 'text/markdown'
      })
    });
  }
};

// ============================================================================
// TASKMAGIC INTEGRATION
// ============================================================================

export const taskmagic = {
  // Trigger webhook
  async triggerWebhook(data) {
    const webhookUrl = process.env.TASKMAGIC_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('TASKMAGIC_WEBHOOK_URL not configured');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    return { success: response.ok, status: response.status };
  },

  // Trigger automation by name
  async triggerAutomation(automationName, payload = {}) {
    return this.triggerWebhook({
      action: 'trigger_automation',
      automation: automationName,
      payload,
      timestamp: new Date().toISOString()
    });
  },

  // Send notification via TaskMagic
  async sendNotification(message, channel = 'default') {
    return this.triggerWebhook({
      action: 'notification',
      message,
      channel,
      timestamp: new Date().toISOString()
    });
  },

  // Execute task in TaskMagic
  async executeTask(taskName, parameters = {}) {
    return this.triggerWebhook({
      action: 'execute_task',
      task: taskName,
      parameters,
      timestamp: new Date().toISOString()
    });
  }
};

// ============================================================================
// GOHIGHLEVEL (GHL) INTEGRATION
// ============================================================================

const GHL_API_BASE = 'https://rest.gohighlevel.com/v1';
const GHL_API_V2_BASE = 'https://services.leadconnectorhq.com';

/**
 * Make GHL API request
 */
async function ghlRequest(endpoint, options = {}, useV2 = false) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey) {
    throw new Error('GHL_API_KEY not configured');
  }

  const baseUrl = useV2 ? GHL_API_V2_BASE : GHL_API_BASE;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28',
      ...(locationId && { 'Location': locationId }),
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GHL API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export const ghl = {
  // Get contacts
  async getContacts(query = '', limit = 20) {
    return ghlRequest(`/contacts?query=${encodeURIComponent(query)}&limit=${limit}`);
  },

  // Get contact by ID
  async getContact(contactId) {
    return ghlRequest(`/contacts/${contactId}`);
  },

  // Create contact
  async createContact(data) {
    return ghlRequest('/contacts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Update contact
  async updateContact(contactId, data) {
    return ghlRequest(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Add tag to contact
  async addTag(contactId, tag) {
    return ghlRequest(`/contacts/${contactId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags: [tag] })
    });
  },

  // Get pipelines
  async getPipelines() {
    return ghlRequest('/pipelines');
  },

  // Get opportunities
  async getOpportunities(pipelineId = null) {
    const endpoint = pipelineId
      ? `/pipelines/${pipelineId}/opportunities`
      : '/opportunities';
    return ghlRequest(endpoint);
  },

  // Create opportunity
  async createOpportunity(pipelineId, stageId, contactId, data = {}) {
    return ghlRequest('/opportunities', {
      method: 'POST',
      body: JSON.stringify({
        pipelineId,
        stageId,
        contactId,
        ...data
      })
    });
  },

  // Get calendars
  async getCalendars() {
    return ghlRequest('/calendars');
  },

  // Get appointments
  async getAppointments(calendarId, startDate, endDate) {
    return ghlRequest(
      `/calendars/${calendarId}/appointments?startDate=${startDate}&endDate=${endDate}`
    );
  },

  // Create appointment
  async createAppointment(calendarId, data) {
    return ghlRequest(`/calendars/${calendarId}/appointments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Send SMS
  async sendSMS(contactId, message) {
    return ghlRequest('/conversations/messages', {
      method: 'POST',
      body: JSON.stringify({
        type: 'SMS',
        contactId,
        message
      })
    });
  },

  // Send Email
  async sendEmail(contactId, subject, body) {
    return ghlRequest('/conversations/messages', {
      method: 'POST',
      body: JSON.stringify({
        type: 'Email',
        contactId,
        subject,
        body
      })
    });
  },

  // Get workflows
  async getWorkflows() {
    return ghlRequest('/workflows');
  },

  // Add contact to workflow
  async addToWorkflow(workflowId, contactId) {
    return ghlRequest(`/workflows/${workflowId}/contacts`, {
      method: 'POST',
      body: JSON.stringify({ contactId })
    });
  },

  // Get campaigns
  async getCampaigns() {
    return ghlRequest('/campaigns');
  }
};

// ============================================================================
// SUPABASE INTEGRATION
// ============================================================================

export const supabase = {
  config: {
    url: null,
    key: null,
    initialized: false
  },

  // Initialize Supabase client
  init() {
    this.config.url = process.env.SUPABASE_URL;
    this.config.key = process.env.SUPABASE_ANON_KEY;

    if (!this.config.url || !this.config.key) {
      console.warn('Supabase not configured - SUPABASE_URL and SUPABASE_ANON_KEY required');
      return false;
    }

    this.config.initialized = true;
    return true;
  },

  // Make Supabase REST request
  async request(table, options = {}) {
    if (!this.config.initialized) {
      this.init();
    }

    if (!this.config.url || !this.config.key) {
      throw new Error('Supabase not configured');
    }

    const { method = 'GET', query = '', body = null } = options;

    const url = `${this.config.url}/rest/v1/${table}${query ? `?${query}` : ''}`;

    const response = await fetch(url, {
      method,
      headers: {
        'apikey': this.config.key,
        'Authorization': `Bearer ${this.config.key}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
      },
      ...(body && { body: JSON.stringify(body) })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  },

  // Query table
  async select(table, options = {}) {
    const { columns = '*', filter = '', order = '', limit = 100 } = options;

    let query = `select=${columns}`;
    if (filter) query += `&${filter}`;
    if (order) query += `&order=${order}`;
    if (limit) query += `&limit=${limit}`;

    return this.request(table, { query });
  },

  // Insert record
  async insert(table, data) {
    return this.request(table, {
      method: 'POST',
      body: Array.isArray(data) ? data : [data]
    });
  },

  // Update records
  async update(table, filter, data) {
    return this.request(table, {
      method: 'PATCH',
      query: filter,
      body: data
    });
  },

  // Delete records
  async delete(table, filter) {
    return this.request(table, {
      method: 'DELETE',
      query: filter
    });
  },

  // Upsert (insert or update)
  async upsert(table, data, onConflict = 'id') {
    return this.request(table, {
      method: 'POST',
      query: `on_conflict=${onConflict}`,
      body: Array.isArray(data) ? data : [data]
    });
  },

  // Call RPC function
  async rpc(functionName, params = {}) {
    return this.request(`rpc/${functionName}`, {
      method: 'POST',
      body: params
    });
  }
};

// ============================================================================
// INTEGRATION STATUS & SYNC
// ============================================================================

/**
 * Check integration status
 */
export async function checkIntegrationStatus() {
  const status = {
    taskade: { configured: !!process.env.TASKADE_API_KEY, connected: false },
    taskmagic: { configured: !!process.env.TASKMAGIC_WEBHOOK_URL, connected: false },
    ghl: { configured: !!process.env.GHL_API_KEY, connected: false },
    supabase: { configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY), connected: false }
  };

  // Test Taskade
  if (status.taskade.configured) {
    try {
      await taskade.getWorkspaces();
      status.taskade.connected = true;
    } catch (e) {
      status.taskade.error = e.message;
    }
  }

  // Test TaskMagic (webhook - just check if configured)
  status.taskmagic.connected = status.taskmagic.configured;

  // Test GHL
  if (status.ghl.configured) {
    try {
      await ghl.getPipelines();
      status.ghl.connected = true;
    } catch (e) {
      status.ghl.error = e.message;
    }
  }

  // Test Supabase
  if (status.supabase.configured) {
    try {
      supabase.init();
      status.supabase.connected = true;
    } catch (e) {
      status.supabase.error = e.message;
    }
  }

  return status;
}

/**
 * Sync data between systems
 */
export async function syncIntegrations(source, target, dataType) {
  const dbInstance = db.getDb();

  // Log sync attempt
  const logSync = dbInstance.prepare(`
    INSERT INTO agent_interactions (agent_id, interaction_type, data)
    VALUES ('integration_sync', ?, ?)
  `);

  logSync.run(`${source}_to_${target}`, JSON.stringify({ dataType, timestamp: new Date().toISOString() }));

  // Implement sync logic based on source/target
  switch (`${source}_${target}`) {
    case 'taskade_local':
      // Sync Taskade tasks to local database
      break;
    case 'ghl_taskade':
      // Sync GHL contacts/opportunities to Taskade tasks
      break;
    case 'local_supabase':
      // Backup local data to Supabase
      break;
    default:
      throw new Error(`Unknown sync path: ${source} -> ${target}`);
  }
}

/**
 * Store integration credentials
 */
export function setIntegrationCredential(service, key, value) {
  const dbInstance = db.getDb();

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS integration_credentials (
      service TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (service, key)
    )
  `);

  const stmt = dbInstance.prepare(`
    INSERT INTO integration_credentials (service, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT(service, key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(service, key, value);
}

export default {
  taskade,
  taskmagic,
  ghl,
  supabase,
  checkIntegrationStatus,
  syncIntegrations,
  setIntegrationCredential
};
