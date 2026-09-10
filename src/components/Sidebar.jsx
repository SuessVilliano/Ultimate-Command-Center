import React from 'react';
import {
  LayoutDashboard, FolderKanban, Bot, Zap, ExternalLink, Github, Ticket,
  Sun, Moon, Users, LogOut, Shield, MessageSquare, TrendingUp, Plug, Inbox,
  X, Menu, BarChart3, Terminal, Glasses, Network, Heart, Target, Sparkles,
  Briefcase, Sunrise, ChevronDown, ChevronRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { FEATURES } from '../config';

const highestSelfItems = [
  { id: 'hs-today', label: 'Today', icon: Sunrise, flag: 'GLANCE' },
  { id: 'highest-self', label: 'Highest Self', icon: Sparkles, flag: 'TODAY' },
  { id: 'life-map', label: 'Life Map', icon: Network, flag: 'LIFE_MAP' },
  { id: 'family-os', label: 'Family OS', icon: Users, flag: 'FAMILY' },
  { id: 'health-os', label: 'Health OS', icon: Heart, flag: 'HEALTH' },
  { id: 'trading-process', label: 'Trading Process', icon: Target, flag: 'TRADING' },
  { id: 'business-os', label: 'Business & Creation', icon: Briefcase, flag: 'BUSINESS' },
].filter((item) => FEATURES.HIGHEST_SELF?.[item.flag]);

// Keep the permanent sidebar reserved for daily operating surfaces.
// Voice Agents + Agent Config live under Agent Team. Domains + Valuation live under Business OS.
// Action Feed + Action Items are unified under Operations.
const mainItems = [
  { id: 'tickets', label: 'GHL', icon: Ticket },
  { id: 'content-engine', label: 'Content Engine', icon: TrendingUp },
  { id: 'trading', label: 'Trading Hub', icon: BarChart3 },
  { id: 'api-builder', label: 'API / MCP Builder', icon: Terminal },
  { id: 'agent-team', label: 'Agent Team', icon: Bot },
  { id: 'inbox', label: 'Team Inbox', icon: MessageSquare },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'glasses', label: 'Glasses Mode', icon: Glasses },
  { id: 'operations', label: 'Operations', icon: Inbox },
];

const quickLinks = [
  { label: 'Command Center', url: 'https://command.liv8.co' },
  { label: 'Hybrid Journal', url: 'https://hybridjournal.co' },
  { label: 'OBS Remote', url: 'https://obsremote.liv8.co' },
  { label: 'Trade Hybrid', url: 'https://tradehybrid.co' },
  { label: 'GitHub', url: 'https://github.com/SuessVilliano' },
];

function Sidebar({ activePage, setActivePage, isOpen, onToggle }) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, isAdmin } = useAuth();
  const isDark = theme === 'dark';
  const hsActive = highestSelfItems.some((item) => item.id === activePage);
  const [hsOpen, setHsOpen] = React.useState(() => {
    try { return localStorage.getItem('hs_group_open') === '1'; } catch { return false; }
  });
  const showHsItems = hsOpen || hsActive;

  const handleNavClick = (pageId) => {
    setActivePage(pageId);
    if (window.innerWidth < 1024) onToggle?.();
  };

  const toggleHs = () => {
    const next = !hsOpen;
    setHsOpen(next);
    try { localStorage.setItem('hs_group_open', next ? '1' : '0'); } catch {}
  };

  const navClass = (active, accent = 'purple') => {
    if (active) {
      return accent === 'teal'
        ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
        : 'bg-purple-600/20 text-purple-400 border border-purple-500/30';
    }
    return isDark
      ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent';
  };

  const userLabel = currentUser?.name || currentUser?.email || currentUser?.username || 'SV';
  const userSub = currentUser?.email || currentUser?.role || 'Command Center';

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />}

      <aside className={`fixed left-0 top-0 h-screen w-64 flex flex-col border-r transition-all duration-300 z-50 ${
        isDark ? 'bg-[#050508] border-purple-900/30' : 'bg-white border-gray-200'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`p-5 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <button onClick={() => handleNavClick('dashboard')} className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>LIV8</h1>
                <p className="text-xs text-gray-500">Command Center</p>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`} title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={onToggle} className={`p-2 rounded-lg lg:hidden ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <button onClick={() => handleNavClick('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${navClass(activePage === 'dashboard')}`}>
            <LayoutDashboard className="w-4 h-4" />
            <span className="font-medium">Dashboard</span>
          </button>

          {highestSelfItems.length > 0 && (
            <div className="mt-1 mb-1">
              <button onClick={toggleHs} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                hsActive ? 'text-teal-400 bg-teal-500/5' : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'
              }`}>
                <span className="flex items-center gap-3"><Sparkles className="w-4 h-4"/><span className="font-medium">Highest Self OS</span></span>
                <span className="flex items-center gap-1 text-[10px] opacity-70">{!showHsItems && `${highestSelfItems.length} tabs`}{showHsItems ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}</span>
              </button>
              {showHsItems && (
                <div className={`ml-4 mt-1 pl-2 border-l ${isDark ? 'border-teal-500/20' : 'border-teal-200'}`}>
                  {highestSelfItems.map((item) => {
                    const Icon = item.icon;
                    return <button key={item.id} onClick={() => handleNavClick(item.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${navClass(activePage === item.id, 'teal')}`}>
                      <Icon className="w-3.5 h-3.5"/><span className="font-medium">{item.label}</span>
                    </button>;
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-1 space-y-1">
            {mainItems.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} onClick={() => handleNavClick(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${navClass(activePage === item.id)}`}>
                <Icon className="w-4 h-4"/><span className="font-medium">{item.label}</span>
              </button>;
            })}
          </div>

          {isAdmin && (
            <div className="mt-5">
              <div className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Admin</div>
              <button onClick={() => handleNavClick('admin')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${navClass(activePage === 'admin')}`}>
                <Users className="w-4 h-4"/><span className="font-medium">Team Management</span>
              </button>
            </div>
          )}

          <div className="mt-5">
            <div className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Quick Links</div>
            <div className="space-y-0.5">
              {quickLinks.map((link) => <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-1.5 rounded text-[11px] ${isDark ? 'text-gray-600 hover:text-gray-300 hover:bg-white/5' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}>
                <ExternalLink className="w-3 h-3"/><span>{link.label}</span>
              </a>)}
            </div>
          </div>
        </nav>

        <div className={`p-3 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className={`rounded-lg border p-2.5 ${isDark ? 'border-purple-500/30 bg-purple-500/5' : 'border-purple-200 bg-purple-50'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{String(userLabel).charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><div className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{userLabel}</div><div className="text-[9px] text-gray-500 truncate">{userSub}</div></div>
              {isAdmin && <Shield className="w-3.5 h-3.5 text-purple-400"/>}
            </div>
            <button onClick={logout} className={`mt-2 w-full flex items-center justify-center gap-2 py-1.5 rounded text-[10px] ${isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-white'}`}><LogOut className="w-3 h-3"/>Sign Out</button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick, isDark }) {
  return <button onClick={onClick} className={`fixed left-4 top-4 z-40 lg:hidden p-2 rounded-lg border shadow-lg ${isDark ? 'bg-[#0a0a0f] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'}`} aria-label="Open navigation"><Menu className="w-5 h-5"/></button>;
}

export default Sidebar;
