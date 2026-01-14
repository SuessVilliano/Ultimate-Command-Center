// LIV8 Command Center - AI Service
// Uses Backend API with Claude/GPT + persistent conversation memory
// Falls back to Gemini for browser-only mode

import { COMMANDER_AGENT, SPECIALIZED_AGENTS, findBestAgentForTask, getAgentById } from '../data/agents';
import { getAgentKnowledge } from '../data/knowledgebase/index';

const BACKEND_URL = 'http://localhost:3005';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'liv8_gemini_api_key',
  CONVERSATIONS: 'liv8_conversations',
  GOALS: 'liv8_user_goals',
  TASKS: 'liv8_pending_tasks',
  USER_CONTEXT: 'liv8_user_context',
  LAST_SESSION: 'liv8_last_session',
  GITHUB_REPOS: 'liv8_github_repos',
  INTEGRATIONS: 'liv8_integrations'
};

// Pre-configured integrations (will be stored in localStorage)
const DEFAULT_INTEGRATIONS = {
  freshdesk: {
    domain: 'gohighlevelassist',
    apiKey: 'jtPOes8ocVu4sv98Gf7s',
    agentId: '155014160586'
  },
  clickup: {
    apiKey: 'pk_94888363_PUI34L440WNP55XCJ9HZMXX22U7X05ED'
  },
  twilio: {
    userSid: 'USfc019fdcbcee43d3ad6bc3c2f47e0b'
  },
  taskmagic: {
    mcpToken: '8gYMmWQYO4NM2oLg7NRJN'
  }
};

// System context for the AI
const SYSTEM_CONTEXT = `You are LIV8 Commander, an AI orchestrator and business partner helping the user build their empire and become a multi-millionaire.

ABOUT THE USER'S PORTFOLIO (Current Value: $420K - $1.6M):
- 9 Software Products ready to monetize
- 12 AI Agents ready to work
- 7 Business Entities including:
  * Hybrid Funding (prop trading firm)
  * LIV8 AI (AI solutions)
  * Smart Life Brokers (insurance)
  * TradeHybrid
- 9 Premium Domains with value

KEY BUSINESSES TO FOCUS ON:
1. Hybrid Funding - Prop trading firm, needs traders and marketing
2. LIV8 AI - AI solutions and automation services
3. Smart Life Brokers - Insurance leads and sales

AVAILABLE SPECIALIZED AGENTS:
${SPECIALIZED_AGENTS.map(a => `- ${a.name}: ${a.role}`).join('\n')}

YOUR ROLE AS COMMANDER:
1. Be a PROACTIVE business partner, not just a reactive assistant
2. Suggest tasks and priorities the user might not think of
3. Keep them focused on revenue-generating activities
4. Break down overwhelming goals into daily actionable tasks
5. Remember ALL conversations and reference past discussions
6. Track progress toward their millionaire goal
7. Be direct, motivating, and action-oriented

COMMUNICATION STYLE:
- Be conversational and supportive like a trusted advisor
- Give direct, actionable advice
- Don't overwhelm with options - recommend THE BEST path
- Celebrate wins and keep momentum
- When they seem stuck, provide the next clear step`;

class AIService {
  constructor() {
    this.apiKey = this.loadFromStorage(STORAGE_KEYS.API_KEY, '');
    this.conversationHistory = this.loadFromStorage(STORAGE_KEYS.CONVERSATIONS, []);
    this.userGoals = this.loadFromStorage(STORAGE_KEYS.GOALS, []);
    this.pendingTasks = this.loadFromStorage(STORAGE_KEYS.TASKS, []);
    this.userContext = this.loadFromStorage(STORAGE_KEYS.USER_CONTEXT, {
      name: '',
      topPriority: '',
      revenueGoal: 1000000,
      notes: []
    });
    this.lastSession = this.loadFromStorage(STORAGE_KEYS.LAST_SESSION, null);

    // Backend connection state
    this.backendConnected = false;
    this.conversationId = null;
    this.memoryFacts = [];
    this.integrationStatus = {};

    // Initialize integrations with defaults if not set
    this.integrations = this.loadFromStorage(STORAGE_KEYS.INTEGRATIONS, null);
    if (!this.integrations) {
      this.integrations = DEFAULT_INTEGRATIONS;
      this.saveToStorage(STORAGE_KEYS.INTEGRATIONS, this.integrations);
    }

    // Check backend connection on startup
    this.checkBackendConnection();
  }

