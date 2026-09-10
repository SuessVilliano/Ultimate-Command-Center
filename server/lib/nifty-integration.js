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

// Runtime token storage. Environment tokens are used as a boot fallback only;
// they must never overwrite a token that was refreshed or set during this process.
let tokenStore = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null
};
let initializedFromEnv = false;

/** Initialize once with stored tokens. */
function initTokens() {
  if (initializedFromEnv) return;
  initializedFromEnv = true;

  if (!tokenStore.accessToken && process.env.NIFTY_ACCESS_TOKEN) {
    tokenStore.accessToken = process.env.NIFTY_ACCESS_TOKEN;
  }
  if (!tokenStore.refreshToken && process.env.NIFTY_REFRESH_TOKEN) {
    tokenStore.refreshToken = process.env.NIFTY_REFRESH_TOKEN;
  }

  const envExpiry = Number(process.env.NIFTY_ACCESS_TOKEN_EXPIRES_AT || 0);
  if (!tokenStore.expiresAt && Number.isFinite(envExpiry) && envExpiry > 0) {
    tokenStore.expiresAt = envExpiry;
  }
}

/** Exchange authorization code for access token. */
async function exchangeCodeForToken(code) {
  const clientId = process.env.NIFTY_CLIENT_ID;
  const clientSecret = process.env.NIFTY_CLIENT_SECRET;
  const redirectUri = process.env.NIFTY_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error('NIFTY_CLIENT_ID and NIFTY_CLIENT_SECRET not configured');
  }

  const response = await fetch(NIFTY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code,
      client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  tokenStore.accessToken = data.access_token;
  tokenStore.refreshToken = data.refresh_token || tokenStore.refreshToken;
  tokenStore.expiresAt = Number(data.expires_in) > 0 ? Date.now() + (Number(data.expires_in) * 1000) : null;
  initializedFromEnv = true;
  return data;
}

