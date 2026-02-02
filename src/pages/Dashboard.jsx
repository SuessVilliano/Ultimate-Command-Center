import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Building2,
  Code2,
  Bot,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Zap,
  Target,
  Shield,
  Sun,
  Moon,
  Coffee,
  Brain,
  Dumbbell,
  BookOpen,
  Wind,
  Plus,
  X,
  ChevronRight,
  Calendar,
  Bell,
  StickyNote,
  Play,
  Pause,
  RotateCcw,
  Flame,
  Heart,
  Star,
  CheckCircle,
  Circle,
  ArrowRight,
  Sparkles,
  Timer,
  Volume2
} from 'lucide-react';
import {
  businesses,
  softwareProducts,
  aiAgents,
  domains,
  valuationSummary
} from '../data/portfolio';
import ProactiveAIDashboard from '../components/ProactiveAIDashboard';

// Storage keys
const STORAGE_KEYS = {
  WELLNESS: 'liv8_wellness_data',
  NOTES: 'liv8_quick_notes',
  TODAY_FOCUS: 'liv8_today_focus',
  SCHEDULE: 'liv8_schedule',
  COMPLETED_TODAY: 'liv8_completed_today'
};

// Default schedule template for a high-performer with ADHD
import { API_URL } from '../config';
const AI_SERVER_URL = API_URL;

// AI Briefing Component
function AIBriefingCard() {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/briefing`);
      if (response.ok) {
        const data = await response.json();
        setBriefing(data);
      }
    } catch (e) {
      console.log('Could not fetch briefing');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="card p-6 bg-gradient-to-br from-cyan-900/30 to-purple-900/30 border-cyan-500/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          AI Daily Briefing
        </h3>
        <button
          onClick={fetchBriefing}
          disabled={loading}
          className="px-3 py-1 text-xs rounded bg-white/10 text-gray-400 hover:bg-white/20"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {briefing ? (
        <div className="space-y-3">
          <p className="text-cyan-300 font-medium">{briefing.greeting}!</p>

          {briefing.aiSummary && (
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">
                {expanded ? briefing.aiSummary : briefing.aiSummary.substring(0, 300)}
                {briefing.aiSummary.length > 300 && !expanded && '...'}
              </p>
              {briefing.aiSummary.length > 300 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-cyan-400 mt-2 hover:underline"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded bg-white/5">
              <p className="text-lg font-bold text-cyan-400">{briefing.calendar?.todayEventCount || 0}</p>
              <p className="text-xs text-gray-400">Events</p>
            </div>
            <div className="p-2 rounded bg-white/5">
              <p className="text-lg font-bold text-green-400">
                {briefing.calendar?.freeTimeMinutes ? Math.floor(briefing.calendar.freeTimeMinutes / 60) : 0}h
              </p>
              <p className="text-xs text-gray-400">Free Time</p>
            </div>
            <div className="p-2 rounded bg-white/5">
              <p className="text-lg font-bold text-purple-400">
                {briefing.calendar?.nextMeeting ? '1' : '0'}
              </p>
              <p className="text-xs text-gray-400">Next Meeting</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          {loading ? (
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          ) : (
            <p className="text-gray-400">Click refresh to generate your briefing</p>
          )}
        </div>
      )}
    </div>
  );
}

// What Was I Doing Card
function WhatWasIDoingCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${AI_SERVER_URL}/api/activity/what-was-i-doing`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (e) {}
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return null;

  return (
    <div className="card p-4 border-yellow-500/30 bg-yellow-500/5">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium text-yellow-400">What was I doing?</span>
      </div>
      <p className="text-sm text-gray-300">{data.summary}</p>
      {data.activePomodoro && (
        <p className="text-xs text-cyan-400 mt-1">
          Active Pomodoro: {data.activePomodoro.task_description} ({data.activePomodoro.remainingMinutes}m left)
        </p>
      )}
    </div>
  );
}

