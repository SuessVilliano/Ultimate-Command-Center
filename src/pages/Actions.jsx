import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Plus,
  Filter,
  Calendar,
  Bot,
  User,
  ExternalLink,
  RefreshCw,
  X,
  Save,
  Edit3,
  Trash2,
  Check,
  FolderKanban,
  Brain,
  MessageSquare,
  ArrowRight,
  Send
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';
import { SPECIALIZED_AGENTS } from '../data/agents';

function Actions() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'task',
    priority: 'medium',
    dueDate: '',
    assignedTo: '',
    notes: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/action-items`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (e) {
      console.log('Failed to load action items');
    }
    setLoading(false);
  };

  const handleAddItem = async () => {
    const newItem = { ...formData, id: Date.now(), createdAt: new Date().toISOString(), status: 'pending' };
    try {
      const response = await fetch(`${API_URL}/api/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        const data = await response.json();
        setItems(prev => [...prev, data]);
      } else {
        setItems(prev => [...prev, newItem]);
      }
    } catch (e) {
      setItems(prev => [...prev, newItem]);
    }
    setShowAddModal(false);
    resetForm();
  };

  const handleUpdateItem = async (id, updates) => {
    try {
      await fetch(`${API_URL}/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {}
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    setShowEditModal(null);
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('Delete this action item?')) return;
    try {
      await fetch(`${API_URL}/api/action-items/${id}`, { method: 'DELETE' });
    } catch (e) {}
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAssignToAgent = async (item, agent) => {
    const updates = { assignedTo: agent.name, assignedAgentId: agent.id, status: 'assigned' };
    await handleUpdateItem(item.id, updates);
    if (agent.platform === 'Taskade') {
      try {
        await fetch(`${API_URL}/api/taskade/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: item.title, description: item.description, priority: item.priority })
        });
      } catch (e) {}
    }
    setShowAssignModal(null);
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', category: 'task', priority: 'medium', dueDate: '', assignedTo: '', notes: '' });
  };

  const categories = ['all', 'task', 'ticket', 'project', 'meeting', 'followup'];

  const filteredItems = items.filter(item => {
    const statusMatch = filter === 'all' || item.status === filter;
    const categoryMatch = categoryFilter === 'all' || item.category === categoryFilter;
    return statusMatch && categoryMatch;
  });

  const getPriorityColor = (priority) => {
    const colors = { critical: 'bg-red-500/20 text-red-400', high: 'bg-orange-500/20 text-orange-400', medium: 'bg-yellow-500/20 text-yellow-400', low: 'bg-green-500/20 text-green-400' };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status) => {
    const colors = { completed: 'bg-green-500/20 text-green-400', assigned: 'bg-blue-500/20 text-blue-400', in_progress: 'bg-purple-500/20 text-purple-400', pending: 'bg-gray-500/20 text-gray-400' };
    return colors[status] || colors.pending;
  };

  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    assigned: items.filter(i => i.status === 'assigned').length,
    completed: items.filter(i => i.status === 'completed').length,
    critical: items.filter(i => i.priority === 'critical').length
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-purple-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Action Items</h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Manage tasks and assign to AI agents</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadItems} className={`p-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}>
            <RefreshCw className="w-5 h-5" />
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4" />Add Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[{ label: 'Total', value: stats.total, color: isDark ? 'text-white' : 'text-gray-900' },
          { label: 'Pending', value: stats.pending, color: 'text-yellow-400' },
          { label: 'Assigned', value: stats.assigned, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, color: 'text-green-400' },
          { label: 'Critical', value: stats.critical, color: 'text-red-400' }
        ].map((stat, i) => (
          <div key={i} className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status:</span>
            {['all', 'pending', 'assigned', 'completed'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-xs rounded-full ${filter === s ? 'bg-purple-600 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Category:</span>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-1 text-xs rounded-full ${categoryFilter === cat ? 'bg-cyan-600 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className={`p-12 rounded-xl border text-center ${isDark ? 'bg-white/5 border-purple-900/30' : 'bg-white border-gray-200'}`}>
            <CheckSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No action items yet</p>
            <button onClick={() => setShowAddModal(true)} className="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white">Create first item</button>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-purple-900/30 hover:border-purple-500/50' : 'bg-white border-gray-200'}`}>
              <div className="flex items-start gap-4">
                <button onClick={() => handleUpdateItem(item.id, { status: item.status === 'completed' ? 'pending' : 'completed' })}
                  className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center ${item.status === 'completed' ? 'bg-green-500 border-green-500' : isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                  {item.status === 'completed' && <Check className="w-4 h-4 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={`font-semibold ${item.status === 'completed' ? 'line-through opacity-50' : ''} ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
                      {item.description && <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(item.priority)}`}>{item.priority}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(item.status)}`}>{item.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {item.category && <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><FolderKanban className="w-3 h-3" />{item.category}</span>}
                    {item.dueDate && <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><Calendar className="w-3 h-3" />{new Date(item.dueDate).toLocaleDateString()}</span>}
                    {item.assignedTo && <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}><Bot className="w-3 h-3" />{item.assignedTo}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowAssignModal(item)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} title="Assign">
                    <Bot className="w-4 h-4 text-purple-400" />
                  </button>
                  <button onClick={() => { setFormData({ title: item.title, description: item.description || '', category: item.category || 'task', priority: item.priority || 'medium', dueDate: item.dueDate || '', assignedTo: item.assignedTo || '', notes: item.notes || '' }); setShowEditModal(item.id); }}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                    <Edit3 className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => handleDeleteItem(item.id)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-lg rounded-xl ${isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{showEditModal ? 'Edit' : 'Add'} Action Item</h3>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(null); resetForm(); }} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Title *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="What needs to be done?" />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="Details..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Category</label>
                  <select value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`}>
                    <option value="task">Task</option><option value="ticket">Ticket</option><option value="project">Project</option><option value="meeting">Meeting</option><option value="followup">Follow-up</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Priority</label>
                  <select value={formData.priority} onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`}>
                    <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Due Date</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={2}
                  className={`w-full p-3 rounded-lg border ${isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200'}`} placeholder="Additional notes..." />
              </div>
            </div>
            <div className={`p-4 border-t flex justify-end gap-3 ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(null); resetForm(); }} className={`px-4 py-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>Cancel</button>
              <button onClick={() => showEditModal ? handleUpdateItem(showEditModal, formData) : handleAddItem()} disabled={!formData.title}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
                <Save className="w-4 h-4 inline-block mr-2" />{showEditModal ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md rounded-xl ${isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white'}`}>
            <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Assign to Agent</h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{showAssignModal.title}</p>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              <button onClick={() => handleAssignToAgent(showAssignModal, { id: 'self', name: 'Self', platform: 'manual' })}
                className={`w-full p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Assign to Self</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Manual tracking</p>
                </div>
              </button>
              <p className={`text-xs font-medium px-3 py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>AI AGENTS</p>
              {SPECIALIZED_AGENTS.map((agent) => (
                <button key={agent.id} onClick={() => handleAssignToAgent(showAssignModal, agent)}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{agent.name}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{agent.role}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>{agent.platform}</span>
                </button>
              ))}
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
              <button onClick={() => setShowAssignModal(null)} className={`w-full px-4 py-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Actions;
