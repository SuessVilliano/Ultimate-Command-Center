import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  History,
  Phone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Recorder from 'opus-recorder';
import { useTheme } from '../context/ThemeContext';
import { COMMANDER_AGENT, SPECIALIZED_AGENTS, AGENT_CATEGORIES, getAgentById } from '../data/agents';
import aiService from '../services/aiService';
import AISettings from './AISettings';
import { API_URL } from '../config';

// ── PersonaPlex protocol constants ──────────────────────────────
const MSG_HANDSHAKE = 0x00;
const MSG_AUDIO    = 0x01;
const MSG_TEXT     = 0x02;
const MSG_CONTROL  = 0x03;
const MSG_PING     = 0x06;
const CTRL_START   = 0x00;

function encodeMessage(type, payload) {
  const typeBuf = new Uint8Array([type]);
  if (!payload || payload.length === 0) return typeBuf;
  const merged = new Uint8Array(1 + payload.length);
  merged[0] = type;
  merged.set(payload instanceof Uint8Array ? payload : new Uint8Array(payload), 1);
  return merged;
}

function decodeMessage(data) {
  const arr = new Uint8Array(data);
  return { type: arr[0], payload: arr.slice(1) };
}

function getPersonaPlexServer() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('worker_addr');
  if (fromQuery) return fromQuery;
  const fromEnv = import.meta.env.VITE_PERSONAPLEX_SERVER;
  if (fromEnv) return fromEnv;
  return 'localhost:8998';
}

const PERSONAPLEX_VOICES = [
  { value: 'NATF0.pt', label: 'Natural Female 1' },
  { value: 'NATF1.pt', label: 'Natural Female 2' },
  { value: 'NATF2.pt', label: 'Natural Female 3' },
  { value: 'NATF3.pt', label: 'Natural Female 4' },
  { value: 'NATM0.pt', label: 'Natural Male 1' },
  { value: 'NATM1.pt', label: 'Natural Male 2' },
  { value: 'NATM2.pt', label: 'Natural Male 3' },
  { value: 'NATM3.pt', label: 'Natural Male 4' },
  { value: 'VARF0.pt', label: 'Varied Female 1' },
  { value: 'VARF1.pt', label: 'Varied Female 2' },
  { value: 'VARF2.pt', label: 'Varied Female 3' },
  { value: 'VARF3.pt', label: 'Varied Female 4' },
  { value: 'VARF4.pt', label: 'Varied Female 5' },
  { value: 'VARM0.pt', label: 'Varied Male 1' },
  { value: 'VARM1.pt', label: 'Varied Male 2' },
  { value: 'VARM2.pt', label: 'Varied Male 3' },
  { value: 'VARM3.pt', label: 'Varied Male 4' },
  { value: 'VARM4.pt', label: 'Varied Male 5' },
];

