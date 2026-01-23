import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  ArrowRight,
  Zap,
  Target,
  Bot,
  Send,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  X,
  Plus,
  RefreshCw,
  ExternalLink,
  Brain,
  Sparkles,
  Calendar,
  Users,
  FolderKanban,
  MessageSquare,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { actionItems as staticActionItems, aiAgents } from '../data/portfolio';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

function Actions() {
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedTask, setExpandedTask] = useState(null);
  const [actionItems, setActionItems] = useState(staticActionItems);
  const [loading, setLoading] = useState({});
  const [aiResponse, setAiResponse] = useState({});

  // Platform data
  const [taskadeProjects, setTaskadeProjects] = useState([]);
  const [niftyProjects, setNiftyProjects] = useState([]);
  const [commandCenterAgents, setCommandCenterAgents] = useState([]);

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [showPushModal, setShowPushModal] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [taskNote, setTaskNote] = useState('');

  const priorities = ['all', 'critical', 'high', 'medium'];
  const categories = ['all', ...new Set(actionItems.map(a => a.category))];

  useEffect(() => {
    loadPlatformData();
  }, []);

  const loadPlatformData = async () => {
    // Load Taskade projects
    try {
      const res = await fetch(`${API_URL}/api/taskade/workspaces`);
      if (res.ok) {
        const data = await res.json();
        const allProjects = [];
        for (const ws of (data.items || []).slice(0, 3)) {
          try {
            const projRes = await fetch(`${API_URL}/api/taskade/workspaces/${ws.id}/projects`);
            if (projRes.ok) {
              const projData = await projRes.json();
              allProjects.push(...(projData.items || []).map(p => ({
                ...p,
                workspaceName: ws.name,
                platform: 'taskade'
              })));
            }
          } catch (e) {}
        }
        setTaskadeProjects(allProjects);
      }
    } catch (e) {
      console.log('Could not load Taskade projects');
    }

    // Load Nifty projects
    try {
      const res = await fetch(`${API_URL}/api/nifty/projects`);
      if (res.ok) {
        const data = await res.json();
        setNiftyProjects((data.projects || data || []).map(p => ({
          ...p,
          platform: 'nifty'
        })));
      }
    } catch (e) {
      console.log('Could not load Nifty projects');
    }

    // Load Command Center agents
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      if (res.ok) {
        const data = await res.json();
        setCommandCenterAgents(data.agents || []);
      }
    } catch (e) {
      console.log('Could not load agents');
    }
  };

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

  // ========== ACTION HANDLERS ==========

  const handleMarkComplete = async (task) => {
    setLoading(prev => ({ ...prev, [task.id]: 'complete' }));

    // Update local state
    setActionItems(prev => prev.map(a =>
      a.id === task.id ? { ...a, status: 'complete' } : a
    ));

    // Sync to platforms if task was pushed there
    if (task.taskadeId) {
      try {
        await fetch(`${API_URL}/api/sync/task/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'taskade', taskId: task.taskadeId })
        });
      } catch (e) {}
    }

    if (task.niftyId) {
      try {
        await fetch(`${API_URL}/api/sync/task/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'nifty', taskId: task.niftyId })
        });
      } catch (e) {}
    }

    setLoading(prev => ({ ...prev, [task.id]: null }));
  };

  const handleStartTask = async (task) => {
    setLoading(prev => ({ ...prev, [task.id]: 'start' }));

    setActionItems(prev => prev.map(a =>
      a.id === task.id ? { ...a, status: 'in-progress' } : a
    ));

    setLoading(prev => ({ ...prev, [task.id]: null }));
    setExpandedTask(task.id);
  };

  const handleAssignToAgent = async (task, agent) => {
    setLoading(prev => ({ ...prev, [task.id]: 'assign' }));

    try {
      // Create a task for the agent
      const response = await fetch(`${API_URL}/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `I'm assigning you this task: "${task.task}". ${task.impact}. Please acknowledge and let me know how you'll approach this.`,
          userId: 'sv'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiResponse(prev => ({ ...prev, [task.id]: data.response }));

        // Update task with assigned agent
        setActionItems(prev => prev.map(a =>
          a.id === task.id ? { ...a, assignedAgent: agent, status: 'in-progress' } : a
        ));
      }
    } catch (e) {
      console.error('Failed to assign to agent:', e);
    }

    setLoading(prev => ({ ...prev, [task.id]: null }));
    setShowAssignModal(null);
  };

  const handlePushToPlatform = async (task, project) => {
    setLoading(prev => ({ ...prev, [task.id]: 'push' }));

    try {
      if (project.platform === 'taskade') {
        const response = await fetch(`${API_URL}/api/taskade/projects/${project.id}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `${task.task}\n\n${task.impact}\n\nPriority: ${task.priority}\nTimeframe: ${task.timeframe}`,
            placement: 'beforeend'
          })
        });

        if (response.ok) {
          const data = await response.json();
          setActionItems(prev => prev.map(a =>
            a.id === task.id ? { ...a, taskadeId: data.id, taskadeProject: project.name } : a
          ));

          // Trigger sync
          await fetch(`${API_URL}/api/sync/task/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: 'taskade',
              projectId: project.id,
              task: { id: data.id, title: task.task }
            })
          });
        }
      } else if (project.platform === 'nifty') {
        const response = await fetch(`${API_URL}/api/nifty/projects/${project.id}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: task.task,
            description: `${task.impact}\n\nPriority: ${task.priority}\nTimeframe: ${task.timeframe}`
          })
        });

        if (response.ok) {
          const data = await response.json();
          setActionItems(prev => prev.map(a =>
            a.id === task.id ? { ...a, niftyId: data.id, niftyProject: project.name } : a
          ));
        }
      }
    } catch (e) {
      console.error('Failed to push to platform:', e);
    }

    setLoading(prev => ({ ...prev, [task.id]: null }));
    setShowPushModal(null);
  };

  const handleAIAction = async (task, action) => {
    setLoading(prev => ({ ...prev, [task.id]: action }));

    const prompts = {
      breakdown: `Break down this task into 3-5 actionable subtasks: "${task.task}". Context: ${task.impact}`,
      research: `Research what's needed to complete this task: "${task.task}". Provide key information, requirements, and resources.`,
      draft: `Draft a plan or initial content for this task: "${task.task}". Context: ${task.impact}`,
      prioritize: `Given this is a ${task.priority} priority task due ${task.timeframe}, what should I focus on first? Task: "${task.task}"`
    };

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompts[action],
          userId: 'sv'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiResponse(prev => ({ ...prev, [task.id]: data.response }));
      }
    } catch (e) {
      console.error('AI action failed:', e);
    }

    setLoading(prev => ({ ...prev, [task.id]: null }));
  };

  const criticalCount = actionItems.filter(a => a.priority === 'critical').length;
  const highCount = actionItems.filter(a => a.priority === 'high').length;
  const completedCount = actionItems.filter(a => a.status === 'complete').length;
  const inProgressCount = actionItems.filter(a => a.status === 'in-progress').length;

  // All available agents (Taskade + Command Center)
  const allAgents = [
    ...aiAgents.map(a => ({ ...a, source: 'taskade' })),
    ...commandCenterAgents.map(a => ({ ...a, source: 'command-center' }))
  ];

  // All available projects
  const allProjects = [...taskadeProjects, ...niftyProjects];

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Action Items</h1>
          <p className="text-gray-400">Click any task to take action - assign, push, or let AI help</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadPlatformData}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400"
          >
            <RefreshCw className="w-4 h-4" />
            Sync
          </button>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <p className="text-3xl font-bold text-cyan-400">{inProgressCount}</p>
          <p className="text-sm text-gray-400">In Progress</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{completedCount}</p>
          <p className="text-sm text-gray-400">Completed</p>
        </div>
      </div>

      {/* Platform Status */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-400">Connected:</span>
        <span className={`flex items-center gap-1 ${taskadeProjects.length > 0 ? 'text-green-400' : 'text-gray-500'}`}>
          <FolderKanban className="w-4 h-4" />
          Taskade ({taskadeProjects.length} projects)
        </span>
        <span className={`flex items-center gap-1 ${niftyProjects.length > 0 ? 'text-green-400' : 'text-gray-500'}`}>
          <Calendar className="w-4 h-4" />
          Nifty ({niftyProjects.length} projects)
        </span>
        <span className={`flex items-center gap-1 ${allAgents.length > 0 ? 'text-purple-400' : 'text-gray-500'}`}>
          <Bot className="w-4 h-4" />
          {allAgents.length} AI Agents
        </span>
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
        {filteredActions.map((task) => (
          <div
            key={task.id}
            className={`card border ${getPriorityColor(task.priority)} transition-all duration-300`}
          >
            {/* Task Header */}
            <div
              className="p-6 cursor-pointer hover:bg-white/5"
              onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  task.priority === 'critical' ? 'bg-red-500/20' :
                  task.priority === 'high' ? 'bg-yellow-500/20' :
                  'bg-blue-500/20'
                }`}>
                  {task.status === 'complete' ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : task.status === 'in-progress' ? (
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  ) : (
                    getPriorityIcon(task.priority)
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white text-lg">{task.task}</h3>
                      <p className="text-sm text-gray-500">{task.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.assignedAgent && (
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400 flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          {task.assignedAgent.name}
                        </span>
                      )}
                      {task.taskadeProject && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
                          Taskade
                        </span>
                      )}
                      {task.niftyProject && (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                          Nifty
                        </span>
                      )}
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                        task.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                        task.status === 'in-progress' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {task.status}
                      </span>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                        task.priority === 'critical' ? 'bg-red-500/30 text-red-300' :
                        task.priority === 'high' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-blue-500/30 text-blue-300'
                      }`}>
                        {task.priority}
                      </span>
                      {expandedTask === task.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  <p className="text-gray-400 mb-2">{task.impact}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{task.timeframe}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Action Panel */}
            {expandedTask === task.id && (
              <div className="border-t border-white/10 p-6 bg-white/5">
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3 mb-6">
                  {task.status !== 'complete' && (
                    <>
                      <button
                        onClick={() => handleMarkComplete(task)}
                        disabled={loading[task.id]}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                      >
                        {loading[task.id] === 'complete' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Mark Complete
                      </button>

                      <button
                        onClick={() => setShowAssignModal(task.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors"
                      >
                        <Bot className="w-4 h-4" />
                        Assign to AI Agent
                      </button>

                      <button
                        onClick={() => setShowPushModal(task.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Push to Platform
                      </button>

                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleStartTask(task)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Start Working
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* AI Actions */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    AI Actions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAIAction(task, 'breakdown')}
                      disabled={loading[task.id]}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 text-sm disabled:opacity-50"
                    >
                      {loading[task.id] === 'breakdown' && <Loader2 className="w-3 h-3 animate-spin" />}
                      Break Down
                    </button>
                    <button
                      onClick={() => handleAIAction(task, 'research')}
                      disabled={loading[task.id]}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 text-sm disabled:opacity-50"
                    >
                      {loading[task.id] === 'research' && <Loader2 className="w-3 h-3 animate-spin" />}
                      Research
                    </button>
                    <button
                      onClick={() => handleAIAction(task, 'draft')}
                      disabled={loading[task.id]}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 text-sm disabled:opacity-50"
                    >
                      {loading[task.id] === 'draft' && <Loader2 className="w-3 h-3 animate-spin" />}
                      Draft Plan
                    </button>
                    <button
                      onClick={() => handleAIAction(task, 'prioritize')}
                      disabled={loading[task.id]}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 text-sm disabled:opacity-50"
                    >
                      {loading[task.id] === 'prioritize' && <Loader2 className="w-3 h-3 animate-spin" />}
                      Prioritize
                    </button>
                  </div>
                </div>

                {/* AI Response */}
                {aiResponse[task.id] && (
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 mb-6">
                    <div className="flex items-start gap-3">
                      <Brain className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-purple-400 mb-2">AI Response</h4>
                        <div className="text-sm text-gray-300 whitespace-pre-wrap">
                          {aiResponse[task.id]}
                        </div>
                      </div>
                      <button
                        onClick={() => setAiResponse(prev => ({ ...prev, [task.id]: null }))}
                        className="text-gray-500 hover:text-gray-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Synced Locations */}
                {(task.taskadeProject || task.niftyProject) && (
                  <div className="text-sm text-gray-400">
                    <span className="font-medium">Synced to: </span>
                    {task.taskadeProject && <span className="text-blue-400">Taskade ({task.taskadeProject})</span>}
                    {task.taskadeProject && task.niftyProject && <span> | </span>}
                    {task.niftyProject && <span className="text-green-400">Nifty ({task.niftyProject})</span>}
                  </div>
                )}
              </div>
            )}

            {/* Assign to Agent Modal */}
            {showAssignModal === task.id && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(null)}>
                <div className="bg-[#0a0a0f] border border-purple-900/30 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-400" />
                    Assign to AI Agent
                  </h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {allAgents.map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => handleAssignToAgent(task, agent)}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${agent.source === 'taskade' ? 'bg-blue-500/20' : 'bg-purple-500/20'}`}>
                            <Bot className={`w-4 h-4 ${agent.source === 'taskade' ? 'text-blue-400' : 'text-purple-400'}`} />
                          </div>
                          <div className="text-left">
                            <p className="text-white font-medium">{agent.name}</p>
                            <p className="text-xs text-gray-500">{agent.role || agent.specialization}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">{agent.source}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowAssignModal(null)}
                    className="mt-4 w-full py-2 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Push to Platform Modal */}
            {showPushModal === task.id && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPushModal(null)}>
                <div className="bg-[#0a0a0f] border border-purple-900/30 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-blue-400" />
                    Push to Platform
                  </h3>
                  {allProjects.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No projects available. Connect Taskade or Nifty first.</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {allProjects.map(project => (
                        <button
                          key={`${project.platform}-${project.id}`}
                          onClick={() => handlePushToPlatform(task, project)}
                          disabled={loading[task.id] === 'push'}
                          className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${project.platform === 'taskade' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                              <FolderKanban className={`w-4 h-4 ${project.platform === 'taskade' ? 'text-blue-400' : 'text-green-400'}`} />
                            </div>
                            <div className="text-left">
                              <p className="text-white font-medium">{project.name}</p>
                              {project.workspaceName && (
                                <p className="text-xs text-gray-500">{project.workspaceName}</p>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            project.platform === 'taskade' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {project.platform}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowPushModal(null)}
                    className="mt-4 w-full py-2 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Execution Roadmap */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Execution Roadmap</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <h4 className="text-sm font-semibold text-red-400 mb-2">Week 1 - Critical</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              {actionItems.filter(a => a.priority === 'critical' && a.status !== 'complete').slice(0, 3).map(a => (
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
              {actionItems.filter(a => a.priority === 'high' && a.status !== 'complete').slice(0, 3).map(a => (
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
              {actionItems.filter(a => a.priority === 'medium' && a.status !== 'complete').slice(0, 3).map(a => (
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
