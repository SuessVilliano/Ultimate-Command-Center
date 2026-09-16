import { getAffiliateImport, getCloudState, saveAffiliateImport, setCloudState } from './liv8-cloud-state';

const BOOK_KEY = 'liv8_ghl_reactivation_book_v1';
const BACKUP_KEY = 'liv8_affiliate_book_backup_v1';
const META_KEY = 'liv8_affiliate_book_meta_v2';
const BOOK_UPDATED_EVENT = 'liv8:affiliate-book-updated';
const CLOUD_STATE_KEY = 'affiliate_book.latest';
const LOCAL_API = String(import.meta.env.VITE_MAC_HOME_API_URL || 'http://127.0.0.1:3005').replace(/\/$/, '');

function readRows(storage, key) {
  try {
    const rows = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; }
  catch { return {}; }
}

function writeMeta(meta = {}) {
  const next = { ...meta, updatedAt: meta.updatedAt || new Date().toISOString() };
  try { localStorage.setItem(META_KEY, JSON.stringify(next)); } catch {}
  return next;
}

function notify(source, meta = {}) {
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(BOOK_UPDATED_EVENT, { detail: { source, ...meta } }));
  }, 0);
}

function cacheRows(rows, source, shouldNotify = true, meta = {}) {
  if (!Array.isArray(rows) || !rows.length) return false;
  try { sessionStorage.setItem(BOOK_KEY, JSON.stringify(rows)); } catch {}
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(rows)); } catch {}
  const savedMeta = writeMeta({ source, count: rows.length, ...meta });
  if (shouldNotify) notify(source, savedMeta);
  return true;
}

async function saveToMac(rows, source = 'command-center', meta = {}) {
  if (!Array.isArray(rows) || !rows.length) return { ok: false };
  try {
    const response = await fetch(`${LOCAL_API}/api/local/home-state/affiliate-book`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, source, meta }),
      signal: AbortSignal.timeout(2500),
    });
    return response.ok ? await response.json().catch(() => ({ ok: true })) : { ok: false };
  } catch {
    return { ok: false };
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
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    return rows.length ? { rows, updatedAt: payload.updatedAt || null, source: payload.source || 'mac-home-state' } : null;
  } catch {
    return null;
  }
}

async function loadFromCloud() {
  try {
    const state = await getCloudState(CLOUD_STATE_KEY, null);
    const rows = Array.isArray(state?.value?.rows) ? state.value.rows : [];
    if (!rows.length) return null;
    return {
      rows,
      updatedAt: state?.value?.meta?.updatedAt || state?.updatedAt || null,
      source: 'liv8-cloud',
      meta: state?.value?.meta || {},
    };
  } catch {
    return null;
  }
}

export function getAffiliateBookMeta() {
  return readMeta();
}

export function getAffiliateBookRows() {
  const sessionRows = readRows(sessionStorage, BOOK_KEY);
  if (sessionRows.length) return sessionRows;
  return readRows(localStorage, BACKUP_KEY);
}

export async function storeAffiliateBook(rows, meta = {}) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Affiliate book is empty');
  const updatedAt = new Date().toISOString();
  const source = meta.source || 'ghl-toolbar-import';
  const finalMeta = {
    filename: meta.filename || '',
    kind: meta.kind || 'affiliate-book',
    source,
    count: rows.length,
    updatedAt,
  };

  cacheRows(rows, source, true, finalMeta);
  const mac = await saveToMac(rows, source, finalMeta);

  let cloud = { ok: false, reason: 'not-connected' };
  let archived = null;
  try {
    cloud = await setCloudState(CLOUD_STATE_KEY, { rows, meta: finalMeta });
    if (cloud.ok && meta.archive !== false) {
      archived = await saveAffiliateImport({
        rows,
        filename: finalMeta.filename,
        source,
        metadata: { kind: finalMeta.kind, updatedAt },
      });
    }
  } catch (error) {
    cloud = { ok: false, reason: error?.message || 'cloud-write-failed' };
  }

  return { ok: true, rows: rows.length, meta: finalMeta, local: true, mac, cloud, archived };
}

export async function restoreAffiliateImport(importId) {
  const snapshot = await getAffiliateImport(importId);
  if (!snapshot?.rows?.length) throw new Error('That affiliate-book snapshot is unavailable');
  return storeAffiliateBook(snapshot.rows, {
    filename: snapshot.filename || '',
    kind: snapshot.metadata?.kind || 'affiliate-book',
    source: 'history-restore',
  });
}

export async function hydrateAffiliateBook() {
  const cloud = await loadFromCloud();
  if (cloud?.rows?.length) {
    cacheRows(cloud.rows, cloud.source, true, { ...cloud.meta, updatedAt: cloud.updatedAt });
    await saveToMac(cloud.rows, 'cloud-hydration', { ...cloud.meta, updatedAt: cloud.updatedAt });
    return { source: 'cloud', rows: cloud.rows.length };
  }

  const sessionRows = readRows(sessionStorage, BOOK_KEY);
  if (sessionRows.length) {
    const meta = readMeta();
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(sessionRows)); } catch {}
    await saveToMac(sessionRows, 'session-migration', meta);
    try { await setCloudState(CLOUD_STATE_KEY, { rows: sessionRows, meta }); } catch {}
    return { source: 'session', rows: sessionRows.length };
  }

  const backupRows = readRows(localStorage, BACKUP_KEY);
  if (backupRows.length) {
    const meta = readMeta();
    cacheRows(backupRows, 'browser-persistent-cache', true, meta);
    await saveToMac(backupRows, 'browser-persistent-cache', meta);
    try { await setCloudState(CLOUD_STATE_KEY, { rows: backupRows, meta }); } catch {}
    return { source: 'browser-cache', rows: backupRows.length };
  }

  const mac = await loadFromMac();
  if (mac?.rows?.length) {
    cacheRows(mac.rows, 'mac-home-state', true, { updatedAt: mac.updatedAt });
    try { await setCloudState(CLOUD_STATE_KEY, { rows: mac.rows, meta: { updatedAt: mac.updatedAt, source: mac.source } }); } catch {}
    return { source: 'mac', rows: mac.rows.length };
  }

  return { source: 'empty', rows: 0 };
}

if (typeof window !== 'undefined') {
  window.addEventListener(BOOK_UPDATED_EVENT, event => {
    if (event?.detail?.skipPersist) return;
    const rows = readRows(sessionStorage, BOOK_KEY);
    if (rows.length) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(rows)); } catch {}
      const meta = writeMeta({ ...readMeta(), source: event?.detail?.source || 'weekly-import' });
      saveToMac(rows, meta.source, meta);
      setCloudState(CLOUD_STATE_KEY, { rows, meta }).catch(() => {});
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

export { BOOK_KEY, BOOK_UPDATED_EVENT };
