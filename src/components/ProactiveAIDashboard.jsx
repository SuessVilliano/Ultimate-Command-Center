/**
 * Proactive AI Dashboard Component
 *
 * Displays AI-detected issues, suggestions, and allows users to:
 * - View proactive AI status
 * - See detected issues across platforms
 * - Review and execute AI suggestions
 * - Trigger manual checks
 * - Monitor cross-platform events
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  AlertTriangle,
  Lightbulb,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Link2,
  Settings,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Workflow
} from 'lucide-react';
import { API_URL } from '../config';

export default function ProactiveAIDashboard({ isDark = true }) {
  const [proactiveState, setProactiveState] = useState(null);
  const [eventBusStatus, setEventBusStatus] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(null);
  const [expanded, setExpanded] = useState({
    issues: true,
    suggestions: true,
    events: false,
    workflows: false
  });
  const [actionPlan, setActionPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Generate local insights when backend is unavailable
  const generateLocalInsights = () => {
    const hour = new Date().getHours();
    const detectedIssues = [];
    const suggestions = [];

    // Check localStorage data
    const actionItemsRaw = localStorage.getItem('liv8_action_items');
    const goalsRaw = localStorage.getItem('liv8_user_goals');
    const reposRaw = localStorage.getItem('liv8_github_repos');
    const geminiKey = localStorage.getItem('liv8_gemini_api_key');
    const taskadeKey = localStorage.getItem('liv8_taskade_api_key');

    let actionItems = [];
    try { actionItems = actionItemsRaw ? JSON.parse(actionItemsRaw) : []; } catch { /* */ }

    let goals = [];
    try { goals = goalsRaw ? JSON.parse(goalsRaw) : []; } catch { /* */ }

    let repos = [];
    try { repos = reposRaw ? JSON.parse(reposRaw) : []; } catch { /* */ }

    // Check for stale tasks (older than 3 days)
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    const staleTasks = actionItems.filter(item => {
      const created = new Date(item.createdAt || item.created || item.date || 0).getTime();
      return created > 0 && created < threeDaysAgo && item.status !== 'completed' && item.status !== 'done';
    });

    if (staleTasks.length > 0) {
      detectedIssues.push({
        type: 'stale_tasks',
        platform: 'local',
        priority: 'medium',
        message: `${staleTasks.length} action item${staleTasks.length > 1 ? 's are' : ' is'} overdue (older than 3 days)`
      });
    }

    // Check for missing integrations
    if (!geminiKey) {
      detectedIssues.push({
        type: 'missing_integration',
        platform: 'local',
        priority: 'high',
        message: 'No Gemini API key configured - AI features limited'
      });
    }

    if (!taskadeKey) {
      detectedIssues.push({
        type: 'missing_integration',
        platform: 'local',
        priority: 'low',
        message: 'No Taskade API key configured - task sync unavailable'
      });
    }

    // Pending action items suggestion
    const pendingItems = actionItems.filter(item => item.status !== 'completed' && item.status !== 'done');
    if (pendingItems.length > 0) {
      suggestions.push({
        title: `Review your ${pendingItems.length} pending action item${pendingItems.length > 1 ? 's' : ''}`,
        description: 'Stay on top of your tasks by reviewing and prioritizing pending items.',
        type: 'productivity',
        priority: 'medium',
        autoExecutable: false
      });
    }

    // Time-based suggestions
    if (hour < 12) {
      suggestions.push({
        title: "It's morning - set your top 3 priorities for today",
        description: 'Starting with clear priorities helps you focus on what matters most.',
        type: 'planning',
        priority: 'medium',
        autoExecutable: false
      });
    } else if (hour >= 12 && hour < 17) {
      suggestions.push({
        title: 'Afternoon check-in - review your progress',
        description: 'Take a moment to assess what you have accomplished and adjust your plan.',
        type: 'productivity',
        priority: 'low',
        autoExecutable: false
      });
    } else if (hour >= 17) {
      suggestions.push({
        title: 'End of day - review what you accomplished and plan tomorrow',
        description: 'Reflect on your wins and set yourself up for a productive morning.',
        type: 'review',
        priority: 'medium',
        autoExecutable: false
      });
    }

    // GitHub repos suggestion
    if (repos.length > 0) {
      suggestions.push({
        title: `You have ${repos.length} GitHub repo${repos.length > 1 ? 's' : ''} - check for any that need attention`,
        description: 'Review open issues, pull requests, and recent activity across your repositories.',
        type: 'code',
        priority: 'low',
        autoExecutable: false
      });
    }

    // Active goals suggestion
    const activeGoals = goals.filter(g => g.status === 'active');
    if (activeGoals.length > 0) {
      suggestions.push({
        title: `You have ${activeGoals.length} active goal${activeGoals.length > 1 ? 's' : ''} - track your progress`,
        description: activeGoals.map(g => g.text || g.name || g.title).join(', '),
        type: 'planning',
        priority: 'medium',
        autoExecutable: false
      });
    }

    return {
      isRunning: false,
      lastCheck: new Date().toISOString(),
      detectedIssues,
      suggestions,
      source: 'local'
    };
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [stateRes, eventsRes, workflowsRes] = await Promise.all([
        fetch(`${API_URL}/api/proactive/state`),
        fetch(`${API_URL}/api/events/status`),
        fetch(`${API_URL}/api/workflows/templates`)
      ]);

      if (stateRes.ok) {
        setProactiveState(await stateRes.json());
      }
      if (eventsRes.ok) {
        setEventBusStatus(await eventsRes.json());
      }
      if (workflowsRes.ok) {
        const data = await workflowsRes.json();
        setWorkflows(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch proactive data:', error);
      // Backend unavailable - generate local insights instead
      const localState = generateLocalInsights();
      setProactiveState(localState);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Trigger manual check
  const triggerCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/proactive/check`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Execute a suggestion
  const executeSuggestion = async (index) => {
    setExecuting(index);
    try {
      const res = await fetch(`${API_URL}/api/proactive/execute-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIndex: index })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Execute failed:', error);
    } finally {
      setExecuting(null);
    }
  };

  // Execute a workflow
  const executeWorkflow = async (templateId) => {
    setExecuting(templateId);
    try {
      const res = await fetch(`${API_URL}/api/workflows/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Workflow failed:', error);
    } finally {
      setExecuting(null);
    }
  };

  // Get action plan
  const getActionPlan = async () => {
    setLoadingPlan(true);
    try {
      const res = await fetch(`${API_URL}/api/proactive/plan`);
      if (res.ok) {
        setActionPlan(await res.json());
      }
    } catch (error) {
      console.error('Failed to get plan:', error);
    } finally {
      setLoadingPlan(false);
    }
  };

  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-500 bg-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/20';
      case 'medium': return 'text-yellow-500 bg-yellow-500/20';
      case 'low': return 'text-green-500 bg-green-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'taskade': return '📋';
      case 'nifty': return '📊';
      case 'taskmagic': return '🤖';
      case 'freshdesk': return '🎫';
      default: return '📦';
    }
  };

  if (loading && !proactiveState) {
    return (
      <div className={`p-6 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading proactive AI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${proactiveState?.isRunning ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
              <Brain className={`w-6 h-6 ${proactiveState?.isRunning ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Proactive AI Engine
              </h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {proactiveState?.isRunning ? 'Monitoring all platforms' : 'Engine stopped'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={getActionPlan}
              disabled={loadingPlan}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isDark ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'
              } text-white`}
            >
              {loadingPlan ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
              Get Action Plan
            </button>
            <button
              onClick={triggerCheck}
              disabled={loading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
              } text-white`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Check Now
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Issues</span>
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {proactiveState?.detectedIssues?.length || 0}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white'}`}>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Suggestions</span>
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {proactiveState?.suggestions?.length || 0}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white'}`}>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Events</span>
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {eventBusStatus?.historySize || 0}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white'}`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Last Check</span>
            </div>
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {proactiveState?.lastCheck
                ? new Date(proactiveState.lastCheck).toLocaleTimeString()
                : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Action Plan Modal */}
      {actionPlan && (
        <div className={`p-4 rounded-xl ${isDark ? 'bg-purple-900/30 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
              AI Action Plan
            </h3>
            <button
              onClick={() => setActionPlan(null)}
              className={`p-1 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
            <pre className={`whitespace-pre-wrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {actionPlan.plan}
            </pre>
          </div>
          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Based on {actionPlan.basedOn?.issueCount || 0} issues and {actionPlan.basedOn?.suggestionCount || 0} suggestions
          </p>
        </div>
      )}

      {/* Detected Issues */}
      <div className={`rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <button
          onClick={() => toggleSection('issues')}
          className={`w-full flex items-center justify-between p-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-t-xl`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Detected Issues ({proactiveState?.detectedIssues?.length || 0})
            </span>
          </div>
          {expanded.issues ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expanded.issues && (
          <div className="p-4 pt-0 space-y-2">
            {proactiveState?.detectedIssues?.length > 0 ? (
              proactiveState.detectedIssues.map((issue, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white'} border-l-4 ${
                    issue.priority === 'critical' ? 'border-red-500' :
                    issue.priority === 'high' ? 'border-orange-500' :
                    issue.priority === 'medium' ? 'border-yellow-500' : 'border-green-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{getPlatformIcon(issue.platform)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {issue.type}
                        </span>
                      </div>
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {issue.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No issues detected</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Suggestions */}
      <div className={`rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <button
          onClick={() => toggleSection('suggestions')}
          className={`w-full flex items-center justify-between p-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-t-xl`}
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              AI Suggestions ({proactiveState?.suggestions?.length || 0})
            </span>
          </div>
          {expanded.suggestions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expanded.suggestions && (
          <div className="p-4 pt-0 space-y-2">
            {proactiveState?.suggestions?.length > 0 ? (
              proactiveState.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(suggestion.priority)}`}>
                          {suggestion.priority}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                          {suggestion.type}
                        </span>
                        {suggestion.autoExecutable && (
                          <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                            Auto-executable
                          </span>
                        )}
                      </div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {suggestion.title}
                      </p>
                      <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {suggestion.description}
                      </p>
                      {suggestion.platforms && (
                        <div className="flex items-center gap-1 mt-2">
                          {suggestion.platforms.map(p => (
                            <span key={p} className="text-sm">{getPlatformIcon(p)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => executeSuggestion(index)}
                      disabled={executing === index}
                      className={`ml-3 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                        isDark ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                      } text-white text-sm`}
                    >
                      {executing === index ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Execute
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Brain className="w-8 h-8 mx-auto mb-2" />
                <p>No suggestions yet. Run a check to generate recommendations.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflows */}
      <div className={`rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <button
          onClick={() => toggleSection('workflows')}
          className={`w-full flex items-center justify-between p-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-t-xl`}
        >
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-purple-400" />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Quick Workflows ({workflows.length})
            </span>
          </div>
          {expanded.workflows ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expanded.workflows && (
          <div className="p-4 pt-0 space-y-2">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {workflow.name}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {workflow.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        {workflow.stepCount} steps
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        {workflow.trigger}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => executeWorkflow(workflow.id)}
                    disabled={executing === workflow.id}
                    className={`ml-3 flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                      isDark ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'
                    } text-white text-sm`}
                  >
                    {executing === workflow.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div className={`rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
        <button
          onClick={() => toggleSection('events')}
          className={`w-full flex items-center justify-between p-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-t-xl`}
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-400" />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Cross-Platform Events
            </span>
          </div>
          {expanded.events ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {expanded.events && (
          <div className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className={`p-2 rounded ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Handlers</p>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {eventBusStatus?.handlerCount || 0}
                </p>
              </div>
              <div className={`p-2 rounded ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Chains</p>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {eventBusStatus?.enabledChains || 0} / {eventBusStatus?.chainCount || 0}
                </p>
              </div>
              <div className={`p-2 rounded ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>History</p>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {eventBusStatus?.historySize || 0}
                </p>
              </div>
            </div>

            {eventBusStatus?.recentEvents?.length > 0 && (
              <div className="space-y-1">
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-2`}>Recent Events:</p>
                {eventBusStatus.recentEvents.slice(-5).reverse().map((event, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 rounded text-sm ${isDark ? 'bg-white/5' : 'bg-white'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{getPlatformIcon(event.source)}</span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{event.type}</span>
                    </div>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
