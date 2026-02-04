import React, { useState, useEffect } from 'react';
import {
  Bot,
  Shield,
  Zap,
  Users,
  TrendingUp,
  MessageSquare,
  Settings,
  CheckCircle2,
  Activity,
  Cloud,
  RefreshCw,
  ExternalLink,
  Plus,
  X,
  Code,
  Server,
  Globe,
  AlertCircle
} from 'lucide-react';
import { aiAgents } from '../data/portfolio';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

const agentIcons = {
  'hybrid-core': Shield,
  'helpbot': MessageSquare,
  'challenge-coach': Users,
  'flow-manager': Settings,
  'drawdown-defender': Shield,
  'policy-pal': CheckCircle2,
  'payout-pilot': TrendingUp,
  'promo-pilot': Zap,
  'tribe-builder': Users,
  'trade-tracker': Activity,
  'skill-designer': Bot,
  'skill-installer': Settings
};

const agentColors = {
  'hybrid-core': 'from-purple-500 to-pink-500',
  'helpbot': 'from-cyan-500 to-blue-500',
  'challenge-coach': 'from-green-500 to-emerald-500',
  'flow-manager': 'from-orange-500 to-yellow-500',
  'drawdown-defender': 'from-red-500 to-pink-500',
  'policy-pal': 'from-blue-500 to-indigo-500',
  'payout-pilot': 'from-green-500 to-teal-500',
  'promo-pilot': 'from-pink-500 to-purple-500',
  'tribe-builder': 'from-cyan-500 to-purple-500',
  'trade-tracker': 'from-yellow-500 to-orange-500',
  'skill-designer': 'from-purple-500 to-indigo-500',
  'skill-installer': 'from-gray-500 to-slate-500'
};

function Agents() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [cloudflareConfigured, setCloudflareConfigured] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);

  const taskadeAgents = aiAgents.filter(a => a.platform === 'Taskade');
  const claudeAgents = aiAgents.filter(a => a.platform === 'Claude Code');

  useEffect(() => {
    loadCloudflareWorkers();
  }, []);

  const loadCloudflareWorkers = async () => {
    setLoadingWorkers(true);
    try {
      const response = await fetch(`${API_URL}/api/cloudflare/workers`);
      if (response.ok) {
        const data = await response.json();
        setCloudflareConfigured(data.configured);
        setWorkers(data.workers || []);
      }
    } catch (e) {
      console.log('Could not load Cloudflare workers');
    }
    setLoadingWorkers(false);
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>AI Agent Network</h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Deployed autonomous agents and Cloudflare Workers</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
            <span className="text-green-400 text-sm font-medium">
              {aiAgents.filter(a => a.status === 'deployed').length}/{aiAgents.length} Deployed
            </span>
          </div>
          {cloudflareConfigured && (
            <div className={`px-4 py-2 rounded-lg ${isDark ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}>
              <span className="text-orange-400 text-sm font-medium flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                {workers.length} Workers
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Cloudflare Workers Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Cloud className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cloudflare Workers</h2>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Edge-deployed serverless functions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadCloudflareWorkers}
              disabled={loadingWorkers}
              className={`p-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <RefreshCw className={`w-5 h-5 ${loadingWorkers ? 'animate-spin' : ''}`} />
            </button>
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isDark ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              Cloudflare Dashboard
            </a>
          </div>
        </div>

        {!cloudflareConfigured ? (
          <div className={`p-6 rounded-xl border ${isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>Cloudflare Not Configured</h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                  Add CLOUDFLARE_API_KEY and CLOUDFLARE_ACCOUNT_ID to your server environment to view and manage Workers.
                </p>
                <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-black/20' : 'bg-white'}`}>
                  <code className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    CLOUDFLARE_API_KEY=your_api_key<br />
                    CLOUDFLARE_ACCOUNT_ID=your_account_id
                  </code>
                </div>
              </div>
            </div>
          </div>
        ) : workers.length === 0 ? (
          <div className={`p-8 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
            <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No Workers deployed yet</p>
            <a
              href="https://developers.cloudflare.com/workers/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-orange-400 hover:text-orange-300 text-sm"
            >
              Learn about Cloudflare Workers <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((worker) => (
              <div key={worker.id} className={`p-5 rounded-xl border transition-all hover:border-orange-500/50 ${
                isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/20">
                      <Code className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{worker.name}</h3>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Worker Script</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Created</span>
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      {worker.created ? new Date(worker.created).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Modified</span>
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      {worker.modified ? new Date(worker.modified).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hybrid Grid - Taskade Agents */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Bot className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Hybrid Grid</h2>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Taskade AI Operations Network - Hybrid Funding</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {taskadeAgents.map((agent) => {
            const Icon = agentIcons[agent.id] || Bot;
            const gradient = agentColors[agent.id] || 'from-gray-500 to-gray-600';

            return (
              <div key={agent.id} className={`p-4 rounded-xl border transition-all hover:border-purple-500/50 ${
                isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'
              }`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{agent.name}</h3>
                <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{agent.role}</p>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                    {agent.status}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{agent.platform}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hybrid Grid Architecture */}
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Operations Flow</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <h4 className="text-sm font-semibold text-purple-400 mb-2">Customer Facing</h4>
            <ul className={`space-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <li>Hybrid Helpbot</li>
              <li>Challenge Coach</li>
              <li>TribeBuilder</li>
            </ul>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <h4 className="text-sm font-semibold text-cyan-400 mb-2">Operations</h4>
            <ul className={`space-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <li>Flow Manager</li>
              <li>PayoutPilot</li>
              <li>TradeTracker</li>
            </ul>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <h4 className="text-sm font-semibold text-green-400 mb-2">Compliance</h4>
            <ul className={`space-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <li>PolicyPal (KYC)</li>
              <li>Drawdown Defender</li>
            </ul>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <h4 className="text-sm font-semibold text-pink-400 mb-2">Growth</h4>
            <ul className={`space-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <li>PromoPilot</li>
              <li>HybridCore (Director)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Claude Code Agents */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <Zap className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>LIV8 Agents</h2>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Claude Code Integration via Migration Protocol</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {claudeAgents.map((agent) => (
            <div key={agent.id} className={`p-4 rounded-xl border transition-all hover:border-cyan-500/50 ${
              isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{agent.name}</h3>
              <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{agent.role}</p>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  agent.status === 'deployed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {agent.status}
                </span>
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{agent.platform}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Capabilities */}
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Agent Capabilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg ${isDark ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}>
            <h4 className="text-sm font-semibold text-purple-400 mb-2">Autonomous Operations</h4>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Agents operate 24/7 with intelligent decision-making, handling customer queries, processing data, and triggering workflows.
            </p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
            <h4 className="text-sm font-semibold text-cyan-400 mb-2">Cross-Platform Sync</h4>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Seamless integration between Taskade, Claude Code, and Cloudflare Workers for unified operations.
            </p>
          </div>
          <div className={`p-4 rounded-lg ${isDark ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}>
            <h4 className="text-sm font-semibold text-orange-400 mb-2">Edge Deployment</h4>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Cloudflare Workers run at the edge for low-latency API endpoints and serverless functions globally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Agents;
