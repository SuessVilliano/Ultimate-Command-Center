import React, { useState } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  ArrowRight,
  Zap,
  Target
} from 'lucide-react';
import { actionItems } from '../data/portfolio';

function Actions() {
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const priorities = ['all', 'critical', 'high', 'medium'];
  const categories = ['all', ...new Set(actionItems.map(a => a.category))];

  const filteredActions = actionItems.filter(a => {
    const priorityMatch = filter === 'all' || a.priority === filter;
    const categoryMatch = categoryFilter === 'all' || a.category === categoryFilter;
    return priorityMatch && categoryMatch;
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'high':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'medium':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'high':
        return <Zap className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const criticalCount = actionItems.filter(a => a.priority === 'critical').length;
  const highCount = actionItems.filter(a => a.priority === 'high').length;
  const completedCount = actionItems.filter(a => a.status === 'complete').length;

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Action Items</h1>
          <p className="text-gray-400">Priority tasks for institutional readiness</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <span className="text-red-400 text-sm font-medium">
              {criticalCount} Critical
            </span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <span className="text-yellow-400 text-sm font-medium">
              {highCount} High Priority
            </span>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-white">{actionItems.length}</p>
          <p className="text-sm text-gray-400">Total Actions</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-red-400">{criticalCount}</p>
          <p className="text-sm text-gray-400">Critical</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{highCount}</p>
          <p className="text-sm text-gray-400">High Priority</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{completedCount}</p>
          <p className="text-sm text-gray-400">Completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Priority:</span>
            <div className="flex gap-2">
              {priorities.map((priority) => (
                <button
                  key={priority}
                  onClick={() => setFilter(priority)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    filter === priority
                      ? priority === 'critical' ? 'bg-red-600 text-white' :
                        priority === 'high' ? 'bg-yellow-600 text-white' :
                        'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Category:</span>
            <div className="flex gap-2 flex-wrap">
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

      {/* Action Items List */}
      <div className="space-y-4">
        {filteredActions.map((action) => (
          <div
            key={action.id}
            className={`card p-6 border ${getPriorityColor(action.priority)} transition-all duration-300 hover:scale-[1.01]`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${
                action.priority === 'critical' ? 'bg-red-500/20' :
                action.priority === 'high' ? 'bg-yellow-500/20' :
                'bg-blue-500/20'
              }`}>
                {action.status === 'complete' ? (
                  <CheckCircle2 className={`w-6 h-6 ${
                    action.priority === 'critical' ? 'text-red-400' :
                    action.priority === 'high' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`} />
                ) : (
                  getPriorityIcon(action.priority)
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-white text-lg">{action.task}</h3>
                    <p className="text-sm text-gray-500">{action.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                      action.status === 'complete' ? 'status-complete' :
                      action.status === 'in-progress' ? 'status-progress' :
                      'status-pending'
                    }`}>
                      {action.status}
                    </span>
                    <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                      action.priority === 'critical' ? 'bg-red-500/30 text-red-300' :
                      action.priority === 'high' ? 'bg-yellow-500/30 text-yellow-300' :
                      'bg-blue-500/30 text-blue-300'
                    }`}>
                      {action.priority}
                    </span>
                  </div>
                </div>
                <p className="text-gray-400 mb-4">{action.impact}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{action.timeframe}</span>
                  </div>
                  {action.status !== 'complete' && (
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors">
                      <span className="text-sm font-medium">Start Task</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Execution Roadmap</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <h4 className="text-sm font-semibold text-red-400 mb-2">Week 1 - Critical</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              {actionItems.filter(a => a.priority === 'critical').slice(0, 3).map(a => (
                <li key={a.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  {a.task}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <h4 className="text-sm font-semibold text-yellow-400 mb-2">Week 2-3 - High</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              {actionItems.filter(a => a.priority === 'high').slice(0, 3).map(a => (
                <li key={a.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                  {a.task}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Week 4+ - Medium</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              {actionItems.filter(a => a.priority === 'medium').slice(0, 3).map(a => (
                <li key={a.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  {a.task}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Actions;