// Parking Lot - Quick Thought Capture for ADHD
function ParkingLotCard() {
  const [thoughts, setThoughts] = useState([]);
  const [newThought, setNewThought] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchThoughts = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/parking-lot`);
      if (response.ok) {
        const data = await response.json();
        setThoughts(data.items || []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchThoughts();
  }, []);

  const addThought = async () => {
    if (!newThought.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/parking-lot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thought: newThought.trim() })
      });
      if (response.ok) {
        setNewThought('');
        fetchThoughts();
      }
    } catch (e) {}
    setLoading(false);
  };

  const processThought = async (id) => {
    try {
      await fetch(`${AI_SERVER_URL}/api/parking-lot/${id}/process`, { method: 'POST' });
      fetchThoughts();
    } catch (e) {}
  };

  return (
    <div className="card p-4 border-orange-500/30 bg-orange-500/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-orange-400">Parking Lot</span>
        </div>
        <span className="text-xs text-gray-500">{thoughts.length} thoughts</span>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newThought}
          onChange={(e) => setNewThought(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addThought()}
          placeholder="Quick capture..."
          className="flex-1 px-3 py-1.5 text-sm rounded bg-white/10 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={addThought}
          disabled={loading || !newThought.trim()}
          className="px-3 py-1.5 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-50 text-sm"
        >
          +
        </button>
      </div>

      {thoughts.length > 0 && (
        <div className="space-y-1 max-h-[120px] overflow-y-auto">
          {thoughts.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded bg-white/5 group">
              <p className="text-xs text-gray-300 flex-1 truncate">{item.thought}</p>
              <button
                onClick={() => processThought(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-gray-500 hover:text-green-400 transition-all"
                title="Mark as processed"
              >
                <CheckCircle className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// AI Memory Card - What the AI has learned
function AIMemoryCard() {
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const response = await fetch(`${AI_SERVER_URL}/api/memory/summary`);
        if (response.ok) {
          const data = await response.json();
          setSummary(data);
        }
      } catch (e) {}
    };
    fetchMemory();
  }, []);

  if (!summary || summary.total === 0) return null;

  const categoryIcons = {
    personal: '👤',
    work: '💼',
    preferences: '⚙️',
    business: '🏢',
    trading: '📈',
    contact: '📧'
  };

  return (
    <div className="card p-4 border-purple-500/30 bg-purple-500/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-400">AI Memory</span>
        </div>
        <span className="text-xs text-gray-500">{summary.total} facts learned</span>
      </div>

      {/* Category breakdown */}
      <div className="flex flex-wrap gap-2 mb-3">
        {summary.byCategory.map((cat) => (
          <span
            key={cat.category}
            className="px-2 py-1 text-xs rounded-full bg-white/10 text-gray-300"
          >
            {categoryIcons[cat.category] || '📝'} {cat.category}: {cat.count}
          </span>
        ))}
      </div>

      {/* Recent facts */}
      {expanded && summary.recent.length > 0 && (
        <div className="space-y-1 mb-2">
          <p className="text-xs text-gray-500 mb-1">Recently learned:</p>
          {summary.recent.map((fact) => (
            <p key={fact.id} className="text-xs text-gray-400 truncate">
              • {fact.fact}
            </p>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-purple-400 hover:underline"
      >
        {expanded ? 'Show less' : 'Show what I know'}
      </button>
    </div>
  );
}

// Google Calendar Widget Component
function GoogleCalendarWidget() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('google_access_token'));

  useEffect(() => {
    if (accessToken) {
      fetchCalendarEvents();
    } else {
      // Try to get cached events
      fetchCachedEvents();
    }
  }, [accessToken]);

  const fetchCalendarEvents = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/calendar/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken })
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      fetchCachedEvents();
    }
    setLoading(false);
  };

  const fetchCachedEvents = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/calendar/upcoming?hours=48`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (e) {}
  };

  const handleGoogleAuth = () => {
    // Google OAuth client-side flow
    const clientId = ''; // User needs to add their client ID
    const redirectUri = window.location.origin + '/auth/callback';
    const scope = 'https://www.googleapis.com/auth/calendar.readonly';

    if (!clientId) {
      alert('Google Calendar Setup Required:\n\n1. Create a project at console.cloud.google.com\n2. Enable Google Calendar API\n3. Create OAuth credentials\n4. Add GOOGLE_CLIENT_ID to settings\n\nFor now, you can manually sync events.');
      return;
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token&scope=${encodeURIComponent(scope)}`;

    window.open(authUrl, '_blank', 'width=500,height=600');
  };

  // Check for token in URL hash (after OAuth redirect)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('google_access_token', token);
        setAccessToken(token);
        window.location.hash = '';
      }
    }
  }, []);

  const formatEventTime = (event) => {
    if (event.isAllDay) return 'All Day';
    return event.time || '';
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-400" />
          Upcoming Events
        </h3>
        <button
          onClick={accessToken ? fetchCalendarEvents : handleGoogleAuth}
          className="text-xs px-2 py-1 rounded bg-white/10 text-gray-400 hover:bg-white/20"
        >
          {accessToken ? 'Refresh' : 'Connect'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-4">
          <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {accessToken ? 'No upcoming events' : 'Connect Google Calendar'}
          </p>
          {!accessToken && (
            <p className="text-xs text-gray-500 mt-1">liv8ent@gmail.com</p>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {events.slice(0, 5).map((event, index) => (
            <div
              key={event.id || index}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="p-1.5 rounded bg-cyan-500/20">
                <Clock className="w-3 h-3 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{event.title}</p>
                <p className="text-xs text-gray-400">
                  {event.date} • {formatEventTime(event)}
                </p>
                {event.location && (
                  <p className="text-xs text-gray-500 truncate">{event.location}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Default schedule template for a high-performer with ADHD
const DEFAULT_SCHEDULE = [
  { id: 1, time: '05:30', duration: 30, activity: 'Morning Meditation', type: 'wellness', icon: 'Brain', color: 'purple' },
  { id: 2, time: '06:00', duration: 45, activity: 'Workout / Yoga', type: 'wellness', icon: 'Dumbbell', color: 'green' },
  { id: 3, time: '06:45', duration: 15, activity: 'Shower & Ready', type: 'personal', icon: 'Sun', color: 'yellow' },
  { id: 4, time: '07:00', duration: 30, activity: 'Reading / Learning', type: 'growth', icon: 'BookOpen', color: 'cyan' },
  { id: 5, time: '07:30', duration: 30, activity: 'Family Time / Breakfast', type: 'family', icon: 'Heart', color: 'pink' },
  { id: 6, time: '08:00', duration: 60, activity: 'Deep Work Block 1', type: 'work', icon: 'Zap', color: 'purple', priority: true },
  { id: 7, time: '09:00', duration: 480, activity: '9-5 Job (SaaS Support)', type: 'job', icon: 'Building2', color: 'blue' },
  { id: 8, time: '17:00', duration: 30, activity: 'Walk / Decompress', type: 'wellness', icon: 'Wind', color: 'green' },
  { id: 9, time: '17:30', duration: 90, activity: 'Family Time', type: 'family', icon: 'Heart', color: 'pink' },
  { id: 10, time: '19:00', duration: 120, activity: 'Deep Work Block 2 (Business)', type: 'work', icon: 'Zap', color: 'purple', priority: true },
  { id: 11, time: '21:00', duration: 30, activity: 'Wind Down / Stretch', type: 'wellness', icon: 'Wind', color: 'green' },
  { id: 12, time: '21:30', duration: 30, activity: 'Evening Meditation', type: 'wellness', icon: 'Brain', color: 'purple' },
  { id: 13, time: '22:00', duration: 0, activity: 'Sleep', type: 'rest', icon: 'Moon', color: 'gray' },
];

function Dashboard() {
  // State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayFocus, setTodayFocus] = useState('');
  const [focusInput, setFocusInput] = useState('');
  const [showFocusInput, setShowFocusInput] = useState(false);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [completedToday, setCompletedToday] = useState([]);
  const [quickNotes, setQuickNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [wellness, setWellness] = useState({
    meditation: { streak: 0, todayDone: false },
    workout: { streak: 0, todayDone: false },
    reading: { streak: 0, todayDone: false },
    walk: { streak: 0, todayDone: false }
  });
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [showNotification, setShowNotification] = useState(null);

  // Load data from localStorage
  useEffect(() => {
    const loadData = () => {
      const savedWellness = localStorage.getItem(STORAGE_KEYS.WELLNESS);
      const savedNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
      const savedFocus = localStorage.getItem(STORAGE_KEYS.TODAY_FOCUS);
      const savedCompleted = localStorage.getItem(STORAGE_KEYS.COMPLETED_TODAY);

      if (savedWellness) {
        const parsed = JSON.parse(savedWellness);
        // Check if it's a new day and reset todayDone
        const lastDate = parsed.lastDate;
        const today = new Date().toDateString();
        if (lastDate !== today) {
          // New day - reset today's completions but keep streaks
          setWellness({
            meditation: { streak: parsed.meditation?.streak || 0, todayDone: false },
            workout: { streak: parsed.workout?.streak || 0, todayDone: false },
            reading: { streak: parsed.reading?.streak || 0, todayDone: false },
            walk: { streak: parsed.walk?.streak || 0, todayDone: false }
          });
          setCompletedToday([]);
        } else {
          setWellness(parsed);
          if (savedCompleted) setCompletedToday(JSON.parse(savedCompleted));
        }
      }
      if (savedNotes) setQuickNotes(JSON.parse(savedNotes));
      if (savedFocus) {
        const parsed = JSON.parse(savedFocus);
        if (parsed.date === new Date().toDateString()) {
          setTodayFocus(parsed.focus);
        }
      }
    };
    loadData();
  }, []);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Pomodoro timer
  useEffect(() => {
    let timer;
    if (pomodoroActive && pomodoroTime > 0) {
      timer = setInterval(() => {
        setPomodoroTime(prev => prev - 1);
      }, 1000);
    } else if (pomodoroTime === 0) {
      setPomodoroActive(false);
      setShowNotification({ type: 'pomodoro', message: 'Focus session complete! Take a 5 minute break.' });
      // Play notification sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6djHhzbHiAjZuan5qMfHFqc3+Lmp6fmox7cGpzf4uanp+ajHtwan');
        audio.play().catch(() => {});
      } catch (e) {}
      setPomodoroTime(25 * 60);
    }
    return () => clearInterval(timer);
  }, [pomodoroActive, pomodoroTime]);

  // Save data to localStorage
  const saveWellness = (newWellness) => {
    const toSave = { ...newWellness, lastDate: new Date().toDateString() };
    localStorage.setItem(STORAGE_KEYS.WELLNESS, JSON.stringify(toSave));
    setWellness(newWellness);
  };

  const saveNotes = (notes) => {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    setQuickNotes(notes);
  };

  const saveTodayFocus = (focus) => {
    localStorage.setItem(STORAGE_KEYS.TODAY_FOCUS, JSON.stringify({
      focus,
      date: new Date().toDateString()
    }));
    setTodayFocus(focus);
  };

  const saveCompletedToday = (completed) => {
    localStorage.setItem(STORAGE_KEYS.COMPLETED_TODAY, JSON.stringify(completed));
    setCompletedToday(completed);
  };

  // Handlers
  const handleSetFocus = () => {
    if (focusInput.trim()) {
      saveTodayFocus(focusInput.trim());
      setFocusInput('');
      setShowFocusInput(false);
    }
  };

  const handleToggleWellness = (type) => {
    const newWellness = { ...wellness };
    if (!newWellness[type].todayDone) {
      newWellness[type] = {
        streak: newWellness[type].streak + 1,
        todayDone: true
      };
    } else {
      newWellness[type] = {
        streak: Math.max(0, newWellness[type].streak - 1),
        todayDone: false
      };
    }
    saveWellness(newWellness);
  };

  const handleToggleScheduleItem = (id) => {
    if (completedToday.includes(id)) {
      saveCompletedToday(completedToday.filter(i => i !== id));
    } else {
      saveCompletedToday([...completedToday, id]);
    }
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      const note = {
        id: Date.now(),
        text: newNote.trim(),
        createdAt: new Date().toISOString()
      };
      saveNotes([note, ...quickNotes]);
      setNewNote('');
    }
  };

  const handleDeleteNote = (id) => {
    saveNotes(quickNotes.filter(n => n.id !== id));
  };

  // Helpers
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatPomodoroTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getCurrentScheduleItem = () => {
    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    for (const item of schedule) {
      const [h, m] = item.time.split(':').map(Number);
      const start = h * 60 + m;
      const end = start + item.duration;
      if (now >= start && now < end) return item;
    }
    return null;
  };

  const getNextScheduleItem = () => {
    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    for (const item of schedule) {
      const [h, m] = item.time.split(':').map(Number);
      const start = h * 60 + m;
      if (start > now) return item;
    }
    return null;
  };

  const getIconComponent = (iconName) => {
    const icons = { Brain, Dumbbell, Sun, BookOpen, Heart, Zap, Building2, Wind, Moon };
    return icons[iconName] || Circle;
  };

  const getColorClass = (color) => {
    const colors = {
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[color] || colors.gray;
  };

  const currentItem = getCurrentScheduleItem();
  const nextItem = getNextScheduleItem();
  const totalValueMin = valuationSummary.conservative.total.min;
  const totalValueMax = valuationSummary.aggressive.total.max;
  const wellnessScore = Object.values(wellness).filter(w => w.todayDone).length;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-lg bg-purple-600 text-white shadow-xl flex items-center gap-3 animate-slide-in">
          <Bell className="w-5 h-5" />
          <span>{showNotification.message}</span>
          <button onClick={() => setShowNotification(null)} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">{getGreeting()}, Commander</h1>
          <p className="text-gray-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} • {formatTime(currentTime)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pomodoro Timer */}
          <div className={`px-4 py-2 rounded-lg border flex items-center gap-3 ${pomodoroActive ? 'bg-purple-500/20 border-purple-500/50' : 'bg-white/5 border-white/10'}`}>
            <Timer className={`w-5 h-5 ${pomodoroActive ? 'text-purple-400' : 'text-gray-400'}`} />
            <span className={`font-mono text-lg ${pomodoroActive ? 'text-purple-400' : 'text-white'}`}>
              {formatPomodoroTime(pomodoroTime)}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPomodoroActive(!pomodoroActive)}
                className={`p-1.5 rounded ${pomodoroActive ? 'bg-purple-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
              >
                {pomodoroActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setPomodoroActive(false); setPomodoroTime(25 * 60); }}
                className="p-1.5 rounded bg-white/10 text-gray-400 hover:bg-white/20"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Wellness Score */}
          <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center gap-2">
            <Flame className={`w-5 h-5 ${wellnessScore >= 3 ? 'text-orange-400' : 'text-green-400'}`} />
            <span className="text-green-400 font-medium">{wellnessScore}/4 Wellness</span>
          </div>
        </div>
      </div>

      {/* TODAY'S FOCUS - The ONE Thing */}
      <div className="card p-6 bg-gradient-to-br from-purple-900/40 to-cyan-900/40 border-purple-500/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Today's ONE Focus
          </h2>
          <span className="text-xs text-gray-400">What will make today a win?</span>
        </div>

        {todayFocus && !showFocusInput ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{todayFocus}</p>
                <p className="text-sm text-gray-400">Stay locked in. Everything else can wait.</p>
              </div>
            </div>
            <button
              onClick={() => setShowFocusInput(true)}
              className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetFocus()}
              placeholder="What's the ONE thing that will move the needle today?"
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 text-lg"
              autoFocus
            />
            <button
              onClick={handleSetFocus}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Lock In
            </button>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Schedule */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current & Next */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Activity */}
            <div className={`card p-4 border-2 ${currentItem ? getColorClass(currentItem.color).replace('bg-', 'border-').split(' ')[2] : 'border-gray-700'}`}>
              <p className="text-xs text-gray-400 mb-2">RIGHT NOW</p>
              {currentItem ? (
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getColorClass(currentItem.color)}`}>
                    {React.createElement(getIconComponent(currentItem.icon), { className: 'w-5 h-5' })}
                  </div>
                  <div>
                    <p className="text-white font-medium">{currentItem.activity}</p>
                    <p className="text-xs text-gray-400">{currentItem.time} • {currentItem.duration} min</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">Free time</p>
              )}
            </div>
            {/* Next Up */}
            <div className="card p-4">
              <p className="text-xs text-gray-400 mb-2">NEXT UP</p>
              {nextItem ? (
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getColorClass(nextItem.color)}`}>
                    {React.createElement(getIconComponent(nextItem.icon), { className: 'w-5 h-5' })}
                  </div>
                  <div>
                    <p className="text-white font-medium">{nextItem.activity}</p>
                    <p className="text-xs text-gray-400">{nextItem.time}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">Nothing scheduled</p>
              )}
            </div>
          </div>

          {/* Daily Schedule */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                Today's Schedule
              </h3>
              <span className="text-xs text-gray-400">
                {completedToday.length}/{schedule.length} completed
              </span>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {schedule.map((item) => {
                const Icon = getIconComponent(item.icon);
                const isCompleted = completedToday.includes(item.id);
                const isCurrent = currentItem?.id === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleScheduleItem(item.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      isCurrent
                        ? `${getColorClass(item.color)} border`
                        : isCompleted
                          ? 'bg-white/5 opacity-60'
                          : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isCompleted ? 'bg-green-500/20' : getColorClass(item.color)}`}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {item.activity}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.time} • {item.duration > 0 ? `${item.duration} min` : 'End of day'}
                      </p>
                    </div>
                    {item.priority && !isCompleted && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                        Priority
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Notes */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-yellow-400" />
              Quick Capture
              <span className="text-xs text-gray-400 font-normal ml-2">Brain dump - get it out of your head</span>
            </h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="Capture a thought, idea, or task..."
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {quickNotes.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No notes yet. Capture ideas as they come!</p>
              ) : (
                quickNotes.map((note) => (
                  <div key={note.id} className="flex items-start justify-between gap-2 p-3 rounded-lg bg-white/5 group">
                    <p className="text-sm text-gray-300 flex-1">{note.text}</p>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-400 hover:text-red-400 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Wellness & Stats */}
        <div className="space-y-6">
          {/* AI Daily Briefing */}
          <AIBriefingCard />

          {/* Proactive AI Dashboard */}
          <div className="card p-4">
            <ProactiveAIDashboard isDark={true} />
          </div>

          {/* What Was I Doing - ADHD Context Recovery */}
          <WhatWasIDoingCard />

          {/* Parking Lot - Quick Thought Capture */}
          <ParkingLotCard />

          {/* AI Memory - What the AI has learned */}
          <AIMemoryCard />

          {/* Wellness Tracker */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              Daily Wellness
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'meditation', label: 'Meditate', icon: Brain, color: 'purple' },
                { key: 'workout', label: 'Workout', icon: Dumbbell, color: 'green' },
                { key: 'reading', label: 'Read', icon: BookOpen, color: 'cyan' },
                { key: 'walk', label: 'Walk', icon: Wind, color: 'yellow' }
              ].map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => handleToggleWellness(key)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    wellness[key].todayDone
                      ? `${getColorClass(color)} border-current`
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon className={`w-6 h-6 ${wellness[key].todayDone ? '' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${wellness[key].todayDone ? '' : 'text-gray-400'}`}>
                      {label}
                    </span>
                    <div className="flex items-center gap-1">
                      <Flame className={`w-3 h-3 ${wellness[key].streak > 0 ? 'text-orange-400' : 'text-gray-600'}`} />
                      <span className={`text-xs ${wellness[key].streak > 0 ? 'text-orange-400' : 'text-gray-600'}`}>
                        {wellness[key].streak} day streak
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Google Calendar Widget */}
          <GoogleCalendarWidget />

          {/* Portfolio Snapshot */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Empire Snapshot
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
                <p className="text-xs text-gray-400 mb-1">Portfolio Value</p>
                <p className="text-2xl font-bold text-white">
                  ${(totalValueMin / 1000).toFixed(0)}K - ${(totalValueMax / 1000000).toFixed(1)}M
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <p className="text-2xl font-bold text-cyan-400">{businesses.length}</p>
                  <p className="text-xs text-gray-400">Businesses</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <p className="text-2xl font-bold text-green-400">{softwareProducts.length}</p>
                  <p className="text-xs text-gray-400">Products</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <p className="text-2xl font-bold text-purple-400">{aiAgents.length}</p>
                  <p className="text-xs text-gray-400">AI Agents</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <p className="text-2xl font-bold text-pink-400">{domains.length}</p>
                  <p className="text-xs text-gray-400">Domains</p>
                </div>
              </div>
            </div>
          </div>

          {/* Motivation */}
          <div className="card p-6 bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-white font-medium mb-1">Remember Why</p>
                <p className="text-sm text-gray-400">
                  You're building generational wealth. Every focused hour compounds. The 9-5 is temporary - your empire is permanent.
                </p>
              </div>
            </div>
          </div>

          {/* ADHD Tips */}
          <div className="card p-4">
            <p className="text-xs text-gray-400 mb-2">ADHD POWER-UP</p>
            <div className="space-y-2 text-sm">
              <p className="text-gray-300">
                <span className="text-purple-400">Right now:</span> {currentItem ? `Focus on ${currentItem.activity}` : 'Check your schedule'}
              </p>
              <p className="text-gray-300">
                <span className="text-green-400">Tip:</span> Start the Pomodoro timer for 25 min of deep focus
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
