import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar, { MobileMenuButton } from './components/Sidebar';
import ChatWidget from './components/ChatWidget';
import VoiceDictation from './components/VoiceDictation';
import VaultLogin from './components/VaultLogin';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Agents from './pages/Agents';
import Actions from './pages/Actions';
import Domains from './pages/Domains';
import Valuation from './pages/Valuation';
import GitHub from './pages/GitHub';
import Tickets from './pages/Tickets';
import Inbox from './pages/Inbox';
import AdminPanel from './pages/AdminPanel';
import News from './pages/News';
import AgentTeam from './pages/AgentTeam';
import Integrations from './pages/Integrations';
import ActionFeed from './pages/ActionFeed';
import Trading from './pages/Trading';
import VoiceAgents from './pages/VoiceAgents';
import APIBuilder from './pages/APIBuilder';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dictationOpen, setDictationOpen] = useState(false);
  const isDark = theme === 'dark';

  // Handle resize to close sidebar on large screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigate = (page) => {
    setActivePage(page);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <VaultLogin />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'projects':
        return <Projects />;
      case 'agents':
        return <Agents />;
      case 'actions':
        return <Actions />;
      case 'domains':
        return <Domains />;
      case 'valuation':
        return <Valuation />;
      case 'github':
        return <GitHub />;
      case 'tickets':
        return <Tickets />;
      case 'inbox':
        return <Inbox />;
      case 'news':
        return <News />;
      case 'agent-team':
        return <AgentTeam />;
      case 'integrations':
        return <Integrations />;
      case 'action-feed':
        return <ActionFeed />;
      case 'trading':
        return <Trading />;
      case 'voice-agents':
        return <VoiceAgents />;
      case 'api-builder':
        return <APIBuilder />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-theme transition-colors duration-300">
      {/* Mobile menu button */}
      <MobileMenuButton onClick={toggleSidebar} isDark={isDark} />

      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
      />

      {/* Main content - responsive margin */}
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 min-h-screen">
        {renderPage()}
      </main>

      {/* Chat Widget - AI Assistant with Agents, Voice & Send to PA */}
      <ChatWidget onNavigate={handleNavigate} />

      {/* Voice Dictation (Willow-like) - floating button */}
      <button
        onClick={() => setDictationOpen(true)}
        className={`fixed bottom-6 left-6 z-40 p-3 rounded-full shadow-lg transition-all hover:scale-110 ${
          isDark
            ? 'bg-gradient-to-br from-green-500 to-cyan-500 text-white hover:shadow-green-500/30'
            : 'bg-gradient-to-br from-green-500 to-cyan-500 text-white hover:shadow-green-500/30'
        }`}
        title="Voice Dictation - Speak & paste anywhere"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
      </button>
      <VoiceDictation isOpen={dictationOpen} onClose={() => setDictationOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
