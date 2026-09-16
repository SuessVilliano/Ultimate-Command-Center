import * as db from '../lib/database.js';

const BOOK_KEY = 'liv8_affiliate_weekly_book_v1';
const BOOK_META_KEY = 'liv8_affiliate_weekly_book_meta_v1';

function isLoopbackRequest(req) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function localOnly(req, res, next) {
  if (!isLoopbackRequest(req)) {
    return res.status(403).json({ ok: false, error: 'Mac home-state routes are local-only' });
  }
  next();
}

function readJsonSetting(key, fallback) {
  try {
    const raw = db.getSetting(key, '');
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function registerLocalHomeStateRoutes(app) {
  app.get('/api/local/home-state/affiliate-book', localOnly, (_req, res) => {
    const rows = readJsonSetting(BOOK_KEY, []);
    const meta = readJsonSetting(BOOK_META_KEY, {});
    res.json({
      ok: true,
      rows: Array.isArray(rows) ? rows : [],
      count: Array.isArray(rows) ? rows.length : 0,
      updatedAt: meta.updatedAt || null,
      source: meta.source || 'mac-home-state',
      meta,
    });
  });

  app.put('/api/local/home-state/affiliate-book', localOnly, (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ ok: false, error: 'rows is required' });
    if (rows.length > 1000) return res.status(400).json({ ok: false, error: 'Maximum 1000 affiliate rows' });

    const updatedAt = new Date().toISOString();
    const suppliedMeta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {};
    const meta = {
      ...suppliedMeta,
      updatedAt,
      source: req.body?.source || suppliedMeta.source || 'weekly-import',
      count: rows.length,
    };
    db.setSetting(BOOK_KEY, JSON.stringify(rows));
    db.setSetting(BOOK_META_KEY, JSON.stringify(meta));

    res.json({ ok: true, count: rows.length, updatedAt, meta, persisted: 'mac-local-sqlite' });
  });

  app.delete('/api/local/home-state/affiliate-book', localOnly, (_req, res) => {
    const updatedAt = new Date().toISOString();
    db.setSetting(BOOK_KEY, '[]');
    db.setSetting(BOOK_META_KEY, JSON.stringify({ updatedAt, source: 'cleared', count: 0 }));
    res.json({ ok: true, count: 0, updatedAt });
  });

  console.log('Mac-local LIV8 home-state routes registered');
}

export default registerLocalHomeStateRoutes;
