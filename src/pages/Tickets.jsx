import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Code,
  ArrowUpCircle,
  MessageSquare,
  Filter,
  RefreshCw,
  Settings,
  Zap,
  Brain,
  Send,
  ChevronRight,
  AlertTriangle,
  PhoneCall,
  Bug,
  HelpCircle,
  Star,
  TrendingUp,
  ListTodo,
  ExternalLink,
  Copy,
  Check,
  Search,
  X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { aiService } from '../services/aiService';

// Storage keys
const STORAGE_KEYS = {
  FRESHDESK_DOMAIN: 'liv8_freshdesk_domain',
  FRESHDESK_API_KEY: 'liv8_freshdesk_api_key',
  TICKETS_CACHE: 'liv8_tickets_cache',
  AI_PROVIDER: 'liv8_ai_provider',
  AI_SETTINGS: 'liv8_ai_settings'
};

// GHL Quick Links - Work Tools
const GHL_QUICK_LINKS = [
  {
    id: 'hq',
    label: 'HQ',
    url: 'https://support.leadconnectorhq.com/login',
    icon: '🏢',
    description: 'LeadConnector Support HQ'
  },
  {
    id: 'twilio',
    label: 'Twilio',
    url: 'https://www.twilio.com/login?g=%2Fconsole-zen%2Fhttps%3A%2F%2Fconsole.twilio.com%2F&t=2d94b9e4c79e07a34a2fac4a2be87b4517b42f35aa88738462dfee82b084af25',
    icon: '📞',
    description: 'Twilio Console'
  },
  {
    id: 'gemini',
    label: 'Gemini',
    url: 'https://gemini.google.com/gem/a3f972a495f7',
    icon: '🌟',
    description: 'Google Gemini AI'
  },
  {
    id: 'freshdesk',
    label: 'Freshdesk',
    url: 'https://gohighlevelassist.freshdesk.com/a/dashboard/default',
    icon: '🎫',
    description: 'Freshdesk Dashboard'
  },
  {
    id: 'support-dashboard',
    label: 'Support Dashboard',
    url: 'https://docs.google.com/spreadsheets/d/1oD_dS_A4b3lNW7cWEdv6QYeb3zJakV_PoKweyhFgaNs/edit?pli=1&gid=1182538947#gid=1182538947',
    icon: '📊',
    description: 'Google Sheets Dashboard'
  },
  {
    id: 'calendar',
    label: 'Calendar',
    url: 'https://calendar.google.com/calendar/u/0/r?cid=jamaur.johnson@gohighlevel.com&pli=1',
    icon: '📅',
    description: 'Google Calendar'
  },
  {
    id: 'senior-zoom',
    label: 'Senior Zoom',
    url: 'https://us02web.zoom.us/j/3297827881',
    icon: '🎥',
    description: 'Senior Team Zoom Meeting'
  },
  {
    id: 'bamboohr',
    label: 'BambooHR',
    url: 'https://gohighlevel.bamboohr.com/home',
    icon: '🎋',
    description: 'HR Portal'
  },
  {
    id: 'slack',
    label: 'Slack',
    url: 'https://app.slack.com/client/E098GV8SRC2/GMBP6HAPM',
    icon: '💬',
    description: 'GHL Slack Workspace'
  },
  {
    id: 'knowledgebase',
    label: 'Knowledgebase',
    url: 'https://help.gohighlevel.com/support/home',
    icon: '📚',
    description: 'GHL Help Center'
  },
  {
    id: 'clickup',
    label: 'ClickUp',
    url: 'https://app.clickup.com',
    icon: '✅',
    description: 'ClickUp Project Management'
  },
  {
    id: 'adp',
    label: 'ADP',
    url: 'https://workforcenow.adp.com/theme/index.html#/home',
    icon: '💰',
    description: 'ADP Workforce'
  },
  {
    id: 'darwinbox',
    label: 'Darwinbox',
    url: 'https://gohighlevel.darwinbox.com/',
    icon: '📦',
    description: 'Darwinbox HR'
  }
];

// AI Server URL
import { API_URL } from '../config';
const AI_SERVER_URL = API_URL;

// Schedule times for display
const SCHEDULE_TIMES = ['8:00 AM', '12:00 PM', '4:00 PM', '12:00 AM'];

// Ticket status mapping (Freshdesk uses numeric status codes)
const STATUS_MAP = {
  2: { label: 'Open', color: 'red', icon: AlertCircle },
  3: { label: 'Pending', color: 'yellow', icon: Clock },
  4: { label: 'Resolved', color: 'green', icon: CheckCircle },
  5: { label: 'Closed', color: 'gray', icon: XCircle },
  6: { label: 'Waiting on Customer', color: 'blue', icon: User },
  7: { label: 'Waiting on Third Party', color: 'purple', icon: Clock }
};

// Priority mapping
const PRIORITY_MAP = {
  1: { label: 'Low', color: 'gray' },
  2: { label: 'Medium', color: 'blue' },
  3: { label: 'High', color: 'orange' },
  4: { label: 'Urgent', color: 'red' }
};

// AI Analysis categories for escalation
const ESCALATION_TYPES = {
  DEV: { label: 'Developer Escalation', icon: Code, color: 'purple', description: 'Requires code changes or bug fixes' },
  TWILIO: { label: 'Twilio/Phone Issue', icon: PhoneCall, color: 'blue', description: 'Phone/SMS system issues' },
  BILLING: { label: 'Billing Escalation', icon: AlertTriangle, color: 'orange', description: 'Payment or subscription issues' },
  FEATURE: { label: 'Feature Request', icon: Star, color: 'cyan', description: 'Customer requesting new functionality' },
  BUG: { label: 'Bug Report', icon: Bug, color: 'red', description: 'Software bug needs investigation' },
  SUPPORT: { label: 'Standard Support', icon: HelpCircle, color: 'green', description: 'Can be resolved with guidance' }
};

