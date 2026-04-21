import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Storage keys
const AUTH_KEYS = {
  USERS: 'liv8_auth_users',
  CURRENT_USER: 'liv8_current_user',
  ADMIN_SETUP: 'liv8_admin_setup'
};

// Legacy default admin password that was shipped in the public bundle.
// Any existing user still carrying this credential is forced back through
// first-run setup so they pick a private password.
const LEAKED_ADMIN_PASSWORD = 'LIV8Command2026!';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state. We no longer seed a default admin — the user is
  // prompted to create one on first launch via `setupAdmin`.
  useEffect(() => {
    const storedUsers = localStorage.getItem(AUTH_KEYS.USERS);
    const storedCurrentUser = localStorage.getItem(AUTH_KEYS.CURRENT_USER);

    let loadedUsers = storedUsers ? JSON.parse(storedUsers) : [];

    // Scrub any account still using the leaked default password.
    const scrubbed = loadedUsers.filter(u => u.password !== LEAKED_ADMIN_PASSWORD);
    if (scrubbed.length !== loadedUsers.length) {
      localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(scrubbed));
      localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
      localStorage.removeItem(AUTH_KEYS.ADMIN_SETUP);
      loadedUsers = scrubbed;
    }

    setUsers(loadedUsers);

    // Only restore the session if that user still exists after scrubbing.
    if (storedCurrentUser) {
      const parsed = JSON.parse(storedCurrentUser);
      if (loadedUsers.some(u => u.id === parsed.id)) {
        setCurrentUser(parsed);
      } else {
        localStorage.removeItem(AUTH_KEYS.CURRENT_USER);
      }
    }

    setIsLoading(false);
  }, []);

  // First-run admin creation. Callable only while no admin exists, so an
  // attacker with network access can't use it to seize an already-configured
  // instance.
  const setupAdmin = ({ username, password, name, email }) => {
    if (users.some(u => u.role === 'admin')) {
      return { success: false, error: 'Admin already exists' };
    }
    if (!username || !password) {
      return { success: false, error: 'Username and password required' };
    }
    if (password === LEAKED_ADMIN_PASSWORD) {
      return { success: false, error: 'Choose a different password' };
    }
    const admin = {
      id: 'admin_001',
      username,
      password,
      name: name || username,
      email: email || '',
      role: 'admin',
      agentName: name || username,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    const next = [admin];
    setUsers(next);
    setCurrentUser(admin);
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(next));
    localStorage.setItem(AUTH_KEYS.CURRENT_USER, JSON.stringify(admin));
    localStorage.setItem(AUTH_KEYS.ADMIN_SETUP, 'true');
    return { success: true, user: admin };
  };

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
    isSetupNeeded: !users.some(u => u.role === 'admin'),
    login,
    logout,
    setupAdmin,
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
