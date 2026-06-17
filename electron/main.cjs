/**
 * LIV8 Command Center — Electron desktop wrapper (macOS / native window)
 *
 * Works both ways:
 *   • Dev / launcher:  `npm run app`  (files live in the project folder)
 *   • Packaged .app:   double-click the app in /Applications (no Terminal)
 *
 * It launches the backend server as a normal system-Node process (so native
 * modules like better-sqlite3 just work against your installed Node), waits for
 * it to come online, then loads the UI from that same server.
 *
 * Everything runs locally. AI is local via Ollama (cloud fallback optional).
 * Support replies are DRAFT-ONLY — the app never sends on its own.
 */

const { app, BrowserWindow, shell, dialog, Menu } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3005;
const APP_URL = `http://localhost:${PORT}`;
const HEALTH_URL = `${APP_URL}/health`;

// In a packaged app the server/dist are copied into Resources (see package.json
// "extraResources"). In dev they live in the project root.
const ROOT = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');

// Writable locations OUTSIDE the (read-only) app bundle.
const USER_DATA = app.getPath('userData');
const DATA_DIR = path.join(USER_DATA, 'data');        // SQLite + reports
const ENV_FILE = path.join(USER_DATA, 'settings.env'); // optional user settings

let backendProcess = null;
let mainWindow = null;

// --- helpers ---------------------------------------------------------------

/** Find a usable binary across common Mac locations (GUI apps have a thin PATH). */
function resolveBin(name, extra = []) {
  const candidates = [
    ...extra,
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return name; // fall back to PATH
}

function isUp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function waitForBackend(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isUp(HEALTH_URL)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Read simple KEY=VALUE lines from the user's settings file. */
function readUserEnv() {
  const out = {};
  try {
    if (fs.existsSync(ENV_FILE)) {
      for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !line.trim().startsWith('#')) out[m[1]] = m[2];
      }
    }
  } catch (_) {}
  return out;
}

/** Seed a settings file the first time so the user has somewhere to add keys. */
function seedUserEnv() {
  if (fs.existsSync(ENV_FILE)) return;
  const template = [
    '# LIV8 Command Center — local settings (safe to edit)',
    '# AI runs locally via Ollama. Add cloud keys only if you want a fallback.',
    'AI_PROVIDER=ollama',
    'OLLAMA_BASE_URL=http://localhost:11434',
    'OLLAMA_MODEL=llama3.1',
    '',
    '# Optional: server-side Freshdesk (you can also enter these in the app UI)',
    'FRESHDESK_DOMAIN=',
    'FRESHDESK_API_KEY=',
    'FRESHDESK_AGENT_ID=',
    '',
    '# Optional cloud fallbacks',
    'GEMINI_API_KEY=',
    'GROQ_API_KEY=',
    'ANTHROPIC_API_KEY=',
    'OPENAI_API_KEY=',
    '',
  ].join('\n');
  try { fs.mkdirSync(USER_DATA, { recursive: true }); fs.writeFileSync(ENV_FILE, template); } catch (_) {}
}

/** Best-effort: make sure a local Ollama server is running. */
function ensureOllama() {
  const ollama = resolveBin('ollama');
  isUp('http://localhost:11434/api/tags').then((up) => {
    if (up) return;
    try {
      const env = { ...process.env, PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin:/usr/bin` };
      const child = spawn(ollama, ['serve'], { detached: true, stdio: 'ignore', env });
      child.unref();
    } catch (_) { /* Ollama not installed — cloud fallback will be used */ }
  });
}

function startBackend() {
  const nodeBin = resolveBin('node', [process.env.LIV8_NODE_BIN]);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  seedUserEnv();

  const env = {
    ...process.env,
    ...readUserEnv(),                 // user-provided keys/settings win
    DB_DATA_DIR: DATA_DIR,            // keep the database in a writable place
    PORT: String(PORT),
    PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin:/usr/bin`,
  };
  // Sensible local defaults if the user left them blank.
  if (!env.AI_PROVIDER) env.AI_PROVIDER = 'ollama';
  if (!env.OLLAMA_BASE_URL) env.OLLAMA_BASE_URL = 'http://localhost:11434';

  backendProcess = spawn(nodeBin, ['server.js'], { cwd: SERVER_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  backendProcess.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  backendProcess.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  backendProcess.on('error', (err) => {
    dialog.showErrorBox(
      'Could not start the backend',
      `Failed to launch Node.js.\n\n${err.message}\n\nInstall Node.js from https://nodejs.org and try again.`
    );
  });
  backendProcess.on('exit', (code) => {
    backendProcess = null;
    if (code && code !== 0 && !app.isQuitting) console.error(`Backend exited with code ${code}`);
  });
}

function stopBackend() {
  if (backendProcess) {
    try { backendProcess.kill('SIGTERM'); } catch (_) {}
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'LIV8 Command Center',
    backgroundColor: '#050508',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // External links (Freshdesk tickets etc.) open in the real browser, so your
  // logged-in work profile is used.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function boot() {
  ensureOllama();
  if (!(await isUp(HEALTH_URL))) startBackend();

  if (!(await waitForBackend())) {
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: 'LIV8 Command Center',
      message: 'The backend did not start in time.',
      detail:
        'Make sure Node.js is installed (https://nodejs.org). If this is the first run ' +
        'after building, the database is still warming up — try reopening the app.',
      buttons: ['Quit', 'Open Anyway'],
      defaultId: 0,
    });
    if (choice === 0) { app.quit(); return; }
  }
  createWindow();
}

function buildMenu() {
  const template = [
    { label: app.name, submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Open Settings File…', click: () => { seedUserEnv(); shell.openPath(ENV_FILE); } },
      { label: 'Open Data Folder…', click: () => shell.openPath(DATA_DIR) },
      { type: 'separator' },
      { role: 'quit' },
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ]},
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  boot();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { app.isQuitting = true; stopBackend(); });
app.on('window-all-closed', () => { app.quit(); });
app.on('quit', stopBackend);
