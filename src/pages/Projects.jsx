import React, { useState } from 'react';
import {
  Code2,
  ExternalLink,
  Github,
  Shield,
  CheckCircle2,
  Clock,
  Rocket,
  Filter
} from 'lucide-react';
import { softwareProducts } from '../data/portfolio';

function Projects() {
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = ['all', ...new Set(softwareProducts.map(p => p.category))];
  const statuses = ['all', 'complete', 'shipping', 'mvp', 'functional', 'spec'];

  const filteredProducts = softwareProducts.filter(p => {
    const statusMatch = filter === 'all' || p.status === filter;
    const categoryMatch = categoryFilter === 'all' || p.category === categoryFilter;
    return statusMatch && categoryMatch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete':
      case 'shipping':
        return 'status-complete';
      case 'mvp':
      case 'functional':
        return 'status-progress';
      default:
        return 'status-pending';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
      case 'shipping':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'mvp':
      case 'functional':
        return <Rocket className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const totalValue = filteredProducts.reduce((acc, p) => ({
    min: acc.min + p.valueMin,
    max: acc.max + p.valueMax
  }), { min: 0, max: 0 });

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Software Projects</h1>
          <p className="text-gray-400">Complete inventory of all software IP</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Portfolio Value</p>
          <p className="text-2xl font-bold text-green-400">
            ${(totalValue.min / 1000).toFixed(0)}K - ${(totalValue.max / 1000).toFixed(0)}K
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Status:</span>
            <div className="flex gap-2">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    filter === status
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Category:</span>
            <div className="flex gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    categoryFilter === cat
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="card p-6 hover:glow-purple transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Code2 className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.category}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(product.status)}`}>
                {getStatusIcon(product.status)}
                <span className="text-xs font-medium">{product.stage}</span>
              </div>
            </div>

            <p className="text-gray-400 mb-4">{product.description}</p>

            {/* Tech Stack */}
            <div className="flex flex-wrap gap-2 mb-4">
              {product.tech?.map((tech) => (
                <span key={tech} className="px-2 py-1 text-xs rounded bg-white/10 text-gray-300">
                  {tech}
                </span>
              ))}
            </div>

            {/* Features count if available */}
            {product.features && (
              <div className="mb-4 text-sm text-gray-400">
                <span className="text-purple-400 font-semibold">{product.features}</span> features/pages built
              </div>
            )}

            {/* Value & Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div>
                <p className="text-xs text-gray-500">Estimated Value</p>
                <p className="text-lg font-bold text-green-400">
                  ${(product.valueMin / 1000).toFixed(0)}K - ${(product.valueMax / 1000).toFixed(0)}K
                </p>
              </div>
              <div className="flex items-center gap-2">
                {product.patentable && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                    <Shield className="w-3 h-3" />
                    <span className="text-xs">Patentable</span>
                  </div>
                )}
                {product.github && (
                  <a
                    href={`https://github.com/${product.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Github className="w-4 h-4 text-gray-400" />
                  </a>
                )}
              </div>
            </div>

            {/* Priority Badge */}
            {product.priority === 'critical' && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-400 font-medium">
                  CRITICAL PRIORITY - High-value IP requiring immediate attention
                </p>
              </div>
            )}
            {product.priority === 'high' && (
              <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-xs text-yellow-400 font-medium">
                  HIGH PRIORITY - Ready for deployment
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-white">{softwareProducts.length}</p>
          <p className="text-sm text-gray-400">Total Projects</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-400">
            {softwareProducts.filter(p => p.status === 'complete' || p.status === 'shipping').length}
          </p>
          <p className="text-sm text-gray-400">Ready to Ship</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">
            {softwareProducts.filter(p => p.patentable).length}
          </p>
          <p className="text-sm text-gray-400">Patentable</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">
            {new Set(softwareProducts.flatMap(p => p.tech || [])).size}
          </p>
          <p className="text-sm text-gray-400">Technologies</p>
        </div>
      </div>
    </div>
  );
}

export default Projects;
