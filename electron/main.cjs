/**
 * LIV8 Command Center — Electron desktop wrapper (macOS / native window)
 *
 * This gives you a real app window. It launches the backend server as a normal
 * Node process (so native modules like better-sqlite3 just work against your
 * system Node), waits for it to come online, then loads the UI from that same
 * server on http://localhost:3005.
 *
 * Nothing runs in the cloud. AI runs locally via Ollama (with optional cloud
 * fallback). Support replies are draft-only — the app never sends on its own.
 */

const { app, BrowserWindow, shell, dialog, Menu } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');
const SERVER_DIR = path.join(PROJECT_ROOT, 'server');
const PORT = process.env.PORT || 3005;
const APP_URL = `http://localhost:${PORT}`;
const HEALTH_URL = `${APP_URL}/health`;

let backendProcess = null;
let mainWindow = null;

/**
 * Find a usable `node` binary. GUI-launched Mac apps often have a minimal PATH
 * that misses Homebrew / nvm locations, so we check the common spots.
 */
function resolveNodeBin() {
  const candidates = [
    process.env.LIV8_NODE_BIN,
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return 'node'; // fall back to PATH
}

/** Is the backend already answering on the port? */
function isBackendUp() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

/** Wait until the backend health check passes (or time out). */
async function waitForBackend(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isBackendUp()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function startBackend() {
  const nodeBin = resolveNodeBin();
  // Augment PATH so the server (and anything it shells out to, like ollama) is found.
  const env = {
    ...process.env,
    PATH: `${process.env.PATH || ''}:/opt/homebrew/bin:/usr/local/bin:/usr/bin`,
  };

  backendProcess = spawn(nodeBin, ['server.js'], {
    cwd: SERVER_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  backendProcess.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  backendProcess.on('error', (err) => {
    dialog.showErrorBox(
      'Could not start the backend',
      `Failed to launch Node.js.\n\n${err.message}\n\nMake sure Node.js is installed (https://nodejs.org).`
    );
  });
  backendProcess.on('exit', (code) => {
    backendProcess = null;
    if (code && code !== 0 && !app.isQuitting) {
      console.error(`Backend exited with code ${code}`);
    }
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links (e.g. the Freshdesk ticket) in the real browser,
  // so your logged-in Freshdesk work profile is used.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function boot() {
  // Reuse a backend if one is already running (e.g. you also ran the dev script).
  const alreadyUp = await isBackendUp();
  if (!alreadyUp) startBackend();

  const ready = await waitForBackend();
  if (!ready) {
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: 'LIV8 Command Center',
      message: 'The backend did not start in time.',
      detail:
        'This usually means Node.js dependencies are not installed yet, or your ' +
        'Freshdesk settings need attention.\n\nTip: run the "Launch LIV8 Command Center" ' +
        'script once from the project folder — it installs everything and builds the app.',
      buttons: ['Quit', 'Open Anyway'],
      defaultId: 0,
    });
    if (choice === 0) { app.quit(); return; }
  }

  createWindow();
}

// Minimal native menu (keeps standard shortcuts like Cmd+C/V/Q, reload, devtools).
function buildMenu() {
  const template = [
    { label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { app.isQuitting = true; stopBackend(); });
app.on('window-all-closed', () => { app.quit(); });
app.on('quit', stopBackend);
