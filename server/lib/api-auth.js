/**
 * LIV8 Command Center - API Key Authentication System
 *
 * Provides API key generation, validation, and Express middleware
 * for securing external API endpoints.
 *
 * Keys are stored in SQLite with scoping (which endpoints they can access),
 * rate limiting, and audit logging.
 */

import crypto from 'crypto';
import { getDb } from './database.js';

// ── Table Setup ────────────────────────────────────────────────

export function initApiAuthTables() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      name TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '*',
      rate_limit INTEGER NOT NULL DEFAULT 60,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      total_requests INTEGER NOT NULL DEFAULT 0,
      created_by TEXT DEFAULT 'system'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_key_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (key_id) REFERENCES api_keys(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_key_logs_key_id ON api_key_logs(key_id);
    CREATE INDEX IF NOT EXISTS idx_api_key_logs_timestamp ON api_key_logs(timestamp);
  `);
}

// ── Key Generation & Management ────────────────────────────────

/**
 * Generate a new API key.
 * Returns the raw key (only shown once) and the stored record.
 */
export function generateApiKey(name, scopes = '*', rateLimit = 60) {
  const db = getDb();
  const rawKey = `liv8_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 12);

  const stmt = db.prepare(`
    INSERT INTO api_keys (key_hash, key_prefix, name, scopes, rate_limit)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(keyHash, keyPrefix, name,
    Array.isArray(scopes) ? scopes.join(',') : scopes,
    rateLimit
  );

  return {
    id: result.lastInsertRowid,
    key: rawKey,
    prefix: keyPrefix,
    name,
    scopes: Array.isArray(scopes) ? scopes : scopes.split(','),
    rateLimit,
    message: 'Store this key securely — it cannot be retrieved again.'
  };
}

/**
 * List all API keys (without hashes)
 */
export function listApiKeys() {
  const db = getDb();
  return db.prepare(`
    SELECT id, key_prefix, name, scopes, rate_limit, is_active,
           created_at, last_used_at, total_requests, created_by
    FROM api_keys ORDER BY created_at DESC
  `).all();
}

/**
 * Revoke (deactivate) an API key
 */
export function revokeApiKey(keyId) {
  const db = getDb();
  const result = db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(keyId);
  return result.changes > 0;
}

/**
 * Reactivate an API key
 */
export function activateApiKey(keyId) {
  const db = getDb();
  const result = db.prepare('UPDATE api_keys SET is_active = 1 WHERE id = ?').run(keyId);
  return result.changes > 0;
}

/**
 * Delete an API key permanently
 */
export function deleteApiKey(keyId) {
  const db = getDb();
  db.prepare('DELETE FROM api_key_logs WHERE key_id = ?').run(keyId);
  const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(keyId);
  return result.changes > 0;
}

/**
 * Get API key usage stats
 */
export function getApiKeyStats(keyId) {
  const db = getDb();
  const key = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(keyId);
  if (!key) return null;

  const recentLogs = db.prepare(`
    SELECT endpoint, method, status_code, ip_address, timestamp
    FROM api_key_logs WHERE key_id = ? ORDER BY timestamp DESC LIMIT 50
  `).all(keyId);

  const endpointCounts = db.prepare(`
    SELECT endpoint, COUNT(*) as count FROM api_key_logs
    WHERE key_id = ? GROUP BY endpoint ORDER BY count DESC
  `).all(keyId);

  return {
    key: { id: key.id, prefix: key.key_prefix, name: key.name, scopes: key.scopes },
    totalRequests: key.total_requests,
    lastUsed: key.last_used_at,
    recentLogs,
    endpointCounts
  };
}

// ── Validation & Rate Limiting ─────────────────────────────────

// In-memory rate limit tracking (per key, per minute window)
const rateLimitWindows = new Map();

function checkRateLimit(keyId, limit) {
  const now = Date.now();
  const windowKey = `${keyId}`;
  const window = rateLimitWindows.get(windowKey);

  if (!window || now - window.start > 60000) {
    // New 1-minute window
    rateLimitWindows.set(windowKey, { start: now, count: 1 });
    return { allowed: true, remaining: limit - 1, resetMs: 60000 };
  }

  window.count++;
  const remaining = limit - window.count;
  const resetMs = 60000 - (now - window.start);

  if (remaining < 0) {
    return { allowed: false, remaining: 0, resetMs };
  }

  return { allowed: true, remaining, resetMs };
}

/**
 * Validate an API key and return the key record if valid
 */
export function validateApiKey(rawKey) {
  const db = getDb();
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const keyRecord = db.prepare(`
    SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1
  `).get(keyHash);

  return keyRecord || null;
}

// ── Express Middleware ──────────────────────────────────────────

/**
 * Express middleware for API key authentication.
 *
 * Usage:
 *   app.use('/api/v1', apiKeyAuth());                    // Any valid key
 *   app.use('/api/v1/tickets', apiKeyAuth('tickets'));    // Requires 'tickets' scope
 */
export function apiKeyAuth(requiredScope = null) {
  return (req, res, next) => {
    // Extract key from Authorization header or query param
    const authHeader = req.headers['authorization'];
    const queryKey = req.query.api_key;
    let rawKey = null;

    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        rawKey = authHeader.slice(7);
      } else {
        rawKey = authHeader;
      }
    } else if (queryKey) {
      rawKey = queryKey;
    }

    if (!rawKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Provide an API key via Authorization: Bearer <key> header or ?api_key= query parameter'
      });
    }

    // Validate key
    const keyRecord = validateApiKey(rawKey);
    if (!keyRecord) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been revoked'
      });
    }

    // Check scope
    if (requiredScope && keyRecord.scopes !== '*') {
      const allowedScopes = keyRecord.scopes.split(',').map(s => s.trim());
      if (!allowedScopes.includes(requiredScope) && !allowedScopes.includes('*')) {
        return res.status(403).json({
          error: 'Insufficient scope',
          message: `This key does not have the '${requiredScope}' scope. Allowed: ${keyRecord.scopes}`
        });
      }
    }

    // Rate limit
    const rateCheck = checkRateLimit(keyRecord.id, keyRecord.rate_limit);
    res.setHeader('X-RateLimit-Limit', keyRecord.rate_limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, rateCheck.remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateCheck.resetMs / 1000));

    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Limit: ${keyRecord.rate_limit} requests/minute. Try again in ${Math.ceil(rateCheck.resetMs / 1000)}s`
      });
    }

    // Update usage stats
    const db = getDb();
    db.prepare(`
      UPDATE api_keys SET last_used_at = datetime('now'), total_requests = total_requests + 1
      WHERE id = ?
    `).run(keyRecord.id);

    // Log the request (fire and forget)
    try {
      db.prepare(`
        INSERT INTO api_key_logs (key_id, endpoint, method, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        keyRecord.id,
        req.originalUrl || req.url,
        req.method,
        req.ip || req.headers['x-forwarded-for'] || 'unknown',
        (req.headers['user-agent'] || '').substring(0, 200)
      );
    } catch (e) { /* non-critical */ }

    // Attach key info to request for downstream use
    req.apiKey = {
      id: keyRecord.id,
      name: keyRecord.name,
      scopes: keyRecord.scopes.split(',').map(s => s.trim()),
      prefix: keyRecord.key_prefix
    };

    next();
  };
}

export default {
  initApiAuthTables,
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  activateApiKey,
  deleteApiKey,
  getApiKeyStats,
  validateApiKey,
  apiKeyAuth
};
