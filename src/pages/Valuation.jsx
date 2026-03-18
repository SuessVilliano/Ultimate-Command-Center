import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  RefreshCw,
  GitCommit,
  Activity
} from 'lucide-react';
import { valuationSummary, softwareProducts, businesses, aiAgents, domains } from '../data/portfolio';

const formatCurrency = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  return `$${(value / 1000).toFixed(0)}K`;
};

// Calculate dynamic value multipliers from GitHub data
const calculateGitHubMultipliers = (repos) => {
  if (!repos || repos.length === 0) return { repoMultiplier: 1, healthScore: 50 };

  const totalRepos = repos.length;
  const activeRepos = repos.filter(r => {
    const days = Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days < 30;
  }).length;

  const totalSize = repos.reduce((sum, r) => sum + (r.size || 0), 0);
  const totalStars = repos.reduce((sum, r) => sum + (r.stars || 0), 0);
  const languages = [...new Set(repos.map(r => r.language).filter(Boolean))];
  const withDescription = repos.filter(r => r.description && r.description !== 'No description').length;

  // Activity score (0-100)
  const activityScore = Math.min(100, (activeRepos / Math.max(totalRepos, 1)) * 100);

  // Code volume score
  const codeScore = Math.min(100, (totalSize / 50000) * 100);

  // Diversity score
  const diversityScore = Math.min(100, (languages.length / 5) * 100);

  // Documentation score
  const docScore = (withDescription / Math.max(totalRepos, 1)) * 100;

  const healthScore = Math.round((activityScore * 0.3 + codeScore * 0.25 + diversityScore * 0.2 + docScore * 0.25));

  // Multiplier: 0.8 to 1.4 based on health
  const repoMultiplier = 0.8 + (healthScore / 100) * 0.6;

  return {
    repoMultiplier,
    healthScore,
    totalRepos,
    activeRepos,
    totalSize,
    totalStars,
    languages,
    activityScore: Math.round(activityScore),
    codeScore: Math.round(codeScore),
    diversityScore: Math.round(diversityScore),
    docScore: Math.round(docScore)
  };
};

