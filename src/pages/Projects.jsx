import React, { useState, useEffect } from 'react';
import {
  Code2,
  ExternalLink,
  Github,
  Shield,
  CheckCircle2,
  Clock,
  Rocket,
  Filter,
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
  Brain,
  RefreshCw,
  FileText,
  BarChart2,
  TrendingUp,
  AlertCircle,
  Loader2,
  Download,
  Eye
} from 'lucide-react';
import { softwareProducts as defaultProducts } from '../data/portfolio';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

function Projects() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // AI Analysis states
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState({});
  const [reportData, setReportData] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'fintech',
    status: 'spec',
    stage: 'Specification',
    tech: [],
    valueMin: 0,
    valueMax: 0,
    github: '',
    patentable: false,
    features: 0,
    priority: 'medium'
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/projects`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || defaultProducts);
      } else {
        setProjects(defaultProducts);
      }
    } catch (e) {
      console.log('Using default projects');
      setProjects(defaultProducts);
    }
    setLoading(false);
  };

  const categories = ['all', ...new Set(projects.map(p => p.category))];
  const statuses = ['all', 'complete', 'shipping', 'mvp', 'functional', 'spec'];

  const filteredProducts = projects.filter(p => {
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
    min: acc.min + (p.valueMin || 0),
    max: acc.max + (p.valueMax || 0)
  }), { min: 0, max: 0 });

  // CRUD Operations
  const handleAddProject = async () => {
    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const newProject = await response.json();
        setProjects(prev => [...prev, { ...formData, id: newProject.id || Date.now() }]);
        setShowAddModal(false);
        resetForm();
      }
    } catch (e) {
      // Add locally if server fails
      setProjects(prev => [...prev, { ...formData, id: Date.now() }]);
      setShowAddModal(false);
      resetForm();
    }
  };

  const handleUpdateProject = async (projectId) => {
    try {
      await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } catch (e) {
      console.log('Server update failed, updating locally');
    }

    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, ...formData } : p
    ));
    setShowEditModal(null);
    resetForm();
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.log('Server delete failed, removing locally');
    }

    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'fintech',
      status: 'spec',
      stage: 'Specification',
      tech: [],
      valueMin: 0,
      valueMax: 0,
      github: '',
      patentable: false,
      features: 0,
      priority: 'medium'
    });
  };

  // AI Analysis
  const analyzeProject = async (project) => {
    setAnalyzing(true);
    setShowAnalysisModal(project.id);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Analyze this software project and provide:
1. Market Analysis: Target market, competition, market size
2. Technical Assessment: Code quality indicators, tech stack evaluation
3. Business Potential: Revenue streams, scaling opportunities
4. Risk Assessment: Technical debt risks, market risks
5. Recommendations: Next steps, priority actions

Project: ${project.name}
Description: ${project.description}
Category: ${project.category}
Tech Stack: ${project.tech?.join(', ')}
Status: ${project.status} - ${project.stage}
Current Valuation: $${project.valueMin} - $${project.valueMax}
Features: ${project.features || 'N/A'}
Patentable: ${project.patentable ? 'Yes' : 'No'}

Provide specific, actionable insights with real data where possible.`,
          userId: 'sv'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysisResults(prev => ({
          ...prev,
          [project.id]: {
            content: data.response,
            timestamp: new Date().toISOString()
          }
        }));
      }
    } catch (e) {
      setAnalysisResults(prev => ({
        ...prev,
        [project.id]: {
          content: 'Analysis failed. Please check your AI configuration.',
          error: true
        }
      }));
    }

    setAnalyzing(false);
  };

  // Generate Portfolio Report
  const generatePortfolioReport = async () => {
    setGeneratingReport(true);
    setShowReportModal(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Generate a comprehensive portfolio analysis report for these software projects:

${projects.map(p => `
- ${p.name} (${p.category})
  Status: ${p.status}
  Tech: ${p.tech?.join(', ')}
  Value: $${p.valueMin}-$${p.valueMax}
  Patentable: ${p.patentable ? 'Yes' : 'No'}
`).join('\n')}

Total Portfolio Value: $${totalValue.min.toLocaleString()} - $${totalValue.max.toLocaleString()}
Total Projects: ${projects.length}
Shipping/Complete: ${projects.filter(p => ['complete', 'shipping'].includes(p.status)).length}
Patentable IP: ${projects.filter(p => p.patentable).length}

Include:
1. Executive Summary
2. Portfolio Health Score (1-100)
3. Top 3 High-Value Opportunities
4. Critical Action Items
5. Market Position Analysis
6. Revenue Projection (conservative/aggressive)
7. Technology Stack Assessment
8. IP Protection Strategy
9. Recommended Next Steps

Be specific with numbers and actionable recommendations.`,
          userId: 'sv'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReportData({
          content: data.response,
          timestamp: new Date().toISOString(),
          metrics: {
            totalProjects: projects.length,
            totalValue: totalValue,
            completedProjects: projects.filter(p => ['complete', 'shipping'].includes(p.status)).length,
            patentableIP: projects.filter(p => p.patentable).length,
            categories: [...new Set(projects.map(p => p.category))].length
          }
        });
      }
    } catch (e) {
      setReportData({
        content: 'Report generation failed. Please check your AI configuration.',
        error: true
      });
    }

    setGeneratingReport(false);
  };

  const downloadReport = () => {
    if (!reportData) return;

    const report = `
PORTFOLIO ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}
=====================================

METRICS:
- Total Projects: ${reportData.metrics?.totalProjects}
- Portfolio Value: $${reportData.metrics?.totalValue?.min?.toLocaleString()} - $${reportData.metrics?.totalValue?.max?.toLocaleString()}
- Completed/Shipping: ${reportData.metrics?.completedProjects}
- Patentable IP: ${reportData.metrics?.patentableIP}
- Categories: ${reportData.metrics?.categories}

=====================================
ANALYSIS:
${reportData.content}
=====================================
    `;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Project Form Modal
  const ProjectFormModal = ({ title, onSubmit, onClose }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl ${
        isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'
      }`}>
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full p-3 rounded-lg border ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                }`}
                placeholder="My Awesome Project"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className={`w-full p-3 rounded-lg border ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <option value="fintech">Fintech</option>
                <option value="health">Health</option>
                <option value="education">Education</option>
                <option value="automation">Automation</option>
                <option value="ai">AI</option>
                <option value="saas">SaaS</option>
                <option value="trading">Trading</option>
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={`w-full p-3 rounded-lg border ${
                isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
              }`}
              placeholder="What does this project do?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className={`w-full p-3 rounded-lg border ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <option value="spec">Specification</option>
                <option value="functional">Functional</option>
                <option value="mvp">MVP</option>
                <option value="shipping">Shipping</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Stage
              </label>
              <input
                type="text"
                value={formData.stage}
                onChange={(e) => setFormData(prev => ({ ...prev, stage: e.target.value }))}
                className={`w-full p-3 rounded-lg border ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                }`}
                placeholder="e.g., Beta, Production"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Tech Stack (comma separated)
            </label>
            <input
              type="text"
              value={formData.tech?.join(', ') || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                tech: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
              }))}
              className={`w-full p-3 rounded-lg border ${
                isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
              }`}
              placeholder="React, Node.js, PostgreSQL"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Value Min ($)
              </label>
              <input
                type="number"
                value={formData.valueMin}
                onChange={(e) => setFormData(prev => ({ ...prev, valueMin: parseInt(e.target.value) || 0 }))}
                className={`w-full p-3 rounded-lg border ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                }`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Value Max ($)
              </label>
              <input
                type="number"
                value={formData.valueMax}
                onChange={(e) => setFormData(prev => ({ ...prev, valueMax: parseInt(e.target.value) || 0 }))}
                className={`w-full p-3 rounded-lg border ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                GitHub Repo
              </label>
              <input
                type="text"
                value={formData.github}
                onChange={(e) => setFormData(prev => ({ ...prev, github: e.target.value }))}
                className={`w-full p-3 rounded-lg border ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                }`}
                placeholder="username/repo"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Features Count
              </label>
              <input
                type="number"
                value={formData.features}
                onChange={(e) => setFormData(prev => ({ ...prev, features: parseInt(e.target.value) || 0 }))}
                className={`w-full p-3 rounded-lg border ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.patentable}
                onChange={(e) => setFormData(prev => ({ ...prev, patentable: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Patentable IP</span>
            </label>

            <select
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              className={`px-3 py-2 rounded-lg border ${
                isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">Critical Priority</option>
            </select>
          </div>
        </div>

        <div className={`p-4 border-t flex justify-end gap-3 ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!formData.name}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline-block mr-2" />
            Save Project
          </button>
        </div>
      </div>
    </div>
  );

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
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Software Projects</h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Complete inventory of all software IP with AI analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={generatePortfolioReport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <BarChart2 className="w-4 h-4" />
            AI Report
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Project
          </button>
          <div className="text-right">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Portfolio Value</p>
            <p className="text-2xl font-bold text-green-400">
              ${(totalValue.min / 1000).toFixed(0)}K - ${(totalValue.max / 1000).toFixed(0)}K
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status:</span>
            <div className="flex gap-2">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    filter === status
                      ? 'bg-purple-600 text-white'
                      : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Category:</span>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    categoryFilter === cat
                      ? 'bg-cyan-600 text-white'
                      : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
          <div key={product.id} className={`p-6 rounded-xl border transition-all duration-300 hover:border-purple-500/50 ${
            isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Code2 className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.name}</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{product.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(product.status)}`}>
                  {getStatusIcon(product.status)}
                  <span className="text-xs font-medium">{product.stage}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => analyzeProject(product)}
                    className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                    title="AI Analysis"
                  >
                    <Brain className="w-4 h-4 text-purple-400" />
                  </button>
                  <button
                    onClick={() => {
                      setFormData({
                        name: product.name,
                        description: product.description || '',
                        category: product.category,
                        status: product.status,
                        stage: product.stage || '',
                        tech: product.tech || [],
                        valueMin: product.valueMin || 0,
                        valueMax: product.valueMax || 0,
                        github: product.github || '',
                        patentable: product.patentable || false,
                        features: product.features || 0,
                        priority: product.priority || 'medium'
                      });
                      setShowEditModal(product.id);
                    }}
                    className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteProject(product.id)}
                    className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>

            <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{product.description}</p>

            {/* Tech Stack */}
            <div className="flex flex-wrap gap-2 mb-4">
              {product.tech?.map((tech) => (
                <span key={tech} className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                  {tech}
                </span>
              ))}
            </div>

            {/* Features count if available */}
            {product.features && (
              <div className={`mb-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="text-purple-400 font-semibold">{product.features}</span> features/pages built
              </div>
            )}

            {/* Value & Actions */}
            <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <div>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Estimated Value</p>
                <p className="text-lg font-bold text-green-400">
                  ${((product.valueMin || 0) / 1000).toFixed(0)}K - ${((product.valueMax || 0) / 1000).toFixed(0)}K
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
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                  >
                    <Github className="w-4 h-4 text-gray-400" />
                  </a>
                )}
              </div>
            </div>

            {/* Analysis Results */}
            {analysisResults[product.id] && (
              <div className={`mt-4 p-4 rounded-lg border ${
                analysisResults[product.id].error
                  ? 'bg-red-500/10 border-red-500/30'
                  : isDark ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>AI Analysis</span>
                  </div>
                  <button
                    onClick={() => setAnalysisResults(prev => {
                      const newResults = { ...prev };
                      delete newResults[product.id];
                      return newResults;
                    })}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className={`text-sm whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {analysisResults[product.id].content}
                </div>
              </div>
            )}

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
        <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{projects.length}</p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Projects</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <p className="text-3xl font-bold text-green-400">
            {projects.filter(p => p.status === 'complete' || p.status === 'shipping').length}
          </p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Ready to Ship</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <p className="text-3xl font-bold text-yellow-400">
            {projects.filter(p => p.patentable).length}
          </p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Patentable</p>
        </div>
        <div className={`p-4 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
          <p className="text-3xl font-bold text-purple-400">
            {new Set(projects.flatMap(p => p.tech || [])).size}
          </p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Technologies</p>
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <ProjectFormModal
          title="Add New Project"
          onSubmit={handleAddProject}
          onClose={() => {
            setShowAddModal(false);
            resetForm();
          }}
        />
      )}

      {/* Edit Project Modal */}
      {showEditModal && (
        <ProjectFormModal
          title="Edit Project"
          onSubmit={() => handleUpdateProject(showEditModal)}
          onClose={() => {
            setShowEditModal(null);
            resetForm();
          }}
        />
      )}

      {/* Portfolio Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl ${
            isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <BarChart2 className="w-5 h-5 text-cyan-400" />
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  AI Portfolio Analysis Report
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {reportData && !reportData.error && (
                  <button
                    onClick={downloadReport}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                )}
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {generatingReport ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                  <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Analyzing portfolio with AI...</p>
                </div>
              ) : reportData ? (
                <div className="space-y-6">
                  {/* Metrics Summary */}
                  {reportData.metrics && (
                    <div className="grid grid-cols-5 gap-4">
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <p className="text-2xl font-bold text-purple-400">{reportData.metrics.totalProjects}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Projects</p>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <p className="text-2xl font-bold text-green-400">
                          ${(reportData.metrics.totalValue.min / 1000).toFixed(0)}K
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Min Value</p>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <p className="text-2xl font-bold text-green-400">
                          ${(reportData.metrics.totalValue.max / 1000).toFixed(0)}K
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Max Value</p>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <p className="text-2xl font-bold text-cyan-400">{reportData.metrics.completedProjects}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Completed</p>
                      </div>
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <p className="text-2xl font-bold text-yellow-400">{reportData.metrics.patentableIP}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Patentable IP</p>
                      </div>
                    </div>
                  )}

                  {/* Report Content */}
                  <div className={`p-6 rounded-lg border ${
                    reportData.error
                      ? 'bg-red-500/10 border-red-500/30'
                      : isDark ? 'bg-white/5 border-purple-900/30' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {reportData.content}
                    </div>
                  </div>

                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Generated: {new Date(reportData.timestamp).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                  <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No report generated yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analyzing Indicator */}
      {analyzing && (
        <div className="fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-purple-600 text-white shadow-lg">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Analyzing project...</span>
        </div>
      )}
    </div>
  );
}

export default Projects;
