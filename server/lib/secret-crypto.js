/**
 * Transparent at-rest encryption for sensitive setting values
 * (API keys, OAuth tokens, passwords). Uses AES-256-GCM with a
 * per-install master key (`LIV8_MASTER_KEY`).
 *
 * Storage format for encrypted strings:
 *   enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 *
 * Plain values that don't match the secret-key pattern pass through
 * unchanged, so existing settings continue to work and only secrets
 * get encrypted.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ENV_PATH = path.join(path.dirname(__filename), '..', '.env');

const ENC_PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

// Suffixes that mark a setting as a secret needing encryption.
// Keep this conservative — wrong matches break consumers that read raw env values.
const SECRET_SUFFIXES = [
  '_api_key', '_apikey', '_token', '_secret', '_password',
  '_pat', '_credentials', '_access_key', '_private_key'
];

export function isSecretKey(key) {
  if (!key || typeof key !== 'string') return false;
  const lower = key.toLowerCase();
  return SECRET_SUFFIXES.some(s => lower.endsWith(s));
}

/**
 * Lazily resolve the master key. If LIV8_MASTER_KEY is not present in env,
 * generate one and append it to server/.env so it survives restarts.
 * This is intentionally a one-time bootstrap — the key never leaves the box.
 */
let cachedKey = null;
function getMasterKey() {
  if (cachedKey) return cachedKey;
  let hex = process.env.LIV8_MASTER_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    hex = crypto.randomBytes(32).toString('hex');
    try {
      const line = `\n# Auto-generated at first boot — protects setting secrets at rest. Do not share.\nLIV8_MASTER_KEY=${hex}\n`;
      fs.appendFileSync(ENV_PATH, line, { mode: 0o600 });
      try { fs.chmodSync(ENV_PATH, 0o600); } catch (e) {}
      console.log('[secret-crypto] Generated LIV8_MASTER_KEY and wrote to server/.env (one-time).');
    } catch (e) {
      console.warn('[secret-crypto] Could not persist LIV8_MASTER_KEY to .env:', e.message);
      console.warn('[secret-crypto] Encryption will work for this process but secrets will be unrecoverable after restart.');
    }
    process.env.LIV8_MASTER_KEY = hex;
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

export function encrypt(plain) {
  if (plain == null) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getMasterKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decrypt(stored) {
  if (!isEncrypted(stored)) return stored;
  try {
    const [, , ivB64, tagB64, ctB64] = stored.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, getMasterKey(), iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch (e) {
    console.warn('[secret-crypto] Decrypt failed (wrong key or corrupted value):', e.message);
    return null;
  }
}

/** Wrap a value before persisting — encrypts if the key looks like a secret. */
export function wrapValue(key, plain) {
  if (plain == null || plain === '') return plain;
  if (!isSecretKey(key)) return plain;
  if (isEncrypted(plain)) return plain; // already encrypted, don't double-wrap
  return encrypt(plain);
}

/** Unwrap a value after reading — decrypts if it was encrypted. */
export function unwrapValue(key, stored) {
  if (!isEncrypted(stored)) return stored;
  return decrypt(stored);
}
