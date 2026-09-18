import { createHash, createHmac, timingSafeEqual, randomUUID } from 'crypto';
import * as db from '../lib/database.js';

const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
const failedAttempts = new Map();

function cfg() {
  return {
    username: String(process.env.LIV8_APP_USERNAME || 'admin').trim(),
    password: String(process.env.LIV8_APP_PASSWORD || process.env.LIV8_MCP_OWNER_PASSWORD || '').trim(),
    sessionSecret: String(process.env.LIV8_APP_SESSION_SECRET || process.env.LIV8_MCP_AUTH_SECRET || process.env.LIV8_MCP_API_KEY || '').trim(),
  };
}

function configured() {
  const c = cfg();
  return Boolean(c.username && c.password && c.sessionSecret);
}

function safeEqual(a, b) {
  const left = createHash('sha256').update(String(a || '')).digest();
  const right = createHash('sha256').update(String(b || '')).digest();
  return timingSafeEqual(left, right);
}

function sign(payload) {
  const secret = cfg().sessionSecret;
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!configured() || typeof token !== 'string') return null;
  const [body, sig, ...extra] = token.split('.');
  if (!body || !sig || extra.length) return null;
  const expected = createHmac('sha256', cfg().sessionSecret).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.kind !== 'liv8-app-session' || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function bearer(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

async function profile() {
  const raw = await db.getSettingAsync('liv8_owner_profile', '');
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const c = cfg();
  return {
    id: 'owner',
    username: c.username,
    name: 'Owner',
    email: '',
    role: 'admin',
    agentName: 'LIV8 Owner',
    permissions: ['*'],
  };
}

async function saveProfile(input = {}) {
  const current = await profile();
  const safe = {
    ...current,
    name: String(input.name ?? current.name ?? 'Owner').slice(0, 120),
    email: String(input.email ?? current.email ?? '').slice(0, 240),
    agentName: String(input.agentName ?? current.agentName ?? 'LIV8 Owner').slice(0, 160),
    username: cfg().username,
    id: 'owner',
    role: 'admin',
    permissions: ['*'],
  };
  await db.setSettingAsync('liv8_owner_profile', JSON.stringify(safe));
  return safe;
}

function attemptKey(req) {
  return String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
}

function checkRate(req) {
  const key = attemptKey(req);
  const now = Date.now();
  const row = failedAttempts.get(key);
  if (!row || now - row.firstAt > 15 * 60 * 1000) {
    failedAttempts.set(key, { firstAt: now, count: 0 });
    return true;
  }
  return row.count < 8;
}

function noteFailure(req) {
  const key = attemptKey(req);
  const now = Date.now();
  const row = failedAttempts.get(key);
  if (!row || now - row.firstAt > 15 * 60 * 1000) failedAttempts.set(key, { firstAt: now, count: 1 });
  else failedAttempts.set(key, { ...row, count: row.count + 1 });
}

function clearFailures(req) {
  failedAttempts.delete(attemptKey(req));
}

async function requireSession(req, res) {
  const payload = verify(bearer(req));
  if (!payload) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return null;
  }
  return payload;
}

export function registerAppAuthRoutes(app) {
  app.get('/api/app-auth/status', (_req, res) => {
    res.json({ ok: true, configured: configured(), mode: configured() ? 'cloud' : 'legacy' });
  });

  app.post('/api/app-auth/login', async (req, res) => {
    try {
      if (!configured()) return res.status(503).json({ ok: false, error: 'Cloud login is not configured' });
      if (!checkRate(req)) return res.status(429).json({ ok: false, error: 'Too many login attempts. Try again later.' });

      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      const c = cfg();
      if (!safeEqual(username.toLowerCase(), c.username.toLowerCase()) || !safeEqual(password, c.password)) {
        noteFailure(req);
        return res.status(401).json({ ok: false, error: 'Invalid username or password' });
      }
      clearFailures(req);
      const now = Math.floor(Date.now() / 1000);
      const user = { ...(await profile()), lastLogin: new Date().toISOString() };
      await db.setSettingAsync('liv8_owner_profile', JSON.stringify(user));
      const token = sign({
        kind: 'liv8-app-session',
        sub: 'owner',
        username: c.username,
        iat: now,
        exp: now + SESSION_TTL_SEC,
        jti: randomUUID(),
      });
      res.json({ ok: true, token, expiresIn: SESSION_TTL_SEC, user });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/app-auth/me', async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    res.json({ ok: true, user: await profile(), session: { expiresAt: new Date(session.exp * 1000).toISOString() } });
  });

  app.patch('/api/app-auth/profile', async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    try {
      res.json({ ok: true, user: await saveProfile(req.body || {}) });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  console.log(`App Auth routes registered | configured=${configured()} | mode=${configured() ? 'cloud' : 'legacy-fallback'}`);
}

export default registerAppAuthRoutes;
