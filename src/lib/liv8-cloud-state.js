import { cloudSyncConfigured, isOwnerEmail, supabase } from './supabase-client';

async function ownerSession() {
  if (!cloudSyncConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.user || !isOwnerEmail(data.session.user.email)) return null;
  return data.session;
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
  const { data, error } = await supabase
    .from('liv8_user_state')
    .select('value,updated_at')
    .eq('user_id', session.user.id)
    .eq('state_key', stateKey)
    .maybeSingle();
  if (error || !data) return fallback;
  return { value: data.value, updatedAt: data.updated_at };
}

export async function setCloudState(stateKey, value) {
  const session = await ownerSession();
  if (!session) return { ok: false, reason: 'not-connected' };
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('liv8_user_state')
    .upsert({
      user_id: session.user.id,
      state_key: stateKey,
      value,
      updated_at: updatedAt,
    }, { onConflict: 'user_id,state_key' });
  if (error) throw error;
  return { ok: true, updatedAt };
}

export async function saveAffiliateImport({ rows, filename = '', source = 'ghl-toolbar', metadata = {} }) {
  const session = await ownerSession();
  if (!session) return { ok: false, reason: 'not-connected' };
  const cleanRows = Array.isArray(rows) ? rows : [];
  const { data, error } = await supabase
    .from('liv8_affiliate_imports')
    .insert({
      user_id: session.user.id,
      filename,
      source,
      row_count: cleanRows.length,
      rows: cleanRows,
      metadata,
    })
    .select('id,imported_at,row_count,filename,source,metadata')
    .single();
  if (error) throw error;
  return { ok: true, import: data };
}

export async function listAffiliateImports(limit = 12) {
  const session = await ownerSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('liv8_affiliate_imports')
    .select('id,imported_at,row_count,filename,source,metadata')
    .eq('user_id', session.user.id)
    .order('imported_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getAffiliateImport(importId) {
  const session = await ownerSession();
  if (!session || !importId) return null;
  const { data, error } = await supabase
    .from('liv8_affiliate_imports')
    .select('id,imported_at,row_count,filename,source,metadata,rows')
    .eq('user_id', session.user.id)
    .eq('id', importId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
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
