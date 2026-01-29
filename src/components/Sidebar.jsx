import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Bot,
  CheckSquare,
  Globe,
  DollarSign,
  Zap,
  ExternalLink,
  Github,
  Ticket,
  Sun,
  Moon,
  Users,
  LogOut,
  Shield,
  MessageSquare,
  Newspaper,
  TrendingUp,
  Plug,
  Inbox
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agent-team', label: 'Agent Team', icon: Bot },
  { id: 'news', label: 'News & Markets', icon: TrendingUp },
  { id: 'inbox', label: 'Team Inbox', icon: MessageSquare },
  { id: 'action-feed', label: 'Action Feed', icon: Inbox },
  { id: 'tickets', label: 'Support Tickets', icon: Ticket },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'agents', label: 'Agents Config', icon: Zap },
  { id: 'actions', label: 'Action Items', icon: CheckSquare },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'valuation', label: 'Valuation', icon: DollarSign },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'integrations', label: 'Integrations', icon: Plug },
];

const quickLinks = [
  { label: 'Hybrid Funding', url: 'https://hybridfunding.co' },
  { label: 'LIV8 Health', url: 'https://liv8health.com' },
  { label: 'Trade Hybrid', url: 'https://tradehybrid.co' },
  { label: 'GitHub', url: 'https://github.com/SuessVilliano' },
];

function Sidebar({ activePage, setActivePage }) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, isAdmin } = useAuth();
  const isDark = theme === 'dark';

  return (
    <aside className={`fixed left-0 top-0 h-screen w-64 flex flex-col border-r transition-colors duration-300 ${
      isDark
        ? 'bg-[#050508] border-purple-900/30'
        : 'bg-white border-gray-200'
    }`}>
      {/* Logo */}
      <div className={`p-6 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>LIV8</h1>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Command Center</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-white/10 text-gray-400'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-purple-600/20 text-purple-500 border border-purple-500/30'
                      : isDark
                        ? 'text-gray-400 hover:text-white hover:bg-white/5'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Admin Section */}
        {isAdmin && (
          <div className="mt-6">
            <h3 className={`px-4 text-xs font-semibold uppercase tracking-wider mb-3 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}>
              Admin
            </h3>
            <button
              onClick={() => setActivePage('admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activePage === 'admin'
                  ? 'bg-purple-600/20 text-purple-500 border border-purple-500/30'
                  : isDark
                    ? 'text-gray-400 hover:text-white hover:bg-white/5'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Team Management</span>
            </button>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-6">
          <h3 className={`px-4 text-xs font-semibold uppercase tracking-wider mb-3 ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Quick Links
          </h3>
          <ul className="space-y-1">
            {quickLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    isDark
                      ? 'text-gray-500 hover:text-cyan-400'
                      : 'text-gray-500 hover:text-purple-600'
                  }`}
                >
                  <ExternalLink className="w-3 h-3" />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User Footer */}
      <div className={`p-4 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
        <div className={`rounded-lg ${
          isDark
            ? 'bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border border-purple-500/20'
            : 'bg-gradient-to-r from-purple-50 to-cyan-50 border border-purple-200'
        }`}>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {currentUser?.name || 'User'}
                </p>
                {isAdmin && (
                  <Shield className="w-3 h-3 text-purple-400 flex-shrink-0" />
                )}
              </div>
              <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {currentUser?.agentName || 'Team Member'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm border-t transition-colors ${
              isDark
                ? 'border-purple-500/20 text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                : 'border-purple-200 text-gray-500 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
