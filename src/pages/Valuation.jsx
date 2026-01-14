import React from 'react';
import {
  DollarSign,
  TrendingUp,
  PieChart,
  BarChart3,
  Shield,
  Building2,
  Code2,
  Bot,
  Globe,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { valuationSummary, softwareProducts, businesses, aiAgents, domains } from '../data/portfolio';

// Format currency - show M for millions, K for thousands
const formatCurrency = (value) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  return `$${(value / 1000).toFixed(0)}K`;
};

function Valuation() {
  const conservative = valuationSummary.conservative;
  const aggressive = valuationSummary.aggressive;

  const patentableProducts = softwareProducts.filter(p => p.patentable);
  const completedProducts = softwareProducts.filter(p => p.status === 'complete' || p.status === 'shipping');

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">IP Valuation</h1>
          <p className="text-gray-400">Comprehensive intellectual property assessment</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 text-lg font-bold">
              {formatCurrency(conservative.total.min)} - {formatCurrency(aggressive.total.max)}
            </span>
          </div>
        </div>
      </div>

      {/* Total Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 border border-green-500/30 glow-green">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-green-500/20">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Conservative Estimate</h3>
              <p className="text-sm text-gray-500">Minimum defensible value</p>
            </div>
          </div>
          <div className="text-center py-6">
            <p className="text-4xl font-bold text-green-400">
              {formatCurrency(conservative.total.min)} - {formatCurrency(conservative.total.max)}
            </p>
          </div>
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Software Products</span>
              <span className="text-white">{formatCurrency(conservative.software.min)} - {formatCurrency(conservative.software.max)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Trading Systems</span>
              <span className="text-white">{formatCurrency(conservative.trading.min)} - {formatCurrency(conservative.trading.max)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">AI Agents</span>
              <span className="text-white">{formatCurrency(conservative.agents.min)} - {formatCurrency(conservative.agents.max)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Brand & Domains</span>
              <span className="text-white">{formatCurrency(conservative.brand.min)} - {formatCurrency(conservative.brand.max)}</span>
            </div>
          </div>
        </div>

        <div className="card p-6 border border-purple-500/30 glow-purple">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-purple-500/20">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Aggressive Estimate</h3>
              <p className="text-sm text-gray-500">Full market potential</p>
            </div>
          </div>
          <div className="text-center py-6">
            <p className="text-4xl font-bold text-purple-400">
              {formatCurrency(aggressive.total.min)} - {formatCurrency(aggressive.total.max)}
            </p>
          </div>
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Software Products</span>
              <span className="text-white">{formatCurrency(aggressive.software.min)} - {formatCurrency(aggressive.software.max)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Trading Systems</span>
              <span className="text-white">{formatCurrency(aggressive.trading.min)} - {formatCurrency(aggressive.trading.max)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">AI Agents</span>
              <span className="text-white">{formatCurrency(aggressive.agents.min)} - {formatCurrency(aggressive.agents.max)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Brand & Domains</span>
              <span className="text-white">{formatCurrency(aggressive.brand.min)} - {formatCurrency(aggressive.brand.max)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Breakdown */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-cyan-400" />
          Asset Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
            <Code2 className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{softwareProducts.length}</p>
            <p className="text-sm text-gray-400">Software Products</p>
            <p className="text-xs text-purple-400 mt-1">{completedProducts.length} Complete</p>
          </div>
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-center">
            <Bot className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{aiAgents.length}</p>
            <p className="text-sm text-gray-400">AI Agents</p>
            <p className="text-xs text-cyan-400 mt-1">{aiAgents.filter(a => a.status === 'deployed').length} Deployed</p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
            <Building2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{businesses.length}</p>
            <p className="text-sm text-gray-400">Businesses</p>
            <p className="text-xs text-green-400 mt-1">{businesses.filter(b => b.status === 'live' || b.status === 'operating').length} Active</p>
          </div>
          <div className="p-4 rounded-lg bg-pink-500/10 border border-pink-500/30 text-center">
            <Globe className="w-8 h-8 text-pink-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{domains.length}</p>
            <p className="text-sm text-gray-400">Domains</p>
            <p className="text-xs text-pink-400 mt-1">{domains.filter(d => d.status === 'live').length} Live</p>
          </div>
        </div>
      </div>

      {/* Patentable IP */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" />
            Patentable Intellectual Property
          </h3>
          <span className="px-3 py-1 text-sm rounded-full bg-yellow-500/20 text-yellow-400">
            {patentableProducts.length} Items
          </span>
        </div>
        <div className="space-y-4">
          {patentableProducts.map((product) => (
            <div key={product.id} className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-white">{product.name}</h4>
                  <p className="text-sm text-gray-400 mt-1">{product.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-400">
                    {formatCurrency(product.valueMin)} - {formatCurrency(product.valueMax)}
                  </p>
                  <p className="text-xs text-gray-500">Estimated Value</p>
                </div>
              </div>
              {product.id === 'abatev' && (
                <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">CRITICAL: File provisional patent immediately</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Valuation Methodology */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          Valuation Methodology
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-purple-400 mb-3">Conservative Approach</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2"></div>
                Development cost replacement value
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2"></div>
                Comparable market transactions
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2"></div>
                Current revenue potential only
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2"></div>
                No speculative growth included
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-cyan-400 mb-3">Aggressive Approach</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                Full market potential valuation
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                Strategic buyer premium
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                Growth trajectory projections
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                Synergy value with acquirer
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Value Drivers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <h4 className="text-sm font-semibold text-green-400 mb-4">Value Drivers</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Proven AI trading performance (65%+ win rate)
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Multiple complete SaaS products
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Patentable ABATEV technology
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Deployed AI agent network
            </li>
          </ul>
        </div>
        <div className="card p-6">
          <h4 className="text-sm font-semibold text-yellow-400 mb-4">Value Risks</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              Code not in version control
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              Missing formal documentation
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              No patent filings yet
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              Scattered data room
            </li>
          </ul>
        </div>
        <div className="card p-6">
          <h4 className="text-sm font-semibold text-purple-400 mb-4">Value Multipliers</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Vertical integration across fintech
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Multi-platform AI infrastructure
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Real revenue-generating assets
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Scalable technology stack
            </li>
          </ul>
        </div>
      </div>

      {/* Institutional Readiness Score */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Institutional Readiness Assessment</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: 'Legal Structure', score: 85, color: 'green' },
            { label: 'IP Protection', score: 35, color: 'red' },
            { label: 'Documentation', score: 55, color: 'yellow' },
            { label: 'Version Control', score: 45, color: 'yellow' },
            { label: 'Data Room', score: 40, color: 'red' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-3">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-gray-800"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 35}
                    strokeDashoffset={2 * Math.PI * 35 * (1 - item.score / 100)}
                    strokeLinecap="round"
                    className={`text-${item.color}-500`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold text-${item.color}-400`}>{item.score}%</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Overall Readiness Score</p>
              <p className="text-sm text-gray-400">Based on institutional due diligence criteria</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-purple-400">52%</p>
              <p className="text-xs text-gray-500">Target: 85%+</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Valuation;
