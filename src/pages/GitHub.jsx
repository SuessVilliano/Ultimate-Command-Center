import React, { useState, useEffect, useRef } from 'react';
import {
  Github,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Star,
  Eye,
  GitFork,
  RefreshCw,
  ExternalLink,
  Folder,
  FileCode,
  Clock,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Play,
  Copy,
  Check,
  Search,
  Filter,
  Download,
  Loader2,
  Bot,
  Send,
  Sparkles,
  Rocket,
  Globe,
  Zap,
  MessageSquare
} from 'lucide-react';

// GitHub username
const GITHUB_USERNAME = 'SuessVilliano';

// Storage key for repos
const REPOS_STORAGE_KEY = 'liv8_github_repos';
const REPOS_LAST_FETCH_KEY = 'liv8_github_repos_last_fetch';

// AI Server URL
const AI_SERVER_URL = 'http://localhost:3005';

function GitHub() {
  const [repos, setRepos] = useState([]);
  const [filteredRepos, setFilteredRepos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [terminalOutput, setTerminalOutput] = useState([
    { type: 'system', content: 'LIV8 GitHub CLI Ready' },
    { type: 'info', content: 'Type a command or click Quick Actions below' },
  ]);
  const [command, setCommand] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(null);

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: 'Hey! I\'m your GitHub AI Assistant. I can help you manage your repositories, deploy sites, and more. Try asking me things like:\n\n• "Deploy liv8-credit to Vercel"\n• "Show me my most active repos"\n• "Create a new issue on hybrid-journal"\n• "What repos need attention?"\n• "Help me set up GitHub Pages"' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('assistant'); // 'assistant' or 'terminal'
  const chatEndRef = useRef(null);

  const quickCommands = [
    { label: 'List Repos', cmd: `gh repo list ${GITHUB_USERNAME} --limit 100` },
    { label: 'Check Auth', cmd: 'gh auth status' },
    { label: 'View Profile', cmd: 'gh api user' },
    { label: 'Clone All', cmd: `gh repo list ${GITHUB_USERNAME} --json name --jq ".[].name" | xargs -I {} gh repo clone ${GITHUB_USERNAME}/{}` },
  ];

  // AI quick suggestions
  const aiSuggestions = [
    { icon: Rocket, label: 'Deploy a site', prompt: 'Help me deploy one of my repos to Vercel' },
    { icon: Globe, label: 'GitHub Pages', prompt: 'Set up GitHub Pages for a repository' },
    { icon: Zap, label: 'Quick status', prompt: 'Give me a quick status of my most important repos' },
    { icon: MessageSquare, label: 'Create issue', prompt: 'Help me create a new issue' },
  ];

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  // AI Assistant message handler
  const handleAiMessage = async (userMessage) => {
    if (!userMessage.trim()) return;

    // Add user message
    setAiMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiInput('');
    setAiLoading(true);

    try {
      // Build context about repos
      const repoContext = repos.slice(0, 20).map(r =>
        `- ${r.name} (${r.language}, ${r.status}, updated ${formatDate(r.updatedAt)})`
      ).join('\n');

      const selectedContext = selectedRepo
        ? `\n\nCurrently selected repo: ${selectedRepo.name} - ${selectedRepo.description}`
        : '';

      const systemPrompt = `You are an AI assistant for managing GitHub repositories. The user is ${GITHUB_USERNAME} with ${repos.length} repositories.

Key repositories:
${repoContext}
${selectedContext}

You can help with:
- Deploying repos to Vercel, Netlify, or GitHub Pages
- Managing issues and pull requests
- Explaining repo status and activity
- Generating GitHub CLI commands
- Setting up CI/CD with GitHub Actions

When suggesting commands, always format them in code blocks. Be concise but helpful.`;

      const response = await fetch(`${AI_SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          systemPrompt,
          context: { repos: repos.length, selectedRepo: selectedRepo?.name }
        })
      });

      if (!response.ok) {
        throw new Error('AI server not available');
      }

      const data = await response.json();
      setAiMessages(prev => [...prev, { role: 'assistant', content: data.response }]);

    } catch (err) {
      // Fallback to intelligent local responses
      const fallbackResponse = generateLocalResponse(userMessage, repos, selectedRepo);
      setAiMessages(prev => [...prev, { role: 'assistant', content: fallbackResponse }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Generate intelligent local response when AI server is unavailable
  const generateLocalResponse = (message, repoList, selected) => {
    const lower = message.toLowerCase();

    // Deploy commands
    if (lower.includes('deploy') || lower.includes('vercel') || lower.includes('netlify')) {
      const repoName = selected?.name || 'your-repo';
      return `To deploy **${repoName}** to Vercel:\n\n\`\`\`bash\n# Install Vercel CLI\nnpm i -g vercel\n\n# Navigate to repo and deploy\ncd ${repoName}\nvercel\n\n# Or deploy to production directly\nvercel --prod\n\`\`\`\n\nFor Netlify:\n\`\`\`bash\nnpm i -g netlify-cli\nnetlify deploy --prod\n\`\`\`\n\nWant me to help with a specific repo?`;
    }

    // GitHub Pages
    if (lower.includes('github pages') || lower.includes('gh-pages')) {
      const repoName = selected?.name || 'your-repo';
      return `To set up **GitHub Pages** for ${repoName}:\n\n\`\`\`bash\n# Enable GitHub Pages via CLI\ngh api repos/${GITHUB_USERNAME}/${repoName}/pages -X POST -f source='{"branch":"main","path":"/"}'\n\n# Or for a built site (docs folder)\ngh api repos/${GITHUB_USERNAME}/${repoName}/pages -X POST -f source='{"branch":"main","path":"/docs"}'\n\`\`\`\n\nYou can also enable it in repo Settings > Pages.`;
    }

    // Status/active repos
    if (lower.includes('status') || lower.includes('active') || lower.includes('attention')) {
      const active = repoList.filter(r => r.status === 'active').slice(0, 5);
      const withIssues = repoList.filter(r => r.openIssues > 0).slice(0, 3);

      let response = `**Repository Status Overview:**\n\n`;
      response += `Active repos (updated this week):\n`;
      active.forEach(r => {
        response += `• **${r.name}** - ${r.language} - ${r.openIssues} open issues\n`;
      });

      if (withIssues.length > 0) {
        response += `\nRepos needing attention:\n`;
        withIssues.forEach(r => {
          response += `• **${r.name}** has ${r.openIssues} open issues\n`;
        });
      }

      return response;
    }

    // Create issue
    if (lower.includes('issue') || lower.includes('bug')) {
      const repoName = selected?.name || 'REPO_NAME';
      return `To create an issue on **${repoName}**:\n\n\`\`\`bash\ngh issue create --repo ${GITHUB_USERNAME}/${repoName} --title "Issue title" --body "Description"\n\n# Or interactively\ngh issue create --repo ${GITHUB_USERNAME}/${repoName}\n\`\`\`\n\nWant me to help draft the issue content?`;
    }

    // Clone
    if (lower.includes('clone')) {
      const repoName = selected?.name || repoList[0]?.name || 'repo-name';
      return `To clone **${repoName}**:\n\n\`\`\`bash\ngh repo clone ${GITHUB_USERNAME}/${repoName}\n\n# Clone and open in VS Code\ngh repo clone ${GITHUB_USERNAME}/${repoName} && code ${repoName}\n\`\`\``;
    }

    // List/show repos
    if (lower.includes('list') || lower.includes('show') || lower.includes('repos')) {
      const topRepos = repoList.slice(0, 8);
      let response = `**Your top repositories:**\n\n`;
      topRepos.forEach(r => {
        const status = r.status === 'active' ? '🟢' : r.status === 'recent' ? '🔵' : '🟡';
        response += `${status} **${r.name}** - ${r.language || 'N/A'} - ${formatDate(r.updatedAt)}\n`;
      });
      response += `\n*${repoList.length} total repositories*`;
      return response;
    }

    // Default helpful response
    return `I can help you with:\n\n• **Deploy**: "Deploy [repo] to Vercel/Netlify"\n• **GitHub Pages**: "Set up GitHub Pages for [repo]"\n• **Issues**: "Create an issue on [repo]"\n• **Status**: "Show my active repos"\n• **Clone**: "Clone [repo]"\n\nTry selecting a repo first, then ask me what you'd like to do with it!`;
  };

  // Load repos from localStorage or fetch
  useEffect(() => {
    const loadRepos = async () => {
      const storedRepos = localStorage.getItem(REPOS_STORAGE_KEY);
      const lastFetch = localStorage.getItem(REPOS_LAST_FETCH_KEY);

      if (storedRepos) {
        const parsed = JSON.parse(storedRepos);
        setRepos(parsed);
        setFilteredRepos(parsed);

        // If last fetch was more than 1 hour ago, refresh in background
        if (lastFetch) {
          const hourAgo = Date.now() - (60 * 60 * 1000);
          if (new Date(lastFetch).getTime() < hourAgo) {
            fetchRepos(true); // Background refresh
          }
        }
      } else {
        fetchRepos();
      }
    };

    loadRepos();
  }, []);

  // Filter repos when search or filter changes
  useEffect(() => {
    let filtered = repos;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(query) ||
        (r.description && r.description.toLowerCase().includes(query))
      );
    }

    if (filterLanguage !== 'all') {
      filtered = filtered.filter(r => r.language === filterLanguage);
    }

    setFilteredRepos(filtered);
  }, [searchQuery, filterLanguage, repos]);

  const fetchRepos = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setError(null);

    try {
      // Fetch all pages of repos
      let allRepos = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&page=${page}&sort=updated`
        );

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('GitHub API rate limit exceeded. Try again in a few minutes.');
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.length === 0) {
          hasMore = false;
        } else {
          allRepos = [...allRepos, ...data];
          page++;
        }

        // Safety: max 10 pages (1000 repos)
        if (page > 10) hasMore = false;
      }

      // Transform and enrich repo data
      const enrichedRepos = allRepos.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || 'No description',
        url: repo.html_url,
        language: repo.language || 'Unknown',
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        isPrivate: repo.private,
        updatedAt: repo.updated_at,
        createdAt: repo.created_at,
        defaultBranch: repo.default_branch,
        topics: repo.topics || [],
        size: repo.size,
        hasIssues: repo.has_issues,
        openIssues: repo.open_issues_count,
        // Status detection based on various factors
        status: detectRepoStatus(repo),
        // Priority score for sorting
        priority: calculatePriority(repo)
      }));

      // Sort by priority (most important first)
      enrichedRepos.sort((a, b) => b.priority - a.priority);

      // Save to state and localStorage
      setRepos(enrichedRepos);
      setFilteredRepos(enrichedRepos);
      localStorage.setItem(REPOS_STORAGE_KEY, JSON.stringify(enrichedRepos));
      localStorage.setItem(REPOS_LAST_FETCH_KEY, new Date().toISOString());

      setTerminalOutput(prev => [
        ...prev,
        { type: 'system', content: `Fetched ${enrichedRepos.length} repositories from GitHub` }
      ]);

    } catch (err) {
      console.error('GitHub fetch error:', err);
      setError(err.message);
      setTerminalOutput(prev => [
        ...prev,
        { type: 'error', content: `Error: ${err.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Detect repo status based on activity
  const detectRepoStatus = (repo) => {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceUpdate < 7) return 'active';
    if (daysSinceUpdate < 30) return 'recent';
    if (daysSinceUpdate < 90) return 'stable';
    return 'archived';
  };

  // Calculate priority score for sorting
  const calculatePriority = (repo) => {
    let score = 0;

    // Recent activity
    const daysSinceUpdate = Math.floor((Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate < 7) score += 50;
    else if (daysSinceUpdate < 30) score += 30;
    else if (daysSinceUpdate < 90) score += 10;

    // Stars and engagement
    score += repo.stargazers_count * 5;
    score += repo.forks_count * 3;

    // Size indicates more development
    if (repo.size > 1000) score += 10;

    // Has description
    if (repo.description) score += 5;

    // Known important names
    const importantNames = ['liv8', 'hybrid', 'trade', 'credit', 'abate', 'funding'];
    if (importantNames.some(n => repo.name.toLowerCase().includes(n))) {
      score += 30;
    }

    return score;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'recent': return 'bg-cyan-500/20 text-cyan-400';
      case 'stable': return 'bg-yellow-500/20 text-yellow-400';
      case 'archived': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getLanguageColor = (lang) => {
    const colors = {
      'JavaScript': 'bg-yellow-500/20 text-yellow-400',
      'TypeScript': 'bg-blue-500/20 text-blue-400',
      'Python': 'bg-green-500/20 text-green-400',
      'Solidity': 'bg-purple-500/20 text-purple-400',
      'HTML': 'bg-orange-500/20 text-orange-400',
      'CSS': 'bg-pink-500/20 text-pink-400',
      'Unknown': 'bg-gray-500/20 text-gray-400'
    };
    return colors[lang] || 'bg-gray-500/20 text-gray-400';
  };

  // Get unique languages for filter
  const languages = [...new Set(repos.map(r => r.language))].filter(Boolean).sort();

  const executeCommand = (cmd) => {
    setTerminalOutput(prev => [
      ...prev,
      { type: 'command', content: `$ ${cmd}` },
      { type: 'info', content: 'Command copied to clipboard. Run in your terminal.' }
    ]);
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (command.trim()) {
      executeCommand(command);
      setCommand('');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">GitHub Projects</h1>
          <p className="text-gray-400">
            {repos.length} repositories from @{GITHUB_USERNAME}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchRepos()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            <span>{isLoading ? 'Fetching...' : 'Refresh All'}</span>
          </button>
          <a
            href={`https://github.com/${GITHUB_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <Github className="w-5 h-5" />
            <span>View Profile</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-white">{repos.length}</p>
          <p className="text-sm text-gray-400">Total Repos</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-400">
            {repos.filter(r => r.status === 'active').length}
          </p>
          <p className="text-sm text-gray-400">Active (7d)</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-cyan-400">
            {repos.filter(r => r.status === 'recent').length}
          </p>
          <p className="text-sm text-gray-400">Recent (30d)</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">
            {repos.reduce((sum, r) => sum + r.stars, 0)}
          </p>
          <p className="text-sm text-gray-400">Total Stars</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">
            {languages.length}
          </p>
          <p className="text-sm text-gray-400">Languages</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Languages</option>
              {languages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Showing {filteredRepos.length} of {repos.length} repositories
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repositories */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Folder className="w-5 h-5 text-purple-400" />
              Repositories
            </h3>
          </div>

          {isLoading && repos.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedRepo?.id === repo.id
                      ? 'bg-purple-500/10 border-purple-500/30'
                      : 'bg-white/5 border-white/10 hover:border-purple-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileCode className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-white truncate">{repo.name}</span>
                      {repo.isPrivate && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-yellow-500/20 text-yellow-400">
                          Private
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${getStatusColor(repo.status)}`}>
                      {repo.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2 line-clamp-2">{repo.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs rounded ${getLanguageColor(repo.language)}`}>
                      {repo.language}
                    </span>
                    {repo.stars > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Star className="w-3 h-3" /> {repo.stars}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" /> {formatDate(repo.updatedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Assistant / Terminal */}
        <div className="card p-6">
          {/* Tab Headers */}
          <div className="flex items-center gap-4 mb-4 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveTab('assistant')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'assistant'
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bot className="w-5 h-5" />
              AI Assistant
              <Sparkles className="w-3 h-3" />
            </button>
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'terminal'
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Terminal className="w-5 h-5" />
              CLI Terminal
            </button>
          </div>

          {activeTab === 'assistant' ? (
            <>
              {/* AI Quick Suggestions */}
              <div className="flex flex-wrap gap-2 mb-4">
                {aiSuggestions.map((sug) => (
                  <button
                    key={sug.label}
                    onClick={() => handleAiMessage(sug.prompt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                  >
                    <sug.icon className="w-3 h-3" />
                    {sug.label}
                  </button>
                ))}
              </div>

              {/* Chat Messages */}
              <div className="bg-black/30 rounded-lg p-4 h-72 overflow-y-auto mb-4 space-y-4">
                {aiMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        msg.role === 'user'
                          ? 'bg-purple-600/30 text-white'
                          : 'bg-white/5 text-gray-300'
                      }`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                          <Bot className="w-4 h-4 text-purple-400" />
                          <span className="text-xs text-purple-400 font-medium">GitHub AI</span>
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap">
                        {msg.content.split('```').map((part, i) => {
                          if (i % 2 === 1) {
                            // Code block
                            const lines = part.split('\n');
                            const language = lines[0];
                            const code = lines.slice(1).join('\n');
                            return (
                              <div key={i} className="my-2">
                                <div className="flex items-center justify-between bg-black/50 px-3 py-1 rounded-t text-xs text-gray-400">
                                  <span>{language || 'code'}</span>
                                  <button
                                    onClick={() => copyToClipboard(code)}
                                    className="hover:text-white"
                                  >
                                    {copiedCmd === code ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <pre className="bg-black/50 px-3 py-2 rounded-b text-xs font-mono overflow-x-auto text-cyan-300">
                                  {code}
                                </pre>
                              </div>
                            );
                          }
                          // Regular text with markdown bold
                          return (
                            <span key={i}>
                              {part.split('**').map((text, j) =>
                                j % 2 === 1 ? <strong key={j} className="text-white">{text}</strong> : text
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        <span className="text-sm text-gray-400">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* AI Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAiMessage(aiInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask me anything about your repos..."
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiInput.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Quick Commands */}
              <div className="flex flex-wrap gap-2 mb-4">
                {quickCommands.map((qc) => (
                  <button
                    key={qc.label}
                    onClick={() => executeCommand(qc.cmd)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    {qc.label}
                  </button>
                ))}
              </div>

              {/* Terminal Output */}
              <div className="bg-black/50 rounded-lg p-4 font-mono text-sm h-72 overflow-y-auto mb-4">
                {terminalOutput.map((line, idx) => (
                  <div
                    key={idx}
                    className={`mb-1 ${
                      line.type === 'command' ? 'text-green-400' :
                      line.type === 'error' ? 'text-red-400' :
                      line.type === 'system' ? 'text-purple-400' :
                      'text-gray-400'
                    }`}
                  >
                    {line.content}
                  </div>
                ))}
              </div>

              {/* Command Input */}
              <form onSubmit={handleCommandSubmit} className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30 border border-white/10">
                  <span className="text-green-400">$</span>
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Enter gh command..."
                    className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none font-mono text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                >
                  Run
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Selected Repo Details */}
      {selectedRepo && (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Github className="w-6 h-6 text-purple-400" />
                {selectedRepo.name}
              </h3>
              <p className="text-gray-400 mt-1">{selectedRepo.description}</p>
            </div>
            <a
              href={selectedRepo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in GitHub
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-white/5">
              <p className="text-sm text-gray-400 mb-1">Status</p>
              <p className={`text-lg font-semibold ${
                selectedRepo.status === 'active' ? 'text-green-400' :
                selectedRepo.status === 'recent' ? 'text-cyan-400' :
                selectedRepo.status === 'stable' ? 'text-yellow-400' : 'text-gray-400'
              }`}>
                {selectedRepo.status.charAt(0).toUpperCase() + selectedRepo.status.slice(1)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-white/5">
              <p className="text-sm text-gray-400 mb-1">Language</p>
              <p className="text-lg font-semibold text-white">{selectedRepo.language}</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5">
              <p className="text-sm text-gray-400 mb-1">Last Updated</p>
              <p className="text-lg font-semibold text-white">{formatDate(selectedRepo.updatedAt)}</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5">
              <p className="text-sm text-gray-400 mb-1">Open Issues</p>
              <p className="text-lg font-semibold text-white">{selectedRepo.openIssues}</p>
            </div>
          </div>

          {/* Quick Actions for Selected Repo */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => copyToClipboard(`gh repo clone ${GITHUB_USERNAME}/${selectedRepo.name}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
            >
              {copiedCmd === `gh repo clone ${GITHUB_USERNAME}/${selectedRepo.name}` ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              Clone
            </button>
            <button
              onClick={() => copyToClipboard(`gh issue list --repo ${GITHUB_USERNAME}/${selectedRepo.name}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
            >
              <GitPullRequest className="w-4 h-4" />
              View Issues
            </button>
            <button
              onClick={() => copyToClipboard(`gh pr list --repo ${GITHUB_USERNAME}/${selectedRepo.name}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              View PRs
            </button>
            <button
              onClick={() => copyToClipboard(`gh repo view ${GITHUB_USERNAME}/${selectedRepo.name} --web`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
            >
              <Eye className="w-4 h-4" />
              Open Web
            </button>
            <button
              onClick={() => copyToClipboard(`cd ~/projects && gh repo clone ${GITHUB_USERNAME}/${selectedRepo.name} && code ${selectedRepo.name}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors"
            >
              <Download className="w-4 h-4" />
              Clone & Open in VS Code
            </button>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          GitHub CLI Setup
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-purple-400 mb-3">Installation</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 font-mono text-sm">
                <span className="text-gray-300">winget install GitHub.cli</span>
                <button
                  onClick={() => copyToClipboard('winget install GitHub.cli')}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  {copiedCmd === 'winget install GitHub.cli' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-cyan-400 mb-3">Authentication</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 font-mono text-sm">
                <span className="text-gray-300">gh auth login</span>
                <button
                  onClick={() => copyToClipboard('gh auth login')}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  {copiedCmd === 'gh auth login' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GitHub;