function Valuation() {
  const [githubRepos, setGithubRepos] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadGitHubData();
  }, []);

  const loadGitHubData = () => {
    try {
      const stored = localStorage.getItem('liv8_github_repos');
      if (stored) {
        const repos = JSON.parse(stored);
        setGithubRepos(repos);
        setMetrics(calculateGitHubMultipliers(repos));

        const lastFetch = localStorage.getItem('liv8_github_repos_last_fetch');
        if (lastFetch) setLastUpdated(new Date(lastFetch));
      }
    } catch (e) {
      console.error('Failed to load GitHub data:', e);
    }
  };

  const multiplier = metrics?.repoMultiplier || 1;

  const conservative = {
    software: { min: Math.round(valuationSummary.conservative.software.min * multiplier), max: Math.round(valuationSummary.conservative.software.max * multiplier) },
    trading: valuationSummary.conservative.trading,
    agents: valuationSummary.conservative.agents,
    brand: valuationSummary.conservative.brand,
  };
  conservative.total = {
    min: conservative.software.min + conservative.trading.min + conservative.agents.min + conservative.brand.min,
    max: conservative.software.max + conservative.trading.max + conservative.agents.max + conservative.brand.max
  };

  const aggressive = {
    software: { min: Math.round(valuationSummary.aggressive.software.min * multiplier), max: Math.round(valuationSummary.aggressive.software.max * multiplier) },
    trading: valuationSummary.aggressive.trading,
    agents: valuationSummary.aggressive.agents,
    brand: valuationSummary.aggressive.brand,
  };
  aggressive.total = {
    min: aggressive.software.min + aggressive.trading.min + aggressive.agents.min + aggressive.brand.min,
    max: aggressive.software.max + aggressive.trading.max + aggressive.agents.max + aggressive.brand.max
  };

  const patentableProducts = softwareProducts.filter(p => p.patentable);
  const completedProducts = softwareProducts.filter(p => p.status === 'complete' || p.status === 'shipping');

  // Dynamic readiness scores based on real data
  const versionControlScore = metrics ? Math.min(95, Math.round(30 + (metrics.activeRepos / Math.max(metrics.totalRepos, 1)) * 65)) : 45;
  const documentationScore = metrics ? Math.min(90, Math.round(20 + metrics.docScore * 0.7)) : 55;
  const ipProtectionScore = patentableProducts.length > 0 ? 35 : 20;
  const dataRoomScore = metrics ? Math.min(75, Math.round(20 + (metrics.totalRepos > 10 ? 30 : metrics.totalRepos * 3) + (metrics.totalStars > 0 ? 15 : 0))) : 40;
  const overallReadiness = Math.round((85 + ipProtectionScore + documentationScore + versionControlScore + dataRoomScore) / 5);

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">IP Valuation</h1>
          <p className="text-gray-400">
            Dynamic intellectual property assessment
            {lastUpdated && (
              <span className="ml-2 text-xs text-purple-400">
                (GitHub data: {lastUpdated.toLocaleDateString()})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadGitHubData}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 text-lg font-bold">
              {formatCurrency(conservative.total.min)} - {formatCurrency(aggressive.total.max)}
            </span>
          </div>
        </div>
      </div>

      {/* GitHub-Powered Metrics */}
      {metrics && (
        <div className="card p-6 border border-cyan-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-cyan-500/20">
              <Activity className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Live GitHub Metrics</h3>
              <p className="text-sm text-gray-500">Auto-calculated from {metrics.totalRepos} repositories</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-gray-400">Value Multiplier</p>
              <p className={`text-xl font-bold ${multiplier >= 1.1 ? 'text-green-400' : multiplier >= 1.0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {multiplier.toFixed(2)}x
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <p className="text-2xl font-bold text-white">{metrics.totalRepos}</p>
              <p className="text-xs text-gray-400">Total Repos</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <p className="text-2xl font-bold text-green-400">{metrics.activeRepos}</p>
              <p className="text-xs text-gray-400">Active (30d)</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <p className="text-2xl font-bold text-cyan-400">{metrics.languages.length}</p>
              <p className="text-xs text-gray-400">Languages</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <p className="text-2xl font-bold text-yellow-400">{metrics.totalStars}</p>
              <p className="text-xs text-gray-400">Stars</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <p className="text-2xl font-bold text-purple-400">{Math.round(metrics.totalSize / 1024)} MB</p>
              <p className="text-xs text-gray-400">Total Code</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Activity</span>
                <span className="text-cyan-400">{metrics.activityScore}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800">
                <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${metrics.activityScore}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Code Volume</span>
                <span className="text-purple-400">{metrics.codeScore}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800">
                <div className="h-2 rounded-full bg-purple-500" style={{ width: `${metrics.codeScore}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Diversity</span>
                <span className="text-green-400">{metrics.diversityScore}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800">
                <div className="h-2 rounded-full bg-green-500" style={{ width: `${metrics.diversityScore}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Documentation</span>
                <span className="text-yellow-400">{metrics.docScore}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800">
                <div className="h-2 rounded-full bg-yellow-500" style={{ width: `${Math.round(metrics.docScore)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Patentable IP - same as before */}
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

      {/* Dynamic Institutional Readiness Score */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Institutional Readiness Assessment</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: 'Legal Structure', score: 85, color: 'green' },
            { label: 'IP Protection', score: ipProtectionScore, color: ipProtectionScore > 60 ? 'green' : ipProtectionScore > 40 ? 'yellow' : 'red' },
            { label: 'Documentation', score: documentationScore, color: documentationScore > 60 ? 'green' : documentationScore > 40 ? 'yellow' : 'red' },
            { label: 'Version Control', score: versionControlScore, color: versionControlScore > 60 ? 'green' : versionControlScore > 40 ? 'yellow' : 'red' },
            { label: 'Data Room', score: dataRoomScore, color: dataRoomScore > 60 ? 'green' : dataRoomScore > 40 ? 'yellow' : 'red' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-3">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="6" fill="none" className="text-gray-800" />
                  <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="6" fill="none"
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
              <p className="text-sm text-gray-400">
                {metrics ? 'Dynamically calculated from GitHub data' : 'Based on institutional due diligence criteria'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-purple-400">{overallReadiness}%</p>
              <p className="text-xs text-gray-500">Target: 85%+</p>
            </div>
          </div>
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
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2"></div>Development cost replacement value</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2"></div>Comparable market transactions</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2"></div>Current revenue potential only</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2"></div>No speculative growth included</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-cyan-400 mb-3">Aggressive Approach</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>Full market potential valuation</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>Strategic buyer premium</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>Growth trajectory projections</li>
              <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>Synergy value with acquirer</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Value sections - same as original */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <h4 className="text-sm font-semibold text-green-400 mb-4">Value Drivers</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>Proven AI trading performance (65%+ win rate)</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>Multiple complete SaaS products</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>Patentable ABATEV technology</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>{metrics ? `${metrics.activeRepos} actively maintained repos` : 'Deployed AI agent network'}</li>
          </ul>
        </div>
        <div className="card p-6">
          <h4 className="text-sm font-semibold text-yellow-400 mb-4">Value Risks</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div>{metrics && metrics.totalRepos > 0 ? `${metrics.totalRepos} repos in version control` : 'Code not in version control'}</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div>{metrics && metrics.docScore > 50 ? 'Documentation improving' : 'Missing formal documentation'}</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div>No patent filings yet</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div>Scattered data room</li>
          </ul>
        </div>
        <div className="card p-6">
          <h4 className="text-sm font-semibold text-purple-400 mb-4">Value Multipliers</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div>Vertical integration across fintech</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div>{metrics ? `${metrics.languages.length} programming languages` : 'Multi-platform AI infrastructure'}</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div>Real revenue-generating assets</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div>Scalable technology stack</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Valuation;