  // Backend connection methods
  async checkBackendConnection() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        this.backendConnected = true;
        this.backendInfo = data;
        console.log('Backend connected:', data.ai?.provider, data.ai?.model);

        // Load memory facts from backend
        await this.loadMemoryFacts();
        // Check integration status
        await this.checkIntegrationStatus();
        return true;
      }
    } catch (e) {
      console.log('Backend not available, using browser-only mode');
      this.backendConnected = false;
    }
    return false;
  }

  async loadMemoryFacts() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/memory/facts`);
      if (response.ok) {
        const data = await response.json();
        this.memoryFacts = data.facts || [];
      }
    } catch (e) {}
  }

  async checkIntegrationStatus() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/status`);
      if (response.ok) {
        this.integrationStatus = await response.json();
      }
    } catch (e) {}
  }

  getBackendStatus() {
    return {
      connected: this.backendConnected,
      provider: this.backendInfo?.ai?.provider,
      model: this.backendInfo?.ai?.model,
      integrations: this.integrationStatus
    };
  }

  getMemoryFacts() {
    return this.memoryFacts;
  }

  async storeFact(category, fact) {
    if (!this.backendConnected) return false;
    try {
      await fetch(`${BACKEND_URL}/api/memory/facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, fact })
      });
      await this.loadMemoryFacts();
      return true;
    } catch (e) {
      return false;
    }
  }

  // Taskade integration
  async getTaskadeWorkspaces() {
    if (!this.backendConnected) return [];
    try {
      const response = await fetch(`${BACKEND_URL}/api/taskade/workspaces`);
      if (response.ok) {
        const data = await response.json();
        return data.items || [];
      }
    } catch (e) {}
    return [];
  }

  async createTaskadeTask(projectId, content) {
    if (!this.backendConnected) return null;
    try {
      const response = await fetch(`${BACKEND_URL}/api/taskade/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {}
    return null;
  }

  // GHL integration
  async getGHLContacts(query = '') {
    if (!this.backendConnected) return [];
    try {
      const response = await fetch(`${BACKEND_URL}/api/ghl/contacts?query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        return data.contacts || [];
      }
    } catch (e) {}
    return [];
  }

  // TaskMagic integration
  async triggerTaskMagicAutomation(name, payload = {}) {
    if (!this.backendConnected) return false;
    try {
      const response = await fetch(`${BACKEND_URL}/api/taskmagic/automation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationName: name, payload })
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  // Integrations management
  getIntegrations() {
    return this.integrations;
  }

  getIntegration(service) {
    return this.integrations?.[service] || null;
  }

  updateIntegration(service, config) {
    this.integrations = {
      ...this.integrations,
      [service]: { ...this.integrations?.[service], ...config }
    };
    this.saveToStorage(STORAGE_KEYS.INTEGRATIONS, this.integrations);
  }

  // ============================================
  // COMMANDER WITH FULL APP CONTEXT
  // ============================================

  // Chat with full access to tickets, analyses, agents
  async commanderChat(message) {
    if (!this.backendConnected) {
      return { response: 'Backend server not connected. Start the server for full app access.', context: null };
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/commander/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (response.ok) {
        const data = await response.json();
        // Save to conversation history
        this.addToHistory('user', message);
        this.addToHistory('assistant', data.response);
        return data;
      } else {
        const error = await response.json();
        return { response: `Error: ${error.error}`, context: null };
      }
    } catch (e) {
      console.error('Commander chat error:', e);
      return { response: `Connection error: ${e.message}`, context: null };
    }
  }

  // Get execution plan from all tickets
  async getExecutionPlan() {
    if (!this.backendConnected) {
      return { plan: 'Backend server not connected. Start the server for execution plan.', ticketCount: 0 };
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/commander/execution-plan`);
      if (response.ok) {
        return await response.json();
      } else {
        const error = await response.json();
        return { plan: `Error: ${error.error}`, ticketCount: 0 };
      }
    } catch (e) {
      console.error('Execution plan error:', e);
      return { plan: `Connection error: ${e.message}`, ticketCount: 0 };
    }
  }

  // Get all tickets for context
  async getAllTickets() {
    if (!this.backendConnected) return [];
    try {
      const response = await fetch(`${BACKEND_URL}/api/tickets`);
      if (response.ok) {
        const data = await response.json();
        return data.tickets || [];
      }
    } catch (e) {}
    return [];
  }

  // Get all analyses for context
  async getAllAnalyses() {
    if (!this.backendConnected) return [];
    try {
      const response = await fetch(`${BACKEND_URL}/api/analyses`);
      if (response.ok) {
        const data = await response.json();
        return data.analyses || [];
      }
    } catch (e) {}
    return [];
  }

  // Storage helpers
  loadFromStorage(key, defaultValue) {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      console.error(`Error loading ${key}:`, e);
      return defaultValue;
    }
  }

  saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error saving ${key}:`, e);
    }
  }

  // API Key management
  setApiKey(key) {
    this.apiKey = key;
    this.saveToStorage(STORAGE_KEYS.API_KEY, key);
  }

  getApiKey() {
    return this.apiKey;
  }

  hasApiKey() {
    return !!this.apiKey;
  }

  // Conversation management
  getConversationHistory() {
    return this.conversationHistory;
  }

  addToHistory(role, content) {
    const message = {
      role,
      content,
      timestamp: new Date().toISOString()
    };
    this.conversationHistory.push(message);

    // Keep last 100 messages for memory
    if (this.conversationHistory.length > 100) {
      this.conversationHistory = this.conversationHistory.slice(-100);
    }

    this.saveToStorage(STORAGE_KEYS.CONVERSATIONS, this.conversationHistory);
    return message;
  }

  clearHistory() {
    this.conversationHistory = [];
    this.saveToStorage(STORAGE_KEYS.CONVERSATIONS, []);
  }

  // Goals management
  getGoals() {
    return this.userGoals;
  }

  addGoal(goal) {
    const newGoal = {
      id: Date.now(),
      text: goal,
      createdAt: new Date().toISOString(),
      status: 'active',
      progress: 0
    };
    this.userGoals.push(newGoal);
    this.saveToStorage(STORAGE_KEYS.GOALS, this.userGoals);
    return newGoal;
  }

  updateGoal(id, updates) {
    this.userGoals = this.userGoals.map(g =>
      g.id === id ? { ...g, ...updates } : g
    );
    this.saveToStorage(STORAGE_KEYS.GOALS, this.userGoals);
  }

  // Tasks management
  getPendingTasks() {
    return this.pendingTasks;
  }

  addTask(task, priority = 'medium') {
    const newTask = {
      id: Date.now(),
      text: task,
      priority,
      createdAt: new Date().toISOString(),
      status: 'pending',
      suggestedBy: 'commander'
    };
    this.pendingTasks.push(newTask);
    this.saveToStorage(STORAGE_KEYS.TASKS, this.pendingTasks);
    return newTask;
  }

  completeTask(id) {
    this.pendingTasks = this.pendingTasks.map(t =>
      t.id === id ? { ...t, status: 'completed', completedAt: new Date().toISOString() } : t
    );
    this.saveToStorage(STORAGE_KEYS.TASKS, this.pendingTasks);
  }

  // Session management
  updateLastSession() {
    this.lastSession = new Date().toISOString();
    this.saveToStorage(STORAGE_KEYS.LAST_SESSION, this.lastSession);
  }

  getTimeSinceLastSession() {
    if (!this.lastSession) return null;
    const last = new Date(this.lastSession);
    const now = new Date();
    const hours = Math.floor((now - last) / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    return { hours, days, lastSession: this.lastSession };
  }

  // Generate welcome/daily brief
  generateDailyBrief() {
    const sessionInfo = this.getTimeSinceLastSession();
    const pendingTasks = this.pendingTasks.filter(t => t.status === 'pending');
    const activeGoals = this.userGoals.filter(g => g.status === 'active');

    let greeting = '';
    let brief = '';

    // Time-based greeting
    const hour = new Date().getHours();
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    // Check if returning user
    if (sessionInfo && sessionInfo.days >= 1) {
      brief = `${greeting}! It's been ${sessionInfo.days} day${sessionInfo.days > 1 ? 's' : ''} since we last connected. Let's get you back on track.\n\n`;
    } else if (sessionInfo && sessionInfo.hours >= 4) {
      brief = `${greeting}! Welcome back. Ready to make progress?\n\n`;
    } else if (!sessionInfo) {
      brief = `${greeting}! I'm your LIV8 Commander - your AI business partner dedicated to helping you build wealth and launch your projects.\n\n`;
    } else {
      brief = `${greeting}! Let's keep the momentum going.\n\n`;
    }

    // Add pending tasks if any
    if (pendingTasks.length > 0) {
      const topTasks = pendingTasks.slice(0, 3);
      brief += `**Your Priority Tasks:**\n`;
      topTasks.forEach((t, i) => {
        brief += `${i + 1}. ${t.text}\n`;
      });
      brief += '\n';
    }

    // Add goals reminder
    if (activeGoals.length > 0) {
      brief += `**Active Goals:** ${activeGoals.map(g => g.text).join(', ')}\n\n`;
    }

    // Add suggested focus
    brief += `**Today's Focus:** What's the ONE thing that would move your business forward today? Tell me and I'll help you execute.`;

    this.updateLastSession();
    return brief;
  }

  // Generate proactive suggestions based on context
  generateProactiveSuggestions() {
    const suggestions = [];
    const pendingTasks = this.pendingTasks.filter(t => t.status === 'pending');

    // If no tasks, suggest starting points
    if (pendingTasks.length === 0) {
      suggestions.push({
        type: 'starter',
        text: 'Set your #1 goal for this week',
        action: 'Tell me your biggest priority this week'
      });
      suggestions.push({
        type: 'business',
        text: 'Review Hybrid Funding marketing',
        action: 'Let\'s create a marketing plan for Hybrid Funding'
      });
      suggestions.push({
        type: 'revenue',
        text: 'Identify quick revenue opportunities',
        action: 'What\'s the fastest way to generate $1000 this week?'
      });
    }

    return suggestions;
  }

  async generateResponse(userMessage, context = {}) {
    // Add to local conversation history
    this.addToHistory('user', userMessage);

    // Try backend first (uses Claude/GPT with persistent memory)
    if (this.backendConnected) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            conversationId: this.conversationId,
            userId: 'default',
            context: {
              activeTasks: context.activeTasks?.length || 0,
              isScreenSharing: context.isScreenSharing || false,
              goals: this.userGoals.filter(g => g.status === 'active').map(g => g.text),
              pendingTasks: this.pendingTasks.filter(t => t.status === 'pending').map(t => t.text)
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          this.conversationId = data.conversationId;
          this.addToHistory('assistant', data.response);

          return {
            response: data.response,
            speakText: this.extractSpeakText(data.response),
            provider: data.provider,
            model: data.model
          };
        }
      } catch (e) {
        console.warn('Backend chat failed, falling back to Gemini:', e.message);
      }
    }

    // Fallback to Gemini if backend not available
    if (!this.apiKey) {
      return this.enhancedFallbackResponse(userMessage, context);
    }

    try {
      // Build conversation context from history
      const recentHistory = this.conversationHistory
        .slice(-20)
        .map(msg => `${msg.role === 'user' ? 'User' : 'Commander'}: ${msg.content}`)
        .join('\n\n');

      // Build goals and tasks context
      const goalsContext = this.userGoals.length > 0
        ? `USER'S GOALS:\n${this.userGoals.map(g => `- ${g.text} (${g.status})`).join('\n')}`
        : '';

      const tasksContext = this.pendingTasks.filter(t => t.status === 'pending').length > 0
        ? `PENDING TASKS:\n${this.pendingTasks.filter(t => t.status === 'pending').map(t => `- ${t.text}`).join('\n')}`
        : '';

      // Get GitHub repos for context
      const githubRepos = this.getGitHubRepos();
      const githubContext = githubRepos.length > 0
        ? `GITHUB PROJECTS (${githubRepos.length} repos):\n${githubRepos.slice(0, 15).map(r => `- ${r.name}: ${r.description} [${r.language}] (${r.status})`).join('\n')}`
        : '';

      const prompt = `${SYSTEM_CONTEXT}

${goalsContext}

${tasksContext}

${githubContext}

CONVERSATION HISTORY:
${recentHistory}

CURRENT CONTEXT:
- Active agent tasks: ${context.activeTasks?.length || 0}
- Screen sharing: ${context.isScreenSharing ? 'Active' : 'Inactive'}

USER'S LATEST MESSAGE: "${userMessage}"

Respond as their trusted Commander. Be helpful, proactive, and focused on helping them succeed. If they seem overwhelmed, give them ONE clear next step. If they share a win, celebrate it briefly then pivot to what's next.`;

      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API error:', errorData);
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "I'm having trouble processing that. Could you try rephrasing?";

      // Add to history
      this.addToHistory('assistant', aiResponse);

      return {
        response: aiResponse,
        speakText: this.extractSpeakText(aiResponse),
        provider: 'gemini',
        model: 'gemini-1.5-flash'
      };

    } catch (error) {
      console.error('AI Service error:', error);
      return this.enhancedFallbackResponse(userMessage, context);
    }
  }

  // Get conversation list from backend
  async getConversations() {
    if (!this.backendConnected) return [];
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations`);
      if (response.ok) {
        const data = await response.json();
        return data.conversations || [];
      }
    } catch (e) {}
    return [];
  }

  // Load a specific conversation
  async loadConversation(conversationId) {
    if (!this.backendConnected) return null;
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        this.conversationId = conversationId;
        return data.messages || [];
      }
    } catch (e) {}
    return null;
  }

  // Start new conversation
  async startNewConversation(title = null) {
    if (!this.backendConnected) return null;
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (response.ok) {
        const data = await response.json();
        this.conversationId = data.id;
        return data.id;
      }
    } catch (e) {}
    return null;
  }

  enhancedFallbackResponse(userMessage, context = {}) {
    const lower = userMessage.toLowerCase();

    // Goal setting
    if (lower.includes('goal') || lower.includes('priority') || lower.includes('focus')) {
      return {
        response: `Let's set your focus. What's the ONE outcome that would make this week a win?\n\nSome options based on your portfolio:\n• Launch marketing campaign for Hybrid Funding\n• Close a deal with Smart Life Brokers\n• Ship a feature for one of your 9 software products\n• Onboard a new client for LIV8 AI\n\nWhat resonates most?`,
        speakText: "Let's set your priority for the week"
      };
    }

    // Overwhelmed/stuck
    if (lower.includes('overwhelm') || lower.includes('stuck') || lower.includes('don\'t know') || lower.includes('confused')) {
      return {
        response: `I got you. Let's simplify.\n\n**Your ONE task right now:** Tell me the business that excites you most - Hybrid Funding, LIV8 AI, or Smart Life Brokers.\n\nOnce you pick one, I'll give you the exact next step. No overwhelming lists, just ONE action.\n\nWhich one?`,
        speakText: "Let's simplify. Pick one business to focus on."
      };
    }

    // Money/revenue focused
    if (lower.includes('money') || lower.includes('revenue') || lower.includes('millionaire') || lower.includes('income')) {
      return {
        response: `Let's talk revenue. Your fastest paths to income:\n\n**Quick Wins (This Week):**\n• Hybrid Funding - Get 5 traders signed up ($500-2500)\n• Smart Life Brokers - Close 2 insurance leads ($200-500)\n\n**Medium Term (This Month):**\n• LIV8 AI - Land 1 automation client ($2000-5000)\n• Sell/license one of your 9 software products\n\n**Your Portfolio Value:** $420K-$1.6M in assets\n\nWhich revenue stream should we activate first?`,
        speakText: "Let's focus on revenue. Which stream do you want to activate?"
      };
    }

    // Help/what can you do
    if (lower.includes('help') || lower.includes('what can you')) {
      return {
        response: `I'm your AI business partner. Here's how I help:\n\n**Daily Operations:**\n• Keep you focused on what matters\n• Break big goals into daily tasks\n• Remember our conversations and track progress\n\n**Your Agent Team:**\n• 12 specialized agents ready to work\n• Just say "assign [task] to [agent]"\n\n**Business Growth:**\n• Marketing strategies for your businesses\n• Revenue optimization\n• Project launch planning\n\nWhat's on your mind? I remember everything we discuss.`,
        speakText: "I'm your AI business partner. What do you need help with?"
      };
    }

    // Greetings
    if (lower.match(/^(hi|hello|hey|yo|sup|what's up)/)) {
      return {
        response: this.generateDailyBrief(),
        speakText: "Welcome! Let's make progress today."
      };
    }

    // Default - be proactive
    const history = this.conversationHistory.slice(-5);
    const hasRecentContext = history.length > 2;

    if (hasRecentContext) {
      return {
        response: `Got it. Based on what you're telling me, here's what I think:\n\nYour portfolio has serious potential - $420K to $1.6M in assets. The key is focusing that potential into cash flow.\n\n**My suggestion:** Let's pick ONE project and make it profitable this month. Which of your businesses is closest to generating revenue right now?\n\n1. Hybrid Funding (prop trading)\n2. Smart Life Brokers (insurance)\n3. LIV8 AI (automation services)\n4. One of your 9 software products\n\nTell me more about "${userMessage}" and I'll help you execute.`,
        speakText: "Let me help you focus that into action."
      };
    }

    return {
      response: `I hear you. Let me help make sense of this.\n\nYou've got:\n• 9 Software Products\n• 12 AI Agents (including me!)\n• 7 Business Entities\n• $420K-$1.6M in portfolio value\n\nThat's a lot of potential. Let's not try to do everything - let's do ONE thing really well.\n\n**Quick question:** What would make you feel like today was a win? Just one thing.`,
      speakText: "What's the one thing that would make today a win?"
    };
  }

  extractSpeakText(text) {
    const firstSentence = text.split(/[.!?]/)[0];
    return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
  }

  // Get GitHub repos for context
  getGitHubRepos() {
    const repos = this.loadFromStorage(STORAGE_KEYS.GITHUB_REPOS, []);
    return repos;
  }

  getGitHubSummary() {
    const repos = this.getGitHubRepos();
    if (repos.length === 0) return 'No GitHub repos loaded yet.';

    const activeRepos = repos.filter(r => r.status === 'active' || r.status === 'recent');
    const languages = [...new Set(repos.map(r => r.language))].filter(l => l && l !== 'Unknown');

    return `GitHub Portfolio: ${repos.length} repositories (${activeRepos.length} active), Languages: ${languages.slice(0, 5).join(', ')}`;
  }

  // Export conversation history
  exportHistory() {
    return {
      conversations: this.conversationHistory,
      goals: this.userGoals,
      tasks: this.pendingTasks,
      githubRepos: this.getGitHubRepos(),
      exportedAt: new Date().toISOString()
    };
  }

  // Import history (for backup restore)
  importHistory(data) {
    if (data.conversations) {
      this.conversationHistory = data.conversations;
      this.saveToStorage(STORAGE_KEYS.CONVERSATIONS, this.conversationHistory);
    }
    if (data.goals) {
      this.userGoals = data.goals;
      this.saveToStorage(STORAGE_KEYS.GOALS, this.userGoals);
    }
    if (data.tasks) {
      this.pendingTasks = data.tasks;
      this.saveToStorage(STORAGE_KEYS.TASKS, this.pendingTasks);
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;
