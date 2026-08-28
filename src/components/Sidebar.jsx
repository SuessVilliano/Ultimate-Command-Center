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
  TrendingUp,
  Plug,
  Inbox,
  X,
  Menu,
  Mic,
  BarChart3,
  Terminal,
  Glasses,
  Network,
  Heart,
  Target,
  Sparkles,
  Briefcase,
  Sunrise,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { FEATURES } from '../config';

// Highest Self OS - stable life-operating-system anchors.
const highestSelfItems = [
  { id: 'hs-today', label: 'Today', icon: Sunrise, flag: 'GLANCE' },
  { id: 'highest-self', label: 'Highest Self', icon: Sparkles, flag: 'TODAY' },
  { id: 'life-map', label: 'Life Map', icon: Network, flag: 'LIFE_MAP' },
  { id: 'family-os', label: 'Family OS', icon: Users, flag: 'FAMILY' },
  { id: 'health-os', label: 'Health OS', icon: Heart, flag: 'HEALTH' },
  { id: 'trading-process', label: 'Trading Process', icon: Target, flag: 'TRADING' },
  { id: 'business-os', label: 'Business & Creation', icon: Briefcase, flag: 'BUSINESS' },
].filter((i) => FEATURES.HIGHEST_SELF?.[i.flag]);

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agent-team', label: 'Agent Team', icon: Bot },
  { id: 'trading', label: 'Trading Hub', icon: BarChart3 },
  { id: 'content-engine', label: 'Content Engine', icon: TrendingUp },
  { id: 'voice-agents', label: 'Voice Agents', icon: Mic },
  { id: 'api-builder', label: 'API / MCP Builder', icon: Terminal },
  { id: 'inbox', label: 'Team Inbox', icon: MessageSquare },
  { id: 'action-feed', label: 'Action Feed', icon: Inbox },
  { id: 'tickets', label: 'GHL', icon: Ticket },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'agents', label: 'Agents Config', icon: Zap },
  { id: 'actions', label: 'Action Items', icon: CheckSquare },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'valuation', label: 'Valuation', icon: DollarSign },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'glasses', label: 'Glasses Mode', icon: Glasses },
];

const quickLinks = [
  { label: 'Command Center', url: 'https://command.liv8.co' },
  { label: 'Hybrid Journal', url: 'https://hybridjournal.co' },
  { label: 'OBS Remote', url: 'https://obsremote.liv8.co' },
  { label: 'Trade Hybrid', url: 'https://tradehybrid.co' },
  { label: 'GitHub', url: 'https://github.com/SuessVilliano' },
];

const allNavItems = [...highestSelfItems, ...menuItems];

