import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const DEFAULT_ROOTS = [path.join(HOME, 'clawd'), path.join(HOME, 'Documents', 'LIV8')];
const MAX_READ_BYTES = Number(process.env.LOCAL_WORKSPACE_MAX_READ_BYTES || 1_000_000);
const MAX_SEARCH_FILES = Number(process.env.LOCAL_WORKSPACE_MAX_SEARCH_FILES || 2000);

const DENY_PARTS = [
  '/.ssh/', '/.gnupg/', '/Library/Keychains/', '/.aws/', '/.config/gcloud/',
  '/node_modules/', '/.git/objects/'
];
const DENY_NAMES = [/^\.env(?:\.|$)/i, /\.pem$/i, /\.key$/i, /id_rsa/i, /id_ed25519/i, /credentials/i, /secret/i];

function expandHome(value = '') {
  return value.startsWith('~/') ? path.join(HOME, value.slice(2)) : value;
}

export function workspaceEnabled() {
  return String(process.env.LOCAL_WORKSPACE_ENABLED || 'true').toLowerCase() !== 'false';
}

export function writeEnabled() {
  return String(process.env.LOCAL_WORKSPACE_WRITE_ENABLED || 'true').toLowerCase() === 'true';
}

export function allowedRoots() {
  const configured = String(process.env.LOCAL_WORKSPACE_ROOTS || '')
    .split(',').map(x => x.trim()).filter(Boolean).map(expandHome);
  return (configured.length ? configured : DEFAULT_ROOTS).map(x => path.resolve(x));
}

function denied(abs) {
  const normalized = abs.split(path.sep).join('/');
  if (DENY_PARTS.some(x => normalized.includes(x))) return true;
  return DENY_NAMES.some(re => re.test(path.basename(abs)));
}

export function resolveWorkspacePath(input = '.') {
  if (!workspaceEnabled()) throw new Error('Local workspace bridge is disabled');
  const roots = allowedRoots();
  const raw = expandHome(String(input || '.'));
  const candidates = path.isAbsolute(raw)
    ? [path.resolve(raw)]
    : roots.map(root => path.resolve(root, raw));
  const abs = candidates.find(candidate => roots.some(root => candidate === root || candidate.startsWith(`${root}${path.sep}`)));
  if (!abs) throw new Error('Path is outside the allow-listed workspace roots');
  if (denied(abs)) throw new Error('Path is blocked by workspace security policy');
  return abs;
}

export async function status() {
  const roots = allowedRoots();
  const checks = await Promise.all(roots.map(async root => {
    try { const s = await fs.stat(root); return { root, available: s.isDirectory() }; }
    catch { return { root, available: false }; }
  }));
  return { enabled: workspaceEnabled(), writeEnabled: writeEnabled(), roots: checks, shellAccess: false, protectedSecrets: true };
}

export async function list(input = '.', { limit = 200 } = {}) {
  const abs = resolveWorkspacePath(input);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const rows = [];
  for (const e of entries.slice(0, Math.max(1, Math.min(Number(limit) || 200, 500)))) {
    const full = path.join(abs, e.name);
    if (denied(full)) continue;
    let size = null, modifiedAt = null;
    try { const st = await fs.stat(full); size = st.size; modifiedAt = st.mtime.toISOString(); } catch {}
    rows.push({ name: e.name, path: full, type: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other', size, modifiedAt });
  }
  return { path: abs, entries: rows };
}

export async function stat(input) {
  const abs = resolveWorkspacePath(input);
  const s = await fs.stat(abs);
  return { path: abs, type: s.isDirectory() ? 'directory' : s.isFile() ? 'file' : 'other', size: s.size, modifiedAt: s.mtime.toISOString(), createdAt: s.birthtime.toISOString() };
}

export async function read(input, { maxBytes = MAX_READ_BYTES } = {}) {
  const abs = resolveWorkspacePath(input);
  const s = await fs.stat(abs);
  if (!s.isFile()) throw new Error('Path is not a file');
  const cap = Math.min(Number(maxBytes) || MAX_READ_BYTES, MAX_READ_BYTES);
  if (s.size > cap) throw new Error(`File is too large to read through MCP (${s.size} bytes > ${cap})`);
  const buffer = await fs.readFile(abs);
  if (buffer.includes(0)) throw new Error('Binary files are not returned through the text workspace tool');
  return { path: abs, content: buffer.toString('utf8'), size: s.size, modifiedAt: s.mtime.toISOString() };
}

async function walk(dir, out, depth = 0) {
  if (out.length >= MAX_SEARCH_FILES || depth > 8) return;
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (out.length >= MAX_SEARCH_FILES) break;
    const full = path.join(dir, entry.name);
    if (denied(full)) continue;
    if (entry.isDirectory()) await walk(full, out, depth + 1);
    else if (entry.isFile()) out.push(full);
  }
}

export async function search(query, { root = '.', limit = 50, content = true } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) throw new Error('query is required');
  const absRoot = resolveWorkspacePath(root);
  const files = [];
  await walk(absRoot, files);
  const hits = [];
  for (const file of files) {
    const nameMatch = path.basename(file).toLowerCase().includes(q);
    let contentMatch = false, snippet = null;
    if (content && !nameMatch) {
      try {
        const st = await fs.stat(file);
        if (st.size <= 250_000) {
          const buf = await fs.readFile(file);
          if (!buf.includes(0)) {
            const text = buf.toString('utf8');
            const idx = text.toLowerCase().indexOf(q);
            if (idx >= 0) { contentMatch = true; snippet = text.slice(Math.max(0, idx - 120), idx + q.length + 240); }
          }
        }
      } catch {}
    }
    if (nameMatch || contentMatch) hits.push({ path: file, name: path.basename(file), match: nameMatch ? 'name' : 'content', snippet });
    if (hits.length >= Math.min(Number(limit) || 50, 100)) break;
  }
  return { query, root: absRoot, scanned: files.length, hits };
}

export async function write(input, content, { overwrite = true } = {}) {
  if (!writeEnabled()) throw new Error('Local workspace writes are disabled');
  const abs = resolveWorkspacePath(input);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  if (!overwrite) {
    try { await fs.access(abs); throw new Error('File already exists'); } catch (e) { if (e.message === 'File already exists') throw e; }
  }
  const text = String(content ?? '');
  await fs.writeFile(abs, text, 'utf8');
  const s = await fs.stat(abs);
  return { ok: true, path: abs, size: s.size, modifiedAt: s.mtime.toISOString() };
}

export async function mkdir(input) {
  if (!writeEnabled()) throw new Error('Local workspace writes are disabled');
  const abs = resolveWorkspacePath(input);
  await fs.mkdir(abs, { recursive: true });
  return { ok: true, path: abs };
}

export const workspaceTools = { status, list, stat, read, search, write, mkdir };
