import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  Hash,
  AtSign,
  Search,
  Plus,
  MoreVertical,
  Link2,
  FileText,
  FolderGit2,
  Briefcase,
  Clock,
  CheckCircle2,
  Circle,
  Star,
  Pin,
  Paperclip,
  Smile,
  Image,
  Bell,
  BellOff,
  Trash2,
  Edit3,
  Reply,
  Check,
  X,
  ChevronDown,
  Settings,
  UserPlus,
  LogOut,
  Bot,
  Sparkles
} from 'lucide-react';

// Storage keys
const MESSAGES_STORAGE_KEY = 'liv8_inbox_messages';
const CHANNELS_STORAGE_KEY = 'liv8_inbox_channels';
const DIRECT_MESSAGES_KEY = 'liv8_direct_messages';

// Default team members (synced with existing team data)
const TEAM_MEMBERS = [
  { id: 'ceo', name: 'CEO', role: 'Chief Executive Officer', avatar: '👤', status: 'online' },
  { id: 'vp-tech', name: 'VP of Technology', role: 'Technical Lead', avatar: '💻', status: 'online' },
  { id: 'ops-manager', name: 'Operations Manager', role: 'Operations', avatar: '📊', status: 'away' },
  { id: 'support-lead', name: 'Support Lead', role: 'Customer Support', avatar: '🎧', status: 'online' },
  { id: 'marketing', name: 'Marketing Lead', role: 'Marketing', avatar: '📢', status: 'offline' },
  { id: 'dev-1', name: 'Senior Developer', role: 'Development', avatar: '⚡', status: 'online' },
  { id: 'dev-2', name: 'Frontend Developer', role: 'Development', avatar: '🎨', status: 'online' },
  { id: 'ai-assistant', name: 'HybridCore AI', role: 'AI Assistant', avatar: '🤖', status: 'online', isAI: true },
];

// Default channels
const DEFAULT_CHANNELS = [
  { id: 'general', name: 'general', description: 'General team discussions', icon: Hash, members: TEAM_MEMBERS.map(m => m.id) },
  { id: 'development', name: 'development', description: 'Dev updates and code reviews', icon: Hash, members: ['ceo', 'vp-tech', 'dev-1', 'dev-2', 'ai-assistant'] },
  { id: 'support', name: 'support', description: 'Customer support coordination', icon: Hash, members: ['ceo', 'support-lead', 'ops-manager', 'ai-assistant'] },
  { id: 'announcements', name: 'announcements', description: 'Important company announcements', icon: Hash, members: TEAM_MEMBERS.map(m => m.id) },
  { id: 'random', name: 'random', description: 'Off-topic conversations', icon: Hash, members: TEAM_MEMBERS.map(m => m.id) },
];

// Sample messages for onboarding
const SAMPLE_MESSAGES = {
  general: [
    { id: 1, userId: 'ai-assistant', content: 'Welcome to the LIV8 Command Center team inbox! This is your central hub for team communication. You can @mention team members, link to projects, and collaborate on tasks.', timestamp: new Date(Date.now() - 86400000).toISOString(), reactions: [{ emoji: '👋', users: ['ceo', 'vp-tech'] }] },
    { id: 2, userId: 'ceo', content: 'Great to have everyone connected! Let\'s use this space to stay aligned on priorities.', timestamp: new Date(Date.now() - 3600000).toISOString(), reactions: [] },
  ],
  development: [
    { id: 1, userId: 'vp-tech', content: 'Quick update: The [[project:liv8-credit]] is ready for final review before deployment. @dev-1 can you handle the code review?', timestamp: new Date(Date.now() - 7200000).toISOString(), reactions: [{ emoji: '✅', users: ['dev-1'] }] },
    { id: 2, userId: 'dev-1', content: 'On it! Will have the review done by EOD. The [[project:hybrid-journal]] also needs attention for the auth fix.', timestamp: new Date(Date.now() - 3600000).toISOString(), reactions: [] },
  ],
  support: [
    { id: 1, userId: 'support-lead', content: 'Heads up team - we have a few priority tickets coming in about phone porting. Let\'s make sure we\'re aligned on the process.', timestamp: new Date(Date.now() - 14400000).toISOString(), reactions: [] },
    { id: 2, userId: 'ai-assistant', content: 'I can help monitor ticket patterns and flag urgent items automatically. Just let me know if you\'d like me to provide daily summaries!', timestamp: new Date(Date.now() - 10800000).toISOString(), reactions: [{ emoji: '🤖', users: ['support-lead'] }] },
  ],
  announcements: [
    { id: 1, userId: 'ceo', content: '📢 Team Update: We\'re on track for our Q1 goals! [[business:hybrid-funding]] is performing well and [[project:abatev]] patent filing is in progress. Great work everyone!', timestamp: new Date(Date.now() - 172800000).toISOString(), reactions: [{ emoji: '🎉', users: ['vp-tech', 'dev-1', 'dev-2', 'ops-manager'] }, { emoji: '🚀', users: ['support-lead', 'marketing'] }], pinned: true },
  ],
  random: [],
};

