import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Activity, RefreshCw, ExternalLink,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Clock, AlertCircle,
  Zap, Target, Eye, ChevronRight, Filter, Search, Star, BookOpen,
  Layers, Globe, Bitcoin
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config';

function Trading() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [marketOverview, setMarketOverview] = useState(null);
  const [cryptoData, setCryptoData] = useState({});
  const [stockQuotes, setStockQuotes] = useState({});
  const [marketNews, setMarketNews] = useState([]);
  const [movers, setMovers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [watchlist] = useState(['BTC', 'ETH', 'SOL', 'NVDA', 'TSLA', 'SPY']);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Fetch all market data
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        fetch(`${API_URL}/api/market/overview`).then(r => r.ok ? r.json() : Promise.reject('Market overview failed')),
        fetch(`${API_URL}/api/news/financial?topics=NASDAQ,CRYPTO_BTC&limit=15`).then(r => r.ok ? r.json() : Promise.reject('News failed')),
      ]);

      const [overviewResult, newsResult] = results;

      if (overviewResult.status === 'fulfilled') {
        const overview = overviewResult.value;
        setMarketOverview(overview);
        if (overview.crypto) setCryptoData(overview.crypto);
        if (overview.movers) setMovers(overview.movers);
      }

      if (newsResult.status === 'fulfilled') {
        setMarketNews(newsResult.value.news || []);
      }

      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to load market data. Check server connection.');
      console.error('Trading data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 60 * 1000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Search for a specific stock symbol
  const searchStock = async () => {
    if (!searchSymbol.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const response = await fetch(`${API_URL}/api/market/stock/${searchSymbol.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResult(data);
      } else {
        setSearchResult({ error: 'Symbol not found or API unavailable' });
      }
    } catch {
      setSearchResult({ error: 'Failed to fetch stock data' });
    } finally {
      setSearchLoading(false);
    }
  };

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: price > 100 ? 0 : 2
    }).format(price);
  };

  const formatChange = (change) => {
    if (change === null || change === undefined || isNaN(change)) return '0.00%';
    const formatted = Number(change).toFixed(2);
    return change >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const formatVolume = (vol) => {
    if (!vol || isNaN(vol)) return '-';
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatMarketCap = (cap) => {
    if (!cap || isNaN(cap)) return '-';
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
    return `$${cap.toFixed(0)}`;
  };

  const timeAgo = (date) => {
    if (!date) return '';
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Crypto icons and colors
  const cryptoMeta = {
    BTC: { name: 'Bitcoin', color: 'orange', icon: Bitcoin },
    ETH: { name: 'Ethereum', color: 'blue', icon: Layers },
    SOL: { name: 'Solana', color: 'purple', icon: Zap },
    BNB: { name: 'BNB', color: 'yellow', icon: Globe },
  };

  const isInitialLoad = loading && !marketOverview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Trading & Markets
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Live market data, crypto prices, stock quotes, and trading tools
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className={`text-xs flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              <Clock className="w-3 h-3" />
              {timeAgo(lastUpdate)}
            </span>
          )}
          <button
            onClick={fetchAllData}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {isInitialLoad && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mr-3" />
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading live market data...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-red-900/20 border border-red-900/30' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className={isDark ? 'text-red-400' : 'text-red-600'}>{error}</span>
            <button onClick={fetchAllData} className="ml-auto text-sm underline">Retry</button>
          </div>
        </div>
      )}

      {!isInitialLoad && (
        <>
          {/* Crypto Ticker Strip */}
          {Object.keys(cryptoData).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['BTC', 'ETH', 'SOL', 'BNB'].map(symbol => {
                const data = cryptoData[symbol];
                if (!data) return null;
                const meta = cryptoMeta[symbol] || { name: symbol, color: 'gray', icon: DollarSign };
                const Icon = meta.icon;
                const isPositive = (data.change24h || 0) >= 0;
                const colorClasses = {
                  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
                  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
                  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
                  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
                  gray: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
                };
                const c = colorClasses[meta.color];

                return (
                  <div key={symbol} className={`p-4 rounded-xl border ${
                    isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${c.bg}`}>
                          <Icon className={`w-4 h-4 ${c.text}`} />
                        </div>
                        <div>
                          <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{symbol}</span>
                          <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{meta.name}</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {formatChange(data.change24h)}
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatPrice(data.price)}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Vol: {formatVolume(data.volume24h)}
                      </span>
                      {data.marketCap && (
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          MC: {formatMarketCap(data.marketCap)}
                        </span>
                      )}
                    </div>
                    {data.high24h && data.low24h && (
                      <div className="mt-2">
                        <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <span>L: {formatPrice(data.low24h)}</span>
                          <span>H: {formatPrice(data.high24h)}</span>
                        </div>
                        <div className={`h-1.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                            style={{
                              width: data.high24h !== data.low24h
                                ? `${((data.price - data.low24h) / (data.high24h - data.low24h)) * 100}%`
                                : '50%'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              }).filter(Boolean)}
            </div>
          )}

          {/* Tabs */}
          <div className={`flex gap-2 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'} pb-2`}>
            {[
              { id: 'overview', label: 'Market Overview', icon: BarChart3 },
              { id: 'watchlist', label: 'Watchlist', icon: Star },
              { id: 'news', label: 'Market News', icon: Activity },
              { id: 'journal', label: 'Trade Journal', icon: BookOpen },
              { id: 'search', label: 'Symbol Lookup', icon: Search },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
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

          {/* Tab Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content Area */}
            <div className="lg:col-span-2">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* All Crypto */}
                  <div className={`rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
                    <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Crypto Markets</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            <th className="text-left p-3">Asset</th>
                            <th className="text-right p-3">Price</th>
                            <th className="text-right p-3">24h Change</th>
                            <th className="text-right p-3">Volume</th>
                            <th className="text-right p-3">Market Cap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(cryptoData).map(([symbol, data]) => {
                            const isPositive = (data.change24h || 0) >= 0;
                            return (
                              <tr key={symbol} className={`border-t ${isDark ? 'border-purple-900/10 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'}`}>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{symbol}</span>
                                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{data.name}</span>
                                  </div>
                                </td>
                                <td className={`p-3 text-right font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {formatPrice(data.price)}
                                </td>
                                <td className={`p-3 text-right text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatChange(data.change24h)}
                                </td>
                                <td className={`p-3 text-right text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {formatVolume(data.volume24h)}
                                </td>
                                <td className={`p-3 text-right text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {formatMarketCap(data.marketCap)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {Object.keys(cryptoData).length === 0 && (
                      <div className="p-8 text-center">
                        <Activity className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                        <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                          No crypto data available. Check RapidAPI key configuration.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Market Movers */}
                  {movers && (
                    <div className={`rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
                      <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Market Movers (Volume Gainers)</h3>
                      </div>
                      <div className="p-4">
                        {movers.data?.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                            {(movers.data || []).slice(0, 8).map((item, i) => (
                              <div key={i} className={`p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                                <div className="flex items-center justify-between">
                                  <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {item.d?.[0] || item.symbol || item.name || `#${i + 1}`}
                                  </span>
                                  <span className={`text-xs font-medium ${
                                    (item.d?.[2] || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    {item.d?.[2] !== undefined ? formatChange(item.d[2]) : '-'}
                                  </span>
                                </div>
                                {item.d?.[1] && (
                                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {formatPrice(item.d[1])}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Market movers data unavailable. Requires TradingView API access.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'watchlist' && (
                <div className={`rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Watchlist</h3>
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {watchlist.length} symbols
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-purple-900/10">
                    {watchlist.map(symbol => {
                      const data = cryptoData[symbol];
                      const isPositive = data ? (data.change24h || 0) >= 0 : true;
                      return (
                        <div key={symbol} className={`p-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                data ? 'bg-purple-500/20' : isDark ? 'bg-white/10' : 'bg-gray-100'
                              }`}>
                                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{symbol.slice(0, 2)}</span>
                              </div>
                              <div>
                                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{symbol}</span>
                                <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {data?.name || (cryptoMeta[symbol]?.name || symbol)}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              {data ? (
                                <>
                                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {formatPrice(data.price)}
                                  </span>
                                  <span className={`block text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatChange(data.change24h)}
                                  </span>
                                </>
                              ) : (
                                <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  No data (stock)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'news' && (
                <div className={`rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <div className={`p-4 border-b ${isDark ? 'border-purple-900/30' : 'border-gray-200'}`}>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Market News</h3>
                  </div>
                  <div className="divide-y divide-purple-900/10 max-h-[600px] overflow-y-auto">
                    {marketNews.length > 0 ? marketNews.map((item, idx) => (
                      <a
                        key={item.id || idx}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block p-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                item.category === 'CRYPTO' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>{item.category || 'MARKET'}</span>
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.source}</span>
                            </div>
                            <h4 className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h4>
                            {item.description && (
                              <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.description}</p>
                            )}
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {timeAgo(item.publishedAt)}
                            </p>
                          </div>
                          <ExternalLink className={`w-4 h-4 flex-shrink-0 mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                        </div>
                      </a>
                    )) : (
                      <div className="p-8 text-center">
                        <Activity className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                        <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No market news available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'journal' && (
                <div className={`rounded-xl border ${
                  isDark ? 'border-cyan-500/30 bg-gradient-to-br from-cyan-900/20 to-purple-900/20' : 'border-cyan-200 bg-gradient-to-br from-cyan-50 to-purple-50'
                }`}>
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-white" />
                    </div>
                    <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Hybrid Trade Journal
                    </h2>
                    <p className={`mb-6 max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Track trades, analyze performance metrics, and improve your strategy with the Hybrid Trading Journal.
                    </p>
                    <div className="flex items-center justify-center gap-4">
                      <a
                        href="https://hybridjournal.co"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-medium hover:opacity-90 shadow-lg"
                      >
                        <ExternalLink className="w-5 h-5" />
                        Open Trade Journal
                      </a>
                      <a
                        href="https://hybridjournal.co/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium ${
                          isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <BarChart3 className="w-5 h-5" />
                        Analytics
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'search' && (
                <div className={`rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
                  <div className="p-6">
                    <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Symbol Lookup</h3>
                    <div className="flex gap-3 mb-6">
                      <input
                        type="text"
                        value={searchSymbol}
                        onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && searchStock()}
                        placeholder="Enter symbol (e.g., AAPL, TSLA, NVDA)"
                        className={`flex-1 px-4 py-2.5 rounded-lg border text-sm ${
                          isDark ? 'bg-white/5 border-purple-900/30 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                        }`}
                      />
                      <button
                        onClick={searchStock}
                        disabled={searchLoading || !searchSymbol.trim()}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 text-sm font-medium"
                      >
                        {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Search
                      </button>
                    </div>
                    {searchResult && (
                      searchResult.error ? (
                        <div className={`p-4 rounded-lg ${isDark ? 'bg-red-900/20 border border-red-900/30' : 'bg-red-50 border border-red-200'}`}>
                          <p className={isDark ? 'text-red-400' : 'text-red-600'}>{searchResult.error}</p>
                        </div>
                      ) : (
                        <div className={`p-4 rounded-lg ${isDark ? 'bg-white/5 border border-purple-900/30' : 'bg-gray-50 border border-gray-200'}`}>
                          <pre className={`text-sm overflow-x-auto ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {JSON.stringify(searchResult, null, 2)}
                          </pre>
                        </div>
                      )
                    )}
                    <div className="mt-4">
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Data provided by Alpha Vantage, CNBC, and BB Finance via RapidAPI.
                        Configure your RAPIDAPI_KEY in environment variables for live data.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              {/* Day Trading Focus */}
              <div className={`p-4 rounded-xl border ${
                isDark ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <h3 className={`font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                    Day Trading Focus
                  </h3>
                </div>
                <div className="space-y-3">
                  {[
                    { symbol: 'NQ', name: 'NASDAQ Futures', market: 'Futures' },
                    { symbol: 'ES', name: 'S&P 500 Futures', market: 'Futures' },
                    { symbol: 'EUR/USD', name: 'Euro/Dollar', market: 'Forex' },
                    { symbol: 'SOL/USD', name: 'Solana', market: 'Crypto' },
                    { symbol: 'BTC/USD', name: 'Bitcoin', market: 'Crypto' },
                  ].map(item => (
                    <div key={item.symbol} className={`flex justify-between items-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <div>
                        <span className="text-sm font-medium">{item.symbol}</span>
                        <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.name}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.market === 'Crypto' ? 'bg-purple-500/20 text-purple-400' :
                        item.market === 'Forex' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>{item.market}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div className={`p-4 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
                <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Trading Tools</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Hybrid Journal', url: 'https://hybridjournal.co', icon: BookOpen },
                    { label: 'Hybrid Funding', url: 'https://hybridfunding.co', icon: DollarSign },
                    { label: 'Trade Hybrid', url: 'https://tradehybrid.co', icon: TrendingUp },
                    { label: 'TradingView', url: 'https://tradingview.com', icon: BarChart3 },
                  ].map(link => {
                    const Icon = link.icon;
                    return (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isDark ? 'hover:bg-white/10' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{link.label}</span>
                        </div>
                        <ExternalLink className={`w-3 h-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Data Sources Status */}
              <div className={`p-4 rounded-xl border ${isDark ? 'border-purple-900/30 bg-white/5' : 'border-gray-200 bg-white'}`}>
                <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Live Data Sources</h3>
                <ul className={`text-xs space-y-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Coinranking (Crypto)</li>
                  <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Binance (Real-time prices)</li>
                  <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> CoinGecko (Fallback)</li>
                  <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Alpha Vantage (Stocks)</li>
                  <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> TradingView (Movers)</li>
                  <li className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Benzinga (News)</li>
                </ul>
                {marketOverview?.cached && (
                  <p className={`text-xs mt-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    Showing cached data (1 min refresh)
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Trading;
