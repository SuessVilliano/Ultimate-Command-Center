import { createClient } from '@supabase/supabase-js';

export const LIV8_OWNER_EMAIL = 'liv8ent@gmail.com';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const cloudSyncConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = cloudSyncConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'liv8_supabase_auth',
      },
    })
  : null;

export function isOwnerEmail(email) {
  return String(email || '').trim().toLowerCase() === LIV8_OWNER_EMAIL;
}

export async function getCloudSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}
