import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Settings,
  Plus, Play, Pause, StopCircle, Save, Trash2, Copy, Users,
  Globe, Zap, Bot, ChevronRight, RefreshCw, ExternalLink,
  AlertCircle, CheckCircle, Edit3, Headphones, Radio, Wifi
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

// Voice agent templates for different client use cases
const AGENT_TEMPLATES = [
  {
    id: 'customer-support',
    name: 'Customer Support Agent',
    description: 'Handle inbound support calls, answer FAQs, route to human agents',
    icon: Phone,
    color: 'blue',
    systemPrompt: 'You are a professional customer support agent. Be helpful, empathetic, and solution-oriented. Ask clarifying questions when needed. If you cannot resolve an issue, offer to escalate to a human agent.',
    voice: 'NATF0.pt',
    settings: { temperature: 0.5, maxTokens: 512, language: 'en-US' }
  },
  {
    id: 'sales-assistant',
    name: 'Sales Assistant',
    description: 'Qualify leads, answer product questions, schedule demos',
    icon: Users,
    color: 'green',
    systemPrompt: 'You are a consultative sales assistant. Understand the prospect\'s needs, explain product benefits clearly, handle objections professionally, and guide towards scheduling a demo or making a purchase. Be persuasive but not pushy.',
    voice: 'NATM0.pt',
    settings: { temperature: 0.7, maxTokens: 512, language: 'en-US' }
  },
  {
    id: 'appointment-scheduler',
    name: 'Appointment Scheduler',
    description: 'Book, reschedule, and manage appointments via voice',
    icon: Globe,
    color: 'purple',
    systemPrompt: 'You are an appointment scheduling assistant. Help callers book, reschedule, or cancel appointments. Confirm all details clearly: date, time, service type, and contact information. Be efficient and courteous.',
    voice: 'NATF1.pt',
    settings: { temperature: 0.3, maxTokens: 256, language: 'en-US' }
  },
  {
    id: 'trading-advisor',
    name: 'Trading Advisor',
    description: 'Provide market insights, trade signals, and risk analysis',
    icon: Zap,
    color: 'cyan',
    systemPrompt: 'You are a trading advisor assistant for Hybrid Funding. Provide market analysis, discuss trade setups, explain risk management strategies, and help traders understand challenge rules. Always include risk disclaimers. Never give specific financial advice.',
    voice: 'NATM1.pt',
    settings: { temperature: 0.6, maxTokens: 1024, language: 'en-US' }
  },
  {
    id: 'health-wellness',
    name: 'Health & Wellness Guide',
    description: 'Product recommendations, supplement info, wellness guidance',
    icon: Headphones,
    color: 'pink',
    systemPrompt: 'You are a health and wellness product advisor for LIV8 Health. Help customers find the right supplements and health products. Ask about their goals, any allergies or conditions, and recommend products. Always remind them to consult a healthcare provider.',
    voice: 'NATF2.pt',
    settings: { temperature: 0.5, maxTokens: 512, language: 'en-US' }
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Build a voice agent from scratch with custom persona',
    icon: Bot,
    color: 'orange',
    systemPrompt: '',
    voice: 'NATF0.pt',
    settings: { temperature: 0.7, maxTokens: 512, language: 'en-US' }
  }
];

const AVAILABLE_VOICES = [
  { value: 'NATF0.pt', label: 'Natural Female 1', gender: 'female' },
  { value: 'NATF1.pt', label: 'Natural Female 2', gender: 'female' },
  { value: 'NATF2.pt', label: 'Natural Female 3', gender: 'female' },
  { value: 'NATF3.pt', label: 'Natural Female 4', gender: 'female' },
  { value: 'NATM0.pt', label: 'Natural Male 1', gender: 'male' },
  { value: 'NATM1.pt', label: 'Natural Male 2', gender: 'male' },
  { value: 'NATM2.pt', label: 'Natural Male 3', gender: 'male' },
  { value: 'NATM3.pt', label: 'Natural Male 4', gender: 'male' },
  { value: 'VARF0.pt', label: 'Varied Female 1', gender: 'female' },
  { value: 'VARF1.pt', label: 'Varied Female 2', gender: 'female' },
  { value: 'VARM0.pt', label: 'Varied Male 1', gender: 'male' },
  { value: 'VARM1.pt', label: 'Varied Male 2', gender: 'male' },
];

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)' },
];

