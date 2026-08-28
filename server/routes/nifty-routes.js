import { nifty } from '../lib/nifty-integration.js';
import { registerNiftyMcpRoutes } from './nifty-mcp-routes.js';
import { registerHybridJournalMcpRoutes } from './hybrid-journal-mcp-routes.js';
import { registerAppleHealthRoutes } from './apple-health-routes.js';
import { registerLocalAiRoutes } from './local-ai-routes.js';
import { registerOperatorRoutes } from './operator-routes.js';
import { registerTimeIntelligenceRoutes } from './time-intelligence-routes.js';
import { registerLocalWorkspaceMcpRoutes } from './local-workspace-mcp-routes.js';
import { registerTradingGuardianRoutes } from './trading-guardian-routes.js';

export function registerNiftyRoutes(app) {
  // Headless operating bridges. Legacy Nifty REST/OAuth routes below remain
  // available as a compatibility fallback while Command Center uses MCP first.
  registerNiftyMcpRoutes(app);
  registerHybridJournalMcpRoutes(app);
  registerAppleHealthRoutes(app);
  registerLocalAiRoutes(app);
  registerOperatorRoutes(app);
  registerTimeIntelligenceRoutes(app);
  registerLocalWorkspaceMcpRoutes(app);
  registerTradingGuardianRoutes(app);

  app.get('/api/nifty/auth/url', (req, res) => {
    try { res.json({ url: nifty.getAuthorizationUrl() }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/callback', async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    try {
      const { code, error: oauthError, error_description } = req.query;
      if (oauthError) return res.redirect(`${frontendUrl}/?page=integrations&nifty_error=${encodeURIComponent(error_description || oauthError)}`);
      if (!code) return res.redirect(`${frontendUrl}/?page=integrations&nifty_error=${encodeURIComponent('No authorization code received')}`);
      await nifty.exchangeCodeForToken(code);
      res.redirect(`${frontendUrl}/?page=integrations&nifty_connected=true`);
    } catch (error) {
      res.redirect(`${frontendUrl}/?page=integrations&nifty_error=${encodeURIComponent(error.message)}`);
    }
  });

  app.get('/api/nifty/auth/status', (req, res) => {
    try {
      const status = nifty.getTokenStatus();
      const redirectUri = process.env.NIFTY_REDIRECT_URI || 'Not configured';
      res.json({
        ...status,
        authenticated: status.hasAccessToken && !status.isExpired,
        redirectUri,
        configNote: redirectUri.includes('localhost') ? `Add this redirect URI to your Nifty OAuth app: ${redirectUri}` : null
      });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/api/nifty/auth/tokens', (req, res) => {
    try {
      const { accessToken, refreshToken, expiresIn } = req.body;
      nifty.setTokens(accessToken, refreshToken, expiresIn);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/projects', async (req, res) => {
    try { res.json(await nifty.getProjects()); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.get('/api/nifty/projects/:projectId', async (req, res) => {
    try { res.json(await nifty.getProject(req.params.projectId)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/api/nifty/projects', async (req, res) => {
    try { res.json(await nifty.createProject(req.body)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.put('/api/nifty/projects/:projectId', async (req, res) => {
    try { res.json(await nifty.updateProject(req.params.projectId, req.body)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/projects/:projectId/tasks', async (req, res) => {
    try {
      const { status, assignee, milestone } = req.query;
      res.json(await nifty.getTasks(req.params.projectId, { status, assignee, milestone }));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.get('/api/nifty/tasks/:taskId', async (req, res) => {
    try { res.json(await nifty.getTask(req.params.taskId)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/api/nifty/projects/:projectId/tasks', async (req, res) => {
    try { res.json(await nifty.createTask(req.params.projectId, req.body)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.put('/api/nifty/tasks/:taskId', async (req, res) => {
    try { res.json(await nifty.updateTask(req.params.taskId, req.body)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/api/nifty/tasks/:taskId/complete', async (req, res) => {
    try { res.json(await nifty.completeTask(req.params.taskId)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.put('/api/nifty/tasks/:taskId/assign', async (req, res) => {
    try { res.json(await nifty.assignTask(req.params.taskId, req.body.memberIds)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/projects/:projectId/milestones', async (req, res) => {
    try { res.json(await nifty.getMilestones(req.params.projectId)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/api/nifty/projects/:projectId/milestones', async (req, res) => {
    try { res.json(await nifty.createMilestone(req.params.projectId, req.body)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.put('/api/nifty/milestones/:milestoneId', async (req, res) => {
    try { res.json(await nifty.updateMilestone(req.params.milestoneId, req.body)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/projects/:projectId/messages', async (req, res) => {
    try {
      const { limit, offset } = req.query;
      res.json(await nifty.getMessages(req.params.projectId, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      }));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/api/nifty/projects/:projectId/messages', async (req, res) => {
    try {
      const { content, taskId } = req.body;
      res.json(await nifty.createMessage(req.params.projectId, content, { taskId }));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/projects/:projectId/documents', async (req, res) => {
    try { res.json(await nifty.getDocuments(req.params.projectId)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.get('/api/nifty/projects/:projectId/members', async (req, res) => {
    try { res.json(await nifty.getMembers(req.params.projectId)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.get('/api/nifty/portfolios', async (req, res) => {
    try { res.json(await nifty.getPortfolios()); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.get('/api/nifty/portfolios/:portfolioId/projects', async (req, res) => {
    try { res.json(await nifty.getPortfolioProjects(req.params.portfolioId)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.get('/api/nifty/time-entries', async (req, res) => {
    try {
      const { projectId, taskId, startDate, endDate } = req.query;
      res.json(await nifty.getTimeEntries({ projectId, taskId, startDate, endDate }));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/api/nifty/time-entries', async (req, res) => {
    try {
      const { taskId, duration, ...data } = req.body;
      res.json(await nifty.createTimeEntry(taskId, duration, data));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  console.log('Nifty + Hybrid Journal MCP + Apple Health + Local Ollama AI + Juno Operator + Time Intelligence + Mac Workspace MCP + Trading Guardian routes registered');
}

export default registerNiftyRoutes;