function Inbox() {
  // Current user (would come from auth in production)
  const [currentUser] = useState(TEAM_MEMBERS[0]);

  // State
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [linkFilter, setLinkFilter] = useState('');
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [directMessages, setDirectMessages] = useState([]);
  const [activeDM, setActiveDM] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});

  const messageEndRef = useRef(null);
  const inputRef = useRef(null);

  // Linkable items (from the app's data)
  const linkableItems = [
    { type: 'project', id: 'liv8-credit', name: 'LIV8 Credit', icon: FolderGit2 },
    { type: 'project', id: 'hybrid-journal', name: 'Hybrid Journal', icon: FolderGit2 },
    { type: 'project', id: 'abatev', name: 'ABATEV', icon: FolderGit2 },
    { type: 'project', id: 'trade-hybrid-app', name: 'Trade Hybrid App', icon: FolderGit2 },
    { type: 'business', id: 'hybrid-funding', name: 'Hybrid Funding', icon: Briefcase },
    { type: 'business', id: 'liv8-solar', name: 'LIV8 Solar', icon: Briefcase },
    { type: 'business', id: 'liv8-health', name: 'LIV8 Health', icon: Briefcase },
    { type: 'ticket', id: 'recent', name: 'Recent Tickets', icon: FileText },
  ];

  // Load data from localStorage
  useEffect(() => {
    const storedChannels = localStorage.getItem(CHANNELS_STORAGE_KEY);
    const storedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY);
    const storedDMs = localStorage.getItem(DIRECT_MESSAGES_KEY);

    if (storedChannels) {
      setChannels(JSON.parse(storedChannels));
    } else {
      setChannels(DEFAULT_CHANNELS);
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(DEFAULT_CHANNELS));
    }

    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    } else {
      setMessages(SAMPLE_MESSAGES);
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(SAMPLE_MESSAGES));
    }

    if (storedDMs) {
      setDirectMessages(JSON.parse(storedDMs));
    }

    // Set default active channel
    setActiveChannel('general');
  }, []);

  // Save data to localStorage
  useEffect(() => {
    if (Object.keys(messages).length > 0) {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (channels.length > 0) {
      localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(channels));
    }
  }, [channels]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel]);

  // Handle @ mentions
  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1 ||
        (lastAtIndex !== -1 && !value.substring(lastAtIndex).includes(' '))) {
      setShowMentionMenu(true);
      setMentionFilter(value.substring(lastAtIndex + 1));
    } else {
      setShowMentionMenu(false);
    }

    // Check for [[ links
    const lastBracketIndex = value.lastIndexOf('[[');
    if (lastBracketIndex !== -1 && !value.substring(lastBracketIndex).includes(']]')) {
      setShowLinkMenu(true);
      setLinkFilter(value.substring(lastBracketIndex + 2));
    } else {
      setShowLinkMenu(false);
    }
  };

  // Insert mention
  const insertMention = (member) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    const newText = newMessage.substring(0, lastAtIndex) + `@${member.id} `;
    setNewMessage(newText);
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  // Insert link
  const insertLink = (item) => {
    const lastBracketIndex = newMessage.lastIndexOf('[[');
    const newText = newMessage.substring(0, lastBracketIndex) + `[[${item.type}:${item.id}]] `;
    setNewMessage(newText);
    setShowLinkMenu(false);
    inputRef.current?.focus();
  };

  // Send message
  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel) return;

    const message = {
      id: Date.now(),
      userId: currentUser.id,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      reactions: [],
    };

    setMessages(prev => ({
      ...prev,
      [activeChannel]: [...(prev[activeChannel] || []), message]
    }));

    setNewMessage('');
  };

  // Add reaction
  const addReaction = (channelId, messageId, emoji) => {
    setMessages(prev => ({
      ...prev,
      [channelId]: prev[channelId].map(msg => {
        if (msg.id === messageId) {
          const existingReaction = msg.reactions.find(r => r.emoji === emoji);
          if (existingReaction) {
            if (existingReaction.users.includes(currentUser.id)) {
              // Remove user from reaction
              return {
                ...msg,
                reactions: msg.reactions.map(r =>
                  r.emoji === emoji
                    ? { ...r, users: r.users.filter(u => u !== currentUser.id) }
                    : r
                ).filter(r => r.users.length > 0)
              };
            } else {
              // Add user to reaction
              return {
                ...msg,
                reactions: msg.reactions.map(r =>
                  r.emoji === emoji
                    ? { ...r, users: [...r.users, currentUser.id] }
                    : r
                )
              };
            }
          } else {
            // Add new reaction
            return {
              ...msg,
              reactions: [...msg.reactions, { emoji, users: [currentUser.id] }]
            };
          }
        }
        return msg;
      })
    }));
  };

  // Render message content with mentions and links
  const renderMessageContent = (content) => {
    // Replace @mentions
    let rendered = content.replace(/@(\w+(-\w+)?)/g, (match, userId) => {
      const member = TEAM_MEMBERS.find(m => m.id === userId);
      return member
        ? `<span class="text-purple-400 bg-purple-500/20 px-1 rounded cursor-pointer hover:bg-purple-500/30">@${member.name}</span>`
        : match;
    });

    // Replace [[links]]
    rendered = rendered.replace(/\[\[([\w-]+):([\w-]+)\]\]/g, (match, type, id) => {
      const item = linkableItems.find(i => i.type === type && i.id === id);
      return item
        ? `<span class="text-cyan-400 bg-cyan-500/20 px-1 rounded cursor-pointer hover:bg-cyan-500/30 inline-flex items-center gap-1">📎 ${item.name}</span>`
        : match;
    });

    return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Get member by ID
  const getMember = (userId) => TEAM_MEMBERS.find(m => m.id === userId) || { name: 'Unknown', avatar: '❓' };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Filter members for mention menu
  const filteredMembers = TEAM_MEMBERS.filter(m =>
    m.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
    m.id.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // Filter linkable items
  const filteredLinks = linkableItems.filter(i =>
    i.name.toLowerCase().includes(linkFilter.toLowerCase()) ||
    i.id.toLowerCase().includes(linkFilter.toLowerCase())
  );

  const currentMessages = activeChannel ? (messages[activeChannel] || []) : [];
  const currentChannelData = channels.find(c => c.id === activeChannel);

  return (
    <div className="h-[calc(100vh-8rem)] flex animate-slide-in">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-64' : 'w-0'} flex-shrink-0 bg-white/5 border-r border-white/10 overflow-hidden transition-all duration-300`}>
        <div className="h-full flex flex-col">
          {/* Workspace Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                  L
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm">LIV8 Command</h2>
                  <p className="text-xs text-gray-400">{TEAM_MEMBERS.filter(m => m.status === 'online').length} online</p>
                </div>
              </div>
              <button className="p-1 rounded hover:bg-white/10">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Channels */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase">Channels</span>
                <button
                  onClick={() => setShowChannelModal(true)}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              {channels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => {
                    setActiveChannel(channel.id);
                    setActiveDM(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    activeChannel === channel.id
                      ? 'bg-purple-600/20 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                  {unreadCounts[channel.id] > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-xs rounded-full bg-purple-500 text-white">
                      {unreadCounts[channel.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Direct Messages */}
            <div className="px-3 py-2 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase">Direct Messages</span>
                <button className="p-1 rounded hover:bg-white/10">
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              {TEAM_MEMBERS.filter(m => m.id !== currentUser.id).slice(0, 5).map(member => (
                <button
                  key={member.id}
                  onClick={() => {
                    setActiveDM(member.id);
                    setActiveChannel(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    activeDM === member.id
                      ? 'bg-purple-600/20 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="relative">
                    <span className="text-base">{member.avatar}</span>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${getStatusColor(member.status)}`} />
                  </div>
                  <span className="truncate">{member.name}</span>
                  {member.isAI && <Bot className="w-3 h-3 text-purple-400 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Current User */}
          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="text-xl">{currentUser.avatar}</span>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${getStatusColor(currentUser.status)}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{currentUser.name}</p>
                <p className="text-xs text-gray-400">{currentUser.role}</p>
              </div>
              <button className="p-1 rounded hover:bg-white/10">
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        {(activeChannel || activeDM) && (
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              {activeChannel ? (
                <>
                  <Hash className="w-5 h-5 text-gray-400" />
                  <div>
                    <h2 className="text-white font-semibold">{currentChannelData?.name}</h2>
                    <p className="text-xs text-gray-400">{currentChannelData?.description}</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-xl">{getMember(activeDM).avatar}</span>
                  <div>
                    <h2 className="text-white font-semibold">{getMember(activeDM).name}</h2>
                    <p className="text-xs text-gray-400">{getMember(activeDM).role}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-white/10">
                <Users className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/10">
                <Pin className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/10">
                <Search className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentMessages.map((msg) => {
            const sender = getMember(msg.userId);
            return (
              <div
                key={msg.id}
                className={`group flex gap-3 ${msg.pinned ? 'bg-yellow-500/5 -mx-4 px-4 py-2 border-l-2 border-yellow-500' : ''}`}
              >
                <div className="flex-shrink-0 pt-1">
                  <div className="relative">
                    <span className="text-2xl">{sender.avatar}</span>
                    {sender.isAI && (
                      <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-purple-400" />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold ${sender.isAI ? 'text-purple-400' : 'text-white'}`}>
                      {sender.name}
                    </span>
                    {sender.isAI && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/20 text-purple-400">AI</span>
                    )}
                    <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
                    {msg.pinned && <Pin className="w-3 h-3 text-yellow-400" />}
                  </div>
                  <div className="text-gray-300 text-sm">
                    {renderMessageContent(msg.content)}
                  </div>
                  {/* Reactions */}
                  {msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.reactions.map((reaction, idx) => (
                        <button
                          key={idx}
                          onClick={() => addReaction(activeChannel, msg.id, reaction.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                            reaction.users.includes(currentUser.id)
                              ? 'bg-purple-500/30 text-purple-300'
                              : 'bg-white/10 text-gray-400 hover:bg-white/20'
                          }`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Quick reaction buttons (show on hover) */}
                  <div className="hidden group-hover:flex items-center gap-1 mt-2">
                    {['👍', '❤️', '🎉', '👀', '🚀'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => addReaction(activeChannel, msg.id, emoji)}
                        className="p-1 rounded hover:bg-white/10 text-sm"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button className="p-1 rounded hover:bg-white/10">
                      <Reply className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messageEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-white/10">
          <form onSubmit={sendMessage} className="relative">
            {/* Mention Menu */}
            {showMentionMenu && filteredMembers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 border border-white/20 rounded-lg shadow-xl overflow-hidden">
                <div className="p-2 border-b border-white/10">
                  <span className="text-xs text-gray-400">Team Members</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredMembers.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => insertMention(member)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left"
                    >
                      <span>{member.avatar}</span>
                      <div>
                        <p className="text-sm text-white">{member.name}</p>
                        <p className="text-xs text-gray-400">{member.role}</p>
                      </div>
                      {member.isAI && <Bot className="w-3 h-3 text-purple-400 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Link Menu */}
            {showLinkMenu && filteredLinks.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 border border-white/20 rounded-lg shadow-xl overflow-hidden">
                <div className="p-2 border-b border-white/10">
                  <span className="text-xs text-gray-400">Link to...</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredLinks.map(item => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => insertLink(item)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left"
                    >
                      <item.icon className="w-4 h-4 text-cyan-400" />
                      <div>
                        <p className="text-sm text-white">{item.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{item.type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  placeholder={`Message #${currentChannelData?.name || 'channel'}... (@ to mention, [[ to link)`}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button type="button" className="p-1.5 rounded hover:bg-white/10">
                    <Paperclip className="w-4 h-4 text-gray-400" />
                  </button>
                  <button type="button" className="p-1.5 rounded hover:bg-white/10">
                    <Smile className="w-4 h-4 text-gray-400" />
                  </button>
                  <button type="button" className="p-1.5 rounded hover:bg-white/10">
                    <AtSign className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-4 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Tip: Use @name to mention, [[type:id]] to link to projects/businesses
            </p>
          </form>
        </div>
      </div>

      {/* Right Sidebar - Members (optional) */}
      {activeChannel && (
        <div className="hidden xl:block w-64 border-l border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Channel Members</h3>
          <div className="space-y-3">
            {currentChannelData?.members.map(memberId => {
              const member = getMember(memberId);
              return (
                <div key={memberId} className="flex items-center gap-2">
                  <div className="relative">
                    <span className="text-lg">{member.avatar}</span>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${getStatusColor(member.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{member.name}</p>
                    <p className="text-xs text-gray-400 truncate">{member.role}</p>
                  </div>
                  {member.isAI && <Bot className="w-3 h-3 text-purple-400" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Inbox;
