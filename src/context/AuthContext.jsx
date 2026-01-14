import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

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

  // Initialize auth state
  useEffect(() => {
    const storedUsers = localStorage.getItem(AUTH_KEYS.USERS);
    const storedCurrentUser = localStorage.getItem(AUTH_KEYS.CURRENT_USER);
    const adminSetup = localStorage.getItem(AUTH_KEYS.ADMIN_SETUP);

    // Initialize with default admin if first time
    if (!adminSetup) {
      const initialUsers = [DEFAULT_ADMIN];
      localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(initialUsers));
      localStorage.setItem(AUTH_KEYS.ADMIN_SETUP, 'true');
      setUsers(initialUsers);
    } else if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    }

    // Restore session if exists
    if (storedCurrentUser) {
      setCurrentUser(JSON.parse(storedCurrentUser));
    }

    setIsLoading(false);
  }, []);

  // Login function
  const login = (username, password) => {
    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (user) {
      const updatedUser = { ...user, lastLogin: new Date().toISOString() };
      setCurrentUser(updatedUser);
      localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(updatedUser));

      // Update last login in users list
      const updatedUsers = users.map(u =>
        u.id === user.id ? updatedUser : u
      );
      setUsers(updatedUsers);
      localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(updatedUsers));

      return { success: true, user: updatedUser };
    }

    return { success: false, error: 'Invalid username or password' };
  };

  // Logout function
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
  };

  // Create new user (admin only)
  const createUser = (userData) => {
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
    if (currentUser?.role !== 'admin' && currentUser?.id !== userId) {
      return { success: false, error: 'Permission denied' };
    }

    return updateUser(userId, { password: newPassword });
  };

  // Change own password
  const changePassword = (currentPassword, newPassword) => {
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
