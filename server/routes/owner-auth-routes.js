import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function authSecret() {
  return String(
    process.env.COMMAND_CENTER_AUTH_SECRET ||
    process.env.LIV8_MCP_AUTH_SECRET ||
    process.env.LIV8_MCP_API_KEY ||
    ''
  ).trim();
}

function ownerConfig() {
  return {
    username: String(process.env.COMMAND_CENTER_OWNER_USERNAME || 'admin').trim(),
    password: String(process.env.COMMAND_CENTER_OWNER_PASSWORD || process.env.LIV8_MCP_OWNER_PASSWORD || '').trim(),
    profile: {
      id: 'admin_001',
      username: String(process.env.COMMAND_CENTER_OWNER_USERNAME || 'admin').trim(),
      name: String(process.env.COMMAND_CENTER_OWNER_NAME || 'SV').trim(),
      email: String(process.env.COMMAND_CENTER_OWNER_EMAIL || 'liv8ent@gmail.com').trim(),
      role: 'admin',
      agentName: String(process.env.COMMAND_CENTER_OWNER_AGENT_NAME || 'SV - GoHighLevel Support').trim(),
      permissions: ['*'],
    },
  };
}

function secureEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sign(payload) {
  const secret = authSecret();
  if (!secret) throw Object.assign(new Error('Command Center auth secret is not configured'), { status: 503 });
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  const secret = authSecret();
  if (!secret || typeof token !== 'string') return null;
  const [body, sig, ...extra] = token.split('.');
  if (!body || !sig || extra.length) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (!secureEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.kind !== 'owner-session') return null;
    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function bearer(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export function requireOwnerSession(req, res, next) {
  const payload = verify(bearer(req));
  if (!payload) return res.status(401).json({ error: 'Authenticated owner session required' });
  req.ownerSession = payload;
  return next();
}

export function createInternalOwnerSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    kind: 'owner-session',
    sub: 'internal-mcp',
    username: 'internal-mcp',
    iat: now,
    exp: now + 60,
  });
}

export function registerOwnerAuthRoutes(app) {
  app.get('/api/auth/status', (_req, res) => {
    const owner = ownerConfig();
    res.json({
      ok: true,
      configured: Boolean(authSecret() && owner.password),
      usernameConfigured: Boolean(owner.username),
      passwordConfigured: Boolean(owner.password),
      sessionSecretConfigured: Boolean(authSecret()),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const owner = ownerConfig();
      if (!authSecret() || !owner.password) {
        return res.status(503).json({ success: false, error: 'Shared Command Center login is not configured on the cloud API.' });
      }

      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      if (!secureEqual(username.toLowerCase(), owner.username.toLowerCase()) || !secureEqual(password, owner.password)) {
        return res.status(401).json({ success: false, error: 'Invalid username or password' });
      }

      const now = Math.floor(Date.now() / 1000);
      const user = { ...owner.profile, lastLogin: new Date().toISOString() };
      const token = sign({
        kind: 'owner-session',
        sub: user.id,
        username: user.username,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      });

      res.json({ success: true, token, user, expiresIn: SESSION_TTL_SECONDS });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/auth/session', (req, res) => {
    const payload = verify(bearer(req));
    if (!payload) return res.status(401).json({ authenticated: false });
    const owner = ownerConfig();
    res.json({ authenticated: true, user: owner.profile, expiresAt: new Date(Number(payload.exp) * 1000).toISOString() });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.json({ success: true });
  });

  console.log(`Shared owner auth routes registered | configured=${Boolean(authSecret() && ownerConfig().password)}`);
}

export default registerOwnerAuthRoutes;