function VoiceAgents() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // State
  const [activeView, setActiveView] = useState('gallery'); // gallery, builder, testing
  const [savedAgents, setSavedAgents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('voice_agents') || '[]');
    } catch { return []; }
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [agentConfig, setAgentConfig] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    voice: 'NATF0.pt',
    greeting: 'Hello! How can I help you today?',
    language: 'en-US',
    temperature: 0.7,
    maxTokens: 512,
    provider: 'auto',
    webhookUrl: '',
    transferNumber: '',
    businessHours: { start: '09:00', end: '17:00', timezone: 'America/New_York' },
    escalationKeywords: ['manager', 'supervisor', 'human', 'real person'],
    knowledgeBase: '',
  });

  // Testing state
  const [isTesting, setIsTesting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [testMessages, setTestMessages] = useState([]);
  const [testInput, setTestInput] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = agentConfig.language;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleTestMessage(transcript);
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
    return () => { if (recognitionRef.current) recognitionRef.current.abort(); };
  }, [agentConfig.language]);

  // Auto-scroll test messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testMessages]);

  // Persist saved agents
  useEffect(() => {
    localStorage.setItem('voice_agents', JSON.stringify(savedAgents));
  }, [savedAgents]);

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const langVoices = voices.filter(v => v.lang.startsWith(agentConfig.language.split('-')[0]));
    if (langVoices.length > 0) utterance.voice = langVoices[0];
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleTestMessage = async (text) => {
    if (!text.trim()) return;
    setTestMessages(prev => [...prev, { role: 'user', content: text }]);
    setTestLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemPrompt: `${agentConfig.systemPrompt}\n\nYour name is "${agentConfig.name}". ${agentConfig.knowledgeBase ? `\n\nKnowledge Base:\n${agentConfig.knowledgeBase}` : ''}`,
          conversationHistory: testMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.response || data.text || data.message || 'I apologize, I could not process that request.';
        setTestMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        speak(reply);
      } else {
        throw new Error('Server error');
      }
    } catch (error) {
      // Fallback - use the AI provider endpoint
      try {
        const response = await fetch(`${API_URL}/api/commander/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            systemPrompt: agentConfig.systemPrompt,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const reply = data.response || data.text || 'I could not process that right now.';
          setTestMessages(prev => [...prev, { role: 'assistant', content: reply }]);
          speak(reply);
        } else {
          setTestMessages(prev => [...prev, {
            role: 'assistant',
            content: 'I\'m currently unable to connect to the AI backend. Please ensure the server is running and API keys are configured in Settings.'
          }]);
        }
      } catch {
        setTestMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Connection error. Please check that the server is running at ' + API_URL
        }]);
      }
    } finally {
      setTestLoading(false);
    }
  };

  const selectTemplate = (template) => {
    setSelectedTemplate(template);
    setAgentConfig(prev => ({
      ...prev,
      name: template.id === 'custom' ? '' : template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
      voice: template.voice,
      temperature: template.settings.temperature,
      maxTokens: template.settings.maxTokens,
      language: template.settings.language,
    }));
    setActiveView('builder');
  };

  const saveAgent = () => {
    const agent = {
      ...agentConfig,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      templateId: selectedTemplate?.id || 'custom',
    };
    setSavedAgents(prev => [...prev, agent]);
    setActiveView('gallery');
  };

  const deleteAgent = (id) => {
    setSavedAgents(prev => prev.filter(a => a.id !== id));
  };

  const loadAgent = (agent) => {
    setAgentConfig(agent);
    setSelectedTemplate(AGENT_TEMPLATES.find(t => t.id === agent.templateId) || AGENT_TEMPLATES[5]);
    setActiveView('builder');
  };

  const startTest = () => {
    setIsTesting(true);
    setTestMessages([{ role: 'assistant', content: agentConfig.greeting || 'Hello! How can I help you today?' }]);
    speak(agentConfig.greeting || 'Hello! How can I help you today?');
    setActiveView('testing');
  };

  const colorMap = {
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Voice Agents
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Build, test, and deploy AI voice agents for your clients
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeView !== 'gallery' && (
            <button
              onClick={() => { setActiveView('gallery'); setIsTesting(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              }`}
            >
              Back to Gallery
            </button>
          )}
          {activeView === 'gallery' && (
            <button
              onClick={() => selectTemplate(AGENT_TEMPLATES[5])}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500"
            >
              <Plus className="w-4 h-4" />
              New Agent
            </button>
          )}
        </div>
      </div>

      {/* Gallery View */}
      {activeView === 'gallery' && (
        <div className="space-y-6">
          {/* Templates */}
          <div>
            <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Agent Templates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AGENT_TEMPLATES.map(template => {
                const Icon = template.icon;
                const colors = colorMap[template.color];
                return (
                  <button
                    key={template.id}
                    onClick={() => selectTemplate(template)}
                    className={`p-5 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                      isDark
                        ? `border-purple-900/30 bg-white/5 hover:bg-white/10`
                        : `border-gray-200 bg-white hover:bg-gray-50`
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {template.name}
                    </h3>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {template.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {template.settings.language}
                      </span>
                      <ChevronRight className={`w-4 h-4 ml-auto ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Saved Agents */}
          {savedAgents.length > 0 && (
            <div>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Your Agents ({savedAgents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedAgents.map(agent => (
                  <div
                    key={agent.id}
                    className={`p-5 rounded-xl border ${
                      isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center">
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {agent.name}
                          </h3>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Created {new Date(agent.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAgent(agent.id)}
                        className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-red-500/20 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className={`text-sm mt-2 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {agent.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => loadAgent(agent)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
                          isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        }`}
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => { loadAgent(agent); startTest(); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-cyan-600 text-white hover:bg-cyan-500"
                      >
                        <Play className="w-3 h-3" />
                        Test
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NVIDIA Integration Info */}
          <div className={`p-6 rounded-xl border ${
            isDark
              ? 'border-green-500/30 bg-gradient-to-br from-green-900/20 to-cyan-900/20'
              : 'border-green-200 bg-gradient-to-br from-green-50 to-cyan-50'
          }`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Radio className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Powered by NVIDIA NIM + PersonaPlex
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Voice agents use NVIDIA Nemotron LLM for intelligent responses and PersonaPlex for real-time
                  voice synthesis. Agents support full-duplex conversation, multiple languages, and can be
                  deployed as phone bots, web widgets, or API endpoints.
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <CheckCircle className="w-3 h-3" /> Nemotron 70B
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <CheckCircle className="w-3 h-3" /> PersonaPlex Voice
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <CheckCircle className="w-3 h-3" /> Multi-language
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <CheckCircle className="w-3 h-3" /> Auto-fallback
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder View */}
      {activeView === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className={`p-6 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Agent Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Agent Name</label>
                  <input
                    type="text"
                    value={agentConfig.name}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Luna Support Bot"
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Voice</label>
                  <select
                    value={agentConfig.voice}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, voice: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  >
                    {AVAILABLE_VOICES.map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Description</label>
                <input
                  type="text"
                  value={agentConfig.description}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this agent does"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                />
              </div>
              <div className="mt-4">
                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Greeting Message</label>
                <input
                  type="text"
                  value={agentConfig.greeting}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, greeting: e.target.value }))}
                  placeholder="What the agent says when a call starts"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                />
              </div>
            </div>

            {/* System Prompt */}
            <div className={`p-6 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>System Prompt (Persona)</h3>
              <textarea
                value={agentConfig.systemPrompt}
                onChange={(e) => setAgentConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="Define the agent's personality, role, knowledge, and behavior..."
                rows={6}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              />
            </div>

            {/* Knowledge Base */}
            <div className={`p-6 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Knowledge Base</h3>
              <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Add FAQs, product info, or any data the agent should know about.
              </p>
              <textarea
                value={agentConfig.knowledgeBase}
                onChange={(e) => setAgentConfig(prev => ({ ...prev, knowledgeBase: e.target.value }))}
                placeholder={`Q: What are your business hours?\nA: We're open Monday through Friday, 9 AM to 5 PM Eastern.\n\nQ: What is your return policy?\nA: We offer a 30-day money-back guarantee on all products.`}
                rows={8}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono ${
                  isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              />
            </div>

            {/* Advanced Settings */}
            <div className={`p-6 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Advanced Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Language</label>
                  <select
                    value={agentConfig.language}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, language: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  >
                    {SUPPORTED_LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>AI Provider</label>
                  <select
                    value={agentConfig.provider}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, provider: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  >
                    <option value="auto">Auto (Cost-effective)</option>
                    <option value="kimi">NVIDIA Nemotron</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="claude">Claude</option>
                    <option value="openai">GPT-4o</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Temperature: {agentConfig.temperature}
                  </label>
                  <input
                    type="range" min="0" max="1" step="0.1"
                    value={agentConfig.temperature}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Max Response Length</label>
                  <select
                    value={agentConfig.maxTokens}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  >
                    <option value="256">Short (256 tokens)</option>
                    <option value="512">Medium (512 tokens)</option>
                    <option value="1024">Long (1024 tokens)</option>
                    <option value="2048">Very Long (2048 tokens)</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Webhook URL (optional)</label>
                  <input
                    type="url"
                    value={agentConfig.webhookUrl}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    placeholder="https://hooks.example.com/voice-agent"
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Transfer Number (optional)</label>
                  <input
                    type="tel"
                    value={agentConfig.transferNumber}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, transferNumber: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${
                      isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview Sidebar */}
          <div className="space-y-4">
            <div className={`p-6 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Agent Preview</h3>
              <div className="text-center mb-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center">
                  <Bot className="w-10 h-10 text-white" />
                </div>
                <h4 className={`mt-3 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {agentConfig.name || 'Unnamed Agent'}
                </h4>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {agentConfig.description || 'No description'}
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <div className={`flex justify-between ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span>Voice:</span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {AVAILABLE_VOICES.find(v => v.value === agentConfig.voice)?.label || agentConfig.voice}
                  </span>
                </div>
                <div className={`flex justify-between ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span>Language:</span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {SUPPORTED_LANGUAGES.find(l => l.code === agentConfig.language)?.label || agentConfig.language}
                  </span>
                </div>
                <div className={`flex justify-between ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span>Provider:</span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>{agentConfig.provider}</span>
                </div>
                <div className={`flex justify-between ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span>Temperature:</span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>{agentConfig.temperature}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={startTest}
                disabled={!agentConfig.name || !agentConfig.systemPrompt}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium ${
                  agentConfig.name && agentConfig.systemPrompt
                    ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                    : isDark ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Phone className="w-4 h-4" />
                Test Voice Agent
              </button>
              <button
                onClick={saveAgent}
                disabled={!agentConfig.name}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium ${
                  agentConfig.name
                    ? 'bg-purple-600 text-white hover:bg-purple-500'
                    : isDark ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Save className="w-4 h-4" />
                Save Agent
              </button>
              <button
                onClick={() => {
                  const config = JSON.stringify(agentConfig, null, 2);
                  navigator.clipboard.writeText(config);
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium ${
                  isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                <Copy className="w-4 h-4" />
                Export Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Testing View */}
      {activeView === 'testing' && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
          {/* Test Header */}
          <div className={`p-4 border-b flex items-center justify-between ${
            isDark ? 'bg-gradient-to-r from-cyan-900/30 to-purple-900/30 border-purple-900/30' : 'bg-gradient-to-r from-cyan-50 to-purple-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Testing: {agentConfig.name}
                </h3>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Live voice test session - speak or type to interact
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                <Wifi className="w-3 h-3" />
                Connected
              </span>
              <button
                onClick={() => { setActiveView('builder'); setIsTesting(false); }}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={`h-[400px] overflow-y-auto p-4 space-y-4 ${isDark ? 'bg-[#050508]' : 'bg-gray-50'}`}>
            {testMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-sm'
                    : isDark
                      ? 'bg-white/10 text-gray-200 rounded-bl-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {testLoading && (
              <div className="flex justify-start">
                <div className={`px-4 py-3 rounded-2xl rounded-bl-sm ${isDark ? 'bg-white/10' : 'bg-white border border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Test Input */}
          <div className={`p-4 border-t ${isDark ? 'border-purple-900/30 bg-[#050508]' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isListening) {
                    recognitionRef.current?.stop();
                    setIsListening(false);
                  } else {
                    recognitionRef.current?.start();
                    setIsListening(true);
                  }
                }}
                className={`p-3 rounded-full transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-purple-600 text-white hover:bg-purple-500'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              {isSpeaking && (
                <button
                  onClick={() => { window.speechSynthesis.cancel(); setIsSpeaking(false); }}
                  className="p-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30"
                >
                  <VolumeX className="w-5 h-5" />
                </button>
              )}
              <form
                onSubmit={(e) => { e.preventDefault(); handleTestMessage(testInput); setTestInput(''); }}
                className="flex-1 flex gap-2"
              >
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Type a message to test the agent..."
                  className={`flex-1 px-4 py-2.5 rounded-lg border text-sm ${
                    isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                />
                <button type="submit" className="px-4 py-2.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 text-sm font-medium">
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceAgents;