/** Refresh the access token. */
async function refreshAccessToken() {
  initTokens();
  const clientId = process.env.NIFTY_CLIENT_ID;
  const clientSecret = process.env.NIFTY_CLIENT_SECRET;

  if (!tokenStore.refreshToken) throw new Error('No refresh token available');
  if (!clientId || !clientSecret) throw new Error('NIFTY_CLIENT_ID and NIFTY_CLIENT_SECRET not configured');

  const response = await fetch(NIFTY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
  if (data.refresh_token) tokenStore.refreshToken = data.refresh_token;
  tokenStore.expiresAt = Number(data.expires_in) > 0 ? Date.now() + (Number(data.expires_in) * 1000) : null;
  return data;
}

/** Get a valid access token (refresh if needed). */
async function getAccessToken() {
  initTokens();
  if (!tokenStore.accessToken) throw new Error('No access token. Please authenticate via OAuth first.');

  if (tokenStore.expiresAt && tokenStore.expiresAt < Date.now() + 300000) {
    if (tokenStore.refreshToken) await refreshAccessToken();
    else throw new Error('Token expired and no refresh token available');
  }

  return tokenStore.accessToken;
}

/** Make Nifty PM API request with OAuth. */
async function niftyRequest(endpoint, options = {}, retried = false) {
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
    if (response.status === 401 && tokenStore.refreshToken && !retried) {
      await refreshAccessToken();
      return niftyRequest(endpoint, options, true);
    }
    const errorText = await response.text();
    throw new Error(`Nifty API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function getAuthorizationUrl() {
  const clientId = process.env.NIFTY_CLIENT_ID;
  const redirectUri = process.env.NIFTY_REDIRECT_URI;
  if (!clientId || !redirectUri) throw new Error('NIFTY_CLIENT_ID and NIFTY_REDIRECT_URI not configured');
  const scopes = 'file,doc,message,project,task,member,time_tracking,subteam,subtask,milestone,label,task_group';
  return `https://nifty.pm/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;
}

export const nifty = {
  getAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,

  setTokens(accessToken, refreshToken = null, expiresIn = null) {
    tokenStore.accessToken = accessToken || null;
    tokenStore.refreshToken = refreshToken || tokenStore.refreshToken;
    const ttl = Number(expiresIn);
    tokenStore.expiresAt = Number.isFinite(ttl) && ttl > 0 ? Date.now() + (ttl * 1000) : null;
    initializedFromEnv = true;
  },

  getTokenStatus() {
    initTokens();
    const isExpired = tokenStore.expiresAt ? tokenStore.expiresAt < Date.now() : false;
    const hasAccessToken = !!tokenStore.accessToken;
    const hasRefreshToken = !!tokenStore.refreshToken;
    return {
      hasAccessToken,
      hasRefreshToken,
      expiresAt: tokenStore.expiresAt,
      isExpired,
      authenticated: hasAccessToken && !isExpired
    };
  },

  async getProjects() { return niftyRequest('/projects'); },
  async getProject(projectId) { return niftyRequest(`/projects/${projectId}`); },
  async createProject(data) { return niftyRequest('/projects', { method: 'POST', body: JSON.stringify(data) }); },
  async updateProject(projectId, data) { return niftyRequest(`/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(data) }); },

  async getTasks(projectId, options = {}) {
    const query = new URLSearchParams();
    if (options.status) query.append('status', options.status);
    if (options.assignee) query.append('assignee', options.assignee);
    if (options.milestone) query.append('milestone_id', options.milestone);
    const queryStr = query.toString();
    return niftyRequest(`/tasks?project_id=${projectId}${queryStr ? '&' + queryStr : ''}`);
  },
  async getTask(taskId) { return niftyRequest(`/tasks/${taskId}`); },
  async createTask(projectId, data) { return niftyRequest('/tasks', { method: 'POST', body: JSON.stringify({ project_id: projectId, ...data }) }); },
  async updateTask(taskId, data) { return niftyRequest(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async completeTask(taskId) { return niftyRequest(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ completed: true }) }); },
  async assignTask(taskId, memberIds) { return niftyRequest(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ assignees: memberIds }) }); },

  async getMilestones(projectId) { return niftyRequest(`/milestones?project_id=${projectId}`); },
  async createMilestone(projectId, data) { return niftyRequest('/milestones', { method: 'POST', body: JSON.stringify({ project_id: projectId, ...data }) }); },
  async updateMilestone(milestoneId, data) { return niftyRequest(`/milestones/${milestoneId}`, { method: 'PUT', body: JSON.stringify(data) }); },

  async getMessages(projectId, options = {}) {
    const query = new URLSearchParams();
    if (options.limit) query.append('limit', options.limit);
    if (options.offset) query.append('offset', options.offset);
    const queryStr = query.toString();
    return niftyRequest(`/messages?project_id=${projectId}${queryStr ? '&' + queryStr : ''}`);
  },
  async createMessage(projectId, content, options = {}) { return niftyRequest('/messages', { method: 'POST', body: JSON.stringify({ project_id: projectId, content, ...(options.taskId && { task_id: options.taskId }) }) }); },

  async getDocuments(projectId) { return niftyRequest(`/docs?project_id=${projectId}`); },
  async getMembers(projectId) { return niftyRequest(`/projects/${projectId}/members`); },
  async getPortfolios() { return niftyRequest('/portfolios'); },
  async getPortfolioProjects(portfolioId) { return niftyRequest(`/portfolios/${portfolioId}/projects`); },

  async getTimeEntries(options = {}) {
    const query = new URLSearchParams();
    if (options.projectId) query.append('project_id', options.projectId);
    if (options.taskId) query.append('task_id', options.taskId);
    if (options.startDate) query.append('start_date', options.startDate);
    if (options.endDate) query.append('end_date', options.endDate);
    const queryStr = query.toString();
    return niftyRequest(`/time_entries${queryStr ? '?' + queryStr : ''}`);
  },
  async createTimeEntry(taskId, duration, data = {}) { return niftyRequest('/time_entries', { method: 'POST', body: JSON.stringify({ task_id: taskId, duration, ...data }) }); }
};

export default nifty;
