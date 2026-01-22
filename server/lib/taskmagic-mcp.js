/**
 * TaskMagic MCP Integration
 * Full MCP control for TaskMagic automations
 */

const TASKMAGIC_MCP_BASE = 'https://api.taskmagic.com/mcp/v1';

/**
 * Make TaskMagic MCP API request
 */
async function taskmagicMCPRequest(endpoint, options = {}) {
  const token = process.env.TASKMAGIC_MCP_TOKEN;
  if (!token) {
    throw new Error('TASKMAGIC_MCP_TOKEN not configured');
  }

  const response = await fetch(`${TASKMAGIC_MCP_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TaskMagic MCP error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export const taskmagicMCP = {
  // Check if MCP is configured
  isConfigured() {
    return !!process.env.TASKMAGIC_MCP_TOKEN;
  },

  // Get all bots/automations
  async getBots() {
    try {
      return await taskmagicMCPRequest('/bots');
    } catch (e) {
      console.error('TaskMagic getBots error:', e.message);
      return { bots: [], error: e.message };
    }
  },

  // Get specific bot details
  async getBot(botId) {
    return taskmagicMCPRequest(`/bots/${botId}`);
  },

  // Run a bot/automation
  async runBot(botId, params = {}) {
    return taskmagicMCPRequest(`/bots/${botId}/run`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  // Get bot run history
  async getBotRuns(botId, limit = 10) {
    return taskmagicMCPRequest(`/bots/${botId}/runs?limit=${limit}`);
  },

  // Get specific run status
  async getRunStatus(runId) {
    return taskmagicMCPRequest(`/runs/${runId}`);
  },

  // Stop a running bot
  async stopRun(runId) {
    return taskmagicMCPRequest(`/runs/${runId}/stop`, {
      method: 'POST'
    });
  },

  // Get all available actions/tasks
  async getActions() {
    try {
      return await taskmagicMCPRequest('/actions');
    } catch (e) {
      console.error('TaskMagic getActions error:', e.message);
      return { actions: [], error: e.message };
    }
  },

  // Execute a specific action
  async executeAction(actionId, params = {}) {
    return taskmagicMCPRequest(`/actions/${actionId}/execute`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  // Get workspace info
  async getWorkspace() {
    try {
      return await taskmagicMCPRequest('/workspace');
    } catch (e) {
      console.error('TaskMagic getWorkspace error:', e.message);
      return { error: e.message };
    }
  },

  // Create a new bot
  async createBot(config) {
    return taskmagicMCPRequest('/bots', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  },

  // Update bot configuration
  async updateBot(botId, config) {
    return taskmagicMCPRequest(`/bots/${botId}`, {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },

  // Delete a bot
  async deleteBot(botId) {
    return taskmagicMCPRequest(`/bots/${botId}`, {
      method: 'DELETE'
    });
  },

  // Get schedules
  async getSchedules() {
    try {
      return await taskmagicMCPRequest('/schedules');
    } catch (e) {
      return { schedules: [], error: e.message };
    }
  },

  // Create schedule for a bot
  async createSchedule(botId, schedule) {
    return taskmagicMCPRequest('/schedules', {
      method: 'POST',
      body: JSON.stringify({ botId, ...schedule })
    });
  },

  // Get integration status
  async getStatus() {
    const configured = this.isConfigured();
    if (!configured) {
      return { configured: false, connected: false };
    }

    try {
      const workspace = await this.getWorkspace();
      return {
        configured: true,
        connected: !workspace.error,
        workspace: workspace.error ? null : workspace
      };
    } catch (e) {
      return { configured: true, connected: false, error: e.message };
    }
  }
};

export default taskmagicMCP;
