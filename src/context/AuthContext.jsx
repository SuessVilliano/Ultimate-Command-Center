import React, { createContext, useContext, useEffect, useState } from 'react';
import { cloudSyncConfigured, isOwnerEmail, LIV8_OWNER_EMAIL, supabase } from '../lib/supabase-client';

const AuthContext = createContext(null);

const AUTH_KEYS = {
  USERS: 'liv8_auth_users',
  CURRENT_USER: 'liv8_current_user',
};

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

function cloudUserFrom(session) {
  const user = session?.user;
  if (!user || !isOwnerEmail(user.email)) return null;
  return {
    id: user.id,
    username: user.email,
    name: user.user_metadata?.name || 'Jamaur Johnson',
    email: user.email,
    role: 'admin',
    agentName: 'LIV8 Owner',
    createdAt: user.created_at,
    lastLogin: new Date().toISOString(),
    cloudAuthenticated: true,
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [cloudSession, setCloudSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const storedUsers = readJson(AUTH_KEYS.USERS, []);
    const legacyUser = readJson(AUTH_KEYS.CURRENT_USER, null);
    if (Array.isArray(storedUsers)) setUsers(storedUsers);
    if (legacyUser) setCurrentUser(legacyUser);

    const applyCloudSession = session => {
      if (!alive) return;
      const owner = cloudUserFrom(session);
      setCloudSession(owner ? session : null);
      if (owner) {
        setCurrentUser(owner);
        localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(owner));
        window.dispatchEvent(new CustomEvent('liv8:cloud-auth-changed', { detail: { connected: true, email: owner.email } }));
        import('../lib/affiliate-book-runtime').then(mod => mod.hydrateAffiliateBook()).catch(() => {});
      } else {
        const fallback = readJson(AUTH_KEYS.CURRENT_USER, null);
        if (!fallback?.cloudAuthenticated) setCurrentUser(fallback);
        window.dispatchEvent(new CustomEvent('liv8:cloud-auth-changed', { detail: { connected: false } }));
      }
    };

    const init = async () => {
      if (!supabase) {
        if (alive) setIsLoading(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        applyCloudSession(data?.session || null);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    init();
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => applyCloudSession(session))?.data?.subscription;
    return () => {
      alive = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const requestMagicLink = async (email = LIV8_OWNER_EMAIL) => {
    if (!supabase) return { success: false, error: 'LIV8 Cloud is not configured yet' };
    if (!isOwnerEmail(email)) return { success: false, error: `This Command Center is assigned to ${LIV8_OWNER_EMAIL}` };
    const { error } = await supabase.auth.signInWithOtp({
      email: LIV8_OWNER_EMAIL,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    return error ? { success: false, error: error.message } : { success: true };
  };

  // Temporary legacy login so already-configured Mac/browser installs are not locked out
  // while the owner account moves to Supabase Auth. No default credential is shipped in code.
  const login = (username, password) => {
    const user = users.find(u => String(u.username || '').toLowerCase() === String(username || '').toLowerCase() && u.password === password);
    if (!user) {
      return {
        success: false,
        error: cloudSyncConfigured ? `Use secure email sign-in for ${LIV8_OWNER_EMAIL}, or your existing legacy credentials on a previously configured device.` : 'Invalid username or password',
      };
    }
    const updatedUser = { ...user, lastLogin: new Date().toISOString(), cloudAuthenticated: false };
    setCurrentUser(updatedUser);
    localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    const updatedUsers = users.map(item => item.id === user.id ? updatedUser : item);
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));
    return { success: true, user: updatedUser };
  };

  const logout = async () => {
    if (supabase && cloudSession) await supabase.auth.signOut().catch(() => {});
    setCloudSession(null);
    setCurrentUser(null);
    localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
  };

  const createUser = userData => {
    if (currentUser?.role !== 'admin') return { success: false, error: 'Only admins can create users' };
    if (users.some(u => String(u.username || '').toLowerCase() === String(userData.username || '').toLowerCase())) return { success: false, error: 'Username already exists' };
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
      permissions: userData.permissions || ['tickets', 'dashboard'],
      cloudAuthenticated: false,
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));
    return { success: true, user: newUser };
  };

  const updateUser = (userId, updates) => {
    if (currentUser?.role !== 'admin' && currentUser?.id !== userId) return { success: false, error: 'Permission denied' };
    const updatedUsers = users.map(u => u.id === userId ? { ...u, ...updates } : u);
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));
    if (currentUser?.id === userId && !currentUser?.cloudAuthenticated) {
      const updatedCurrentUser = { ...currentUser, ...updates };
      setCurrentUser(updatedCurrentUser);
      localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(updatedCurrentUser));
    }
    return { success: true };
  };

  const deleteUser = userId => {
    if (currentUser?.role !== 'admin') return { success: false, error: 'Only admins can delete users' };
    if (userId === currentUser?.id) return { success: false, error: 'Cannot delete your own account' };
    const updatedUsers = users.filter(u => u.id !== userId);
    setUsers(updatedUsers);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));
    return { success: true };
  };

  const resetPassword = (userId, newPassword) => updateUser(userId, { password: newPassword });
  const changePassword = (currentPassword, newPassword) => {
    if (currentUser?.cloudAuthenticated) return { success: false, error: 'Cloud account security is managed through email sign-in.' };
    if (currentUser?.password !== currentPassword) return { success: false, error: 'Current password is incorrect' };
    return updateUser(currentUser.id, { password: newPassword });
  };

  const value = {
    currentUser,
    users,
    isLoading,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'admin',
    cloudConfigured: cloudSyncConfigured,
    cloudAuthenticated: Boolean(cloudSession && currentUser?.cloudAuthenticated),
    cloudSession,
    ownerEmail: LIV8_OWNER_EMAIL,
    requestMagicLink,
    login,
    logout,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
