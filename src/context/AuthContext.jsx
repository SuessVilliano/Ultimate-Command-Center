import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CLOUD_API_URL } from '../config';

const AuthContext = createContext(null);

const AUTH_TOKEN_KEY = 'liv8_owner_session_v1';
const PROFILE_CACHE_KEY = 'liv8_owner_profile_v1';
const LEGACY_KEYS = ['liv8_auth_users', 'liv8_current_user', 'liv8_admin_setup'];

function readToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || ''; } catch { return ''; }
}

export function ownerSessionHeaders() {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function cacheProfile(user) {
  try {
    if (user) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {}
}

function clearLegacyAuth() {
  try { LEGACY_KEYS.forEach(key => localStorage.removeItem(key)); } catch {}
}

async function safeJson(response) {
  try { return await response.json(); } catch { return {}; }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    clearLegacyAuth();

    const restore = async () => {
      const token = readToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(`${CLOUD_API_URL}/api/auth/session`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await safeJson(response);
        if (!response.ok || !data?.authenticated || !data?.user) throw new Error('Session expired');
        setCurrentUser(data.user);
        cacheProfile(data.user);
      } catch {
        try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch {}
        cacheProfile(null);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await fetch(`${CLOUD_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await safeJson(response);
      if (!response.ok || !data?.success || !data?.token || !data?.user) {
        return { success: false, error: data?.error || 'Login failed' };
      }

      try { localStorage.setItem(AUTH_TOKEN_KEY, data.token); } catch {}
      setCurrentUser(data.user);
      cacheProfile(data.user);
      clearLegacyAuth();
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error?.message || 'Cloud login unavailable' };
    }
  };

  const logout = async () => {
    const token = readToken();
    setCurrentUser(null);
    try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch {}
    cacheProfile(null);
    if (token) {
      fetch(`${CLOUD_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  };

  const unsupported = () => ({
    success: false,
    error: 'Accounts are now managed by the shared Command Center owner login.',
  });

  const users = useMemo(() => currentUser ? [currentUser] : [], [currentUser]);

  const value = {
    currentUser,
    users,
    isLoading,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'admin',
    login,
    logout,
    createUser: unsupported,
    updateUser: unsupported,
    deleteUser: unsupported,
    resetPassword: unsupported,
    changePassword: () => ({
      success: false,
      error: 'Password changes are managed server-side so credentials stay off browser storage.',
    }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
