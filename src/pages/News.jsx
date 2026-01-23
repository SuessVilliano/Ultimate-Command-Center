import React, { useState, useEffect } from 'react';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Bitcoin,
  Activity,
  RefreshCw,
  ExternalLink,
  Clock,
  Ticket,
  Brain,
  Bot,
  Calendar,
  Filter,
  Bell,
  ChevronRight,
  Zap,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const AI_SERVER_URL = 'http://localhost:3005';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#030305]">
          <div className="text-center p-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-4">The News page encountered an error.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Market icons
const MarketIcons = {
  BTC: Bitcoin,
  SOL: Activity,
  ETH: DollarSign
};

function News() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // State
  const [activeTab, setActiveTab] = useState('financial');
  const [financialNews, setFinancialNews] = useState([]);
  const [personalUpdates, setPersonalUpdates] = useState([]);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState(['NASDAQ', 'CRYPTO_BTC', 'CRYPTO_SOL']);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Load data on mount
  useEffect(() => {
    fetchAllData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAllData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchFinancialNews(),
        fetchPersonalUpdates(),
        fetchMarketData()
      ]);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialNews = async () => {
    try {
      const response = await fetch(
        `${AI_SERVER_URL}/api/news/financial?topics=${selectedTopics.join(',')}&limit=20`
      );
      if (response.ok) {
        const data = await response.json();
        setFinancialNews(data.news || []);
      }
    } catch (e) {
      console.log('Could not fetch financial news');
      // Use cached
      try {
        const cached = await fetch(`${AI_SERVER_URL}/api/news/financial/cached?limit=20`);
        if (cached.ok) {
          const data = await cached.json();
          setFinancialNews(data.news || []);
        }
      } catch (e2) {}
    }
  };

  const fetchPersonalUpdates = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/news/personal?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setPersonalUpdates(data.updates || []);
      }
    } catch (e) {
      console.log('Could not fetch personal updates');
    }
  };

  const fetchMarketData = async () => {
    try {
      const response = await fetch(`${AI_SERVER_URL}/api/news/market`);
      if (response.ok) {
        const data = await response.json();
        setMarketData(data);
      }
    } catch (e) {
      console.log('Could not fetch market data');
    }
  };

  const formatPrice = (price) => {
    if (!price) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price > 100 ? 0 : 2
    }).format(price);
  };

  const formatChange = (change) => {
    if (!change) return '0.00%';
    const formatted = change.toFixed(2);
    return change >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const getUpdateIcon = (type) => {
    switch (type) {
      case 'ticket': return Ticket;
      case 'schedule': return Clock;
      case 'knowledge': return Brain;
      case 'agent': return Bot;
      default: return Activity;
    }
  };

  const timeAgo = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diff = Math.floor((now - then) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Show loading screen on initial load
  if (loading && financialNews.length === 0 && !marketData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading News & Markets...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && financialNews.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>{error}</p>
          <button
            onClick={fetchAllData}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            News & Updates
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Financial markets, crypto, and your personal command center activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Updated {timeAgo(lastUpdate)}
            </span>
          )}
          <button
            onClick={fetchAllData}
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
        </div>
      </div>

      {/* Market Overview Cards */}
      {marketData?.crypto && (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(marketData.crypto).map(([symbol, data]) => {
            const Icon = MarketIcons[symbol] || DollarSign;
            const isPositive = (data.change24h || 0) >= 0;

            return (
              <div
                key={symbol}
                className={`p-4 rounded-xl border ${
                  isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${
                      symbol === 'BTC' ? 'bg-orange-500/20' :
                      symbol === 'SOL' ? 'bg-purple-500/20' :
                      'bg-blue-500/20'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        symbol === 'BTC' ? 'text-orange-400' :
                        symbol === 'SOL' ? 'text-purple-400' :
                        'text-blue-400'
                      }`} />
                    </div>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {symbol}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    isPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {formatChange(data.change24h)}
                  </div>
                </div>
                <div className={`mt-2 text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatPrice(data.price)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className={`flex gap-2 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'} pb-2`}>
        {[
          { id: 'financial', label: 'Financial News', icon: TrendingUp },
          { id: 'personal', label: 'My Updates', icon: Bell }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
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
      <div className="grid grid-cols-3 gap-6">
        {/* Main News List */}
        <div className={`col-span-2 rounded-xl border ${
          isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
        }`}>
          <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {activeTab === 'financial' ? 'Market News' : 'Activity Feed'}
              </h3>
              {activeTab === 'financial' && (
                <div className="flex items-center gap-2">
                  <Filter className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <select
                    value={selectedTopics.join(',')}
                    onChange={(e) => {
                      setSelectedTopics(e.target.value.split(','));
                      setTimeout(fetchFinancialNews, 100);
                    }}
                    className={`text-sm rounded-lg border px-2 py-1 ${
                      isDark
                        ? 'bg-white/5 border-purple-900/30 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  >
                    <option value="NASDAQ,CRYPTO_BTC,CRYPTO_SOL">All Markets</option>
                    <option value="NASDAQ,FUTURES">Stocks & Futures</option>
                    <option value="CRYPTO_BTC,CRYPTO_SOL">Crypto Only</option>
                    <option value="FOREX">Forex</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-purple-900/10 max-h-[600px] overflow-y-auto">
            {activeTab === 'financial' ? (
              financialNews.length === 0 ? (
                <div className="p-8 text-center">
                  <Newspaper className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    {loading ? 'Loading news...' : 'No financial news available'}
                  </p>
                </div>
              ) : (
                financialNews.map((item, index) => (
                  <a
                    key={item.id || index}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block p-4 transition-colors ${
                      isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            item.category === 'CRYPTO' ? 'bg-orange-500/20 text-orange-400' :
                            item.category === 'MARKET' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {item.category || 'NEWS'}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {item.source}
                          </span>
                        </div>
                        <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {item.title}
                        </h4>
                        {item.description && (
                          <p className={`text-sm mt-1 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {item.description}
                          </p>
                        )}
                        <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {timeAgo(item.publishedAt || item.published_at)}
                        </p>
                      </div>
                      <ExternalLink className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    </div>
                  </a>
                ))
              )
            ) : (
              personalUpdates.length === 0 ? (
                <div className="p-8 text-center">
                  <Activity className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    No recent activity
                  </p>
                </div>
              ) : (
                personalUpdates.map((item, index) => {
                  const Icon = getUpdateIcon(item.type);
                  return (
                    <div
                      key={item.id || index}
                      className={`p-4 transition-colors ${
                        isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          item.type === 'ticket' ? 'bg-red-500/20' :
                          item.type === 'schedule' ? 'bg-cyan-500/20' :
                          item.type === 'knowledge' ? 'bg-purple-500/20' :
                          'bg-blue-500/20'
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            item.type === 'ticket' ? 'text-red-400' :
                            item.type === 'schedule' ? 'text-cyan-400' :
                            item.type === 'knowledge' ? 'text-purple-400' :
                            'text-blue-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {item.title}
                          </h4>
                          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {item.description}
                          </p>
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {timeAgo(item.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className={`p-4 rounded-xl border ${
            isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
          }`}>
            <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => window.location.href = '/tickets'}
                className={`w-full flex items-center justify-between p-3 rounded-lg ${
                  isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-red-400" />
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>View Tickets</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className={`w-full flex items-center justify-between p-3 rounded-lg ${
                  isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>Dashboard</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Trading Watchlist */}
          <div className={`p-4 rounded-xl border ${
            isDark ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className={`font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                Day Trading Focus
              </h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className={`flex justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <span>NQ Futures</span>
                <span className="text-cyan-400">NASDAQ</span>
              </div>
              <div className={`flex justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <span>EUR/USD</span>
                <span className="text-cyan-400">Forex</span>
              </div>
              <div className={`flex justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <span>SOL/USD</span>
                <span className="text-purple-400">Crypto</span>
              </div>
              <div className={`flex justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <span>BTC/USD</span>
                <span className="text-orange-400">Crypto</span>
              </div>
            </div>
          </div>

          {/* Data Sources */}
          <div className={`p-4 rounded-xl border ${
            isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
          }`}>
            <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Data Sources
            </h3>
            <ul className={`text-xs space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <li>Coinranking (Crypto stats)</li>
              <li>Binance (Real-time prices)</li>
              <li>Benzinga (Market news)</li>
              <li>TradingView (Market movers)</li>
              <li>Real-Time News (Headlines)</li>
              <li>Alpha Vantage (Stock quotes)</li>
            </ul>
            {marketData?.source && (
              <p className={`text-xs mt-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                Source: {marketData.source === 'rapidapi' ? 'RapidAPI (Premium)' : 'CoinGecko (Free)'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap with Error Boundary
function NewsWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <News />
    </ErrorBoundary>
  );
}

export default NewsWithErrorBoundary;
