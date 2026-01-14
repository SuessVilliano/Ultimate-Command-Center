import React from 'react';
import {
  Globe,
  ExternalLink,
  CheckCircle2,
  Clock,
  Server,
  Shield,
  TrendingUp
} from 'lucide-react';
import { domains } from '../data/portfolio';

function Domains() {
  const liveDomains = domains.filter(d => d.status === 'live');
  const parkedDomains = domains.filter(d => d.status === 'parked');

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Domain Portfolio</h1>
          <p className="text-gray-400">Digital real estate and web presence management</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
            <span className="text-green-400 text-sm font-medium">
              {liveDomains.length} Live
            </span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <span className="text-cyan-400 text-sm font-medium">
              {parkedDomains.length} Parked
            </span>
          </div>
        </div>
      </div>

      {/* Domain Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-white">{domains.length}</p>
          <p className="text-sm text-gray-400">Total Domains</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{liveDomains.length}</p>
          <p className="text-sm text-gray-400">Live Sites</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-cyan-400">{parkedDomains.length}</p>
          <p className="text-sm text-gray-400">Parked</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">
            ${domains.length * 15}/yr
          </p>
          <p className="text-sm text-gray-400">Est. Annual Cost</p>
        </div>
      </div>

      {/* Live Domains */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-500/20">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Live Domains</h2>
            <p className="text-sm text-gray-500">Active websites with deployed applications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveDomains.map((domain) => (
            <div key={domain.domain} className="card p-6 hover:glow-green transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Globe className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{domain.domain}</h3>
                    <p className="text-xs text-gray-500">{domain.purpose}</p>
                  </div>
                </div>
                <a
                  href={`https://${domain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Status</span>
                  <span className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Live
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">SSL</span>
                  <span className="flex items-center gap-1 text-green-400">
                    <Shield className="w-3 h-3" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Parked Domains */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <Server className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Parked Domains</h2>
            <p className="text-sm text-gray-500">Reserved domains awaiting deployment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parkedDomains.map((domain) => (
            <div key={domain.domain} className="card p-6 hover:glow-blue transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Globe className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{domain.domain}</h3>
                    <p className="text-xs text-gray-500">{domain.purpose}</p>
                  </div>
                </div>
                <a
                  href={`https://${domain.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Status</span>
                  <span className="flex items-center gap-2 text-cyan-400">
                    <Clock className="w-3 h-3" />
                    Parked
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Ready</span>
                  <span className="text-gray-500">Awaiting deployment</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Domain Strategy */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Domain Strategy Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <h4 className="text-sm font-semibold text-purple-400 mb-2">Core Brand</h4>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>liv8.co - Primary brand hub</li>
              <li>liv8ai.com - AI products</li>
              <li>liv8health.com - Health vertical</li>
              <li>liv8solar.com - Energy vertical</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <h4 className="text-sm font-semibold text-cyan-400 mb-2">Trading Brand</h4>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>hybridfunding.co - Prop firm</li>
              <li>hybridjournal.co - Trading journal</li>
              <li>tradehybrid.co - Trading tools</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <h4 className="text-sm font-semibold text-green-400 mb-2">Service Brands</h4>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>smartlifebrokers.com - Insurance</li>
              <li>builtinminutes.com - Dev services</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Domain Value */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Portfolio Value</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Registration Costs</span>
              <span className="text-white">${domains.length * 15}/year</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Estimated Market Value</span>
              <span className="text-green-400">$5,000 - $15,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Brand Equity</span>
              <span className="text-purple-400">Growing</span>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Deployment Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Deployed</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 rounded-full bg-gray-800">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${(liveDomains.length / domains.length) * 100}%` }}
                  ></div>
                </div>
                <span className="text-white text-sm">{Math.round((liveDomains.length / domains.length) * 100)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Parked</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 rounded-full bg-gray-800">
                  <div
                    className="h-2 rounded-full bg-cyan-500"
                    style={{ width: `${(parkedDomains.length / domains.length) * 100}%` }}
                  ></div>
                </div>
                <span className="text-white text-sm">{Math.round((parkedDomains.length / domains.length) * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Domains;
