import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Storage keys
const AUTH_KEYS = {
  USERS: 'liv8_auth_users',
  CURRENT_USER: 'liv8_current_user',
  ADMIN_SETUP: 'liv8_admin_setup'
};

// ---------------------------------------------------------------------------
// Password hashing — PBKDF2 via Web Crypto (no external deps).
// Stored shape on user records: { passwordHash: 'pbkdf2$<iters>$<saltB64>$<hashB64>' }
// Plaintext `password` fields are kept only as a one-time migration path:
// legacy users still authenticate, then get re-saved with passwordHash.
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_BITS = 256;

function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(plain, saltBytes, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(plain), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: PBKDF2_HASH },
    keyMaterial, PBKDF2_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(plain, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('pbkdf2$')) return false;
  const [, iterStr, saltB64, hashB64] = stored.split('$');
  const iterations = parseInt(iterStr, 10);
  if (!iterations) return false;
  const expected = b64ToBytes(hashB64);
  const candidate = await derive(plain, b64ToBytes(saltB64), iterations);
  return timingSafeEqual(expected, candidate);
}

// First-launch default admin. NO plaintext password lives here — on initial
// setup we generate a one-time install password, print it to the console once,
// and store only the hash. The user is required to change it on first login.
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_EMAIL = 'liv8ent@gmail.com';

function makeInstallPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return bytesToB64(bytes).replace(/[+/=]/g, '').slice(0, 14);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state (async because crypto.subtle is async).
  useEffect(() => {
    (async () => {
      try {
        const storedUsers = localStorage.getItem(AUTH_KEYS.USERS);
        const storedCurrentUser = localStorage.getItem(AUTH_KEYS.CURRENT_USER);
        const adminSetup = localStorage.getItem(AUTH_KEYS.ADMIN_SETUP);

        if (!adminSetup) {
          const installPw = makeInstallPassword();
          const passwordHash = await hashPassword(installPw);
          const admin = {
            id: 'admin_001',
            username: DEFAULT_ADMIN_USERNAME,
            passwordHash,
            mustChangePassword: true,
            name: 'SV',
            email: DEFAULT_ADMIN_EMAIL,
            role: 'admin',
            agentName: 'SV - GoHighLevel Support',
            createdAt: new Date().toISOString(),
            lastLogin: null
          };
          const initial = [admin];
          localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(initial));
          localStorage.setItem(AUTH_KEYS.ADMIN_SETUP, 'true');
          setUsers(initial);
          // Surface the one-time password once; the user will be forced to change it.
          // eslint-disable-next-line no-console
          console.warn(`[LIV8] First-time admin login → username: ${DEFAULT_ADMIN_USERNAME}  password: ${installPw}\n[LIV8] You'll be required to change this on first login.`);
          if (typeof window !== 'undefined') {
            window.__LIV8_INSTALL_PASSWORD__ = installPw; // also visible from DevTools once
          }
        } else if (storedUsers) {
          setUsers(JSON.parse(storedUsers));
        }

        if (storedCurrentUser) setCurrentUser(JSON.parse(storedCurrentUser));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // -------------------------------------------------------------------------
  // Login — accepts hashed (new) and legacy plaintext (one-time migration).
  // -------------------------------------------------------------------------
  async function login(username, password) {
    const u = users.find(x => x.username.toLowerCase() === (username || '').toLowerCase());
    if (!u) return { success: false, error: 'Invalid username or password' };

    let ok = false;
    let needsRehash = false;
    if (u.passwordHash) {
      ok = await verifyPassword(password, u.passwordHash);
    } else if (typeof u.password === 'string') {
      // Legacy plaintext entry — accept once, then re-hash and drop the plaintext.
      ok = u.password === password;
      needsRehash = ok;
    }
    if (!ok) return { success: false, error: 'Invalid username or password' };

    let updated = { ...u, lastLogin: new Date().toISOString() };
    if (needsRehash) {
      updated.passwordHash = await hashPassword(password);
      delete updated.password;
    }

    setCurrentUser(updated);
    localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(updated));
    const updatedUsers = users.map(x => x.id === u.id ? updated : x);
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));

    return { success: true, user: updated };
  }

  function logout() {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
  }

  async function createUser(userData) {
    if (currentUser?.role !== 'admin') {
      return { success: false, error: 'Only admins can create users' };
    }
    if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
      return { success: false, error: 'Username already exists' };
    }
    const passwordHash = await hashPassword(userData.password);
    const newUser = {
      id: `user_${Date.now()}`,
      username: userData.username,
      passwordHash,
      name: userData.name,
      email: userData.email || '',
      role: userData.role || 'member',
      agentName: userData.agentName || userData.name,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      permissions: userData.permissions || ['tickets', 'dashboard']
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));
    return { success: true, user: newUser };
  }

  async function updateUser(userId, updates) {
    if (currentUser?.role !== 'admin' && currentUser?.id !== userId) {
      return { success: false, error: 'Permission denied' };
    }
    // If `password` was passed, hash it transparently and never persist plaintext.
    let next = { ...updates };
    if (typeof next.password === 'string' && next.password.length > 0) {
      next.passwordHash = await hashPassword(next.password);
      delete next.password;
    }
    const updatedUsers = users.map(u => u.id === userId ? { ...u, ...next } : u);
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));

    if (currentUser?.id === userId) {
      const updatedCurrentUser = { ...currentUser, ...next };
      setCurrentUser(updatedCurrentUser);
      localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(updatedCurrentUser));
    }
    return { success: true };
  }

  function deleteUser(userId) {
    if (currentUser?.role !== 'admin') {
      return { success: false, error: 'Only admins can delete users' };
    }
    if (userId === currentUser?.id) {
      return { success: false, error: 'Cannot delete your own account' };
    }
    const updatedUsers = users.filter(u => u.id !== userId);
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));
    return { success: true };
  }

  async function resetPassword(userId, newPassword) {
    if (currentUser?.role !== 'admin' && currentUser?.id !== userId) {
      return { success: false, error: 'Permission denied' };
    }
    return updateUser(userId, { password: newPassword, mustChangePassword: false });
  }

  async function changePassword(currentPassword, newPassword) {
    if (!currentUser) return { success: false, error: 'Not logged in' };
    const stored = users.find(u => u.id === currentUser.id);
    const ok = stored?.passwordHash
      ? await verifyPassword(currentPassword, stored.passwordHash)
      : (stored?.password === currentPassword);
    if (!ok) return { success: false, error: 'Current password is incorrect' };
    return updateUser(currentUser.id, { password: newPassword, mustChangePassword: false });
  }

  const value = {
    currentUser,
    users,
    isLoading,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'admin',
    login,
    logout,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    changePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
