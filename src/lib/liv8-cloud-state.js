import {
  cloudSyncConfigured,
  getCloudSession,
  isOwnerEmail,
  supabase,
  supabaseRest,
} from './supabase-client';

async function ownerSession() {
  if (!cloudSyncConfigured) return null;
  const session = await getCloudSession();
  if (!session?.user || !isOwnerEmail(session.user.email)) return null;
  return session;
}

function enc(value) {
  return encodeURIComponent(String(value ?? ''));
}

export async function cloudStateStatus() {
  const session = await ownerSession();
  return {
    configured: cloudSyncConfigured,
    connected: Boolean(session),
    email: session?.user?.email || null,
    userId: session?.user?.id || null,
  };
}

export async function getCloudState(stateKey, fallback = null) {
  const session = await ownerSession();
  if (!session) return fallback;
  const rows = await supabaseRest(
    `liv8_user_state?select=value,updated_at&user_id=eq.${enc(session.user.id)}&state_key=eq.${enc(stateKey)}&limit=1`
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return fallback;
  return { value: row.value, updatedAt: row.updated_at };
}

export async function setCloudState(stateKey, value) {
  const session = await ownerSession();
  if (!session) return { ok: false, reason: 'not-connected' };
  const updatedAt = new Date().toISOString();
  const rows = await supabaseRest('liv8_user_state?on_conflict=user_id,state_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: {
      user_id: session.user.id,
      state_key: stateKey,
      value,
      updated_at: updatedAt,
    },
  });
  return { ok: true, updatedAt, state: Array.isArray(rows) ? rows[0] || null : null };
}

export async function saveAffiliateImport({ rows, filename = '', source = 'ghl-toolbar', metadata = {} }) {
  const session = await ownerSession();
  if (!session) return { ok: false, reason: 'not-connected' };
  const cleanRows = Array.isArray(rows) ? rows : [];
  const data = await supabaseRest('liv8_affiliate_imports', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: {
      user_id: session.user.id,
      filename,
      source,
      row_count: cleanRows.length,
      rows: cleanRows,
      metadata,
    },
  });
  return { ok: true, import: Array.isArray(data) ? data[0] || null : data };
}

export async function listAffiliateImports(limit = 12) {
  const session = await ownerSession();
  if (!session) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 50));
  const data = await supabaseRest(
    `liv8_affiliate_imports?select=id,imported_at,row_count,filename,source,metadata&user_id=eq.${enc(session.user.id)}&order=imported_at.desc&limit=${safeLimit}`
  );
  return Array.isArray(data) ? data : [];
}

export async function getAffiliateImport(importId) {
  const session = await ownerSession();
  if (!session || !importId) return null;
  const data = await supabaseRest(
    `liv8_affiliate_imports?select=id,imported_at,row_count,filename,source,metadata,rows&user_id=eq.${enc(session.user.id)}&id=eq.${enc(importId)}&limit=1`
  );
  return Array.isArray(data) ? data[0] || null : null;
}

export async function requestOwnerMagicLink() {
  if (!supabase) throw new Error('LIV8 cloud sync is not configured');
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOtp({
    email: 'liv8ent@gmail.com',
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
  return { ok: true };
}
