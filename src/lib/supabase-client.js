export const LIV8_OWNER_EMAIL = 'liv8ent@gmail.com';

// Publishable Supabase values are intentionally client-visible. RLS protects the
// actual records and limits them to the authenticated LIV8 owner account.
const DEFAULT_SUPABASE_URL = 'https://jnpfjjqevglenqpxpvsx.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_32gEkj00AeeuhEtE65XopA_XrfaUQ0d';
const SESSION_KEY = 'liv8_supabase_auth';
const AUTH_EVENT = 'liv8:supabase-auth';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/$/, '');
const supabaseKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY).trim();
export const cloudSyncConfigured = Boolean(supabaseUrl && supabaseKey);

export function isOwnerEmail(email) {
  return String(email || '').trim().toLowerCase() === LIV8_OWNER_EMAIL;
}

function readStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

function storeSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

function emitAuth(session) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { session } }));
}

function errorFromPayload(payload, fallback) {
  return payload?.msg || payload?.message || payload?.error_description || payload?.error || fallback;
}

async function authFetch(path, { method = 'GET', body, accessToken, signal } = {}) {
  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken || supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorFromPayload(payload, `Supabase auth HTTP ${response.status}`));
  return payload;
}

function sessionFromHash() {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  const expiresIn = Number(params.get('expires_in') || 3600);
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: params.get('token_type') || 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: null,
  };
  storeSession(session);
  try { window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`); } catch {}
  return session;
}

async function attachUser(session) {
  if (!session?.access_token) return null;
  if (session.user?.id) return session;
  const user = await authFetch('/user', { accessToken: session.access_token, signal: AbortSignal.timeout(8000) });
  const next = { ...session, user };
  storeSession(next);
  return next;
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  const payload = await authFetch('/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: session.refresh_token },
    signal: AbortSignal.timeout(10000),
  });
  const next = {
    ...payload,
    expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
  };
  storeSession(next);
  emitAuth(next);
  return next;
}

sessionFromHash();

export async function getCloudSession() {
  if (!cloudSyncConfigured) return null;
  let session = readStoredSession();
  if (!session?.access_token) return null;
  const now = Math.floor(Date.now() / 1000);
  try {
    if (session.expires_at && session.expires_at <= now + 60) session = await refreshSession(session);
    session = await attachUser(session);
    return session;
  } catch {
    storeSession(null);
    emitAuth(null);
    return null;
  }
}

export async function supabaseRest(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const session = await getCloudSession();
  if (!session?.access_token) throw new Error('LIV8 Cloud is not signed in on this device');
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal: signal || AbortSignal.timeout(12000),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(errorFromPayload(payload, `Supabase data HTTP ${response.status}`));
  return payload;
}

async function signInWithOtp({ email, options = {} }) {
  try {
    const redirect = options.emailRedirectTo ? `?redirect_to=${encodeURIComponent(options.emailRedirectTo)}` : '';
    await authFetch(`/otp${redirect}`, {
      method: 'POST',
      body: { email, create_user: options.shouldCreateUser !== false },
      signal: AbortSignal.timeout(10000),
    });
    return { data: { user: null, session: null }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

async function signOut() {
  const session = readStoredSession();
  try {
    if (session?.access_token) await authFetch('/logout', { method: 'POST', accessToken: session.access_token, signal: AbortSignal.timeout(8000) });
  } catch {}
  storeSession(null);
  emitAuth(null);
  return { error: null };
}

function onAuthStateChange(callback) {
  const listener = event => callback(event.detail?.session ? 'SIGNED_IN' : 'SIGNED_OUT', event.detail?.session || null);
  window.addEventListener(AUTH_EVENT, listener);
  return { data: { subscription: { unsubscribe: () => window.removeEventListener(AUTH_EVENT, listener) } } };
}

export const supabase = cloudSyncConfigured ? {
  auth: {
    getSession: async () => ({ data: { session: await getCloudSession() }, error: null }),
    signInWithOtp,
    signOut,
    onAuthStateChange,
  },
} : null;
