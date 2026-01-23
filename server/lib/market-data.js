/**
 * Market Data Service
 * Aggregates data from multiple financial APIs
 *
 * APIs used:
 * - Benzinga (News)
 * - RapidAPI: Coinranking, Binance, Real-time News, Alpha Vantage, Trading View, CNBC
 */

// Read API keys at runtime to ensure dotenv is loaded
const getKeys = () => ({
  rapidApi: process.env.RAPIDAPI_KEY,
  benzinga: process.env.BENZINGA_API_KEY
});

// Cache for market data
let marketCache = {
  crypto: null,
  stocks: null,
  news: null,
  movers: null,
  lastUpdate: null
};
const CACHE_DURATION = 60 * 1000; // 1 minute

/**
 * Make RapidAPI request
 */
async function rapidApiRequest(host, path) {
  const { rapidApi } = getKeys();
  if (!rapidApi) {
    throw new Error('RAPIDAPI_KEY not configured');
  }

  const response = await fetch(`https://${host}${path}`, {
    headers: {
      'x-rapidapi-key': rapidApi,
      'x-rapidapi-host': host
    }
  });

  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get crypto stats from Coinranking
 */
async function getCryptoStats() {
  try {
    const data = await rapidApiRequest(
      'coinranking1.p.rapidapi.com',
      '/stats?referenceCurrencyUuid=yhjMzLPhuIDl'
    );
    return data;
  } catch (e) {
    console.error('Coinranking error:', e.message);
    return null;
  }
}

/**
 * Get top coins from Coinranking
 */
async function getTopCoins(limit = 10) {
  try {
    const data = await rapidApiRequest(
      'coinranking1.p.rapidapi.com',
      `/coins?limit=${limit}&referenceCurrencyUuid=yhjMzLPhuIDl`
    );
    return data?.data?.coins || [];
  } catch (e) {
    console.error('Coinranking coins error:', e.message);
    return [];
  }
}

/**
 * Get Binance 24hr ticker data
 */
async function getBinanceTickers(symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']) {
  try {
    const data = await rapidApiRequest(
      'binance43.p.rapidapi.com',
      '/ticker/24hr'
    );

    if (!Array.isArray(data)) return [];

    // Filter to requested symbols
    return data.filter(t => symbols.includes(t.symbol));
  } catch (e) {
    console.error('Binance error:', e.message);
    return [];
  }
}

/**
 * Get stock data from Alpha Vantage
 */
async function getStockQuote(symbol) {
  try {
    const data = await rapidApiRequest(
      'alpha-vantage.p.rapidapi.com',
      `/query?function=GLOBAL_QUOTE&symbol=${symbol}`
    );
    return data['Global Quote'] || null;
  } catch (e) {
    console.error('Alpha Vantage error:', e.message);
    return null;
  }
}

/**
 * Get market movers from Trading View
 */
async function getMarketMovers(exchange = 'US', type = 'volume_gainers') {
  try {
    const data = await rapidApiRequest(
      'trading-view.p.rapidapi.com',
      `/market/get-movers?exchange=${exchange}&name=${type}&locale=en`
    );
    return data;
  } catch (e) {
    console.error('Trading View error:', e.message);
    return null;
  }
}

/**
 * Get real-time news
 */
async function getRealTimeNews(query = 'stock market', limit = 20) {
  try {
    const data = await rapidApiRequest(
      'real-time-news-data.p.rapidapi.com',
      `/search?query=${encodeURIComponent(query)}&limit=${limit}&time_published=anytime&country=US&lang=en`
    );
    return data?.data || [];
  } catch (e) {
    console.error('Real-time news error:', e.message);
    return [];
  }
}

/**
 * Get Benzinga news
 */
async function getBenzingaNews(tickers = 'AAPL,TSLA,MSFT', limit = 20) {
  const { benzinga } = getKeys();
  if (!benzinga) {
    return [];
  }

  try {
    const response = await fetch(
      `https://api.benzinga.com/api/v2/news?token=${benzinga}&tickers=${tickers}&pageSize=${limit}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Benzinga error: ${response.status}`);
    }

    const data = await response.json();
    return data || [];
  } catch (e) {
    console.error('Benzinga error:', e.message);
    return [];
  }
}

/**
 * Get CNBC symbol info
 */
async function getCNBCSymbol(symbol) {
  try {
    const data = await rapidApiRequest(
      'cnbc.p.rapidapi.com',
      `/symbols/translate?symbol=${symbol}`
    );
    return data;
  } catch (e) {
    console.error('CNBC error:', e.message);
    return null;
  }
}

/**
 * Get BB Finance stock statistics
 */
async function getBBFinanceStats(symbol) {
  try {
    const data = await rapidApiRequest(
      'bb-finance.p.rapidapi.com',
      `/stock/get-statistics?id=${symbol.toLowerCase()}%3Aus&template=STOCK`
    );
    return data;
  } catch (e) {
    console.error('BB Finance error:', e.message);
    return null;
  }
}

/**
 * Fetch coin data from CoinGecko (free fallback)
 */
async function fetchCoinGecko(coinId) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
    );
    if (response.ok) {
      return response.json();
    }
  } catch (e) {
    console.error('CoinGecko error:', e.message);
  }
  return null;
}

/**
 * Aggregate market data for dashboard
 */