const DEFAULT_VOICE_PROMPT =
  `You are an AI assistant integrated into LIV8 Command Center — a voice-enabled operations dashboard for managing projects, support tickets, GitHub repos, AI agent teams, domain portfolios, integrations (Freshdesk, ClickUp, GitHub), news monitoring, and automated workflows. You help users navigate the app, find information, manage tasks, troubleshoot issues, and operate the platform hands-free. Be concise and helpful.`;

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

  // PersonaPlex voice state
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState('NATF0.pt');
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [aiAudioLevel, setAiAudioLevel] = useState(0);
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [micActive, setMicActive] = useState(false);

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
  const screenStreamRef = useRef(null);

  // PersonaPlex refs
  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const decoderWorkerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      disconnectPersonaPlex();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── PersonaPlex voice engine ────────────────────────────────────

  const startLevelMonitoring = useCallback((stream) => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setUserAudioLevel(Math.min(avg / 128, 1));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* non-critical */ }
  }, []);

  const startMicForPersonaPlex = useCallback(async (ws, audioCtx) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;
      startLevelMonitoring(stream);

      const recorder = new Recorder({
        encoderPath: '/encoderWorker.min.js',
        mediaTrackConstraints: { sampleRate: 24000, channelCount: 1 },
        encoderSampleRate: 24000,
        encoderFrameSize: 960,
        encoderApplication: 2048,
        streamPages: true,
        sourceNode: audioCtx.createMediaStreamSource(stream),
      });

      recorder.ondataavailable = (opusData) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(encodeMessage(MSG_AUDIO, new Uint8Array(opusData)));
        }
      };

      await recorder.start();
      recorderRef.current = recorder;
      setMicActive(true);
    } catch (err) {
      console.error('PersonaPlex mic error:', err);
      setMicActive(false);
    }
  }, [startLevelMonitoring]);

  const connectPersonaPlex = useCallback(async () => {
    setVoiceConnecting(true);
    setVoiceError(null);
    setVoiceTranscript('');

    const serverAddr = getPersonaPlexServer();
    const textSeed = Math.floor(Math.random() * 100000);
    const audioSeed = Math.floor(Math.random() * 100000);

    const wsUrl =
      `wss://${serverAddr}/api/chat?` +
      `text_temperature=0.7&text_topk=25&audio_temperature=0.8&audio_topk=250` +
      `&pad_mult=0&text_seed=${textSeed}&audio_seed=${audioSeed}` +
      `&repetition_penalty_context=64&repetition_penalty=1.0` +
      `&text_prompt=${encodeURIComponent(DEFAULT_VOICE_PROMPT)}` +
      `&voice_prompt=${encodeURIComponent(selectedVoice)}`;

    try {
      const audioCtx = new AudioContext({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;

      await audioCtx.audioWorklet.addModule('/moshi-processor.js');
      const workletNode = new AudioWorkletNode(audioCtx, 'moshi-processor');
      workletNode.connect(audioCtx.destination);
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e) => {
        if (e.data && typeof e.data.delay === 'number') {
          setAiAudioLevel(e.data.delay > 0.05 ? 0.6 + Math.random() * 0.4 : 0);
        }
      };

      const decoderWorker = new Worker('/decoderWorker.min.js');
      decoderWorkerRef.current = decoderWorker;

      decoderWorker.onmessage = (e) => {
        if (e.data && e.data.length) {
          const pcm = new Float32Array(e.data);
          workletNode.port.postMessage({ type: 'audio', frame: pcm, micDuration: 0 });
        }
      };

      decoderWorker.postMessage({
        command: 'init',
        decoderSampleRate: 24000,
        outputBufferSampleRate: 24000,
      });

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setVoiceConnecting(false);
        setVoiceActive(true);
        setShowVoiceSetup(false);

        ws.send(encodeMessage(MSG_CONTROL, new Uint8Array([CTRL_START])));

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(encodeMessage(MSG_PING, null));
          }
        }, 5000);

        addMessage('system', 'Voice session started — speak freely, the AI can hear and respond in real-time');
        startMicForPersonaPlex(ws, audioCtx);
      };

      ws.onmessage = (event) => {
        const { type, payload } = decodeMessage(event.data);
        switch (type) {
          case MSG_AUDIO:
            decoderWorker.postMessage(
              { command: 'decode', pages: payload.buffer },
              [payload.buffer]
            );
            break;
          case MSG_TEXT: {
            const text = new TextDecoder().decode(payload);
            setVoiceTranscript((prev) => prev + text);
            break;
          }
          default:
            break;
        }
      };

      ws.onerror = () => {
        setVoiceConnecting(false);
        setVoiceError('Connection failed. Is the PersonaPlex server running?');
      };

      ws.onclose = () => {
        setVoiceActive(false);
        setVoiceConnecting(false);
        cleanupVoicePing();
      };
    } catch (err) {
      console.error('PersonaPlex connect error:', err);
      setVoiceConnecting(false);
      setVoiceError('Failed to initialize audio. Check browser permissions.');
    }
  }, [selectedVoice, startMicForPersonaPlex]);

  const disconnectPersonaPlex = useCallback(() => {
    cleanupVoicePing();

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recorderRef.current) {
      try { recorderRef.current.stop(); } catch { /* */ }
      recorderRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (decoderWorkerRef.current) {
      decoderWorkerRef.current.terminate();
      decoderWorkerRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'reset' });
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    // Flush transcript to chat as a message
    setVoiceTranscript((prev) => {
      if (prev.trim()) {
        addMessage('commander', prev.trim(), 'liv8-commander');
      }
      return '';
    });

    setMicActive(false);
    setAiAudioLevel(0);
    setUserAudioLevel(0);
    setVoiceActive(false);
    setVoiceConnecting(false);
  }, []);

  const cleanupVoicePing = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const handleMicButton = () => {
    if (voiceActive) {
      addMessage('system', 'Voice session ended');
      disconnectPersonaPlex();
    } else if (voiceConnecting) {
      // Already connecting, do nothing
    } else {
      setShowVoiceSetup(!showVoiceSetup);
    }
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
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 group ${
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
        <div className={`fixed bottom-24 right-6 z-50 w-[450px] h-[650px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border transition-all duration-300 ${
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>PersonaPlex Voice</span>
                    {voiceActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Active</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedVoice}
                      onChange={e => setSelectedVoice(e.target.value)}
                      disabled={voiceActive}
                      className={`flex-1 px-2 py-1 rounded text-sm ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border disabled:opacity-50`}
                    >
                      {PERSONAPLEX_VOICES.map(v => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Server: <span className="font-mono">{getPersonaPlexServer()}</span>
                  </div>
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

          {/* PersonaPlex Voice Session Banner */}
          {voiceActive && (
            <div className={`px-4 py-3 border-t ${isDark ? 'border-emerald-800/50 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50'}`}>
              {/* Audio visualizers */}
              <div className="flex items-center justify-center gap-6 mb-2">
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-emerald-500 flex items-center justify-center transition-all duration-100"
                    style={{
                      boxShadow: aiAudioLevel > 0.1 ? `0 0 ${aiAudioLevel * 16}px rgba(16,185,129,${aiAudioLevel * 0.5})` : 'none',
                      transform: `scale(${1 + aiAudioLevel * 0.12})`,
                    }}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-400" style={{ opacity: 0.4 + aiAudioLevel * 0.6 }} />
                  </div>
                  <span className="text-[9px] text-emerald-400 font-medium">AI</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-blue-500 flex items-center justify-center transition-all duration-100"
                    style={{
                      boxShadow: userAudioLevel > 0.1 ? `0 0 ${userAudioLevel * 16}px rgba(59,130,246,${userAudioLevel * 0.5})` : 'none',
                      transform: `scale(${1 + userAudioLevel * 0.12})`,
                    }}
                  >
                    <div className="w-5 h-5 rounded-full bg-blue-400" style={{ opacity: 0.4 + userAudioLevel * 0.6 }} />
                  </div>
                  <span className="text-[9px] text-blue-400 font-medium">You</span>
                </div>
              </div>
              {/* Live transcript */}
              {voiceTranscript && (
                <div className={`text-xs max-h-16 overflow-y-auto rounded-lg p-2 mb-2 ${isDark ? 'bg-gray-800/80 text-gray-300' : 'bg-white text-gray-700'}`}>
                  {voiceTranscript}
                </div>
              )}
              {/* Mic status + end */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {micActive ? (
                    <><Mic className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400">Speak freely</span></>
                  ) : (
                    <><MicOff className="w-3 h-3 text-red-400" /><span className="text-[10px] text-red-400">Mic off</span></>
                  )}
                </div>
                <button
                  onClick={() => { addMessage('system', 'Voice session ended'); disconnectPersonaPlex(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs text-white font-medium transition-colors"
                >
                  <Phone className="w-3 h-3 rotate-[135deg]" />
                  End
                </button>
              </div>
            </div>
          )}

          {/* Voice Setup Panel (shown when mic clicked while disconnected) */}
          {showVoiceSetup && !voiceActive && (
            <div className={`px-4 py-3 border-t ${isDark ? 'border-gray-800 bg-gradient-to-r from-emerald-900/20 to-cyan-900/20' : 'border-gray-200 bg-emerald-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <Mic className="w-3 h-3" /> PersonaPlex Voice
                </span>
                <button onClick={() => setShowVoiceSetup(false)} className={`p-1 rounded ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}>
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={selectedVoice}
                  onChange={e => setSelectedVoice(e.target.value)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border`}
                >
                  {PERSONAPLEX_VOICES.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
                <button
                  onClick={connectPersonaPlex}
                  disabled={voiceConnecting}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    voiceConnecting
                      ? 'bg-emerald-700 text-white cursor-wait'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95'
                  }`}
                >
                  {voiceConnecting ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connecting
                    </span>
                  ) : 'Start'}
                </button>
              </div>
              {voiceError && (
                <p className="text-[10px] text-red-400 bg-red-400/10 rounded-lg px-2 py-1 mb-1">{voiceError}</p>
              )}
              <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Server: <span className="font-mono">{getPersonaPlexServer()}</span> — Full-duplex voice, no turn-taking needed
              </p>
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
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMicButton}
                className={`p-3 rounded-xl transition-all ${
                  voiceActive
                    ? 'bg-emerald-500 text-white animate-pulse'
                    : voiceConnecting
                    ? 'bg-yellow-500 text-white animate-pulse'
                    : showVoiceSetup
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
                title={voiceActive ? 'End voice session' : 'Start PersonaPlex voice'}
              >
                {voiceActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
