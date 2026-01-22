import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
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

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

  const handleNavigate = (page) => {
    setActivePage(page);
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
      case 'admin':
        return <AdminPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-theme transition-colors duration-300">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 ml-64 p-8">
        {renderPage()}
      </main>
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