function Sidebar({ activePage, setActivePage, isOpen, onToggle }) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, isAdmin } = useAuth();
  const isDark = theme === 'dark';

  const hsIds = highestSelfItems.map((i) => i.id);
  const hsActive = hsIds.includes(activePage);
  const [hsOpen, setHsOpen] = React.useState(() => {
    try { return localStorage.getItem('hs_group_open') === '1'; } catch { return false; }
  });
  const toggleHs = () => {
    const next = !hsOpen;
    setHsOpen(next);
    try { localStorage.setItem('hs_group_open', next ? '1' : '0'); } catch {}
  };
  const showHsItems = hsOpen || hsActive;

  // Adaptive shortcuts: stable navigation remains intact, while this small block
  // learns the pages used most often and most recently.
  const [navUsage, setNavUsage] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('nav_usage_v1') || '{}'); } catch { return {}; }
  });

  React.useEffect(() => {
    if (!activePage || !allNavItems.some((item) => item.id === activePage)) return;
    setNavUsage((previous) => {
      const prior = previous[activePage] || { count: 0, last: 0 };
      const next = {
        ...previous,
        [activePage]: { count: prior.count + 1, last: Date.now() }
      };
      try { localStorage.setItem('nav_usage_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [activePage]);

  const smartItems = React.useMemo(() => {
    const now = Date.now();
    return allNavItems
      .map((item, baseIndex) => {
        const usage = navUsage[item.id] || { count: 0, last: 0 };
        const hoursAgo = usage.last ? Math.max(0, (now - usage.last) / 3600000) : 9999;
        const recencyBoost = usage.last ? Math.max(0, 14 - Math.min(14, hoursAgo / 6)) : 0;
        const score = usage.count * 3 + recencyBoost - baseIndex * 0.001;
        return { ...item, usage, score };
      })
      .filter((item) => item.usage.count > 0 || item.id === 'hs-today' || item.id === 'dashboard')
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [navUsage]);

  // Drag-to-reorder persists the stable menus separately from Smart Shortcuts.
  const orderList = (items, key) => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      const byId = Object.fromEntries(items.map((i) => [i.id, i]));
      const ordered = saved.map((id) => byId[id]).filter(Boolean);
      const rest = items.filter((i) => !saved.includes(i.id));
      return [...ordered, ...rest];
    } catch { return items; }
  };
  const [mainOrder, setMainOrder] = React.useState(() => orderList(menuItems, 'menu_order_v1'));
  const [hsOrder, setHsOrder] = React.useState(() => orderList(highestSelfItems, 'hs_menu_order_v1'));
  const dragRef = React.useRef(null);
  const reorder = (list, setter, key, from, to) => {
    if (from === to || from == null) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setter(next);
    try { localStorage.setItem(key, JSON.stringify(next.map((i) => i.id))); } catch {}
  };
  const dragProps = (listKey, index, list, setter, storageKey) => ({
    draggable: true,
    onDragStart: () => { dragRef.current = { listKey, index }; },
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault();
      const d = dragRef.current;
      if (d && d.listKey === listKey) reorder(list, setter, storageKey, d.index, index);
      dragRef.current = null;
    },
  });

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
    if (window.innerWidth < 1024) onToggle?.();
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />
      )}

      <aside className={`
        fixed left-0 top-0 h-screen w-64 flex flex-col border-r transition-all duration-300 z-50
        ${isDark ? 'bg-[#050508] border-purple-900/30' : 'bg-white border-gray-200'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className={`p-6 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>LIV8</h1>
                <p className="text-xs text-gray-500">Command Center</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={onToggle}
                className={`p-2 rounded-lg transition-colors lg:hidden ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="mb-5">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-cyan-400/80' : 'text-cyan-700'}`}>Smart Shortcuts</span>
              <span className="text-[10px] text-gray-500">learns your flow</span>
            </div>
            <div className={`rounded-xl p-2 border ${isDark ? 'bg-cyan-950/10 border-cyan-500/15' : 'bg-cyan-50 border-cyan-200'}`}>
              {smartItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={`smart-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300'
                        : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:bg-white'
                    }`}
                    title={`${item.usage.count || 0} visits - adapts based on frequency and recency`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {highestSelfItems.length > 0 && (
            <div className="mb-6">
              <button
                onClick={toggleHs}
                className={`w-full flex items-center justify-between px-4 mb-2 text-xs font-semibold uppercase tracking-wider transition-colors ${isDark ? 'text-teal-500/70 hover:text-teal-400' : 'text-teal-600/80 hover:text-teal-600'}`}
              >
                <span className="flex items-center gap-1.5">
                  {showHsItems ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  Highest Self OS
                </span>
                {!showHsItems && <span className="text-[10px] opacity-60 normal-case tracking-normal">{highestSelfItems.length} tabs</span>}
              </button>
              {showHsItems && (
                <ul className="space-y-2">
                  {hsOrder.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <li key={item.id} {...dragProps('hs', index, hsOrder, setHsOrder, 'hs_menu_order_v1')}>
                        <button
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing ${
                            isActive
                              ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
                              : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <ul className="space-y-2">
            {mainOrder.map((item, index) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id} {...dragProps('main', index, mainOrder, setMainOrder, 'menu_order_v1')}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing ${
                      isActive
                        ? 'bg-purple-600/20 text-purple-500 border border-purple-500/30'
                        : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {isAdmin && (
            <div className="mt-6">
              <h3 className={`px-4 text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Admin</h3>
              <button
                onClick={() => handleNavClick('admin')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activePage === 'admin'
                    ? 'bg-purple-600/20 text-purple-500 border border-purple-500/30'
                    : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">Team Management</span>
              </button>
            </div>
          )}

          <div className="mt-6">
            <h3 className={`px-4 text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Quick Links</h3>
            <ul className="space-y-1">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${isDark ? 'text-gray-500 hover:text-cyan-400' : 'text-gray-500 hover:text-purple-600'}`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className={`p-4 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className={`rounded-lg ${isDark ? 'bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border border-purple-500/20' : 'bg-gradient-to-r from-purple-50 to-cyan-50 border border-purple-200'}`}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{currentUser?.name || 'User'}</p>
                  {isAdmin && <Shield className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                </div>
                <p className="text-xs truncate text-gray-500">{currentUser?.agentName || 'Team Member'}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm border-t transition-colors ${isDark ? 'border-purple-500/20 text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'border-purple-200 text-gray-500 hover:text-red-500 hover:bg-red-50'}`}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick, isDark }) {
  return (
    <button
      onClick={onClick}
      className={`fixed top-4 left-4 z-30 p-3 rounded-lg shadow-lg lg:hidden transition-colors ${isDark ? 'bg-[#0a0a0f] border border-purple-900/30 text-white hover:bg-purple-900/20' : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'}`}
    >
      <Menu className="w-6 h-6" />
    </button>
  );
}

export default Sidebar;