async function getMarketOverview() {
  const now = Date.now();

  // Return cache if fresh
  if (marketCache.lastUpdate && (now - marketCache.lastUpdate) < CACHE_DURATION) {
    return {
      crypto: marketCache.crypto,
      stocks: marketCache.stocks,
      movers: marketCache.movers,
      cached: true,
      lastUpdate: marketCache.lastUpdate
    };
  }

  // Fetch all data in parallel
  const [cryptoStats, topCoins, binanceTickers, movers, solanaPrice] = await Promise.all([
    getCryptoStats(),
    getTopCoins(10), // Get top 10 to have a better chance of including SOL
    getBinanceTickers(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']),
    getMarketMovers('US', 'volume_gainers'),
    // Fallback: fetch SOL from CoinGecko if not in top coins
    fetchCoinGecko('solana')
  ]);

  // Process crypto data
  const cryptoData = {};

  // From Coinranking
  if (topCoins.length > 0) {
    topCoins.forEach(coin => {
      cryptoData[coin.symbol] = {
        name: coin.name,
        price: parseFloat(coin.price),
        change24h: parseFloat(coin.change),
        marketCap: parseFloat(coin.marketCap),
        volume24h: parseFloat(coin['24hVolume']),
        iconUrl: coin.iconUrl
      };
    });
  }

  // Override with Binance data if available (more accurate)
  if (binanceTickers.length > 0) {
    binanceTickers.forEach(ticker => {
      const symbol = ticker.symbol.replace('USDT', '');
      if (cryptoData[symbol]) {
        cryptoData[symbol].price = parseFloat(ticker.lastPrice);
        cryptoData[symbol].change24h = parseFloat(ticker.priceChangePercent);
        cryptoData[symbol].volume24h = parseFloat(ticker.quoteVolume);
        cryptoData[symbol].high24h = parseFloat(ticker.highPrice);
        cryptoData[symbol].low24h = parseFloat(ticker.lowPrice);
      } else {
        cryptoData[symbol] = {
          name: symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.priceChangePercent),
          volume24h: parseFloat(ticker.quoteVolume),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice)
        };
      }
    });
  }

  // Add SOL from CoinGecko if not already present
  if (!cryptoData['SOL'] && solanaPrice?.solana) {
    cryptoData['SOL'] = {
      name: 'Solana',
      price: solanaPrice.solana.usd || 0,
      change24h: solanaPrice.solana.usd_24h_change || 0
    };
  }

  // Update cache
  marketCache = {
    crypto: cryptoData,
    stocks: null, // Stocks require specific symbols
    movers: movers,
    lastUpdate: now
  };

  return {
    crypto: cryptoData,
    stats: cryptoStats?.data || null,
    movers: movers,
    cached: false,
    lastUpdate: now
  };
}

/**
 * Get aggregated financial news
 */
async function getFinancialNews(topics = 'NASDAQ,CRYPTO_BTC', limit = 20) {
  const queries = [];

  if (topics.includes('NASDAQ') || topics.includes('MARKET')) {
    queries.push(getRealTimeNews('NASDAQ stock market', Math.floor(limit / 2)));
  }
  if (topics.includes('CRYPTO')) {
    queries.push(getRealTimeNews('bitcoin cryptocurrency', Math.floor(limit / 2)));
  }
  if (topics.includes('FOREX')) {
    queries.push(getRealTimeNews('forex currency trading', Math.floor(limit / 2)));
  }
  if (topics.includes('FUTURES')) {
    queries.push(getRealTimeNews('futures trading', Math.floor(limit / 2)));
  }

  // Also get Benzinga news
  const { benzinga } = getKeys();
  if (benzinga) {
    queries.push(getBenzingaNews('AAPL,TSLA,MSFT,NVDA,SPY', limit));
  }

  // Default query if none specified
  if (queries.length === 0) {
    queries.push(getRealTimeNews('stock market finance', limit));
  }

  const results = await Promise.all(queries);

  // Combine and format news
  let allNews = [];

  results.forEach((result, idx) => {
    if (Array.isArray(result)) {
      result.forEach(item => {
        // Handle different API response formats
        if (item.title && item.link) {
          // Real-time news format
          allNews.push({
            id: item.link,
            title: item.title,
            description: item.snippet || '',
            url: item.link,
            source: item.source_name || item.source || 'News',
            publishedAt: item.date || new Date().toISOString(),
            category: topics.includes('CRYPTO') ? 'CRYPTO' : 'MARKET',
            image: item.photo_url || null
          });
        } else if (item.title && item.url) {
          // Benzinga format
          allNews.push({
            id: item.id || item.url,
            title: item.title,
            description: item.teaser || item.body?.substring(0, 200) || '',
            url: item.url,
            source: 'Benzinga',
            publishedAt: item.created || new Date().toISOString(),
            category: 'MARKET',
            image: item.image?.[0]?.url || null
          });
        }
      });
    }
  });

  // Sort by date, newest first
  allNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // Remove duplicates by title
  const seen = new Set();
  allNews = allNews.filter(item => {
    const key = item.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return allNews.slice(0, limit);
}

export const marketData = {
  // Core functions
  getCryptoStats,
  getTopCoins,
  getBinanceTickers,
  getStockQuote,
  getMarketMovers,
  getRealTimeNews,
  getBenzingaNews,
  getCNBCSymbol,
  getBBFinanceStats,

  // Aggregated functions
  getMarketOverview,
  getFinancialNews,

  // Check if configured
  isConfigured() {
    const { rapidApi } = getKeys();
    return !!rapidApi;
  },

  // Get status
  getStatus() {
    const { rapidApi, benzinga } = getKeys();
    return {
      rapidApi: !!rapidApi,
      benzinga: !!benzinga,
      cacheAge: marketCache.lastUpdate ? Date.now() - marketCache.lastUpdate : null
    };
  }
};

export default marketData;
