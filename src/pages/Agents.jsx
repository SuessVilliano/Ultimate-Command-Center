import React from 'react';
import {
  Bot,
  Shield,
  Zap,
  Users,
  TrendingUp,
  MessageSquare,
  Settings,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { aiAgents } from '../data/portfolio';

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
  const taskadeAgents = aiAgents.filter(a => a.platform === 'Taskade');
  const claudeAgents = aiAgents.filter(a => a.platform === 'Claude Code');

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Agent Network</h1>
          <p className="text-gray-400">Deployed autonomous agents across platforms</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
            <span className="text-green-400 text-sm font-medium">
              {aiAgents.filter(a => a.status === 'deployed').length}/{aiAgents.length} Deployed
            </span>
          </div>
        </div>
      </div>

      {/* Hybrid Grid - Taskade Agents */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Bot className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Hybrid Grid</h2>
            <p className="text-sm text-gray-500">Taskade AI Operations Network - Hybrid Funding</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {taskadeAgents.map((agent) => {
            const Icon = agentIcons[agent.id] || Bot;
            const gradient = agentColors[agent.id] || 'from-gray-500 to-gray-600';

            return (
              <div key={agent.id} className="card p-4 hover:glow-purple transition-all duration-300">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-1">{agent.name}</h3>
                <p className="text-xs text-gray-400 mb-3">{agent.role}</p>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-1 text-xs rounded-full status-complete">
                    {agent.status}
                  </span>
                  <span className="text-xs text-gray-500">{agent.platform}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hybrid Grid Architecture */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Operations Flow</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="text-sm font-semibold text-purple-400 mb-2">Customer Facing</h4>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>Hybrid Helpbot</li>
              <li>Challenge Coach</li>
              <li>TribeBuilder</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="text-sm font-semibold text-cyan-400 mb-2">Operations</h4>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>Flow Manager</li>
              <li>PayoutPilot</li>
              <li>TradeTracker</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="text-sm font-semibold text-green-400 mb-2">Compliance</h4>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>PolicyPal (KYC)</li>
              <li>Drawdown Defender</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="text-sm font-semibold text-pink-400 mb-2">Growth</h4>
            <ul className="space-y-1 text-xs text-gray-400">
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
            <h2 className="text-xl font-semibold text-white">LIV8 Agents</h2>
            <p className="text-sm text-gray-500">Claude Code Integration via Migration Protocol</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {claudeAgents.map((agent) => {
            const Icon = agentIcons[agent.id] || Bot;
            const gradient = agentColors[agent.id] || 'from-gray-500 to-gray-600';

            return (
              <div key={agent.id} className="card p-6 hover:glow-blue transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">{agent.name}</h3>
                    <p className="text-sm text-gray-400 mb-3">{agent.role}</p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs rounded-full status-complete">
                        {agent.status}
                      </span>
                      <span className="text-xs text-gray-500">{agent.platform}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integrations */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Platform Integrations</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {['Google Sheets', 'Slack', 'Gmail', 'Discord', 'Freshdesk', 'Webhooks'].map((integration) => (
            <div key={integration} className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <p className="text-sm text-gray-300">{integration}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">{aiAgents.length}</p>
          <p className="text-sm text-gray-400">Total Agents</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{taskadeAgents.length}</p>
          <p className="text-sm text-gray-400">Hybrid Grid</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-cyan-400">{claudeAgents.length}</p>
          <p className="text-sm text-gray-400">LIV8 Agents</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-pink-400">6</p>
          <p className="text-sm text-gray-400">Integrations</p>
        </div>
      </div>
    </div>
  );
}

export default Agents;
