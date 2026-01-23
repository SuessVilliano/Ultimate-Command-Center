/**
 * Nifty PM API Routes
 * These routes provide REST endpoints for Nifty PM integration
 */

import { nifty } from '../lib/nifty-integration.js';

export function registerNiftyRoutes(app) {
  // ============================================
  // NIFTY PM OAUTH ENDPOINTS
  // ============================================

  // Get OAuth authorization URL
  app.get('/api/nifty/auth/url', (req, res) => {
    try {
      const url = nifty.getAuthorizationUrl();
      res.json({ url });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // OAuth callback - exchange code for token
  app.get('/api/nifty/callback', async (req, res) => {
    try {
      const { code, error: oauthError, error_description } = req.query;

      // Determine frontend URL (for redirect after OAuth)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

      console.log('Nifty OAuth callback received:', { code: code ? 'present' : 'missing', error: oauthError });

      if (oauthError) {
        const errorMsg = error_description || oauthError;
        console.error('Nifty OAuth error from provider:', errorMsg);
        return res.redirect(`${frontendUrl}/?page=integrations&nifty_error=${encodeURIComponent(errorMsg)}`);
      }

      if (!code) {
        console.error('Nifty OAuth: No code received');
        return res.redirect(`${frontendUrl}/?page=integrations&nifty_error=${encodeURIComponent('No authorization code received')}`);
      }

      console.log('Exchanging code for token...');
      const tokens = await nifty.exchangeCodeForToken(code);
      console.log('Token exchange successful');

      // Redirect back to integrations page with success
      res.redirect(`${frontendUrl}/?page=integrations&nifty_connected=true`);
    } catch (error) {
      console.error('Nifty OAuth token exchange error:', error.message);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/?page=integrations&nifty_error=${encodeURIComponent(error.message)}`);
    }
  });

  // Get token status
  app.get('/api/nifty/auth/status', (req, res) => {
    try {
      const status = nifty.getTokenStatus();
      const redirectUri = process.env.NIFTY_REDIRECT_URI || 'Not configured';

      res.json({
        ...status,
        authenticated: status.hasAccessToken && !status.isExpired,
        redirectUri,
        configNote: redirectUri.includes('localhost')
          ? 'Add this redirect URI to your Nifty OAuth app: ' + redirectUri
          : null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Set tokens manually
  app.post('/api/nifty/auth/tokens', (req, res) => {
    try {
      const { accessToken, refreshToken, expiresIn } = req.body;
      nifty.setTokens(accessToken, refreshToken, expiresIn);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // NIFTY PM PROJECT ENDPOINTS
  // ============================================

  // Get all projects
  app.get('/api/nifty/projects', async (req, res) => {
    try {
      const result = await nifty.getProjects();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get project by ID
  app.get('/api/nifty/projects/:projectId', async (req, res) => {
    try {
      const result = await nifty.getProject(req.params.projectId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create project
  app.post('/api/nifty/projects', async (req, res) => {
    try {
      const result = await nifty.createProject(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update project
  app.put('/api/nifty/projects/:projectId', async (req, res) => {
    try {
      const result = await nifty.updateProject(req.params.projectId, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // NIFTY PM TASK ENDPOINTS
  // ============================================

  // Get tasks for a project
  app.get('/api/nifty/projects/:projectId/tasks', async (req, res) => {
    try {
      const { status, assignee, milestone } = req.query;
      const result = await nifty.getTasks(req.params.projectId, { status, assignee, milestone });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get task by ID
  app.get('/api/nifty/tasks/:taskId', async (req, res) => {
    try {
      const result = await nifty.getTask(req.params.taskId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create task
  app.post('/api/nifty/projects/:projectId/tasks', async (req, res) => {
    try {
      const result = await nifty.createTask(req.params.projectId, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update task
  app.put('/api/nifty/tasks/:taskId', async (req, res) => {
    try {
      const result = await nifty.updateTask(req.params.taskId, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Complete task
  app.post('/api/nifty/tasks/:taskId/complete', async (req, res) => {
    try {
      const result = await nifty.completeTask(req.params.taskId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Assign task
  app.put('/api/nifty/tasks/:taskId/assign', async (req, res) => {
    try {
      const { memberIds } = req.body;
      const result = await nifty.assignTask(req.params.taskId, memberIds);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // NIFTY PM MILESTONE ENDPOINTS
  // ============================================

  // Get milestones for a project
  app.get('/api/nifty/projects/:projectId/milestones', async (req, res) => {
    try {
      const result = await nifty.getMilestones(req.params.projectId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create milestone
  app.post('/api/nifty/projects/:projectId/milestones', async (req, res) => {
    try {
      const result = await nifty.createMilestone(req.params.projectId, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update milestone
  app.put('/api/nifty/milestones/:milestoneId', async (req, res) => {
    try {
      const result = await nifty.updateMilestone(req.params.milestoneId, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // NIFTY PM MESSAGE ENDPOINTS
  // ============================================

  // Get messages for a project
  app.get('/api/nifty/projects/:projectId/messages', async (req, res) => {
    try {
      const { limit, offset } = req.query;
      const result = await nifty.getMessages(req.params.projectId, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create message
  app.post('/api/nifty/projects/:projectId/messages', async (req, res) => {
    try {
      const { content, taskId } = req.body;
      const result = await nifty.createMessage(req.params.projectId, content, { taskId });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // NIFTY PM OTHER ENDPOINTS
  // ============================================

  // Get documents for a project
  app.get('/api/nifty/projects/:projectId/documents', async (req, res) => {
    try {
      const result = await nifty.getDocuments(req.params.projectId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get project members
  app.get('/api/nifty/projects/:projectId/members', async (req, res) => {
    try {
      const result = await nifty.getMembers(req.params.projectId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get portfolios
  app.get('/api/nifty/portfolios', async (req, res) => {
    try {
      const result = await nifty.getPortfolios();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get portfolio projects
  app.get('/api/nifty/portfolios/:portfolioId/projects', async (req, res) => {
    try {
      const result = await nifty.getPortfolioProjects(req.params.portfolioId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // NIFTY PM TIME TRACKING ENDPOINTS
  // ============================================

  // Get time entries
  app.get('/api/nifty/time-entries', async (req, res) => {
    try {
      const { projectId, taskId, startDate, endDate } = req.query;
      const result = await nifty.getTimeEntries({ projectId, taskId, startDate, endDate });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create time entry
  app.post('/api/nifty/time-entries', async (req, res) => {
    try {
      const { taskId, duration, ...data } = req.body;
      const result = await nifty.createTimeEntry(taskId, duration, data);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('Nifty PM routes registered');
}

export default registerNiftyRoutes;
