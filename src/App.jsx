import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar, { MobileMenuButton } from './components/Sidebar';
import ChatWidget from './components/ChatWidget';
import VoiceRouter from './components/VoiceRouter';
import VaultLogin from './components/VaultLogin';
import GodViewRail from './components/GodViewRail';
import PersistentPanel from './components/PersistentPanel';
import LifeCalendarPanel from './components/LifeCalendarPanel';
import CommandDashboard from './pages/CommandDashboard';
import Projects from './pages/Projects';
import Agents from './pages/Agents';
import Domains from './pages/Domains';
import Valuation from './pages/Valuation';
import GitHub from './pages/GitHub';
import AffiliateManagerPage from './pages/AffiliateManagerPage';
import Inbox from './pages/Inbox';
import UnifiedConversations from './pages/UnifiedConversations';
import AdminPanel from './pages/AdminPanel';
import Trading from './pages/Trading';
import AgentTeamLive from './pages/AgentTeamLive';
import Integrations from './pages/Integrations';
import TradingProcessLive from './pages/TradingProcessLive';
import VoiceAgents from './pages/VoiceAgents';
import APIBuilder from './pages/APIBuilder';
import Glasses from './pages/Glasses';
import CreatorControlRoomLive from './pages/CreatorControlRoomLive';
import LifeMap from './pages/LifeMap';
import HighestSelf from './pages/HighestSelf';
import HealthCommandCenter from './pages/HealthCommandCenter';
import MemoryVault from './pages/MemoryVault';
import FamilyOS from './pages/FamilyOS';
import BusinessOS from './pages/BusinessOS';
import Today from './pages/Today';
import Operations from './pages/Operations';

const validPages = new Set([
  'dashboard','projects','github','tickets','inbox','team-inbox','news','agent-team','integrations','operations',
  'action-feed','actions','agents','voice-agents','domains','valuation','trading','api-builder','admin',
  'content-engine','highest-self','life-map','health-os','memory-vault','trading-process','family-os',
  'business-os','hs-today','glasses'
]);

function initialPage() {
  if (window.location.hash.includes('access_token=')) return 'integrations';
  const requested = new URLSearchParams(window.location.search).get('page');
  return requested && validPages.has(requested) ? requested : 'dashboard';
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const [activePage, setActivePage] = useState(initialPage);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('liv8_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const [dictationOpen, setDictationOpen] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('liv8_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('page');
    if (requested && validPages.has(requested)) setActivePage(requested);
  }, []);

  const handleNavigate = (page) => setActivePage(page);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleSidebarCollapsed = () => setSidebarCollapsed(value => !value);

  if (isLoading) return <div className="min-h-screen bg-[#030305] flex items-center justify-center"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return <VaultLogin />;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <CommandDashboard />;
      case 'projects': return <Projects />;
      case 'github': return <GitHub />;
      case 'tickets': return <AffiliateManagerPage />;
      case 'inbox': return <UnifiedConversations />;
      case 'team-inbox': return <Inbox />;
      case 'news': return <Trading />;
      case 'agent-team': return <AgentTeamLive />;
      case 'integrations': return <Integrations />;
      case 'operations': return <Operations onNavigate={setActivePage} />;
      case 'action-feed': return <Operations onNavigate={setActivePage} />;
      case 'actions': return <Operations onNavigate={setActivePage} />;
      case 'agents': return <Agents />;
      case 'voice-agents': return <VoiceAgents />;
      case 'domains': return <Domains />;
      case 'valuation': return <Valuation />;
      case 'trading': return <TradingProcessLive />;
      case 'api-builder': return <APIBuilder />;
      case 'admin': return <AdminPanel />;
      case 'content-engine': return <CreatorControlRoomLive />;
      case 'highest-self': return <HighestSelf />;
      case 'life-map': return <LifeMap />;
      case 'health-os': return <HealthCommandCenter />;
      case 'memory-vault': return <MemoryVault />;
      case 'trading-process': return <TradingProcessLive />;
      case 'family-os': return <div className="space-y-4"><PersistentPanel id="life-calendar" title="Life Calendar" subtitle="Real calendar + Family OS" defaultOpen><LifeCalendarPanel /></PersistentPanel><FamilyOS /></div>;
      case 'business-os': return <BusinessOS />;
      case 'hs-today': return <Today onNavigate={setActivePage} />;
      case 'glasses': return <Glasses onExit={() => setActivePage('dashboard')} />;
      default: return <CommandDashboard />;
    }
  };

  if (activePage === 'glasses') return <Glasses onExit={() => setActivePage('dashboard')} />;

  return (
    <div className={`flex min-h-screen bg-theme transition-colors duration-300 ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <style>{`
        @media (min-width: 1280px) { [data-testid="god-view-rail"] { display: flex !important; } }
        .theme-light [data-testid="god-view-rail"] > section { background: rgba(255,255,255,.96) !important; border-color: rgba(124,58,237,.18) !important; box-shadow: 0 18px 48px rgba(15,23,42,.10) !important; }
        .theme-light [data-testid="god-view-rail"] .text-white { color: #111827 !important; }
        .theme-light [data-testid="god-view-rail"] .text-gray-300 { color: #374151 !important; }
        .theme-light [data-testid="god-view-rail"] .text-gray-400 { color: #4b5563 !important; }
        .theme-light [data-testid="god-view-rail"] .text-gray-500 { color: #6b7280 !important; }
        .theme-light [data-testid="god-view-rail"] .bg-black\/70,
        .theme-light [data-testid="god-view-rail"] .bg-black\/60 { background: rgba(255,255,255,.82) !important; }
      `}</style>
      <MobileMenuButton onClick={toggleSidebar} isDark={isDark} />
      <Sidebar activePage={activePage} setActivePage={setActivePage} isOpen={sidebarOpen} onToggle={toggleSidebar} collapsed={sidebarCollapsed} onCollapse={toggleSidebarCollapsed} />
      <main className={`flex-1 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 min-h-screen xl:pr-[390px] transition-[margin] duration-300`}>{renderPage()}</main>
      <GodViewRail activePage={activePage} onNavigate={handleNavigate} />
      <ChatWidget onNavigate={handleNavigate} />
      <button onClick={() => setDictationOpen(true)} className={`fixed bottom-6 left-6 ${sidebarCollapsed ? 'lg:left-[104px]' : 'lg:left-[280px]'} z-[70] p-3.5 rounded-full shadow-xl transition-all hover:scale-110 bg-gradient-to-br from-green-500 to-cyan-500 text-white ring-1 ring-white/20 hover:shadow-green-500/30`} title="LIV8 Voice Router — speak once, send anywhere" aria-label="Open LIV8 Voice Router">
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </button>
      <VoiceRouter isOpen={dictationOpen} onClose={() => setDictationOpen(false)} onNavigate={handleNavigate} />
    </div>
  );
}

function App() { return <ThemeProvider><AuthProvider><AppContent /></AuthProvider></ThemeProvider>; }
export default App;