function Tickets() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const isDark = theme === 'dark';

  // State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [freshdeskDomain, setFreshdeskDomain] = useState('');
  const [freshdeskApiKey, setFreshdeskApiKey] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState({});
  const [analyzingTicket, setAnalyzingTicket] = useState(null);
  const [activeFilter, setActiveFilter] = useState('open'); // Default to open tickets
  const [aiResponse, setAiResponse] = useState('');
  const [generatingResponse, setGeneratingResponse] = useState(false);
  const [aiServerStatus, setAiServerStatus] = useState('checking');
  const [proactiveAnalysis, setProactiveAnalysis] = useState(null);
  const [similarTickets, setSimilarTickets] = useState([]);
  const [knowledgeBaseStats, setKnowledgeBaseStats] = useState(null);
  // New v2.0 state
  const [aiProvider, setAiProvider] = useState('claude');
  const [aiModel, setAiModel] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [recentRuns, setRecentRuns] = useState([]);
  const [settingsTab, setSettingsTab] = useState('freshdesk'); // freshdesk, ai, schedule
  const [cachedResponses, setCachedResponses] = useState({}); // Store generated responses
  const [searchQuery, setSearchQuery] = useState(''); // Search for tickets
  const [sendingToPA, setSendingToPA] = useState(false); // Sending to Personal Assistant
  const [sentToPA, setSentToPA] = useState({}); // Track which tickets were sent
  const [quickLinksCollapsed, setQuickLinksCollapsed] = useState(false); // Collapsible quick links

  // Check AI server status and load persisted data
  const checkAiServer = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/health`);
      const data = await response.json();
      // Check if any AI provider is available (gemini, claude, openai, or kimi)
      const hasAnyProvider = data.ai?.available?.gemini || data.ai?.available?.claude || data.ai?.available?.openai || data.ai?.available?.kimi;
      if (data.status === 'ok' && hasAnyProvider) {
        setAiServerStatus('online');
        // Set AI provider info
        setAiProvider(data.ai?.provider || 'gemini');
        setAiModel(data.ai?.model || 'gemini-2.0-flash');
        // Set schedule status
        if (data.schedule) {
          setScheduleStatus(data.schedule);
          setScheduleEnabled(data.schedule.enabled);
        }
        // Set knowledge base stats
        if (data.database) {
          setKnowledgeBaseStats({
            ticketCount: data.database.knowledge || 0,
            analyses: data.database.analyses || 0
          });
        }
      } else if (data.status === 'ok') {
        setAiServerStatus('no-key');
      } else {
        setAiServerStatus('offline');
      }
    } catch (e) {
      setAiServerStatus('offline');
    }
  };

  // Load persisted analyses from backend
  const loadPersistedAnalyses = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/analyses`);
      if (response.ok) {
        const data = await response.json();
        if (data.analyses && Object.keys(data.analyses).length > 0) {
          setAiAnalysis(prev => ({ ...prev, ...data.analyses }));
          console.log(`Loaded ${Object.keys(data.analyses).length} persisted analyses`);
        }
      }
    } catch (e) {
      console.log('Could not load persisted analyses');
    }
  };

  // Load schedule history
  const loadScheduleHistory = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/schedule/history`);
      if (response.ok) {
        const data = await response.json();
        setRecentRuns(data.runs || []);
      }
    } catch (e) {}
  };

  // Sync tickets to backend for persistence
  const syncTicketsToBackend = async (ticketList) => {
    try {
      await fetch(`${AI_SERVER_URL}/api/tickets/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets: ticketList })
      });
    } catch (e) {
      console.log('Could not sync tickets to backend');
    }
  };

  // Switch AI provider
  const switchAiProvider = async (provider, model = null) => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/ai/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model })
      });
      if (response.ok) {
        const data = await response.json();
        setAiProvider(data.provider);
        setAiModel(data.model);
        localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
        return true;
      }
    } catch (e) {
      setError('Failed to switch AI provider');
    }
    return false;
  };

  // Update API key
  const updateApiKey = async (provider, apiKey) => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/ai/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey })
      });
      if (response.ok) {
        await checkAiServer(); // Refresh status
        return true;
      }
    } catch (e) {
      setError('Failed to update API key');
    }
    return false;
  };

  // Toggle scheduled polling
  const toggleSchedule = async (enabled) => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/schedule/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (response.ok) {
        const data = await response.json();
        setScheduleEnabled(data.enabled);
        setScheduleStatus(data.status);
      }
    } catch (e) {
      setError('Failed to toggle schedule');
    }
  };

  // Run manual analysis
  const runManualScheduledAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${AI_SERVER_URL}/api/schedule/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        // Reload analyses after scheduled run
        await loadPersistedAnalyses();
        await loadScheduleHistory();
        alert(`Analysis complete: ${result.summary || 'Done'}`);
      }
    } catch (e) {
      setError('Failed to run scheduled analysis');
    } finally {
      setLoading(false);
    }
  };

  // Auto-dismiss errors after 15 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 15000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Load settings on mount
  useEffect(() => {
    // Check AI server status
    checkAiServer();

    // Load persisted analyses from backend (v2.0)
    loadPersistedAnalyses();
    loadScheduleHistory();

    // First try to load from aiService integrations (pre-configured)
    const integrations = aiService.getIntegrations();
    const freshdeskConfig = integrations?.freshdesk || {};

    // Use pre-configured values or fall back to localStorage
    const domain = freshdeskConfig.domain || localStorage.getItem(STORAGE_KEYS.FRESHDESK_DOMAIN) || '';
    const apiKey = freshdeskConfig.apiKey || localStorage.getItem(STORAGE_KEYS.FRESHDESK_API_KEY) || '';
    const cached = localStorage.getItem(STORAGE_KEYS.TICKETS_CACHE);

    setFreshdeskDomain(domain);
    setFreshdeskApiKey(apiKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setTickets(parsed.tickets || []);
        // Merge cached analysis with persisted (persisted takes priority)
        setAiAnalysis(prev => ({ ...(parsed.analysis || {}), ...prev }));
      } catch (e) {}
    }

    // Auto-fetch if configured
    if (domain && apiKey) {
      fetchTickets(domain, apiKey);
    } else {
      setShowSettings(true);
    }
  }, []);

  // Save settings
  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEYS.FRESHDESK_DOMAIN, freshdeskDomain);
    localStorage.setItem(STORAGE_KEYS.FRESHDESK_API_KEY, freshdeskApiKey);

    // Also save to aiService for central management
    aiService.updateIntegration('freshdesk', {
      domain: freshdeskDomain,
      apiKey: freshdeskApiKey
    });

    setShowSettings(false);
    if (freshdeskDomain && freshdeskApiKey) {
      fetchTickets(freshdeskDomain, freshdeskApiKey);
    }
  };

  // Create ClickUp task from ticket
  const createClickUpTask = async (ticket, analysis) => {
    const clickupConfig = aiService.getIntegration('clickup');
    if (!clickupConfig?.apiKey) {
      setError('ClickUp API key not configured');
      return;
    }

    try {
      // Get ClickUp spaces/lists (you may need to configure the list ID)
      const escalationType = ESCALATION_TYPES[analysis?.ESCALATION_TYPE] || ESCALATION_TYPES.SUPPORT;

      const taskData = {
        name: `[Ticket #${ticket.id}] ${ticket.subject}`,
        description: `**Freshdesk Ticket:** #${ticket.id}\n**Customer:** ${ticket.requester?.name || 'Unknown'}\n**Email:** ${ticket.requester?.email || 'N/A'}\n\n**Description:**\n${ticket.description_text || ticket.description || 'No description'}\n\n**AI Analysis:**\n- Type: ${escalationType.label}\n- Urgency: ${analysis?.URGENCY_SCORE || 'N/A'}/10\n- Summary: ${analysis?.SUMMARY || 'Not analyzed'}\n\n**Action Items:**\n${(analysis?.ACTION_ITEMS || []).map(item => `- ${item}`).join('\n')}`,
        priority: ticket.priority >= 3 ? 1 : ticket.priority >= 2 ? 2 : 3, // ClickUp priority (1=urgent, 2=high, 3=normal)
        tags: [escalationType.label.toLowerCase().replace(' ', '-'), 'freshdesk']
      };

      // Note: You'll need to set your ClickUp list ID
      // For now, we'll show what would be created
      console.log('Would create ClickUp task:', taskData);
      alert(`ClickUp task would be created:\n\n${taskData.name}\n\nConfigure your ClickUp list ID to enable this feature.`);

    } catch (err) {
      console.error('ClickUp error:', err);
      setError('Failed to create ClickUp task');
    }
  };

  // Fetch tickets from Freshdesk - ONLY for your agent ID
  const fetchTickets = async (domain, apiKey) => {
    setLoading(true);
    setError(null);

    try {
      // Get agent ID from integrations config
      const integrations = aiService.getIntegrations();
      const agentId = integrations?.freshdesk?.agentId || '155014160586';
      const authHeader = 'Basic ' + btoa(apiKey + ':X');

      // Helper function to fetch all pages for a status
      const fetchAllPages = async (status) => {
        let allResults = [];
        let page = 1;
        const maxPages = 5; // Safety limit

        while (page <= maxPages) {
          try {
            const response = await fetch(
              `https://${domain}.freshdesk.com/api/v2/search/tickets?query="agent_id:${agentId} AND status:${status}"&page=${page}`,
              { headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' } }
            );

            if (!response.ok) break;

            const data = await response.json();
            const results = data.results || [];
            allResults = [...allResults, ...results];

            // If less than 30 results, we've reached the end
            if (results.length < 30) break;
            page++;
          } catch (e) {
            console.error(`Error fetching page ${page} for status ${status}:`, e);
            break;
          }
        }

        return allResults;
      };

      // Fetch tickets in parallel: Open, Pending, On Hold, Waiting on Customer, Resolved
      const [openTickets, pendingTickets, waitingCustomerTickets, waitingThirdPartyTickets, resolvedTicketsList] = await Promise.all([
        fetchAllPages(2), // Open
        fetchAllPages(3), // Pending
        fetchAllPages(6), // Waiting on Customer
        fetchAllPages(7), // Waiting on Third Party (On Hold)
        fetchAllPages(4)  // Resolved (for knowledge base)
      ]);

      // Combine all tickets
      const allTickets = [
        ...openTickets,
        ...pendingTickets,
        ...waitingCustomerTickets,
        ...waitingThirdPartyTickets,
        ...resolvedTicketsList
      ];

      // Remove duplicates by ticket ID
      const uniqueTickets = allTickets.reduce((acc, ticket) => {
        if (!acc.find(t => t.id === ticket.id)) {
          acc.push(ticket);
        }
        return acc;
      }, []);

      // Sort by priority (urgent first) then by created date (newest first)
      uniqueTickets.sort((a, b) => {
        // Priority: 4=urgent, 3=high, 2=medium, 1=low (higher number = higher priority)
        if (b.priority !== a.priority) return b.priority - a.priority;
        // Then by status: 2=open, 3=pending (open first)
        if (a.status !== b.status) return a.status - b.status;
        // Then by date (newest first)
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setTickets(uniqueTickets);

      // Cache tickets locally
      localStorage.setItem(STORAGE_KEYS.TICKETS_CACHE, JSON.stringify({
        tickets: uniqueTickets,
        analysis: aiAnalysis,
        timestamp: Date.now()
      }));

      // Sync all tickets to backend for persistence (v2.0)
      syncTicketsToBackend(uniqueTickets);

      // Index resolved tickets into knowledge base (runs in background, no await needed)
      const resolvedTickets = uniqueTickets.filter(t => t.status === 4 || t.status === 5);
      if (resolvedTickets.length > 0) {
        fetch(`${AI_SERVER_URL}/api/index-tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickets: resolvedTickets })
        }).then(res => res.json()).then(data => {
          if (data.totalInKnowledgeBase) {
            setKnowledgeBaseStats(prev => ({ ...prev, ticketCount: data.totalInKnowledgeBase }));
          }
        }).catch(() => {}); // Silent fail - not critical
      }

      // Load any existing analyses from backend
      loadPersistedAnalyses();

    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  // AI Analysis using local Claude server
  const analyzeTicket = async (ticket) => {
    if (aiServerStatus !== 'online') {
      setError('AI Server not available. Start the server: cd server && npm start');
      return;
    }

    setAnalyzingTicket(ticket.id);

    try {
      const response = await fetch(`${AI_SERVER_URL}/api/analyze-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticket.subject,
          description: ticket.description_text || ticket.description || 'No description',
          priority: PRIORITY_MAP[ticket.priority]?.label || 'Unknown',
          status: STATUS_MAP[ticket.status]?.label || 'Unknown',
          ticketId: ticket.id // For persistence
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'AI analysis failed');
      }

      const analysis = await response.json();
      const newAnalysis = { ...aiAnalysis, [ticket.id]: analysis };
      setAiAnalysis(newAnalysis);

      // Update cache
      localStorage.setItem(STORAGE_KEYS.TICKETS_CACHE, JSON.stringify({
        tickets,
        analysis: newAnalysis,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('AI analysis failed:', err);
      setError(err.message);
    } finally {
      setAnalyzingTicket(null);
    }
  };

  // Generate AI response for a ticket - GoHighLevel Support Agent style
  const generateResponse = async (ticket) => {
    if (aiServerStatus !== 'online') {
      setError('AI Server not available. Start the server: cd server && npm start');
      return;
    }

    setGeneratingResponse(true);
    setAiResponse('');
    setSimilarTickets([]);

    try {
      const analysis = aiAnalysis[ticket.id];
      const agentName = currentUser?.agentName || currentUser?.name || 'Support Team';

      // Determine ticket type for specialized response
      const ticketLower = (ticket.subject + ' ' + (ticket.description_text || ticket.description || '')).toLowerCase();
      let ticketType = 'general';
      if (ticketLower.includes('port') || ticketLower.includes('number')) ticketType = 'porting';
      if (ticketLower.includes('phone') || ticketLower.includes('call') || ticketLower.includes('dialer')) ticketType = 'phone_system';
      if (ticketLower.includes('cancel') || ticketLower.includes('refund')) ticketType = 'cancellation';
      if (ticketLower.includes('login') || ticketLower.includes('password') || ticketLower.includes('access')) ticketType = 'access';
      if (ticketLower.includes('email') || ticketLower.includes('smtp')) ticketType = 'email';
      if (ticketLower.includes('workflow') || ticketLower.includes('automation')) ticketType = 'automation';
      if (ticketLower.includes('cnam') || ticketLower.includes('caller id')) ticketType = 'cnam';
      if (ticketLower.includes('whitelabel') || ticketLower.includes('white label')) ticketType = 'whitelabel';

      const response = await fetch(`${AI_SERVER_URL}/api/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticket.subject,
          description: ticket.description_text || ticket.description || 'No description provided',
          requesterName: ticket.requester?.name || 'there',
          agentName,
          ticketType,
          ticketId: String(ticket.id),
          analysis
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate response');
      }

      const data = await response.json();
      setAiResponse(data.response);

      // Set similar tickets if found
      if (data.similarTickets && data.similarTickets.length > 0) {
        setSimilarTickets(data.similarTickets);
      }
    } catch (err) {
      console.error('Failed to generate response:', err);
      setError(err.message);
    } finally {
      setGeneratingResponse(false);
    }
  };

  // Proactive analysis of all open tickets
  const runProactiveAnalysis = async () => {
    if (aiServerStatus !== 'online') {
      setError('AI Server not available');
      return;
    }

    const openTickets = tickets.filter(t => t.status === 2 || t.status === 3);
    if (openTickets.length === 0) return;

    try {
      const response = await fetch(`${AI_SERVER_URL}/api/proactive-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickets: openTickets.map(t => ({
            id: t.id,
            subject: t.subject,
            priority: PRIORITY_MAP[t.priority]?.label || 'Unknown',
            status: STATUS_MAP[t.status]?.label || 'Unknown'
          })),
          agentName: currentUser?.agentName || currentUser?.name
        })
      });

      if (response.ok) {
        const analysis = await response.json();
        setProactiveAnalysis(analysis);
      }
    } catch (err) {
      console.error('Proactive analysis failed:', err);
    }
  };

  // Copy response to clipboard (clean text)
  const copyResponseToClipboard = () => {
    if (!aiResponse) return;

    // Additional cleaning for clipboard
    const cleanText = aiResponse
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^- /gm, '• ')
      .replace(/^#{1,6}\s/gm, '')
      .replace(/`/g, '')
      .trim();

    navigator.clipboard.writeText(cleanText).then(() => {
      // Show brief feedback
      const btn = document.getElementById('copy-response-btn');
      if (btn) {
        const originalText = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => { btn.innerText = originalText; }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // Send ticket to Personal Assistant - opens Telegram with pre-filled message
  const sendToPA = (ticket, includeAnalysis = true) => {
    if (!ticket) return;

    const analysis = aiAnalysis[ticket.id];
    const ticketUrl = freshdeskDomain ? `https://${freshdeskDomain}.freshdesk.com/a/tickets/${ticket.id}` : '';
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    // Format ticket message for Telegram (plain text, no HTML for t.me links)
    let message = `🎫 TICKET ALERT\n\n`;
    message += `${ticket.subject}\n\n`;
    message += `📊 Status: ${STATUS_MAP[ticket.status]?.label || 'Unknown'}\n`;
    message += `⚡ Priority: ${PRIORITY_MAP[ticket.priority]?.label || 'Normal'}\n`;
    message += `👤 Requester: ${ticket.requester?.name || 'Unknown'}\n`;
    if (ticket.requester?.company?.name) {
      message += `🏢 Company: ${ticket.requester.company.name}\n`;
    }

    if (includeAnalysis && analysis) {
      message += `\n🤖 AI Analysis:\n`;
      message += `Type: ${analysis.ESCALATION_TYPE || 'SUPPORT'}\n`;
      if (analysis.SUMMARY) message += `Summary: ${analysis.SUMMARY}\n`;
      if (analysis.SUGGESTED_ACTION) message += `💡 Suggested: ${analysis.SUGGESTED_ACTION}\n`;
    }

    if (ticketUrl) {
      message += `\n🔗 ${ticketUrl}`;
    }
    message += `\n\n⏰ ${timestamp}`;

    // Copy to clipboard
    navigator.clipboard.writeText(message).catch(() => {});

    // Open Telegram with pre-filled message TO the bot
    const encodedMsg = encodeURIComponent(message);
    const telegramUrl = `https://t.me/LIV8AiBot?text=${encodedMsg}`;
    window.open(telegramUrl, '_blank');

    // Mark as sent (visual feedback)
    setSentToPA(prev => ({ ...prev, [ticket.id]: true }));
    setTimeout(() => {
      setSentToPA(prev => ({ ...prev, [ticket.id]: false }));
    }, 3000);
  };

  // Analyze all open tickets AND generate responses
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, phase: '' });

  const analyzeAllTickets = async () => {
    const openTickets = tickets.filter(t => [2, 3, 6, 7].includes(t.status));
    if (openTickets.length === 0) {
      alert('No active tickets to analyze');
      return;
    }

    setAnalyzingAll(true);
    setAnalysisProgress({ current: 0, total: openTickets.length * 2, phase: 'Analyzing tickets...' });

    try {
      // Phase 1: Analyze all tickets
      for (let i = 0; i < openTickets.length; i++) {
        const ticket = openTickets[i];
        setAnalysisProgress({
          current: i + 1,
          total: openTickets.length * 2,
          phase: `Analyzing: ${ticket.subject.substring(0, 30)}...`
        });

        if (!aiAnalysis[ticket.id]) {
          await analyzeTicket(ticket);
        }
        await new Promise(r => setTimeout(r, 300)); // Rate limiting
      }

      // Phase 2: Generate responses for all analyzed tickets
      setAnalysisProgress({
        current: openTickets.length,
        total: openTickets.length * 2,
        phase: 'Generating AI responses...'
      });

      for (let i = 0; i < openTickets.length; i++) {
        const ticket = openTickets[i];
        setAnalysisProgress({
          current: openTickets.length + i + 1,
          total: openTickets.length * 2,
          phase: `Response for: ${ticket.subject.substring(0, 30)}...`
        });

        // Generate response if not already cached
        if (!cachedResponses[ticket.id]) {
          await generateResponseForTicket(ticket);
        }
        await new Promise(r => setTimeout(r, 300)); // Rate limiting
      }

      setAnalysisProgress({ current: openTickets.length * 2, total: openTickets.length * 2, phase: 'Complete!' });

      // Auto-dismiss after showing complete
      setTimeout(() => {
        setAnalyzingAll(false);
        setAnalysisProgress({ current: 0, total: 0, phase: '' });
      }, 1500);

    } catch (err) {
      console.error('Analysis failed:', err);
      setError('Analysis failed: ' + err.message);
      setAnalyzingAll(false);
    }
  };

  // Generate response for a specific ticket (silent, for batch processing)
  const generateResponseForTicket = async (ticket) => {
    if (aiServerStatus !== 'online') return;

    try {
      const analysis = aiAnalysis[ticket.id];
      const agentName = currentUser?.agentName || currentUser?.name || 'Support Team';

      const ticketLower = (ticket.subject + ' ' + (ticket.description_text || ticket.description || '')).toLowerCase();
      let ticketType = 'general';
      if (ticketLower.includes('port') || ticketLower.includes('number')) ticketType = 'porting';
      if (ticketLower.includes('phone') || ticketLower.includes('call') || ticketLower.includes('dialer')) ticketType = 'phone_system';
      if (ticketLower.includes('cancel') || ticketLower.includes('refund')) ticketType = 'cancellation';
      if (ticketLower.includes('login') || ticketLower.includes('password') || ticketLower.includes('access')) ticketType = 'access';
      if (ticketLower.includes('email') || ticketLower.includes('smtp')) ticketType = 'email';
      if (ticketLower.includes('workflow') || ticketLower.includes('automation')) ticketType = 'automation';

      const response = await fetch(`${AI_SERVER_URL}/api/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticket.subject,
          description: ticket.description_text || ticket.description || 'No description provided',
          requesterName: ticket.requester?.name || 'there',
          agentName,
          ticketType,
          ticketId: String(ticket.id),
          analysis
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCachedResponses(prev => ({
          ...prev,
          [ticket.id]: {
            response: data.response,
            similarTickets: data.similarTickets || [],
            generatedAt: new Date().toISOString()
          }
        }));
      }
    } catch (err) {
      console.log(`Could not generate response for ticket ${ticket.id}`);
    }
  };

  // Quick copy response for a ticket
  const quickCopyResponse = (ticketId) => {
    const cached = cachedResponses[ticketId];
    if (!cached?.response) return;

    const cleanText = cached.response
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^- /gm, '• ')
      .replace(/^#{1,6}\s/gm, '')
      .replace(/`/g, '')
      .trim();

    navigator.clipboard.writeText(cleanText).then(() => {
      // Visual feedback
      const btn = document.getElementById(`copy-btn-${ticketId}`);
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        btn.classList.add('bg-green-600');
        setTimeout(() => {
          btn.innerHTML = original;
          btn.classList.remove('bg-green-600');
        }, 2000);
      }
    });
  };

  // Search tickets by ID, subject, requester, or custom fields
  const searchTickets = (ticketList) => {
    if (!searchQuery.trim()) return ticketList;

    const query = searchQuery.toLowerCase().trim();

    return ticketList.filter(ticket => {
      // Search by ticket ID
      if (String(ticket.id).includes(query)) return true;

      // Search by subject
      if (ticket.subject?.toLowerCase().includes(query)) return true;

      // Search by requester name or email
      if (ticket.requester?.name?.toLowerCase().includes(query)) return true;
      if (ticket.requester?.email?.toLowerCase().includes(query)) return true;

      // Search by description
      if (ticket.description_text?.toLowerCase().includes(query)) return true;

      // Search custom fields (relationship_id, location_id, etc.)
      if (ticket.custom_fields) {
        for (const [key, value] of Object.entries(ticket.custom_fields)) {
          if (value && String(value).toLowerCase().includes(query)) return true;
          if (key.toLowerCase().includes(query)) return true;
        }
      }

      // Search by company name
      if (ticket.company?.name?.toLowerCase().includes(query)) return true;

      // Search tags
      if (ticket.tags?.some(tag => tag.toLowerCase().includes(query))) return true;

      return false;
    });
  };

  // Filter tickets - Updated for v2.0 with On Hold and Waiting statuses
  const filteredTickets = searchTickets(tickets.filter(ticket => {
    // If searching, show all statuses
    if (searchQuery.trim()) return true;

    if (activeFilter === 'all') return [2, 3, 6, 7].includes(ticket.status); // All active (not resolved/closed)
    if (activeFilter === 'open') return ticket.status === 2;
    if (activeFilter === 'pending') return ticket.status === 3;
    if (activeFilter === 'waiting') return ticket.status === 6; // Waiting on Customer
    if (activeFilter === 'onhold') return ticket.status === 7; // Waiting on Third Party (On Hold)
    if (activeFilter === 'resolved') return ticket.status === 4;
    if (activeFilter === 'escalate') {
      const analysis = aiAnalysis[ticket.id];
      return analysis && ['DEV', 'TWILIO', 'BUG'].includes(analysis.ESCALATION_TYPE) && [2, 3, 6, 7].includes(ticket.status);
    }
    return true;
  }));

  // Count tickets by status - Updated for v2.0
  const statusCounts = {
    open: tickets.filter(t => t.status === 2).length,
    pending: tickets.filter(t => t.status === 3).length,
    waiting: tickets.filter(t => t.status === 6).length,
    onhold: tickets.filter(t => t.status === 7).length,
    resolved: tickets.filter(t => t.status === 4).length,
    needsEscalation: tickets.filter(t => {
      const a = aiAnalysis[t.id];
      return a && ['DEV', 'TWILIO', 'BUG'].includes(a.ESCALATION_TYPE);
    }).length,
    total: tickets.filter(t => [2, 3, 6, 7].includes(t.status)).length
  };

  // Get urgency color
  const getUrgencyColor = (score) => {
    if (score >= 8) return 'text-red-500';
    if (score >= 5) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Open link in work profile (jamaur.johnson@gohighlevel.com)
  const openInWorkProfile = (url) => {
    // Using chrome profile selector URL format
    // The URL will open and user can select their work profile
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            GHL Command Center
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            GoHighLevel Support Hub - Tickets, Tools & Resources
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* AI Server Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
            aiServerStatus === 'online'
              ? 'bg-green-500/20 text-green-400'
              : aiServerStatus === 'no-key'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              aiServerStatus === 'online' ? 'bg-green-500' :
              aiServerStatus === 'no-key' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            {aiServerStatus === 'online' ? 'AI Online' :
             aiServerStatus === 'no-key' ? 'No API Key' : 'AI Offline'}
          </div>
          <button
            onClick={runProactiveAnalysis}
            disabled={aiServerStatus !== 'online'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              aiServerStatus === 'online'
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Proactive
          </button>
          <button
            onClick={analyzeAllTickets}
            disabled={aiServerStatus !== 'online' || analyzingAll}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              aiServerStatus === 'online' && !analyzingAll
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {analyzingAll ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            {analyzingAll ? 'Processing...' : 'Analyze All'}
          </button>
          <button
            onClick={() => freshdeskDomain && freshdeskApiKey && fetchTickets(freshdeskDomain, freshdeskApiKey)}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isDark
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {/* Responses Ready Counter */}
          {Object.keys(cachedResponses).length > 0 && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
              isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
            }`} title="AI responses ready to copy">
              <Copy className="w-3 h-3" />
              {Object.keys(cachedResponses).length} responses ready
            </div>
          )}
          {/* Knowledge Base Indicator */}
          {knowledgeBaseStats && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
              isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
            }`} title="Resolved tickets indexed for smart suggestions">
              <Brain className="w-3 h-3" />
              {knowledgeBaseStats.ticketCount} indexed
            </div>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2 rounded-lg ${
              isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* GHL Quick Links - Collapsible */}
      <div className={`rounded-xl border transition-all ${
        isDark ? 'border-purple-900/30 bg-gradient-to-r from-purple-900/10 to-cyan-900/10' : 'border-gray-200 bg-gradient-to-r from-purple-50 to-cyan-50'
      }`}>
        <button
          onClick={() => setQuickLinksCollapsed(!quickLinksCollapsed)}
          className={`w-full p-3 flex items-center justify-between ${quickLinksCollapsed ? '' : 'border-b border-purple-900/20'}`}
        >
          <div className="flex items-center gap-3">
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Quick Links
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-100 text-purple-600'}`}>
              {GHL_QUICK_LINKS.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              jamaur.johnson@gohighlevel.com
            </span>
            <ChevronRight className={`w-5 h-5 transition-transform ${quickLinksCollapsed ? '' : 'rotate-90'} ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        </button>
        {!quickLinksCollapsed && (
          <div className="p-3 grid grid-cols-7 gap-2">
            {GHL_QUICK_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => openInWorkProfile(link.url)}
                className={`p-2 rounded-lg text-center transition-all hover:scale-105 ${
                  isDark
                    ? 'bg-white/5 hover:bg-white/10 border border-purple-500/20 hover:border-purple-500/40'
                    : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-purple-300'
                }`}
                title={link.description}
              >
                <span className="text-xl block mb-0.5">{link.icon}</span>
                <span className={`text-[10px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {link.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal - Updated v2.0 with tabs */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-2xl p-6 rounded-xl ${
            isDark ? 'bg-[#0a0a0f] border border-purple-900/30' : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className={`p-1 rounded hover:bg-white/10`}>
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-purple-900/30 pb-2">
              {[
                { id: 'freshdesk', label: 'Freshdesk' },
                { id: 'ai', label: 'AI Provider' },
                { id: 'schedule', label: 'Schedule' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    settingsTab === tab.id
                      ? 'bg-purple-600 text-white'
                      : isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* Freshdesk Tab */}
              {settingsTab === 'freshdesk' && (
                <>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Freshdesk Domain (without .freshdesk.com)
                    </label>
                    <input
                      type="text"
                      value={freshdeskDomain}
                      onChange={(e) => setFreshdeskDomain(e.target.value)}
                      placeholder="yourcompany"
                      className={`w-full p-3 rounded-lg border ${
                        isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Freshdesk API Key
                    </label>
                    <input
                      type="password"
                      value={freshdeskApiKey}
                      onChange={(e) => setFreshdeskApiKey(e.target.value)}
                      placeholder="Your Freshdesk API key"
                      className={`w-full p-3 rounded-lg border ${
                        isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>
                </>
              )}

              {/* AI Provider Tab */}
              {settingsTab === 'ai' && (
                <>
                  {/* Current Provider Status */}
                  <div className={`p-4 rounded-lg ${
                    aiServerStatus === 'online' ? 'bg-green-500/10 border border-green-500/30'
                      : aiServerStatus === 'no-key' ? 'bg-yellow-500/10 border border-yellow-500/30'
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          aiServerStatus === 'online' ? 'bg-green-500' :
                          aiServerStatus === 'no-key' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className={`font-medium ${
                          aiServerStatus === 'online' ? 'text-green-400' :
                          aiServerStatus === 'no-key' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {aiServerStatus === 'online' ? `AI Online - ${aiProvider.toUpperCase()}` :
                           aiServerStatus === 'no-key' ? 'No API Key' : 'AI Offline'}
                        </span>
                      </div>
                      <button onClick={checkAiServer} className={`text-xs px-3 py-1 rounded ${
                        isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100'
                      }`}>
                        Refresh
                      </button>
                    </div>
                    {aiModel && (
                      <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Model: {aiModel}
                      </p>
                    )}
                  </div>

                  {/* Provider Selection */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      AI Provider
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <button
                        onClick={() => switchAiProvider('gemini')}
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          aiProvider === 'gemini'
                            ? 'border-blue-500 bg-blue-500/20'
                            : isDark ? 'border-purple-900/30 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xl mb-1">🌟</div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Gemini</div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          2.0 Flash
                        </p>
                      </button>
                      <button
                        onClick={() => switchAiProvider('claude')}
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          aiProvider === 'claude'
                            ? 'border-purple-500 bg-purple-500/20'
                            : isDark ? 'border-purple-900/30 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xl mb-1">🤖</div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Claude</div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Sonnet 4
                        </p>
                      </button>
                      <button
                        onClick={() => switchAiProvider('openai')}
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          aiProvider === 'openai'
                            ? 'border-green-500 bg-green-500/20'
                            : isDark ? 'border-purple-900/30 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xl mb-1">🧠</div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>GPT</div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          gpt-4o
                        </p>
                      </button>
                      <button
                        onClick={() => switchAiProvider('kimi')}
                        className={`p-4 rounded-lg border text-left transition-colors ${
                          aiProvider === 'kimi'
                            ? 'border-orange-500 bg-orange-500/20'
                            : isDark ? 'border-purple-900/30 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xl mb-1">🚀</div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Kimi</div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Nemotron 70B
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* API Keys Section */}
                  <div className="space-y-3">
                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      API Keys
                    </label>

                    {/* Gemini Key */}
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          🌟 Gemini
                        </span>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300">Get Key</a>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          id="gemini-key-input"
                          placeholder="Enter Gemini API key..."
                          className={`flex-1 p-2 rounded-lg border text-sm ${
                            isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-white border-gray-200 text-gray-900'
                          }`}
                        />
                        <button
                          onClick={() => {
                            const key = document.getElementById('gemini-key-input').value;
                            if (key) updateApiKey('gemini', key);
                          }}
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    {/* Claude Key */}
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          🤖 Claude
                        </span>
                        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-300">Get Key</a>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          id="claude-key-input"
                          placeholder="Enter Claude API key..."
                          className={`flex-1 p-2 rounded-lg border text-sm ${
                            isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-white border-gray-200 text-gray-900'
                          }`}
                        />
                        <button
                          onClick={() => {
                            const key = document.getElementById('claude-key-input').value;
                            if (key) updateApiKey('claude', key);
                          }}
                          className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    {/* OpenAI Key */}
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          🧠 OpenAI
                        </span>
                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                          className="text-xs text-green-400 hover:text-green-300">Get Key</a>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                          placeholder="Enter OpenAI API key..."
                          className={`flex-1 p-2 rounded-lg border text-sm ${
                            isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-white border-gray-200 text-gray-900'
                          }`}
                        />
                        <button
                          onClick={() => updateApiKey('openai', openaiKey)}
                          disabled={!openaiKey}
                          className={`px-3 py-2 rounded-lg text-sm ${
                            openaiKey ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 text-gray-400'
                          }`}
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    {/* Kimi / NVIDIA Key */}
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          🚀 Kimi (NVIDIA)
                        </span>
                        <a href="https://build.nvidia.com/explore/discover" target="_blank" rel="noopener noreferrer"
                          className="text-xs text-orange-400 hover:text-orange-300">Get Key</a>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          id="kimi-key-input"
                          placeholder="Enter NVIDIA API key (nvapi-...)..."
                          className={`flex-1 p-2 rounded-lg border text-sm ${
                            isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-white border-gray-200 text-gray-900'
                          }`}
                        />
                        <button
                          onClick={() => {
                            const key = document.getElementById('kimi-key-input').value;
                            if (key) updateApiKey('kimi', key);
                          }}
                          className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Knowledge Base Stats */}
                  {knowledgeBaseStats && (
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Brain className="w-4 h-4 text-purple-400" />
                        <span className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                          Knowledge Base
                        </span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {knowledgeBaseStats.ticketCount || 0} tickets indexed • {knowledgeBaseStats.analyses || 0} analyses cached
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Schedule Tab */}
              {settingsTab === 'schedule' && (
                <>
                  {/* Schedule Toggle */}
                  <div className={`p-4 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className={`font-medium ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                          Automatic Ticket Polling
                        </div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Automatically fetch and analyze tickets at scheduled times
                        </p>
                      </div>
                      <button
                        onClick={() => toggleSchedule(!scheduleEnabled)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          scheduleEnabled
                            ? 'bg-cyan-600 text-white'
                            : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {scheduleEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    {/* Schedule Times */}
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {SCHEDULE_TIMES.map((time, i) => (
                        <div key={i} className={`text-center p-2 rounded ${
                          isDark ? 'bg-white/5' : 'bg-white'
                        }`}>
                          <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {time}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>EST</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Manual Run Button */}
                  <button
                    onClick={runManualScheduledAnalysis}
                    disabled={loading}
                    className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 ${
                      loading
                        ? 'bg-gray-600 text-gray-400'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Run Analysis Now
                  </button>

                  {/* Recent Runs */}
                  {recentRuns.length > 0 && (
                    <div>
                      <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Recent Automated Runs
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {recentRuns.slice(0, 5).map((run, i) => (
                          <div key={i} className={`p-2 rounded text-xs flex justify-between ${
                            isDark ? 'bg-white/5' : 'bg-gray-50'
                          }`}>
                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                              {run.schedule_name || run.run_type}
                            </span>
                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                              {new Date(run.started_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-purple-900/30">
                <button
                  onClick={() => setShowSettings(false)}
                  className={`flex-1 py-2 rounded-lg ${
                    isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  Close
                </button>
                {settingsTab === 'freshdesk' && (
                  <button
                    onClick={saveSettings}
                    className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Save & Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Progress Modal */}
      {analyzingAll && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-xl ${
            isDark ? 'bg-[#0a0a0f] border border-purple-500/30' : 'bg-white border border-gray-200'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  AI Agent Processing
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Analyzing tickets & generating responses
                </p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  {analysisProgress.phase}
                </span>
                <span className={isDark ? 'text-purple-400' : 'text-purple-600'}>
                  {analysisProgress.current}/{analysisProgress.total}
                </span>
              </div>
              <div className={`w-full h-3 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 transition-all duration-300"
                  style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                />
              </div>
            </div>

            <div className={`p-3 rounded-lg ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
              <p className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                Your HighLevel Support Specialist agent is analyzing each ticket, categorizing issues, and generating professional responses ready to copy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className={`p-4 rounded-xl border ${
        isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket ID, subject, requester, relationship ID, location ID..."
              className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-white/5 border-purple-900/30 text-white placeholder:text-gray-500'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-purple-500`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full ${
                  isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
            }`}>
              <span className="text-sm font-medium">{filteredTickets.length} found</span>
            </div>
          )}
        </div>
        {searchQuery && filteredTickets.length > 0 && (
          <div className={`mt-3 pt-3 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Searching across all statuses. Showing {filteredTickets.length} matching ticket{filteredTickets.length !== 1 ? 's' : ''}.
            </p>
          </div>
        )}
      </div>

      {/* Status Overview Cards - Updated v2.0 */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { key: 'open', label: 'Open', count: statusCounts.open, color: 'red', icon: AlertCircle },
          { key: 'pending', label: 'Pending', count: statusCounts.pending, color: 'yellow', icon: Clock },
          { key: 'waiting', label: 'Waiting', count: statusCounts.waiting, color: 'blue', icon: User },
          { key: 'onhold', label: 'On Hold', count: statusCounts.onhold, color: 'purple', icon: Clock },
          { key: 'escalate', label: 'Escalation', count: statusCounts.needsEscalation, color: 'orange', icon: ArrowUpCircle },
          { key: 'resolved', label: 'Resolved', count: statusCounts.resolved, color: 'green', icon: CheckCircle }
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeFilter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveFilter(activeFilter === item.key ? 'all' : item.key)}
              className={`p-4 rounded-xl border transition-all ${
                isActive
                  ? `border-${item.color}-500 bg-${item.color}-500/10`
                  : isDark
                    ? 'border-purple-900/30 bg-white/5 hover:bg-white/10'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 text-${item.color}-500`} />
                <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {item.count}
                </span>
              </div>
              <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {item.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="flex-shrink-0 p-1 hover:bg-red-500/20 rounded transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Proactive Analysis Panel */}
      {proactiveAnalysis && (
        <div className={`p-4 rounded-xl border ${
          isDark ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h3 className={`font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
              AI Workload Analysis
            </h3>
            <button
              onClick={() => setProactiveAnalysis(null)}
              className={`ml-auto text-xs px-2 py-1 rounded ${
                isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-white hover:bg-gray-100'
              }`}
            >
              Dismiss
            </button>
          </div>
          <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {proactiveAnalysis.summary}
          </p>
          {proactiveAnalysis.urgentItems?.length > 0 && (
            <div className="mb-3">
              <h4 className={`text-xs font-semibold uppercase mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                Urgent Attention Needed
              </h4>
              <ul className="space-y-1">
                {proactiveAnalysis.urgentItems.map((item, i) => (
                  <li key={i} className={`text-sm flex items-center gap-2 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                    <AlertCircle className="w-3 h-3" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {proactiveAnalysis.patterns?.length > 0 && (
            <div>
              <h4 className={`text-xs font-semibold uppercase mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Patterns Detected
              </h4>
              <ul className="flex flex-wrap gap-2">
                {proactiveAnalysis.patterns.map((pattern, i) => (
                  <li key={i} className={`text-xs px-2 py-1 rounded-full ${
                    isDark ? 'bg-white/10 text-gray-300' : 'bg-white text-gray-700'
                  }`}>
                    {pattern}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {proactiveAnalysis.estimatedWorkload && (
            <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Estimated time to clear: {proactiveAnalysis.estimatedWorkload}
            </p>
          )}
        </div>
      )}

      {/* Main content area */}
      <div className="grid grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className={`col-span-2 rounded-xl border ${
          isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
        }`}>
          <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Tickets ({filteredTickets.length})
              </h3>
              <div className="flex items-center gap-2">
                <Filter className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className={`text-sm rounded-lg border px-3 py-1 ${
                    isDark
                      ? 'bg-white/5 border-purple-900/30 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="open">Open ({statusCounts.open})</option>
                  <option value="pending">Pending ({statusCounts.pending})</option>
                  <option value="waiting">Waiting on Customer ({statusCounts.waiting})</option>
                  <option value="onhold">On Hold ({statusCounts.onhold})</option>
                  <option value="all">All Active ({statusCounts.total})</option>
                  <option value="escalate">Needs Escalation ({statusCounts.needsEscalation})</option>
                  <option value="resolved">Resolved (Archive)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-purple-900/10 max-h-[600px] overflow-y-auto">
            {loading && tickets.length === 0 ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" />
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center">
                <Ticket className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                  {freshdeskDomain ? 'No tickets found' : 'Configure Freshdesk to see tickets'}
                </p>
              </div>
            ) : (
              filteredTickets.map(ticket => {
                const status = STATUS_MAP[ticket.status] || { label: 'Unknown', color: 'gray', icon: HelpCircle };
                const priority = PRIORITY_MAP[ticket.priority] || { label: 'Unknown', color: 'gray' };
                const analysis = aiAnalysis[ticket.id];
                const escalationType = analysis ? ESCALATION_TYPES[analysis.ESCALATION_TYPE] : null;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedTicket?.id === ticket.id
                        ? isDark ? 'bg-purple-600/20' : 'bg-purple-50'
                        : isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            #{ticket.id}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full bg-${status.color}-500/20 text-${status.color}-400`}>
                            {status.label}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full bg-${priority.color}-500/20 text-${priority.color}-400`}>
                            {priority.label}
                          </span>
                        </div>
                        <h4 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {ticket.subject}
                        </h4>
                        <p className={`text-sm mt-1 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {ticket.requester?.name || 'Unknown'} • {new Date(ticket.created_at).toLocaleDateString()}
                        </p>

                        {/* AI Analysis Badge */}
                        {analysis && escalationType && (
                          <div className={`flex items-center gap-2 mt-2`}>
                            <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-${escalationType.color}-500/20 text-${escalationType.color}-400`}>
                              <escalationType.icon className="w-3 h-3" />
                              {escalationType.label}
                            </span>
                            <span className={`text-xs ${getUrgencyColor(analysis.URGENCY_SCORE)}`}>
                              Urgency: {analysis.URGENCY_SCORE}/10
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Quick Copy Button - shows when response is ready */}
                        {cachedResponses[ticket.id] && (
                          <button
                            id={`copy-btn-${ticket.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              quickCopyResponse(ticket.id);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                            title="Copy AI response to clipboard"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        )}
                        {analyzingTicket === ticket.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
                        ) : !analysis ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              analyzeTicket(ticket);
                            }}
                            className="p-1 rounded hover:bg-purple-500/20"
                            title="Analyze with AI"
                          >
                            <Brain className="w-4 h-4 text-purple-400" />
                          </button>
                        ) : !cachedResponses[ticket.id] ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateResponseForTicket(ticket);
                            }}
                            className="p-1 rounded hover:bg-cyan-500/20"
                            title="Generate AI response"
                          >
                            <MessageSquare className="w-4 h-4 text-cyan-400" />
                          </button>
                        ) : null}
                        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ticket Detail Panel */}
        <div className={`rounded-xl border ${
          isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
        }`}>
          {selectedTicket ? (
            <div className="h-full flex flex-col">
              <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    #{selectedTicket.id}
                  </span>
                  <div className="flex items-center gap-2">
                    {aiAnalysis[selectedTicket.id] && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        getUrgencyColor(aiAnalysis[selectedTicket.id].URGENCY_SCORE)
                      } bg-current/10`}>
                        Urgency: {aiAnalysis[selectedTicket.id].URGENCY_SCORE}/10
                      </span>
                    )}
                  </div>
                </div>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedTicket.subject}
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  From: {selectedTicket.requester?.name || 'Unknown'} ({selectedTicket.requester?.email || 'No email'})
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Description */}
                <div>
                  <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description
                  </h4>
                  <div className={`p-3 rounded-lg text-sm ${
                    isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-50 text-gray-700'
                  }`}>
                    {selectedTicket.description_text || selectedTicket.description || 'No description provided'}
                  </div>
                </div>

                {/* AI Analysis */}
                {aiAnalysis[selectedTicket.id] && (
                  <div className={`p-4 rounded-lg border ${
                    isDark ? 'border-purple-500/30 bg-purple-500/10' : 'border-purple-200 bg-purple-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <h4 className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                        AI Analysis
                      </h4>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Summary</p>
                        <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {aiAnalysis[selectedTicket.id].SUMMARY}
                        </p>
                      </div>

                      {aiAnalysis[selectedTicket.id].ACTION_ITEMS && (
                        <div>
                          <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Action Items
                          </p>
                          <ul className="space-y-1">
                            {(Array.isArray(aiAnalysis[selectedTicket.id].ACTION_ITEMS)
                              ? aiAnalysis[selectedTicket.id].ACTION_ITEMS
                              : [aiAnalysis[selectedTicket.id].ACTION_ITEMS]
                            ).map((item, i) => (
                              <li key={i} className={`text-sm flex items-start gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <span className="text-purple-400">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Similar Tickets from History */}
                {similarTickets.length > 0 && (
                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <ListTodo className="w-4 h-4 text-cyan-400" />
                      <h4 className={`text-sm font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                        Similar Resolved Tickets
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                      }`}>
                        Reference these for context
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {similarTickets.map((st, i) => (
                        <li key={st.id} className={`flex items-start gap-2 text-sm ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                            isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => openInWorkProfile(`https://${freshdeskDomain}.freshdesk.com/a/tickets/${st.id}`)}
                              className={`font-medium hover:underline text-left ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}
                            >
                              #{st.id}: {st.subject}
                            </button>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {st.keywords?.slice(0, 4).map((kw, j) => (
                                <span key={j} className={`text-xs px-1.5 py-0.5 rounded ${
                                  isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {kw}
                                </span>
                              ))}
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                ({st.matchScore} keywords matched)
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-400" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Generated Response - show aiResponse or cached */}
                {(aiResponse || cachedResponses[selectedTicket.id]) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Ready to Copy Response
                      </h4>
                      <button
                        id="copy-response-btn"
                        onClick={() => {
                          if (aiResponse) {
                            copyResponseToClipboard();
                          } else {
                            quickCopyResponse(selectedTicket.id);
                          }
                        }}
                        className={`flex items-center gap-1 px-3 py-1 text-xs rounded-lg transition-colors ${
                          isDark
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        <Copy className="w-3 h-3" />
                        Copy to Clipboard
                      </button>
                    </div>
                    <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
                      isDark ? 'bg-green-500/10 border border-green-500/30 text-green-300' : 'bg-green-50 border border-green-200 text-green-800'
                    }`}>
                      {aiResponse || cachedResponses[selectedTicket.id]?.response}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className={`p-4 border-t ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateResponse(selectedTicket)}
                      disabled={generatingResponse || aiServerStatus !== 'online'}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg ${
                        generatingResponse || aiServerStatus !== 'online'
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700'
                      } text-white`}
                    >
                      {generatingResponse ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                      Generate Response
                    </button>
                    <button
                      onClick={() => openInWorkProfile(`https://${freshdeskDomain}.freshdesk.com/a/tickets/${selectedTicket.id}`)}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                      title="Open in Freshdesk (Work Profile)"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => sendToPA(selectedTicket)}
                      disabled={sendingToPA}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        sentToPA[selectedTicket.id]
                          ? 'bg-green-600 text-white'
                          : sendingToPA
                          ? 'bg-gray-500 cursor-wait'
                          : isDark
                          ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                          : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                      }`}
                      title="Send to Personal Assistant (Telegram)"
                    >
                      {sentToPA[selectedTicket.id] ? (
                        <>
                          <Check className="w-4 h-4" />
                          Sent!
                        </>
                      ) : sendingToPA ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send to PA
                        </>
                      )}
                    </button>
                  </div>

                  {/* Escalation Actions */}
                  {aiAnalysis[selectedTicket.id] && ['DEV', 'TWILIO', 'BUG'].includes(aiAnalysis[selectedTicket.id].ESCALATION_TYPE) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => createClickUpTask(selectedTicket, aiAnalysis[selectedTicket.id])}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg ${
                          isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                        } text-white`}
                      >
                        <ListTodo className="w-4 h-4" />
                        Create ClickUp Task
                      </button>
                      {aiAnalysis[selectedTicket.id].ESCALATION_TYPE === 'TWILIO' && (
                        <button
                          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                            isDark ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                          } text-white`}
                          title="Twilio escalation"
                        >
                          <PhoneCall className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <Ticket className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                  Select a ticket to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Tickets;
