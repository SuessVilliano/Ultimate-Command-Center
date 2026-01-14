import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Plus,
  Link,
  FileText,
  Upload,
  Type,
  Search,
  Trash2,
  Settings,
  MessageSquare,
  Brain,
  X,
  ChevronRight,
  RefreshCw,
  Check,
  Copy,
  Globe,
  File,
  Code,
  Sparkles,
  Users
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

const AI_SERVER_URL = API_URL;

function AgentTeam() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // State
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Knowledge modal state
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledgeTab, setKnowledgeTab] = useState('url');
  const [knowledgeEntries, setKnowledgeEntries] = useState([]);
  const [knowledgeStats, setKnowledgeStats] = useState(null);

  // Form state for adding knowledge
  const [urlInput, setUrlInput] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [addingKnowledge, setAddingKnowledge] = useState(false);

  // Load agents on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchAgents = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/agents`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/agent-conversations`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    }
  };

  const fetchConversation = async (conversationId) => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/agent-conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setActiveConversation(data.conversation);
      }
    } catch (e) {
      console.error('Failed to fetch conversation:', e);
    }
  };

  const fetchAgentKnowledge = async (agentId) => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/agents/${agentId}/knowledge`);
      if (response.ok) {
        const data = await response.json();
        setKnowledgeEntries(data.entries || []);
        setKnowledgeStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch knowledge:', e);
    }
  };

  // Send message - uses orchestrator for auto-routing or direct agent if selected
  const sendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    const message = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    // Add user message to UI immediately
    const userMsg = { role: 'user', content: message, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      let endpoint, body;

      if (selectedAgent && selectedAgent.id !== 'orchestrator') {
        // Direct chat with specific agent
        endpoint = `${AI_SERVER_URL}/api/agents/${selectedAgent.id}/chat`;
        body = {
          message,
          conversationId: activeConversation?.id,
          userId: 'default'
        };
      } else {
        // Orchestrated chat - auto-routes to best agent
        endpoint = `${AI_SERVER_URL}/api/orchestrator/chat`;
        body = {
          message,
          conversationId: activeConversation?.id,
          userId: 'default'
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();

        // Update conversation ID if new
        if (data.conversationId && !activeConversation) {
          setActiveConversation({ id: data.conversationId });
          fetchConversations();
        }

        // Add agent response(s) to messages
        if (data.response) {
          const agentMsg = {
            role: 'agent',
            content: data.response.content || data.response,
            agent_id: data.agentId || data.response?.agent?.id,
            agent_name: data.agentName || data.response?.agent?.name,
            created_at: new Date().toISOString(),
            routing: data.response?.routing
          };
          setMessages(prev => [...prev, agentMsg]);
        }
      } else {
        const error = await response.json();
        setMessages(prev => [...prev, {
          role: 'system',
          content: `Error: ${error.error || 'Failed to get response'}`,
          created_at: new Date().toISOString()
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${e.message}`,
        created_at: new Date().toISOString()
      }]);
    }

    setSending(false);
  };

  // Add URL to agent knowledge
  const addUrlKnowledge = async () => {
    if (!urlInput.trim() || !selectedAgent) return;
    setAddingKnowledge(true);

    try {
      const response = await fetch(`${AI_SERVER_URL}/api/agents/${selectedAgent.id}/knowledge/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() })
      });

      if (response.ok) {
        setUrlInput('');
        fetchAgentKnowledge(selectedAgent.id);
      }
    } catch (e) {
      console.error('Failed to add URL:', e);
    }

    setAddingKnowledge(false);
  };

  // Add text to agent knowledge
  const addTextKnowledge = async () => {
    if (!textTitle.trim() || !textContent.trim() || !selectedAgent) return;
    setAddingKnowledge(true);

    try {
      const response = await fetch(`${AI_SERVER_URL}/api/agents/${selectedAgent.id}/knowledge/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: textTitle.trim(), content: textContent.trim() })
      });

      if (response.ok) {
        setTextTitle('');
        setTextContent('');
        fetchAgentKnowledge(selectedAgent.id);
      }
    } catch (e) {
      console.error('Failed to add text:', e);
    }

    setAddingKnowledge(false);
  };

  // Upload file to agent knowledge
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length || !selectedAgent) return;

    setAddingKnowledge(true);

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await fetch(`${AI_SERVER_URL}/api/agents/${selectedAgent.id}/knowledge/upload`, {
          method: 'POST',
          body: formData
        });
      } catch (e) {
        console.error(`Failed to upload ${file.name}:`, e);
      }
    }

    fetchAgentKnowledge(selectedAgent.id);
    setAddingKnowledge(false);
    fileInputRef.current.value = '';
  };

  // Delete knowledge entry
  const deleteKnowledge = async (entryId) => {
    try {
      await fetch(`${AI_SERVER_URL}/api/knowledge/${entryId}`, { method: 'DELETE' });
      fetchAgentKnowledge(selectedAgent.id);
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  // Get icon for knowledge type
  const getKnowledgeIcon = (type) => {
    switch (type) {
      case 'url': return Globe;
      case 'document': return FileText;
      case 'text': return Type;
      case 'file': return File;
      default: return FileText;
    }
  };

  // Start new conversation
  const startNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    setSelectedAgent(null);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4">
      {/* Left Sidebar - Agents */}
      <div className={`w-64 flex-shrink-0 rounded-xl border ${
        isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
      }`}>
        <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              AI Agents
            </h2>
            <button
              onClick={startNewConversation}
              className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
              title="New Conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {/* Orchestrator option */}
          <button
            onClick={() => setSelectedAgent({ id: 'orchestrator', name: 'Auto (Smart Routing)' })}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              !selectedAgent || selectedAgent.id === 'orchestrator'
                ? 'bg-purple-600 text-white'
                : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              !selectedAgent || selectedAgent.id === 'orchestrator' ? 'bg-white/20' : 'bg-purple-500/20'
            }`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="font-medium text-sm truncate">Auto Route</p>
              <p className={`text-xs truncate ${
                !selectedAgent || selectedAgent.id === 'orchestrator' ? 'text-white/70' : 'text-gray-500'
              }`}>
                Smart agent selection
              </p>
            </div>
          </button>

          <div className={`px-3 py-2 text-xs font-semibold uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Specialists
          </div>

          {agents.filter(a => a.id !== 'orchestrator').map(agent => (
            <button
              key={agent.id}
              onClick={() => {
                setSelectedAgent(agent);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                selectedAgent?.id === agent.id
                  ? 'bg-purple-600 text-white'
                  : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${agent.avatar_color}30` }}
              >
                <Bot className="w-4 h-4" style={{ color: agent.avatar_color }} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{agent.name}</p>
                <p className={`text-xs truncate ${
                  selectedAgent?.id === agent.id ? 'text-white/70' : 'text-gray-500'
                }`}>
                  {agent.specialization?.substring(0, 30)}...
                </p>
              </div>
              {selectedAgent?.id === agent.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowKnowledgeModal(true);
                    fetchAgentKnowledge(agent.id);
                  }}
                  className="p-1 rounded hover:bg-white/20"
                  title="Manage Knowledge"
                >
                  <Brain className="w-4 h-4" />
                </button>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col rounded-xl border ${
        isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
      }`}>
        {/* Chat Header */}
        <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedAgent ? (
                <>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${selectedAgent.avatar_color || '#8B5CF6'}30` }}
                  >
                    {selectedAgent.id === 'orchestrator' ? (
                      <Sparkles className="w-5 h-5 text-purple-500" />
                    ) : (
                      <Bot className="w-5 h-5" style={{ color: selectedAgent.avatar_color }} />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selectedAgent.name || 'Auto Route'}
                    </h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {selectedAgent.id === 'orchestrator'
                        ? 'Automatically routes to the best agent'
                        : selectedAgent.specialization?.substring(0, 50)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Agent Team Chat
                    </h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Select an agent or use auto-routing
                    </p>
                  </div>
                </>
              )}
            </div>

            {selectedAgent && selectedAgent.id !== 'orchestrator' && (
              <button
                onClick={() => {
                  setShowKnowledgeModal(true);
                  fetchAgentKnowledge(selectedAgent.id);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                <Brain className="w-4 h-4" />
                Knowledge Base
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Bot className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Start a Conversation
                </h3>
                <p className={`text-sm max-w-md ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {selectedAgent?.id === 'orchestrator' || !selectedAgent
                    ? "Just ask anything - I'll automatically route your question to the best specialist agent."
                    : `Chat directly with ${selectedAgent.name}. They specialize in ${selectedAgent.specialization}.`}
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {msg.role !== 'user' && msg.agent_name && (
                    <div className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                        {msg.agent_name}
                      </span>
                      {msg.routing?.reasoning && (
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          ({msg.routing.reasoning})
                        </span>
                      )}
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-md'
                      : msg.role === 'system'
                        ? isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                        : isDark ? 'bg-white/10 text-gray-200 rounded-bl-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          <div className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={
                selectedAgent?.id === 'orchestrator' || !selectedAgent
                  ? "Ask anything - I'll route to the right agent..."
                  : `Message ${selectedAgent.name}...`
              }
              disabled={sending}
              className={`flex-1 px-4 py-3 rounded-xl border ${
                isDark
                  ? 'bg-white/5 border-purple-900/30 text-white placeholder:text-gray-500'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-purple-500`}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || sending}
              className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                inputMessage.trim() && !sending
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Knowledge Base Modal */}
      {showKnowledgeModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl ${
            isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'
          }`}>
            {/* Modal Header */}
            <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-purple-500" />
                <div>
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedAgent.name} - Knowledge Base
                  </h3>
                  {knowledgeStats && (
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {knowledgeStats.total} items total
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowKnowledgeModal(false)}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className={`p-2 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'} flex gap-2`}>
              {[
                { id: 'url', label: 'Add URL', icon: Link },
                { id: 'text', label: 'Add Text', icon: Type },
                { id: 'upload', label: 'Upload File', icon: Upload },
                { id: 'browse', label: 'Browse All', icon: FileText }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setKnowledgeTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
                      knowledgeTab === tab.id
                        ? 'bg-purple-600 text-white'
                        : isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {knowledgeTab === 'url' && (
                <div className="space-y-4">
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Add a URL to scrape and add to this agent's knowledge base.
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/article"
                      className={`flex-1 px-4 py-2 rounded-lg border ${
                        isDark
                          ? 'bg-white/5 border-purple-900/30 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    />
                    <button
                      onClick={addUrlKnowledge}
                      disabled={!urlInput.trim() || addingKnowledge}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                    >
                      {addingKnowledge ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Add URL'}
                    </button>
                  </div>
                </div>
              )}

              {knowledgeTab === 'text' && (
                <div className="space-y-4">
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Add a text snippet with a title to this agent's knowledge base.
                  </p>
                  <input
                    type="text"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="Title (e.g., 'How to reset password')"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark
                        ? 'bg-white/5 border-purple-900/30 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Content..."
                    rows={6}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDark
                        ? 'bg-white/5 border-purple-900/30 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                  <button
                    onClick={addTextKnowledge}
                    disabled={!textTitle.trim() || !textContent.trim() || addingKnowledge}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                  >
                    {addingKnowledge ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Add Text'}
                  </button>
                </div>
              )}

              {knowledgeTab === 'upload' && (
                <div className="space-y-4">
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Upload files (PDF, Word, Excel, PowerPoint, CSV, JSON, code files, images).
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={addingKnowledge}
                    className={`w-full p-8 rounded-xl border-2 border-dashed ${
                      isDark
                        ? 'border-purple-900/50 hover:border-purple-500/50 bg-white/5'
                        : 'border-gray-300 hover:border-purple-400 bg-gray-50'
                    } transition-colors`}
                  >
                    {addingKnowledge ? (
                      <RefreshCw className="w-8 h-8 mx-auto text-purple-500 animate-spin" />
                    ) : (
                      <>
                        <Upload className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                          Click to upload or drag and drop
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          PDF, DOC, XLS, PPT, CSV, JSON, TXT, MD, Images, Code files
                        </p>
                      </>
                    )}
                  </button>
                </div>
              )}

              {knowledgeTab === 'browse' && (
                <div className="space-y-2">
                  {knowledgeEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                        No knowledge entries yet
                      </p>
                    </div>
                  ) : (
                    knowledgeEntries.map(entry => {
                      const Icon = getKnowledgeIcon(entry.type);
                      return (
                        <div
                          key={entry.id}
                          className={`p-3 rounded-lg border ${
                            isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                                <Icon className="w-4 h-4 text-purple-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {entry.title}
                                </h4>
                                <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {entry.summary || entry.source_url || 'No summary'}
                                </p>
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {entry.type} • {new Date(entry.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteKnowledge(entry.id)}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentTeam;
