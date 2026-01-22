/**
 * Nifty PM Integration for LIV8 Command Center
 * API Documentation: https://developers.niftypm.com/
 *
 * OAuth 2.0 Authentication Flow:
 * 1. User authorizes via NIFTY_AUTHORIZE_URL
 * 2. Redirect receives code, exchanges for access_token
 * 3. Access token used for API calls
 */

const NIFTY_API_BASE = 'https://openapi.niftypm.com/api/v1.0';
const NIFTY_TOKEN_URL = 'https://openapi.niftypm.com/oauth/token';

// Token storage (in production, store in database)
let tokenStore = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};

/**
 * Initialize with stored tokens
 */
function initTokens() {
  // Check environment for pre-stored token
  if (process.env.NIFTY_ACCESS_TOKEN) {
    tokenStore.accessToken = process.env.NIFTY_ACCESS_TOKEN;
  }
  if (process.env.NIFTY_REFRESH_TOKEN) {
    tokenStore.refreshToken = process.env.NIFTY_REFRESH_TOKEN;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code) {
  const clientId = process.env.NIFTY_CLIENT_ID;
  const clientSecret = process.env.NIFTY_CLIENT_SECRET;
  const redirectUri = process.env.NIFTY_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error('NIFTY_CLIENT_ID and NIFTY_CLIENT_SECRET not configured');
  }

  const response = await fetch(NIFTY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  tokenStore.accessToken = data.access_token;
  tokenStore.refreshToken = data.refresh_token;
  tokenStore.expiresAt = Date.now() + (data.expires_in * 1000);

  return data;
}

/**
 * Refresh the access token
 */
async function refreshAccessToken() {
  const clientId = process.env.NIFTY_CLIENT_ID;
  const clientSecret = process.env.NIFTY_CLIENT_SECRET;

  if (!tokenStore.refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(NIFTY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenStore.refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  tokenStore.accessToken = data.access_token;
  if (data.refresh_token) {
    tokenStore.refreshToken = data.refresh_token;
  }
  tokenStore.expiresAt = Date.now() + (data.expires_in * 1000);

  return data;
}

/**
 * Get valid access token (refresh if needed)
 */
async function getAccessToken() {
  initTokens();

  // If no token, check if we have one stored
  if (!tokenStore.accessToken) {
    throw new Error('No access token. Please authenticate via OAuth first.');
  }

  // Refresh if expired or expiring soon (within 5 minutes)
  if (tokenStore.expiresAt && tokenStore.expiresAt < Date.now() + 300000) {
    if (tokenStore.refreshToken) {
      await refreshAccessToken();
    } else {
      throw new Error('Token expired and no refresh token available');
    }
  }

  return tokenStore.accessToken;
}

/**
 * Make Nifty PM API request with OAuth
 */
async function niftyRequest(endpoint, options = {}) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${NIFTY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    // If unauthorized, try refreshing token once
    if (response.status === 401 && tokenStore.refreshToken) {
      await refreshAccessToken();
      return niftyRequest(endpoint, options);
    }
    const errorText = await response.text();
    throw new Error(`Nifty API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Generate OAuth authorization URL
 */
function getAuthorizationUrl() {
  const clientId = process.env.NIFTY_CLIENT_ID;
  const redirectUri = process.env.NIFTY_REDIRECT_URI;
  const scopes = 'file,doc,message,project,task,member,time_tracking,subteam,subtask,milestone,label,task_group';

  return `https://nifty.pm/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;
}

export const nifty = {
  // ===== OAUTH =====

  getAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,

  // Set tokens directly (for stored tokens)
  setTokens(accessToken, refreshToken = null, expiresIn = 3600) {
    tokenStore.accessToken = accessToken;
    tokenStore.refreshToken = refreshToken;
    tokenStore.expiresAt = Date.now() + (expiresIn * 1000);
  },

  // Get current token status
  getTokenStatus() {
    return {
      hasAccessToken: !!tokenStore.accessToken,
      hasRefreshToken: !!tokenStore.refreshToken,
      expiresAt: tokenStore.expiresAt,
      isExpired: tokenStore.expiresAt ? tokenStore.expiresAt < Date.now() : true
    };
  },

  // ===== PROJECTS =====

  // Get all projects
  async getProjects() {
    return niftyRequest('/projects');
  },

  // Get project by ID
  async getProject(projectId) {
    return niftyRequest(`/projects/${projectId}`);
  },

  // Create project
  async createProject(data) {
    return niftyRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Update project
  async updateProject(projectId, data) {
    return niftyRequest(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // ===== TASKS =====

  // Get tasks for a project
  async getTasks(projectId, options = {}) {
    const query = new URLSearchParams();
    if (options.status) query.append('status', options.status);
    if (options.assignee) query.append('assignee', options.assignee);
    if (options.milestone) query.append('milestone_id', options.milestone);

    const queryStr = query.toString();
    return niftyRequest(`/tasks?project_id=${projectId}${queryStr ? '&' + queryStr : ''}`);
  },

  // Get task by ID
  async getTask(taskId) {
    return niftyRequest(`/tasks/${taskId}`);
  },

  // Create task
  async createTask(projectId, data) {
    return niftyRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        ...data
      })
    });
  },

  // Update task
  async updateTask(taskId, data) {
    return niftyRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Complete task
  async completeTask(taskId) {
    return niftyRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ completed: true })
    });
  },

  // Assign task
  async assignTask(taskId, memberIds) {
    return niftyRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ assignees: memberIds })
    });
  },

  // ===== MILESTONES =====

  // Get milestones for a project
  async getMilestones(projectId) {
    return niftyRequest(`/milestones?project_id=${projectId}`);
  },

  // Create milestone
  async createMilestone(projectId, data) {
    return niftyRequest('/milestones', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        ...data
      })
    });
  },

  // Update milestone
  async updateMilestone(milestoneId, data) {
    return niftyRequest(`/milestones/${milestoneId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // ===== MESSAGES =====

  // Get messages for a project
  async getMessages(projectId, options = {}) {
    const query = new URLSearchParams();
    if (options.limit) query.append('limit', options.limit);
    if (options.offset) query.append('offset', options.offset);

    const queryStr = query.toString();
    return niftyRequest(`/messages?project_id=${projectId}${queryStr ? '&' + queryStr : ''}`);
  },

  // Create message (comment)
  async createMessage(projectId, content, options = {}) {
    return niftyRequest('/messages', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        content,
        ...(options.taskId && { task_id: options.taskId })
      })
    });
  },

  // ===== DOCUMENTS =====

  // Get documents for a project
  async getDocuments(projectId) {
    return niftyRequest(`/docs?project_id=${projectId}`);
  },

  // ===== MEMBERS =====

  // Get project members
  async getMembers(projectId) {
    return niftyRequest(`/projects/${projectId}/members`);
  },

  // ===== PORTFOLIOS (TEAMS) =====

  // Get portfolios
  async getPortfolios() {
    return niftyRequest('/portfolios');
  },

  // Get portfolio projects
  async getPortfolioProjects(portfolioId) {
    return niftyRequest(`/portfolios/${portfolioId}/projects`);
  },

  // ===== TIME TRACKING =====

  // Get time entries
  async getTimeEntries(options = {}) {
    const query = new URLSearchParams();
    if (options.projectId) query.append('project_id', options.projectId);
    if (options.taskId) query.append('task_id', options.taskId);
    if (options.startDate) query.append('start_date', options.startDate);
    if (options.endDate) query.append('end_date', options.endDate);

    const queryStr = query.toString();
    return niftyRequest(`/time_entries${queryStr ? '?' + queryStr : ''}`);
  },

  // Create time entry
  async createTimeEntry(taskId, duration, data = {}) {
    return niftyRequest('/time_entries', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        duration,
        ...data
      })
    });
  }
};

export default nifty;
