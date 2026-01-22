import React, { useState, useEffect } from 'react';
import {
  Plug,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  FolderKanban,
  ListTodo,
  Zap,
  Users,
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Settings,
  Bot,
  Play,
  Copy,
  ArrowRightLeft,
  Send
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

function Integrations() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState({});
  const [integrationStatus, setIntegrationStatus] = useState({});

  // Taskade State
  const [taskadeWorkspaces, setTaskadeWorkspaces] = useState([]);
  const [taskadeProjects, setTaskadeProjects] = useState({});
  const [expandedWorkspace, setExpandedWorkspace] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState({});

  // Nifty State
  const [niftyStatus, setNiftyStatus] = useState({ authenticated: false });
  const [niftyProjects, setNiftyProjects] = useState([]);
  const [niftyAuthUrl, setNiftyAuthUrl] = useState('');

  // TaskMagic State
  const [taskmagicWebhook, setTaskmagicWebhook] = useState({ configured: false });
  const [taskmagicMCP, setTaskmagicMCP] = useState({ configured: false, connected: false });
  const [taskmagicBots, setTaskmagicBots] = useState([]);

  // Unified Task State
  const [unifiedCommand, setUnifiedCommand] = useState('');
  const [commandResult, setCommandResult] = useState(null);
  const [executingCommand, setExecutingCommand] = useState(false);

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/integrations/status`);
      if (response.ok) {
        const data = await response.json();
        setIntegrationStatus(data);

        // Load Taskade if configured
        if (data.taskade?.configured) {
          loadTaskadeWorkspaces();
        }

        // Check Nifty auth status
        loadNiftyStatus();

        // Check TaskMagic status - handle both old and new format
        if (data.taskmagic?.webhook || data.taskmagic?.configured) {
          setTaskmagicWebhook({
            configured: data.taskmagic?.webhook?.configured || data.taskmagic?.configured,
            connected: data.taskmagic?.webhook?.connected || data.taskmagic?.configured
          });
        }
        if (data.taskmagic?.mcp?.configured) {
          setTaskmagicMCP(data.taskmagic.mcp);
          loadTaskmagicBots();
        } else {
          // Check MCP status separately
          loadTaskmagicMCPStatus();
        }
      }
    } catch (error) {
      console.error('Failed to load integration status:', error);
    }
    setLoading(false);
  };

  // ============================================
  // TASKADE FUNCTIONS
  // ============================================

  const loadTaskadeWorkspaces = async () => {
    setRefreshing(prev => ({ ...prev, taskade: true }));
    try {
      const response = await fetch(`${API_URL}/api/taskade/workspaces`);
      if (response.ok) {
        const data = await response.json();
        setTaskadeWorkspaces(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load Taskade workspaces:', error);
    }
    setRefreshing(prev => ({ ...prev, taskade: false }));
  };

  const loadTaskadeProjects = async (workspaceId) => {
    if (taskadeProjects[workspaceId]) {
      setExpandedWorkspace(expandedWorkspace === workspaceId ? null : workspaceId);
      return;
    }

    setLoadingProjects(prev => ({ ...prev, [workspaceId]: true }));
    try {
      const response = await fetch(`${API_URL}/api/taskade/workspaces/${workspaceId}/projects`);
      if (response.ok) {
        const data = await response.json();
        setTaskadeProjects(prev => ({ ...prev, [workspaceId]: data.items || [] }));
        setExpandedWorkspace(workspaceId);
      }
    } catch (error) {
      console.error('Failed to load Taskade projects:', error);
    }
    setLoadingProjects(prev => ({ ...prev, [workspaceId]: false }));
  };

  // ============================================
  // NIFTY FUNCTIONS
  // ============================================

  const loadNiftyStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/nifty/auth/status`);
      if (response.ok) {
        const data = await response.json();
        setNiftyStatus(data);

        if (data.authenticated) {
          loadNiftyProjects();
        } else {
          const urlResponse = await fetch(`${API_URL}/api/nifty/auth/url`);
          if (urlResponse.ok) {
            const urlData = await urlResponse.json();
            setNiftyAuthUrl(urlData.url);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load Nifty status:', error);
    }
  };

  const loadNiftyProjects = async () => {
    setRefreshing(prev => ({ ...prev, nifty: true }));
    try {
      const response = await fetch(`${API_URL}/api/nifty/projects`);
      if (response.ok) {
        const data = await response.json();
        setNiftyProjects(data.projects || data || []);
      }
    } catch (error) {
      console.error('Failed to load Nifty projects:', error);
    }
    setRefreshing(prev => ({ ...prev, nifty: false }));
  };

  const handleNiftyAuth = () => {
    if (niftyAuthUrl) {
      window.open(niftyAuthUrl, '_blank');
    }
  };

  // ============================================
  // TASKMAGIC MCP FUNCTIONS
  // ============================================

  const loadTaskmagicMCPStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/taskmagic/mcp/status`);
      if (response.ok) {
        const data = await response.json();
        setTaskmagicMCP(data);
        if (data.configured && data.connected) {
          loadTaskmagicBots();
        }
      }
    } catch (error) {
      console.error('Failed to load TaskMagic MCP status:', error);
    }
  };

  const loadTaskmagicBots = async () => {
    setRefreshing(prev => ({ ...prev, taskmagic: true }));
    try {
      const response = await fetch(`${API_URL}/api/taskmagic/mcp/bots`);
      if (response.ok) {
        const data = await response.json();
        setTaskmagicBots(data.bots || []);
      }
    } catch (error) {
      console.error('Failed to load TaskMagic bots:', error);
    }
    setRefreshing(prev => ({ ...prev, taskmagic: false }));
  };

  const runBot = async (botId) => {
    try {
      const response = await fetch(`${API_URL}/api/taskmagic/mcp/bots/${botId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (response.ok) {
        alert('Bot started successfully!');
      }
    } catch (error) {
      console.error('Failed to run bot:', error);
    }
  };

  // ============================================
  // UNIFIED TASK FUNCTIONS
  // ============================================

  const executeUnifiedCommand = async () => {
    if (!unifiedCommand.trim()) return;

    setExecutingCommand(true);
    setCommandResult(null);
    try {
      const response = await fetch(`${API_URL}/api/unified/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: unifiedCommand })
      });

      if (response.ok) {
        const data = await response.json();
        setCommandResult(data);
      } else {
        setCommandResult({ error: 'Command failed' });
      }
    } catch (error) {
      setCommandResult({ error: error.message });
    }
    setExecutingCommand(false);
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const StatusBadge = ({ connected, configured }) => {
    if (connected) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          Connected
        </span>
      );
    }
    if (configured) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
          <AlertCircle className="w-3 h-3" />
          Configured
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
        <XCircle className="w-3 h-3" />
        Not Connected
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Integrations
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Connect and manage your productivity tools
          </p>
        </div>
        <button
          onClick={loadIntegrationStatus}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isDark
              ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30'
              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
      </div>

      {/* Unified Command Bar */}
      <div className={`rounded-xl border p-4 ${
        isDark ? 'bg-[#0a0a0f] border-purple-900/30' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="w-5 h-5 text-purple-400" />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Unified Task Command
          </h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={unifiedCommand}
            onChange={(e) => setUnifiedCommand(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && executeUnifiedCommand()}
            placeholder='Try: "List all tasks", "Show Taskade projects", "Trigger automation deploy-bot"'
            className={`flex-1 px-4 py-2 rounded-lg border ${
              isDark
                ? 'bg-black/50 border-purple-900/30 text-white placeholder-gray-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
            }`}
          />
          <button
            onClick={executeUnifiedCommand}
            disabled={executingCommand}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {executingCommand ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Execute
          </button>
        </div>
        {commandResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            commandResult.error
              ? 'bg-red-500/10 text-red-400'
              : isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-700'
          }`}>
            <pre className="whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(commandResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* TASKADE CARD */}
        <div className={`rounded-xl border p-6 ${
          isDark ? 'bg-[#0a0a0f] border-purple-900/30' : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <FolderKanban className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Taskade</h3>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Project Management</p>
              </div>
            </div>
            <StatusBadge connected={taskadeWorkspaces.length > 0} configured={integrationStatus.taskade?.configured} />
          </div>

          {taskadeWorkspaces.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{taskadeWorkspaces.length} Workspaces</span>
                <button onClick={loadTaskadeWorkspaces} disabled={refreshing.taskade} className={`p-1 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                  <RefreshCw className={`w-4 h-4 ${refreshing.taskade ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>
              </div>
              {taskadeWorkspaces.map((workspace) => (
                <div key={workspace.id} className={`rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                  <button onClick={() => loadTaskadeProjects(workspace.id)} className={`w-full flex items-center justify-between p-3 text-left ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}>
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{workspace.name}</span>
                    {loadingProjects[workspace.id] ? <RefreshCw className="w-4 h-4 animate-spin text-purple-400" /> : expandedWorkspace === workspace.id ? <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} /> : <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />}
                  </button>
                  {expandedWorkspace === workspace.id && taskadeProjects[workspace.id] && (
                    <div className={`border-t px-3 pb-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                      {taskadeProjects[workspace.id].length === 0 ? (
                        <p className={`text-xs py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No projects found</p>
                      ) : (
                        taskadeProjects[workspace.id].map((project) => (
                          <div key={project.id} className={`flex items-center gap-2 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <ListTodo className="w-3 h-3 text-blue-400" />
                            {project.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              <p className="text-sm">API key not configured</p>
              <p className="text-xs mt-1">Set TASKADE_API_KEY in server environment</p>
            </div>
          )}
        </div>

        {/* NIFTY PM CARD */}
        <div className={`rounded-xl border p-6 ${isDark ? 'bg-[#0a0a0f] border-purple-900/30' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Calendar className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Nifty PM</h3>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Project Management</p>
              </div>
            </div>
            <StatusBadge connected={niftyStatus.authenticated} configured={integrationStatus.nifty?.configured} />
          </div>

          {niftyStatus.authenticated ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{niftyProjects.length} Projects</span>
                <button onClick={loadNiftyProjects} disabled={refreshing.nifty} className={`p-1 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                  <RefreshCw className={`w-4 h-4 ${refreshing.nifty ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>
              </div>
              {niftyProjects.map((project) => (
                <div key={project.id} className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-green-400" />
                    <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{project.name}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : integrationStatus.nifty?.configured ? (
            <div className="text-center py-4">
              <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>OAuth authentication required</p>
              <button onClick={handleNiftyAuth} className="flex items-center gap-2 mx-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <ExternalLink className="w-4 h-4" />
                Connect Nifty
              </button>
            </div>
          ) : (
            <div className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              <p className="text-sm">OAuth credentials not configured</p>
              <p className="text-xs mt-1">Set NIFTY_CLIENT_ID and NIFTY_CLIENT_SECRET</p>
            </div>
          )}
        </div>

        {/* TASKMAGIC CARD */}
        <div className={`rounded-xl border p-6 ${isDark ? 'bg-[#0a0a0f] border-purple-900/30' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>TaskMagic</h3>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Automation Platform</p>
              </div>
            </div>
            <StatusBadge connected={taskmagicMCP.connected || taskmagicWebhook.connected} configured={taskmagicMCP.configured || taskmagicWebhook.configured} />
          </div>

          <div className="space-y-3">
            {/* Webhook Status */}
            <div className={`p-3 rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plug className="w-4 h-4 text-purple-400" />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Webhook</span>
                </div>
                <StatusBadge connected={taskmagicWebhook.connected} configured={taskmagicWebhook.configured} />
              </div>
            </div>

            {/* MCP Status */}
            <div className={`p-3 rounded-lg border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>MCP Control</span>
                </div>
                <StatusBadge connected={taskmagicMCP.connected} configured={taskmagicMCP.configured} />
              </div>

              {taskmagicMCP.connected && taskmagicBots.length > 0 ? (
                <div className="space-y-2 mt-3">
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{taskmagicBots.length} Bots Available</p>
                  {taskmagicBots.slice(0, 3).map((bot) => (
                    <div key={bot.id} className="flex items-center justify-between">
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{bot.name}</span>
                      <button
                        onClick={() => runBot(bot.id)}
                        className="p-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : taskmagicMCP.configured ? (
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Connecting to MCP...</p>
              ) : (
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Set TASKMAGIC_MCP_TOKEN for full control</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Integration Summary */}
      <div className={`rounded-xl border p-6 ${isDark ? 'bg-[#0a0a0f] border-purple-900/30' : 'bg-white border-gray-200 shadow-sm'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Integration Status Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
            <p className={`text-2xl font-bold ${taskadeWorkspaces.length > 0 ? 'text-green-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>{taskadeWorkspaces.length}</p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Taskade Workspaces</p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
            <p className={`text-2xl font-bold ${niftyProjects.length > 0 ? 'text-green-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>{niftyProjects.length}</p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Nifty Projects</p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
            <p className={`text-2xl font-bold ${taskmagicWebhook.configured ? 'text-green-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>{taskmagicWebhook.configured ? '1' : '0'}</p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>TaskMagic Webhooks</p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
            <p className={`text-2xl font-bold ${taskmagicBots.length > 0 ? 'text-cyan-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>{taskmagicBots.length}</p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>TaskMagic Bots</p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
            <p className="text-2xl font-bold text-purple-400">
              {[integrationStatus.taskade?.configured, integrationStatus.nifty?.configured, taskmagicWebhook.configured, taskmagicMCP.configured].filter(Boolean).length}
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Configured</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Integrations;
