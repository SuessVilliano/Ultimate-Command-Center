import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Monitor,
  Bot,
  User,
  Settings,
  Sun,
  Moon,
  Upload,
  FileText,
  Image,
  File,
  StopCircle,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle,
  Users,
  Zap,
  ChevronDown,
  Clock,
  AlertCircle,
  Play,
  Pause,
  MoreHorizontal,
  Shield,
  Target,
  Plus,
  Link,
  Brain,
  Database,
  Webhook,
  CheckSquare,
  RefreshCw,
  History
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { COMMANDER_AGENT, SPECIALIZED_AGENTS, AGENT_CATEGORIES, getAgentById } from '../data/agents';
import aiService from '../services/aiService';
import AISettings from './AISettings';
import { API_URL } from '../config';

function ChatWidget({ onNavigate }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Chat state
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize messages from history or show daily brief
  useEffect(() => {
    if (!initialized) {
      const history = aiService.getConversationHistory();

      if (history.length > 0) {
        // Load conversation history
        const loadedMessages = history.slice(-30).map((msg, idx) => ({
          id: Date.now() - (history.length - idx),
          role: msg.role === 'user' ? 'user' : 'commander',
          agentId: msg.role === 'user' ? null : 'liv8-commander',
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));

        // Add a "welcome back" message
        const dailyBrief = aiService.generateDailyBrief();
        loadedMessages.push({
          id: Date.now(),
          role: 'commander',
          agentId: 'liv8-commander',
          content: dailyBrief,
          timestamp: new Date()
        });

        setMessages(loadedMessages);
      } else {
        // First time user - show welcome
        const dailyBrief = aiService.generateDailyBrief();
        setMessages([{
          id: 1,
          role: 'commander',
          agentId: 'liv8-commander',
          content: dailyBrief,
          timestamp: new Date()
        }]);
      }

      // Check backend status
      updateBackendStatus();

      setInitialized(true);
    }
  }, [initialized]);

  // Update backend status and memory
  const updateBackendStatus = async () => {
    const status = aiService.getBackendStatus();
    setBackendStatus(status);

    if (status.connected) {
      const facts = aiService.getMemoryFacts();
      setMemoryFacts(facts);

      const convs = await aiService.getConversations();
      setConversations(convs);
    }
  };

  // Refresh integrations status
  const refreshIntegrations = async () => {
    await aiService.checkBackendConnection();
    updateBackendStatus();
  };

  // Multi-agent task tracking
  const [activeTasks, setActiveTasks] = useState([]);
  const [showTaskPanel, setShowTaskPanel] = useState(false);

  // Agent selection
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAgents, setSelectedAgents] = useState([]);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // File & screen state
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(aiService.getApiKey());
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

  // Focus/Mission panel
  const [showFocusPanel, setShowFocusPanel] = useState(false);
  const [userGoals, setUserGoals] = useState(aiService.getGoals());
  const [newGoalInput, setNewGoalInput] = useState('');

  // Integrations & Memory panel
  const [showIntegrationsPanel, setShowIntegrationsPanel] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ connected: false });
  const [memoryFacts, setMemoryFacts] = useState([]);
  const [conversations, setConversations] = useState([]);

  // Send to PA (Personal Assistant via Telegram)
  const [showPAPanel, setShowPAPanel] = useState(false);
  const [paMessage, setPAMessage] = useState('');
  const [paType, setPAType] = useState('note');

  // Send to PA - Opens Telegram with pre-filled message TO the bot
  // Bot can then read and respond to the message
  const sendToPA = (message, type = 'note') => {
    if (!message?.trim()) return;

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    // Format message based on type
    let formattedMsg = '';
    switch (type) {
      case 'ticket':
        formattedMsg = `🎫 TICKET\n\n${message}\n\n⏰ ${timestamp}`;
        break;
      case 'task':
        formattedMsg = `✅ TASK\n\n${message}\n\n⏰ ${timestamp}`;
        break;
      case 'reminder':
        formattedMsg = `⏰ REMINDER\n\n${message}\n\n📅 ${timestamp}`;
        break;
      case 'action':
        formattedMsg = `🎯 ACTION ITEM\n\n${message}\n\n⏰ ${timestamp}`;
        break;
      case 'summary':
        formattedMsg = `📊 SUMMARY\n\n${message}\n\n⏰ ${timestamp}`;
        break;
      default:
        formattedMsg = `📝 NOTE\n\n${message}\n\n⏰ ${timestamp}`;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(formattedMsg).catch(() => {});

    // Open Telegram with pre-filled message TO the bot (https works in browsers)
    // User just needs to tap send, then bot receives and can respond
    const encodedMsg = encodeURIComponent(formattedMsg);
    const telegramUrl = `https://t.me/LIV8AiBot?text=${encodedMsg}`;
    window.open(telegramUrl, '_blank');

    // Show confirmation
    addMessage('commander', `📤 Opening Telegram - tap send to message your PA!\n\nMessage copied to clipboard as backup.`, 'liv8-commander');

    // Reset
    setPAMessage('');
    setShowPAPanel(false);
  };

  // Quick send current conversation summary to PA
  const sendConversationToPA = () => {
    const recentMessages = messages.slice(-10);
    const summary = recentMessages.map(m =>
      `${m.role === 'user' ? '👤' : '🤖'} ${m.content.substring(0, 150)}${m.content.length > 150 ? '...' : ''}`
    ).join('\n\n');

    sendToPA(summary, 'summary');
  };

  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Initialize speech
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        const englishVoice = availableVoices.find(v =>
          v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Zira'))
        ) || availableVoices.find(v => v.lang.startsWith('en'));
        setSelectedVoice(englishVoice);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleSend(transcript);
      };

      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }

    return () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = (text) => {
    if (!voiceEnabled || !selectedVoice) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.rate = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const addMessage = (role, content, agentId = 'liv8-commander', extras = {}) => {
    const msg = {
      id: Date.now(),
      role,
      agentId,
      content,
      timestamp: new Date(),
      ...extras
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  };

  const createTask = (agentId, description) => {
    const agent = getAgentById(agentId);
    const task = {
      id: Date.now(),
      agentId,
      agentName: agent?.name || 'Unknown',
      description,
      status: 'in_progress',
      createdAt: new Date(),
      progress: 0
    };
    setActiveTasks(prev => [...prev, task]);

    // Simulate task progress
    const interval = setInterval(() => {
      setActiveTasks(prev => prev.map(t => {
        if (t.id === task.id && t.status === 'in_progress') {
          const newProgress = Math.min(t.progress + Math.random() * 30, 100);
          if (newProgress >= 100) {
            clearInterval(interval);
            return { ...t, progress: 100, status: 'completed' };
          }
          return { ...t, progress: newProgress };
        }
        return t;
      }));
    }, 1000);

    return task;
  };

  // Process specific commands that don't need AI
  const processLocalCommand = (input) => {
    const lower = input.toLowerCase();

    // Full context commands - use commander endpoint
    const fullContextTriggers = [
      'execution plan', 'summarize tickets', 'ticket summary', 'all tickets',
      'what are my tickets', 'show me tickets', 'ticket overview', 'priorities',
      'what should i work on', 'my workload', 'support queue', 'urgent tickets'
    ];

    if (fullContextTriggers.some(t => lower.includes(t))) {
      return { useCommander: true, message: input };
    }

    // Execution plan specific command
    if (lower.includes('execution plan') || lower.includes('create plan') || lower.includes('action plan')) {
      return { useExecutionPlan: true };
    }

    // Navigation commands
    const pages = ['dashboard', 'projects', 'agents', 'actions', 'domains', 'valuation', 'github', 'tickets', 'agent-team'];
    for (const page of pages) {
      if (lower.includes(`go to ${page}`) || lower.includes(`open ${page}`) || lower.includes(`show ${page}`) || lower.includes(`navigate to ${page}`)) {
        onNavigate(page);
        return { response: `Opening ${page} for you.`, speakText: `Opening ${page}`, isLocal: true };
      }
    }

    // Direct task assignment to specific agent
    if (lower.includes('assign') && lower.includes(' to ')) {
      for (const agent of SPECIALIZED_AGENTS) {
        if (lower.includes(agent.name.toLowerCase())) {
          const taskDesc = input.replace(/assign|task|to/gi, '').replace(new RegExp(agent.name, 'gi'), '').trim();
          const task = createTask(agent.id, taskDesc || 'General task');

          addMessage('agent', `Got it! I'm on it. Task received: "${taskDesc || 'General task'}"`, agent.id);

          return {
            response: `Task assigned to ${agent.name}. They're working on it now. Say "status" to track progress.`,
            speakText: `Task assigned to ${agent.name}`,
            isLocal: true
          };
        }
      }
    }

    // Status check - local command
    if (lower === 'status' || lower === 'tasks' || lower === 'show tasks' || lower === 'task status') {
      if (activeTasks.length === 0) {
        return { response: 'No active tasks. Assign a task to an agent to get started!', speakText: 'No active tasks', isLocal: true };
      }
      const statusReport = activeTasks.map(t => {
        const statusIcon = t.status === 'completed' ? '✅' : '🔄';
        return `${statusIcon} ${t.agentName}: ${t.description} (${Math.round(t.progress)}%)`;
      }).join('\n');
      return {
        response: `Active Tasks:\n${statusReport}`,
        speakText: `You have ${activeTasks.length} active tasks`,
        isLocal: true
      };
    }

    // Agent listing
    if (lower === 'list agents' || lower === 'show agents' || lower === 'agents') {
      const agentList = SPECIALIZED_AGENTS.map(a => `• ${a.name} - ${a.role} (${a.platform})`).join('\n');
      return {
        response: `Your AI Team (${SPECIALIZED_AGENTS.length} agents):\n\n${agentList}\n\nSay "assign [task] to [agent name]" to put them to work!`,
        speakText: `You have ${SPECIALIZED_AGENTS.length} specialized agents ready to work`,
        isLocal: true
      };
    }

    // Not a local command - needs AI processing
    return null;
  };

  const handleSend = async (text = inputText) => {
    if (!text.trim() && uploadedFiles.length === 0) return;

    const messageText = text.trim();

    // Add user message
    addMessage('user', messageText, null, {
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    });

    setInputText('');
    const currentFiles = [...uploadedFiles];
    setUploadedFiles([]);
    setIsProcessing(true);

    // First check for local commands (navigation, status, etc.)
    const localResult = processLocalCommand(messageText);

    if (localResult) {
      // Handle execution plan request
      if (localResult.useExecutionPlan) {
        try {
          addMessage('commander', "Analyzing all your tickets and creating an execution plan...", 'liv8-commander');
          const planData = await aiService.getExecutionPlan();
          addMessage('commander', planData.plan, 'liv8-commander');
          if (planData.ticketCount > 0) {
            speak(`Execution plan ready for ${planData.ticketCount} tickets`);
          }
        } catch (e) {
          addMessage('commander', `Error creating execution plan: ${e.message}`, 'liv8-commander');
        }
        setIsProcessing(false);
        return;
      }

      // Handle commander with full context
      if (localResult.useCommander) {
        try {
          const result = await aiService.commanderChat(localResult.message);
          addMessage('commander', result.response, 'liv8-commander');
          if (result.context) {
            speak(`I have access to ${result.context.ticketCount} tickets and ${result.context.agentCount} agents`);
          }
        } catch (e) {
          addMessage('commander', `Error: ${e.message}`, 'liv8-commander');
        }
        setIsProcessing(false);
        return;
      }

      // Handle locally without AI
      setTimeout(() => {
        addMessage('commander', localResult.response, 'liv8-commander');
        setIsProcessing(false);
        if (localResult.speakText) speak(localResult.speakText);
      }, 300);
      return;
    }

    // Use AI service for all other messages
    try {
      const context = {
        activeTasks,
        files: currentFiles,
        isScreenSharing
      };

      const result = await aiService.generateResponse(messageText, context);
      addMessage('commander', result.response, 'liv8-commander');
      if (result.speakText) speak(result.speakText);
    } catch (error) {
      console.error('AI response error:', error);
      addMessage('commander', "I'm having trouble processing that request. Please try again or rephrase your question.", 'liv8-commander');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save API key
  const handleSaveApiKey = () => {
    aiService.setApiKey(apiKey);
    setShowApiKeyInput(false);
    addMessage('system', 'API key saved! AI responses are now enabled.');
  };

  // Goal management
  const handleAddGoal = () => {
    if (!newGoalInput.trim()) return;
    const goal = aiService.addGoal(newGoalInput.trim());
    setUserGoals(aiService.getGoals());
    setNewGoalInput('');
    addMessage('system', `New goal added: "${goal.text}"`);
  };

  const handleCompleteGoal = (id) => {
    aiService.updateGoal(id, { status: 'completed', progress: 100 });
    setUserGoals(aiService.getGoals());
    addMessage('system', 'Goal marked as complete! Great work!');
  };

  // Clear conversation history
  const handleClearHistory = () => {
    if (confirm('Clear all conversation history? This cannot be undone.')) {
      aiService.clearHistory();
      setMessages([{
        id: Date.now(),
        role: 'commander',
        agentId: 'liv8-commander',
        content: "Fresh start! I've cleared our conversation history. What would you like to focus on?",
        timestamp: new Date()
      }]);
    }
  };

  // Export history
  const handleExportHistory = () => {
    const data = aiService.exportHistory();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liv8-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick action suggestions
  const quickActions = [
    { text: "Create execution plan from my tickets", icon: Target },
    { text: "Summarize all my tickets", icon: CheckSquare },
    { text: "What are my urgent priorities?", icon: AlertCircle },
    { text: "What should I focus on today?", icon: Zap }
  ];

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files.map(f => ({
      name: f.name, type: f.type, size: f.size
    }))]);
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      stream.getVideoTracks()[0].onended = () => setIsScreenSharing(false);
      addMessage('system', '🖥️ Screen sharing started - I can now see your screen');
    } catch (err) {
      console.error('Screen share error:', err);
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    setIsScreenSharing(false);
    addMessage('system', '🖥️ Screen sharing stopped');
  };

  const filteredAgents = selectedCategory === 'all'
    ? SPECIALIZED_AGENTS
    : SPECIALIZED_AGENTS.filter(a => a.category === selectedCategory);

  const getAgentColor = (agentId) => {
    const colors = {
      'liv8-commander': 'from-purple-600 to-cyan-500',
      'highlevel-specialist': 'from-orange-500 to-red-500',
      'hybrid-core': 'from-purple-500 to-pink-500',
      'helpbot': 'from-cyan-500 to-blue-500',
      'challenge-coach': 'from-green-500 to-emerald-500',
      'flow-manager': 'from-orange-500 to-yellow-500',
      'drawdown-defender': 'from-red-500 to-pink-500',
      'policy-pal': 'from-blue-500 to-indigo-500',
      'payout-pilot': 'from-green-500 to-teal-500',
      'promo-pilot': 'from-pink-500 to-purple-500',
      'tribe-builder': 'from-cyan-500 to-purple-500',
      'trade-tracker': 'from-yellow-500 to-orange-500',
      'skill-designer': 'from-purple-500 to-indigo-500',
      'skill-installer': 'from-gray-500 to-slate-500',
      'code-architect': 'from-blue-600 to-purple-600',
      'content-creator': 'from-pink-500 to-rose-500',
      'data-analyst': 'from-indigo-500 to-blue-500'
    };
    return colors[agentId] || 'from-gray-500 to-gray-600';
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 group ${
          isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-purple-600 to-cyan-500 hover:scale-110'
        }`}
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : (
          <div className="relative">
            <Bot className="w-6 h-6 text-white" />
            {activeTasks.filter(t => t.status === 'in_progress').length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className={`fixed bottom-[7.5rem] right-6 z-50 w-[450px] h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border transition-all duration-300 ${
          isDark ? 'bg-gray-900 border-purple-500/30' : 'bg-white border-gray-200'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>LIV8 Commander</h3>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {activeTasks.filter(t => t.status === 'in_progress').length} agents working
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowFocusPanel(!showFocusPanel)}
                  className={`p-2 rounded-lg relative ${showFocusPanel ? 'bg-green-600 text-white' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Goals & Focus"
                >
                  <Shield className="w-5 h-5" />
                  {userGoals.filter(g => g.status === 'active').length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[10px] text-white flex items-center justify-center">
                      {userGoals.filter(g => g.status === 'active').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowMemoryPanel(!showMemoryPanel)}
                  className={`p-2 rounded-lg relative ${showMemoryPanel ? 'bg-cyan-600 text-white' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Memory & History"
                >
                  <Brain className="w-5 h-5" />
                  {memoryFacts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full text-[10px] text-white flex items-center justify-center">
                      {memoryFacts.length > 9 ? '9+' : memoryFacts.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowIntegrationsPanel(!showIntegrationsPanel)}
                  className={`p-2 rounded-lg relative ${showIntegrationsPanel ? 'bg-orange-600 text-white' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Integrations"
                >
                  <Link className="w-5 h-5" />
                  {backendStatus.connected && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setShowTaskPanel(!showTaskPanel)}
                  className={`p-2 rounded-lg relative ${showTaskPanel ? 'bg-purple-600 text-white' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Active Tasks"
                >
                  <Target className="w-5 h-5" />
                  {activeTasks.filter(t => t.status === 'in_progress').length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[10px] text-white flex items-center justify-center">
                      {activeTasks.filter(t => t.status === 'in_progress').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowAgentPanel(!showAgentPanel)}
                  className={`p-2 rounded-lg ${showAgentPanel ? 'bg-purple-600 text-white' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Agents"
                >
                  <Users className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowPAPanel(!showPAPanel)}
                  className={`p-2 rounded-lg ${showPAPanel ? 'bg-cyan-600 text-white' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="Send to PA (Telegram)"
                >
                  <Send className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg ${showSettings ? 'bg-purple-600 text-white' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className={`p-3 border-b ${isDark ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)} className="accent-purple-600" />
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Voice</span>
                  </label>
                  {voices.length > 0 && (
                    <select
                      value={selectedVoice?.name || ''}
                      onChange={e => setSelectedVoice(voices.find(v => v.name === e.target.value))}
                      className={`flex-1 px-2 py-1 rounded text-sm ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border`}
                    >
                      {voices.filter(v => v.lang.startsWith('en')).map(v => (
                        <option key={v.name} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      AI: {backendStatus.connected ? `${backendStatus.provider} ✓` : '○ Offline'}
                    </span>
                    <button
                      onClick={() => setShowAISettings(true)}
                      className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-purple-600 text-white hover:bg-purple-500'}`}
                    >
                      AI Settings
                    </button>
                  </div>
                  {backendStatus.connected && (
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Model: {backendStatus.model || 'default'}
                    </div>
                  )}
                </div>
                {/* History management */}
                <div className="pt-2 border-t border-gray-700 flex gap-2">
                  <button
                    onClick={handleExportHistory}
                    className={`flex-1 px-2 py-1 text-xs rounded ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Export History
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="px-2 py-1 text-xs rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"
                  >
                    Clear History
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Focus/Goals Panel */}
          {showFocusPanel && (
            <div className={`p-3 border-b max-h-48 overflow-y-auto ${isDark ? 'border-gray-800 bg-gradient-to-br from-green-900/20 to-emerald-900/20' : 'border-gray-200 bg-green-50'}`}>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                <Shield className="w-3 h-3" /> YOUR MISSION
              </h4>
              {/* Add goal input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newGoalInput}
                  onChange={e => setNewGoalInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
                  placeholder="Add a goal..."
                  className={`flex-1 px-2 py-1.5 rounded text-sm ${isDark ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'} border`}
                />
                <button
                  onClick={handleAddGoal}
                  disabled={!newGoalInput.trim()}
                  className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {/* Goals list */}
              {userGoals.filter(g => g.status === 'active').length > 0 ? (
                <div className="space-y-2">
                  {userGoals.filter(g => g.status === 'active').map(goal => (
                    <div key={goal.id} className={`p-2 rounded-lg flex items-center justify-between ${isDark ? 'bg-gray-900/50' : 'bg-white border'}`}>
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{goal.text}</span>
                      <button
                        onClick={() => handleCompleteGoal(goal.id)}
                        className="p-1 rounded hover:bg-green-600/20 text-green-500"
                        title="Mark complete"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-xs text-center py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  No active goals. Add one above to stay focused!
                </p>
              )}
              {/* Completed goals count */}
              {userGoals.filter(g => g.status === 'completed').length > 0 && (
                <p className={`text-xs mt-2 ${isDark ? 'text-green-500' : 'text-green-600'}`}>
                  {userGoals.filter(g => g.status === 'completed').length} goal{userGoals.filter(g => g.status === 'completed').length > 1 ? 's' : ''} completed
                </p>
              )}
            </div>
          )}

          {/* Integrations Panel */}
          {showIntegrationsPanel && (
            <div className={`p-3 border-b max-h-48 overflow-y-auto ${isDark ? 'border-gray-800 bg-gradient-to-br from-orange-900/20 to-yellow-900/20' : 'border-gray-200 bg-orange-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-xs font-semibold flex items-center gap-1 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                  <Link className="w-3 h-3" /> INTEGRATIONS
                </h4>
                <button
                  onClick={refreshIntegrations}
                  className={`p-1 rounded ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              {/* Backend Status */}
              <div className={`p-2 rounded-lg mb-2 ${isDark ? 'bg-gray-900/50' : 'bg-white border'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Backend Server</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${backendStatus.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {backendStatus.connected ? 'Connected' : 'Offline'}
                  </span>
                </div>
                {backendStatus.connected && (
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    AI: {backendStatus.provider || 'unknown'} / {backendStatus.model?.substring(0, 20) || 'unknown'}
                  </p>
                )}
              </div>

              {/* Integration List */}
              <div className="space-y-1">
                {[
                  { name: 'Taskade', key: 'taskade', icon: CheckSquare, color: 'purple' },
                  { name: 'TaskMagic', key: 'taskmagic', icon: Webhook, color: 'blue' },
                  { name: 'GoHighLevel', key: 'ghl', icon: Users, color: 'orange' },
                  { name: 'Supabase', key: 'supabase', icon: Database, color: 'green' }
                ].map(integration => {
                  const status = backendStatus.integrations?.[integration.key];
                  return (
                    <div key={integration.key} className={`p-2 rounded-lg flex items-center justify-between ${isDark ? 'bg-gray-900/30 hover:bg-gray-900/50' : 'bg-white/50 hover:bg-white border'}`}>
                      <div className="flex items-center gap-2">
                        <integration.icon className={`w-4 h-4 text-${integration.color}-500`} />
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{integration.name}</span>
                      </div>
                      <span className={`text-[10px] ${status?.connected ? 'text-green-400' : status?.configured ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {status?.connected ? 'Connected' : status?.configured ? 'Configured' : 'Not Setup'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className={`text-[10px] mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Configure API keys in server/.env
              </p>
            </div>
          )}

          {/* Memory Panel */}
          {showMemoryPanel && (
            <div className={`p-3 border-b max-h-48 overflow-y-auto ${isDark ? 'border-gray-800 bg-gradient-to-br from-cyan-900/20 to-blue-900/20' : 'border-gray-200 bg-cyan-50'}`}>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-1 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                <Brain className="w-3 h-3" /> MEMORY & CONTEXT
              </h4>

              {/* Remembered Facts */}
              {memoryFacts.length > 0 ? (
                <div className="space-y-1 mb-3">
                  <p className={`text-[10px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Things I Remember:</p>
                  {memoryFacts.slice(0, 8).map((fact, i) => (
                    <div key={i} className={`text-xs p-1.5 rounded ${isDark ? 'bg-gray-900/50 text-gray-300' : 'bg-white text-gray-700'}`}>
                      <span className={`text-[10px] text-cyan-500 mr-1`}>[{fact.category}]</span>
                      {fact.fact}
                    </div>
                  ))}
                  {memoryFacts.length > 8 && (
                    <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      +{memoryFacts.length - 8} more facts remembered
                    </p>
                  )}
                </div>
              ) : (
                <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  No facts remembered yet. I'll learn as we chat!
                </p>
              )}

              {/* Conversation History */}
              {conversations.length > 0 && (
                <div>
                  <p className={`text-[10px] font-medium mb-1 flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <History className="w-3 h-3" /> Recent Conversations:
                  </p>
                  <div className="space-y-1">
                    {conversations.slice(0, 3).map(conv => (
                      <button
                        key={conv.id}
                        onClick={async () => {
                          const msgs = await aiService.loadConversation(conv.id);
                          if (msgs) {
                            setMessages(msgs.map((m, idx) => ({
                              id: idx,
                              role: m.role === 'user' ? 'user' : 'commander',
                              agentId: m.role === 'user' ? null : 'liv8-commander',
                              content: m.content,
                              timestamp: new Date(m.timestamp)
                            })));
                            setShowMemoryPanel(false);
                          }
                        }}
                        className={`w-full text-left p-1.5 rounded text-xs ${isDark ? 'bg-gray-900/30 hover:bg-gray-900/50 text-gray-300' : 'bg-white hover:bg-gray-50 text-gray-700 border'}`}
                      >
                        <span className="truncate block">{conv.title || 'Untitled'}</span>
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {conv.message_count} messages
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!backendStatus.connected && (
                <p className={`text-[10px] mt-2 ${isDark ? 'text-yellow-500' : 'text-yellow-600'}`}>
                  Start the backend server for persistent memory
                </p>
              )}
            </div>
          )}

          {/* Task Panel */}
          {showTaskPanel && activeTasks.length > 0 && (
            <div className={`p-3 border-b max-h-40 overflow-y-auto ${isDark ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
              <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ACTIVE TASKS</h4>
              <div className="space-y-2">
                {activeTasks.map(task => (
                  <div key={task.id} className={`p-2 rounded-lg ${isDark ? 'bg-gray-900' : 'bg-white border'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{task.agentName}</span>
                      <span className={`text-xs ${task.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {task.status === 'completed' ? '✓ Done' : `${Math.round(task.progress)}%`}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{task.description}</p>
                    <div className="mt-1 h-1 rounded-full bg-gray-700 overflow-hidden">
                      <div className={`h-full transition-all ${task.status === 'completed' ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${task.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Panel */}
          {showAgentPanel && (
            <div className={`p-3 border-b max-h-48 overflow-y-auto ${isDark ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex gap-1 mb-2 flex-wrap">
                {AGENT_CATEGORIES.slice(0, 5).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2 py-0.5 text-xs rounded-full ${selectedCategory === cat.id ? 'bg-purple-600 text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {filteredAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setInputText(`Assign task to ${agent.name}: `);
                      setShowAgentPanel(false);
                    }}
                    className={`p-2 rounded-lg text-left transition-all hover:scale-[1.02] ${isDark ? 'bg-gray-900 hover:bg-gray-700' : 'bg-white hover:bg-gray-50 border'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAgentColor(agent.id)} flex items-center justify-center`}>
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{agent.name}</p>
                        <p className={`text-[10px] truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{agent.role}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Send to PA Panel */}
          {showPAPanel && (
            <div className={`p-3 border-b ${isDark ? 'border-gray-800 bg-gradient-to-r from-cyan-900/30 to-purple-900/30' : 'border-gray-200 bg-gradient-to-r from-cyan-50 to-purple-50'}`}>
              <h4 className={`text-xs font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                <Send className="w-3 h-3" /> SEND TO PA (Opens Telegram)
              </h4>
              <p className={`text-[10px] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Opens Telegram with your message → tap send → bot reads & responds
              </p>
              <div className="flex gap-1 mb-2 flex-wrap">
                {[
                  { id: 'note', label: '📝 Note' },
                  { id: 'task', label: '✅ Task' },
                  { id: 'reminder', label: '⏰ Reminder' },
                  { id: 'action', label: '🎯 Action' },
                  { id: 'ticket', label: '🎫 Ticket' }
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setPAType(type.id)}
                    className={`px-2 py-1 text-xs rounded-full transition-all ${
                      paType === type.id
                        ? 'bg-cyan-600 text-white'
                        : isDark
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={paMessage}
                  onChange={(e) => setPAMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendToPA(paMessage, paType)}
                  placeholder="Type message for your PA..."
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } border focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                />
                <button
                  onClick={() => sendToPA(paMessage, paType)}
                  disabled={!paMessage.trim()}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    paMessage.trim()
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      : isDark
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={sendConversationToPA}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  📤 Send Chat Summary
                </button>
                <button
                  onClick={() => {
                    const dailyBrief = `Today's Focus:\n${userGoals.map(g => `• ${g}`).join('\n') || 'No goals set'}`;
                    sendToPA(dailyBrief, 'summary');
                  }}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${
                    isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  }`}
                >
                  📊 Send Daily Brief
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'system' ? (
                  <div className={`text-center text-xs py-1 px-3 rounded-full ${isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-200 text-gray-500'}`}>
                    {msg.content}
                  </div>
                ) : (
                  <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.role !== 'user' && (
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAgentColor(msg.agentId)} flex items-center justify-center flex-shrink-0`}>
                        {msg.role === 'commander' ? <Zap className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                      </div>
                    )}
                    <div className={`px-4 py-2 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-br-sm'
                        : isDark
                          ? 'bg-gray-800 text-gray-200 rounded-bl-sm'
                          : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                    }`}>
                      {msg.role !== 'user' && msg.role !== 'commander' && (
                        <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                          {getAgentById(msg.agentId)?.name || 'Agent'}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
                <div className={`px-4 py-2 rounded-2xl rounded-bl-sm ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Files Preview */}
          {uploadedFiles.length > 0 && (
            <div className={`px-4 py-2 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    <FileText className="w-3 h-3" />
                    <span className="max-w-[80px] truncate">{f.name}</span>
                    <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {messages.length <= 2 && (
            <div className={`px-4 py-2 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Quick actions:</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(action.text)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                      isDark
                        ? 'bg-gray-800 text-gray-300 hover:bg-purple-600 hover:text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-purple-600 hover:text-white'
                    }`}
                  >
                    <action.icon className="w-3 h-3" />
                    {action.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className={`p-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                <Paperclip className="w-5 h-5" />
              </button>
              <button onClick={isScreenSharing ? stopScreenShare : startScreenShare} className={`p-2 rounded-lg ${isScreenSharing ? 'bg-red-500/20 text-red-500' : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                {isScreenSharing ? <StopCircle className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </button>
              {isSpeaking && (
                <button onClick={() => { window.speechSynthesis.cancel(); setIsSpeaking(false); }} className="p-2 rounded-lg bg-red-500/20 text-red-500">
                  <VolumeX className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleListening}
                className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-purple-600 text-white hover:bg-purple-500'}`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Talk to your AI team..."
                className={`flex-1 px-4 py-3 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400'} focus:outline-none focus:border-purple-500`}
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputText.trim() && uploadedFiles.length === 0}
                className={`p-3 rounded-xl ${inputText.trim() || uploadedFiles.length ? 'bg-cyan-600 text-white hover:bg-cyan-500' : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-200 text-gray-400'}`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;
