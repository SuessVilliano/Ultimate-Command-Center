import React, { createContext, useContext, useState, useEffect } from 'react';
import { CLOUD_API_URL } from '../config';

const AuthContext = createContext(null);
const CLOUD_SESSION_KEY = 'liv8_cloud_session';

// Storage keys
const AUTH_KEYS = {
  USERS: 'liv8_auth_users',
  CURRENT_USER: 'liv8_current_user',
  ADMIN_SETUP: 'liv8_admin_setup'
};

// Default admin account
const DEFAULT_ADMIN = {
  id: 'admin_001',
  username: 'admin',
  password: 'LIV8Command2026!', // Change this after first login
  name: 'SV',
  email: 'liv8ent@gmail.com',
  role: 'admin',
  agentName: 'SV - GoHighLevel Support',
  createdAt: new Date().toISOString(),
  lastLogin: null
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState('legacy');

  // Initialize auth state. Cloud auth is authoritative when configured;
  // legacy localStorage remains a compatibility fallback so an incomplete deploy cannot lock the owner out.
  useEffect(() => {
    let cancelled = false;

    const initLegacy = () => {
      const storedUsers = localStorage.getItem(AUTH_KEYS.USERS);
      const storedCurrentUser = localStorage.getItem(AUTH_KEYS.CURRENT_USER);
      const adminSetup = localStorage.getItem(AUTH_KEYS.ADMIN_SETUP);

      if (!adminSetup) {
        const initialUsers = [DEFAULT_ADMIN];
        localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(initialUsers));
        localStorage.setItem(AUTH_KEYS.ADMIN_SETUP, 'true');
        setUsers(initialUsers);
      } else if (storedUsers) {
        try { setUsers(JSON.parse(storedUsers)); } catch { setUsers([DEFAULT_ADMIN]); }
      }

      if (storedCurrentUser) {
        try { setCurrentUser(JSON.parse(storedCurrentUser)); } catch { localStorage.removeItem(AUTH_KEYS.CURRENT_USER); }
      }
      setAuthMode('legacy');
    };

    const init = async () => {
      try {
        const statusRes = await fetch(`${CLOUD_API_URL}/api/app-auth/status`, { cache: 'no-store' });
        const status = statusRes.ok ? await statusRes.json() : null;
        if (status?.configured) {
          setAuthMode('cloud');
          const token = localStorage.getItem(CLOUD_SESSION_KEY);
          if (token) {
            const meRes = await fetch(`${CLOUD_API_URL}/api/app-auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store',
            });
            if (meRes.ok) {
              const payload = await meRes.json();
              if (!cancelled && payload?.user) {
                setCurrentUser(payload.user);
                setUsers([payload.user]);
              }
            } else {
              localStorage.removeItem(CLOUD_SESSION_KEY);
            }
          }
          if (!cancelled) setIsLoading(false);
          return;
        }
      } catch (error) {
        console.warn('Cloud auth status unavailable; using legacy login:', error?.message);
      }

      if (!cancelled) {
        initLegacy();
        setIsLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  // Login function
  const login = async (username, password) => {
    if (authMode === 'cloud') {
      try {
        const response = await fetch(`${CLOUD_API_URL}/api/app-auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok || !payload?.token || !payload?.user) {
          return { success: false, error: payload?.error || 'Invalid username or password' };
        }
        localStorage.setItem(CLOUD_SESSION_KEY, payload.token);
        localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
        setCurrentUser(payload.user);
        setUsers([payload.user]);
        return { success: true, user: payload.user };
      } catch (error) {
        return { success: false, error: error?.message || 'Cloud login unavailable' };
      }
    }

    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (user) {
      const updatedUser = { ...user, lastLogin: new Date().toISOString() };
      setCurrentUser(updatedUser);
      localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(updatedUser));

      const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);
      setUsers(updatedUsers);
      localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));

      return { success: true, user: updatedUser };
    }

    return { success: false, error: 'Invalid username or password' };
  };

  // Logout function
  const logout = () => {
    setCurrentUser(null);
    setUsers(authMode === 'cloud' ? [] : users);
    localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
    localStorage.removeItem(CLOUD_SESSION_KEY);
  };

  // Create new user (admin only)
  const createUser = (userData) => {
    if (authMode === 'cloud') return { success: false, error: 'Cloud owner mode is single-user. Additional users require server-managed accounts.' };
    if (currentUser?.role !== 'admin') {
      return { success: false, error: 'Only admins can create users' };
    }

    // Check if username exists
    if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
      return { success: false, error: 'Username already exists' };
    }

    const newUser = {
      id: `user_${Date.now()}`,
      username: userData.username,
      password: userData.password,
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
  };

  // Update user
  const updateUser = (userId, updates) => {
    if (authMode === 'cloud') {
      if (!currentUser || currentUser.id !== userId) return { success: false, error: 'Permission denied' };
      const safeUpdates = { name: updates?.name, email: updates?.email, agentName: updates?.agentName };
      const updatedCurrentUser = { ...currentUser, ...Object.fromEntries(Object.entries(safeUpdates).filter(([, value]) => value !== undefined)) };
      setCurrentUser(updatedCurrentUser);
      setUsers([updatedCurrentUser]);
      const token = localStorage.getItem(CLOUD_SESSION_KEY);
      if (token) {
        fetch(`${CLOUD_API_URL}/api/app-auth/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(safeUpdates),
        }).catch(error => console.warn('Cloud profile update failed:', error?.message));
      }
      return { success: true };
    }
    if (currentUser?.role !== 'admin' && currentUser?.id !== userId) {
      return { success: false, error: 'Permission denied' };
    }

    const updatedUsers = users.map(u =>
      u.id === userId ? { ...u, ...updates } : u
    );
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));

    // Update current user if it's the same user
    if (currentUser?.id === userId) {
      const updatedCurrentUser = { ...currentUser, ...updates };
      setCurrentUser(updatedCurrentUser);
      localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(updatedCurrentUser));
    }

    return { success: true };
  };

  // Delete user (admin only)
  const deleteUser = (userId) => {
    if (authMode === 'cloud') return { success: false, error: 'Cloud owner account cannot be deleted from the client.' };
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
  };

  // Reset password (admin or self)
  const resetPassword = (userId, newPassword) => {
    if (authMode === 'cloud') return { success: false, error: 'Cloud password is managed securely on the server.' };
    if (currentUser?.role !== 'admin' && currentUser?.id !== userId) {
      return { success: false, error: 'Permission denied' };
    }

    return updateUser(userId, { password: newPassword });
  };

  // Change own password
  const changePassword = (currentPassword, newPassword) => {
    if (authMode === 'cloud') return { success: false, error: 'Cloud password is managed securely on the server.' };
    if (currentUser?.password !== currentPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    return updateUser(currentUser.id, { password: newPassword });
  };

  const value = {
    currentUser,
    users,
    isLoading,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'admin',
    authMode,
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
