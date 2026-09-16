const BOOK_KEY = 'liv8_ghl_reactivation_book_v1';
const BACKUP_KEY = 'liv8_affiliate_book_backup_v1';
const BOOK_UPDATED_EVENT = 'liv8:affiliate-book-updated';
const LOCAL_API = String(import.meta.env.VITE_MAC_HOME_API_URL || 'http://127.0.0.1:3005').replace(/\/$/, '');

function readRows(storage, key) {
  try {
    const rows = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function notify(source) {
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(BOOK_UPDATED_EVENT, { detail: { source } }));
  }, 0);
}

function cacheRows(rows, source, shouldNotify = true) {
  if (!Array.isArray(rows) || !rows.length) return false;
  try { sessionStorage.setItem(BOOK_KEY, JSON.stringify(rows)); } catch {}
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(rows)); } catch {}
  if (shouldNotify) notify(source);
  return true;
}

async function saveToMac(rows, source = 'command-center') {
  if (!Array.isArray(rows) || !rows.length) return;
  try {
    await fetch(`${LOCAL_API}/api/local/home-state/affiliate-book`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, source }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // The app still works from browser-local persistence when the Mac API is offline.
  }
}

async function clearMacBook() {
  try {
    await fetch(`${LOCAL_API}/api/local/home-state/affiliate-book`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(2000),
    });
  } catch {}
}

async function loadFromMac() {
  try {
    const response = await fetch(`${LOCAL_API}/api/local/home-state/affiliate-book`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.rows) ? payload.rows : [];
  } catch {
    return [];
  }
}

async function hydrateAffiliateBook() {
  const sessionRows = readRows(sessionStorage, BOOK_KEY);
  if (sessionRows.length) {
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(sessionRows)); } catch {}
    await saveToMac(sessionRows, 'session-migration');
    return;
  }

  const backupRows = readRows(localStorage, BACKUP_KEY);
  if (backupRows.length) {
    cacheRows(backupRows, 'browser-persistent-cache');
    await saveToMac(backupRows, 'browser-persistent-cache');
    return;
  }

  const macRows = await loadFromMac();
  if (macRows.length) cacheRows(macRows, 'mac-home-state');
}

if (typeof window !== 'undefined') {
  window.addEventListener(BOOK_UPDATED_EVENT, () => {
    const rows = readRows(sessionStorage, BOOK_KEY);
    if (rows.length) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(rows)); } catch {}
      saveToMac(rows, 'weekly-import');
    } else {
      try { localStorage.removeItem(BACKUP_KEY); } catch {}
      clearMacBook();
    }
  });

  window.addEventListener('storage', event => {
    if (event.key !== BACKUP_KEY || !event.newValue) return;
    try {
      const rows = JSON.parse(event.newValue);
      if (Array.isArray(rows) && rows.length) cacheRows(rows, 'shared-browser-storage');
    } catch {}
  });

  hydrateAffiliateBook();
}

export { hydrateAffiliateBook, BOOK_KEY, BOOK_UPDATED_EVENT };
