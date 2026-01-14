import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Trash2,
  Edit,
  Key,
  Save,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail
} from 'lucide-react';

function AdminPanel() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { currentUser, users, createUser, updateUser, deleteUser, resetPassword, isAdmin } = useAuth();

  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // New user form state
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'member',
    agentName: '',
    permissions: ['tickets', 'dashboard']
  });

  // New password state
  const [newPassword, setNewPassword] = useState('');

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className={`text-center p-8 rounded-xl border ${
          isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-200 bg-red-50'
        }`}>
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Access Denied
          </h2>
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
            Only administrators can access this panel.
          </p>
        </div>
      </div>
    );
  }

  const handleCreateUser = (e) => {
    e.preventDefault();
    const result = createUser({
      ...newUser,
      agentName: newUser.agentName || newUser.name
    });

    if (result.success) {
      setMessage({ type: 'success', text: `User "${newUser.username}" created successfully!` });
      setNewUser({
        username: '',
        password: '',
        name: '',
        email: '',
        role: 'member',
        agentName: '',
        permissions: ['tickets', 'dashboard']
      });
      setShowAddUser(false);
    } else {
      setMessage({ type: 'error', text: result.error });
    }

    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleUpdateUser = (e) => {
    e.preventDefault();
    const result = updateUser(editingUser.id, editingUser);

    if (result.success) {
      setMessage({ type: 'success', text: 'User updated successfully!' });
      setEditingUser(null);
    } else {
      setMessage({ type: 'error', text: result.error });
    }

    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    const result = resetPassword(resetPasswordUser.id, newPassword);

    if (result.success) {
      setMessage({ type: 'success', text: `Password reset for "${resetPasswordUser.username}"` });
      setResetPasswordUser(null);
      setNewPassword('');
    } else {
      setMessage({ type: 'error', text: result.error });
    }

    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleDeleteUser = (user) => {
    if (window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      const result = deleteUser(user.id);
      if (result.success) {
        setMessage({ type: 'success', text: `User "${user.username}" deleted` });
      } else {
        setMessage({ type: 'error', text: result.error });
      }
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const availablePermissions = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'tickets', label: 'Support Tickets' },
    { id: 'projects', label: 'Projects' },
    { id: 'agents', label: 'AI Agents' },
    { id: 'github', label: 'GitHub' },
    { id: 'domains', label: 'Domains' },
    { id: 'valuation', label: 'Valuation' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Team Management
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Manage team members and access permissions
          </p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border ${
          isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
        }`}>
          <Users className="w-6 h-6 text-purple-500 mb-2" />
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {users.length}
          </div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Users</div>
        </div>
        <div className={`p-4 rounded-xl border ${
          isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
        }`}>
          <ShieldCheck className="w-6 h-6 text-green-500 mb-2" />
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {users.filter(u => u.role === 'admin').length}
          </div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Admins</div>
        </div>
        <div className={`p-4 rounded-xl border ${
          isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
        }`}>
          <Clock className="w-6 h-6 text-cyan-500 mb-2" />
          <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {users.filter(u => u.lastLogin).length}
          </div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Active Users</div>
        </div>
      </div>

      {/* Users Table */}
      <div className={`rounded-xl border ${
        isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
      }`}>
        <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Team Members
          </h3>
        </div>
        <div className="divide-y divide-purple-900/10">
          {users.map(user => (
            <div key={user.id} className={`p-4 flex items-center justify-between ${
              isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  user.role === 'admin'
                    ? 'bg-gradient-to-br from-purple-500 to-cyan-500 text-white'
                    : isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
                }`}>
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {user.name}
                    </span>
                    {user.role === 'admin' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                        Admin
                      </span>
                    )}
                    {user.id === currentUser?.id && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                        You
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    @{user.username} • {user.agentName || 'No agent name set'}
                  </div>
                  {user.lastLogin && (
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Last login: {new Date(user.lastLogin).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResetPasswordUser(user)}
                  className={`p-2 rounded-lg ${
                    isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title="Reset Password"
                >
                  <Key className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingUser({ ...user })}
                  className={`p-2 rounded-lg ${
                    isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title="Edit User"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {user.id !== currentUser?.id && (
                  <button
                    onClick={() => handleDeleteUser(user)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"
                    title="Delete User"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-xl ${
            isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Add Team Member
              </h3>
              <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Username *
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className={`w-full p-2 rounded-lg border ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className={`w-full p-2 rounded-lg border pr-10 ${
                        isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className={`w-full p-2 rounded-lg border ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                  required
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Agent Name (for ticket responses)
                </label>
                <input
                  type="text"
                  value={newUser.agentName}
                  onChange={(e) => setNewUser({ ...newUser, agentName: e.target.value })}
                  placeholder="e.g., John - GHL Support"
                  className={`w-full p-2 rounded-lg border ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className={`w-full p-2 rounded-lg border ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className={`w-full p-2 rounded-lg border ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <option value="member">Team Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className={`flex-1 py-2 rounded-lg ${
                    isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-xl ${
            isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Edit User: {editingUser.username}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className={`w-full p-2 rounded-lg border ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Agent Name
                </label>
                <input
                  type="text"
                  value={editingUser.agentName || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, agentName: e.target.value })}
                  className={`w-full p-2 rounded-lg border ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email
                </label>
                <input
                  type="email"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className={`w-full p-2 rounded-lg border ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Role
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className={`w-full p-2 rounded-lg border ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                  }`}
                  disabled={editingUser.id === currentUser?.id}
                >
                  <option value="member">Team Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className={`flex-1 py-2 rounded-lg ${
                    isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-xl ${
            isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Reset Password: {resetPasswordUser.username}
              </h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full p-2 rounded-lg border pr-10 ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                    }`}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}
                  className={`flex-1 py-2 rounded-lg ${
                    isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
