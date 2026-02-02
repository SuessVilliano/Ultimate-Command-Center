import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar, { MobileMenuButton } from './components/Sidebar';
import ChatWidget from './components/ChatWidget';
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

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

      {/* Chat Widget */}
      <ChatWidget onNavigate={handleNavigate} />
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
