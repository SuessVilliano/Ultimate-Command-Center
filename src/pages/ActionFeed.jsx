import React, { useState, useEffect } from 'react';
import {
  Inbox as InboxIcon,
  Ticket,
  CheckSquare,
  Bell,
  AtSign,
  Clock,
  X,
  Check,
  RefreshCw,
  Filter,
  ChevronRight,
  AlertCircle,
  MessageSquare,
  Eye,
  EyeOff,
  Timer,
  Zap,
  Target
} from 'lucide-react';

const AI_SERVER_URL = import.meta.env.VITE_API_URL
  ? `https://${import.meta.env.VITE_API_URL}`
  : 'http://localhost:3005';

// Type icons and colors mapping
const typeConfig = {
  ticket: { icon: Ticket, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Ticket' },
  task: { icon: CheckSquare, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Task' },
  notification: { icon: Bell, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Notification' },
  mention: { icon: AtSign, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Mention' }
};

// Source badges
const sourceBadges = {
  freshdesk: { label: 'Freshdesk', color: 'bg-green-600/50' },
  nifty: { label: 'Nifty', color: 'bg-purple-600/50' },
  taskade: { label: 'Taskade', color: 'bg-cyan-600/50' },
  notion: { label: 'Notion', color: 'bg-gray-600/50' },
  system: { label: 'System', color: 'bg-blue-600/50' }
};

function InboxItem({ item, onMarkRead, onSnooze, onDismiss }) {
  const config = typeConfig[item.item_type] || typeConfig.notification;
  const Icon = config.icon;
  const source = sourceBadges[item.source] || { label: item.source, color: 'bg-gray-600/50' };
  const isUnread = item.status === 'unread';

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`group flex items-start gap-4 p-4 rounded-lg border transition-all ${
        isUnread
          ? 'bg-white/5 border-white/20 hover:bg-white/10'
          : 'bg-transparent border-white/5 hover:bg-white/5 opacity-60'
      }`}
    >
      {/* Type Icon */}
      <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs rounded-full ${source.color} text-white`}>
                {source.label}
              </span>
              {item.priority > 2 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/50 text-white">
                  High Priority
                </span>
              )}
              {isUnread && (
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
              )}
            </div>
            <h4 className={`font-medium truncate ${isUnread ? 'text-white' : 'text-gray-400'}`}>
              {item.title}
            </h4>
            {item.preview && (
              <p className="text-sm text-gray-500 truncate mt-0.5">{item.preview}</p>
            )}
          </div>

          <span className="text-xs text-gray-500 shrink-0">
            {formatTime(item.created_at)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {isUnread && (
          <button
            onClick={() => onMarkRead(item)}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
            title="Mark as read"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onSnooze(item)}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-yellow-400"
          title="Snooze 1 hour"
        >
          <Timer className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDismiss(item)}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ActionFeed() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ total: 0, tickets: 0, tasks: 0, notifications: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchInbox = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      if (statusFilter === 'unread') params.set('status', 'unread');

      const response = await fetch(`${AI_SERVER_URL}/api/inbox?${params}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch inbox:', e);
    }
    setLoading(false);
  };

  const fetchCounts = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/inbox/counts`);
      if (response.ok) {
        const data = await response.json();
        setCounts(data);
      }
    } catch (e) {}
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${AI_SERVER_URL}/api/inbox/refresh`, { method: 'POST' });
      await Promise.all([fetchInbox(), fetchCounts()]);
    } catch (e) {}
    setRefreshing(false);
  };

  const handleMarkRead = async (item) => {
    try {
      await fetch(`${AI_SERVER_URL}/api/inbox/${item.id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedType: item.feed_type })
      });
      await Promise.all([fetchInbox(), fetchCounts()]);
    } catch (e) {}
  };

  const handleSnooze = async (item) => {
    try {
      await fetch(`${AI_SERVER_URL}/api/inbox/${item.id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 60 })
      });
      await fetchInbox();
    } catch (e) {}
  };

  const handleDismiss = async (item) => {
    try {
      await fetch(`${AI_SERVER_URL}/api/inbox/${item.id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedType: item.feed_type })
      });
      await Promise.all([fetchInbox(), fetchCounts()]);
    } catch (e) {}
  };

  useEffect(() => {
    fetchInbox();
    fetchCounts();

    // Refresh every 2 minutes
    const interval = setInterval(() => {
      fetchInbox();
      fetchCounts();
    }, 120000);

    return () => clearInterval(interval);
  }, [filter, statusFilter]);

  const filterTabs = [
    { id: 'all', label: 'All', count: counts.total },
    { id: 'ticket', label: 'Tickets', count: counts.tickets || 0, icon: Ticket },
    { id: 'task', label: 'Tasks', count: counts.tasks || 0, icon: CheckSquare },
    { id: 'notification', label: 'Notifications', count: counts.notifications || 0, icon: Bell }
  ];

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-cyan-400" />
            Action Feed
          </h1>
          <p className="text-gray-400 mt-1">
            All your tickets, tasks, and notifications in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Items</option>
            <option value="unread">Unread Only</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Counts Summary */}
      <div className="grid grid-cols-4 gap-4">
        {filterTabs.map((tab) => {
          const Icon = tab.icon || InboxIcon;
          const isActive = filter === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`p-4 rounded-lg border transition-all ${
                isActive
                  ? 'bg-cyan-500/20 border-cyan-500/50'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-gray-400'}`} />
                <span className={`text-2xl font-bold ${isActive ? 'text-cyan-400' : 'text-white'}`}>
                  {tab.count}
                </span>
              </div>
              <p className={`text-sm mt-2 ${isActive ? 'text-cyan-300' : 'text-gray-400'}`}>
                {tab.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Inbox Items */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            {filterTabs.find(t => t.id === filter)?.label || 'All'}
            <span className="text-sm text-gray-500 font-normal">
              ({items.length} items)
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No action items</p>
            <p className="text-sm text-gray-500 mt-1">
              Click "Sync Now" to pull in tickets and tasks from connected services
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <InboxItem
                key={`${item.feed_type}-${item.id}`}
                item={item}
                onMarkRead={handleMarkRead}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card p-4 bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-300">
              {counts.total > 0
                ? `You have ${counts.total} items requiring attention`
                : 'All caught up! Your feed is clear.'}
            </span>
          </div>
          {counts.total > 0 && (
            <button className="text-sm text-cyan-400 hover:underline flex items-center gap-1">
              Process all <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActionFeed;
