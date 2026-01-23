/**
 * LIV8 Command Center - News Service
 * Provides financial news (NASDAQ, Forex, Crypto) and personal updates
 *
 * Uses:
 * - RapidAPI (Coinranking, Binance, Real-time News, Alpha Vantage, Trading View)
 * - Benzinga
 * - CoinGecko (fallback)
 */

import * as db from './database.js';
import { marketData } from './market-data.js';

// News cache
let newsCache = {
  financial: [],
  personal: [],
  lastFetch: null
};

// Financial news sources and topics
const FINANCIAL_TOPICS = {
  NASDAQ: ['nasdaq', 'stock market', 'sp500', 's&p 500', 'dow jones', 'equities'],
  FOREX: ['forex', 'eur/usd', 'gbp/usd', 'usd/jpy', 'currency', 'fx market'],
  CRYPTO_SOL: ['solana', 'sol', 'solana price', 'solana news'],
  CRYPTO_BTC: ['bitcoin', 'btc', 'bitcoin price', 'btc news'],
  FUTURES: ['futures', 'nq futures', 'es futures', 'nasdaq futures', 'emini'],
  MARKETS: ['market news', 'trading', 'financial markets', 'wall street']
};

/**
 * Fetch financial news from free APIs
 * Enhanced with RapidAPI and Benzinga sources via marketData module
 */
export async function fetchFinancialNews(options = {}) {
  const {
    topics = ['NASDAQ', 'CRYPTO_BTC', 'CRYPTO_SOL'],
    limit = 20
  } = options;

  const allNews = [];

  try {
    // Try RapidAPI sources first (if configured)
    if (marketData.isConfigured()) {
      try {
        const topicsStr = topics.join(',');
        const rapidNews = await marketData.getFinancialNews(topicsStr, limit);
        allNews.push(...rapidNews);
      } catch (e) {
        console.log('RapidAPI news fetch failed, falling back to free APIs:', e.message);
      }
    }

    // If no news from RapidAPI or not configured, use free sources
    if (allNews.length < 5) {
      // 1. CoinGecko for crypto news (free, no API key needed)
      if (topics.includes('CRYPTO_BTC') || topics.includes('CRYPTO_SOL')) {
        const cryptoNews = await fetchCryptoNews();
        allNews.push(...cryptoNews);
      }

      // 2. Alpha Vantage News (free tier available)
      const alphaNews = await fetchAlphaVantageNews(topics);
      allNews.push(...alphaNews);

      // 3. Finnhub (free tier)
      const finnhubNews = await fetchFinnhubNews(topics);
      allNews.push(...finnhubNews);
    }

    // Sort by date and deduplicate
    const uniqueNews = deduplicateNews(allNews);
    const sortedNews = uniqueNews
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, limit);

    newsCache.financial = sortedNews;
    newsCache.lastFetch = new Date();

    // Store in database
    storeNewsInDb(sortedNews, 'financial');

    return sortedNews;

  } catch (error) {
    console.error('Error fetching financial news:', error.message);
    return newsCache.financial;
  }
}

/**
 * Fetch crypto news from CoinGecko
 */
async function fetchCryptoNews() {
  try {
    // CoinGecko status/updates (free, no API key)
    const response = await fetch('https://api.coingecko.com/api/v3/status_updates?per_page=10');

    if (response.ok) {
      const data = await response.json();
      return (data.status_updates || []).map(item => ({
        id: `coingecko-${item.created_at}`,
        title: item.project?.name ? `${item.project.name}: ${item.description?.substring(0, 100)}` : item.description?.substring(0, 100),
        description: item.description,
        source: 'CoinGecko',
        category: 'CRYPTO',
        publishedAt: item.created_at,
        url: item.project?.links?.homepage?.[0] || 'https://coingecko.com'
      }));
    }
  } catch (e) {
    console.log('CoinGecko fetch failed:', e.message);
  }
  return [];
}

/**
 * Fetch news from Alpha Vantage (requires API key)
 */
async function fetchAlphaVantageNews(topics) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  try {
    // Map topics to tickers
    const tickers = [];
    if (topics.includes('NASDAQ')) tickers.push('QQQ', 'AAPL');
    if (topics.includes('CRYPTO_BTC')) tickers.push('CRYPTO:BTC');
    if (topics.includes('CRYPTO_SOL')) tickers.push('CRYPTO:SOL');

    const tickerStr = tickers.join(',');
    const response = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${tickerStr}&apikey=${apiKey}`
    );

    if (response.ok) {
      const data = await response.json();
      return (data.feed || []).slice(0, 10).map(item => ({
        id: `av-${item.time_published}`,
        title: item.title,
        description: item.summary,
        source: item.source,
        category: 'MARKET',
        publishedAt: formatAlphaVantageDate(item.time_published),
        url: item.url,
        sentiment: item.overall_sentiment_label
      }));
    }
  } catch (e) {
    console.log('Alpha Vantage fetch failed:', e.message);
  }
  return [];
}

/**
 * Fetch news from Finnhub (requires API key)
 */
async function fetchFinnhubNews(topics) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`
    );

    if (response.ok) {
      const data = await response.json();
      return (data || []).slice(0, 10).map(item => ({
        id: `finnhub-${item.id}`,
        title: item.headline,
        description: item.summary,
        source: item.source,
        category: 'MARKET',
        publishedAt: new Date(item.datetime * 1000).toISOString(),
        url: item.url,
        image: item.image
      }));
    }
  } catch (e) {
    console.log('Finnhub fetch failed:', e.message);
  }
  return [];
}

/**
 * Format Alpha Vantage date
 */
function formatAlphaVantageDate(dateStr) {
  // Format: 20240115T120000
  if (!dateStr || dateStr.length < 15) return new Date().toISOString();
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(9, 11);
  const min = dateStr.substring(11, 13);
  return new Date(`${year}-${month}-${day}T${hour}:${min}:00Z`).toISOString();
}

/**
 * Deduplicate news by title similarity
 */
function deduplicateNews(news) {
  const seen = new Set();
  return news.filter(item => {
    const key = item.title?.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Store news in database
 */
function storeNewsInDb(news, type) {
  try {
    const dbInstance = db.getDb();

    // Create news table if not exists
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS news_items (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        source TEXT,
        category TEXT,
        type TEXT,
        published_at TEXT,
        url TEXT,
        image TEXT,
        sentiment TEXT,
        fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const upsertStmt = dbInstance.prepare(`
      INSERT INTO news_items (id, title, description, source, category, type, published_at, url, image, sentiment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        fetched_at = CURRENT_TIMESTAMP
    `);

    for (const item of news) {
      upsertStmt.run(
        item.id,
        item.title,
        item.description,
        item.source,
        item.category,
        type,
        item.publishedAt,
        item.url,
        item.image || null,
        item.sentiment || null
      );
    }
  } catch (e) {
    console.error('Failed to store news:', e.message);
  }
}

/**
 * Get personal news/updates from tickets, projects, etc.
 */
export function getPersonalUpdates(options = {}) {
  const { limit = 20 } = options;

  try {
    const dbInstance = db.getDb();
    const updates = [];

    // 1. Recent ticket activities
    try {
      const ticketStmt = dbInstance.prepare(`
        SELECT 'ticket' as type, freshdesk_id as id, subject as title,
               'Ticket updated' as description, updated_at as date, status
        FROM tickets
        ORDER BY updated_at DESC
        LIMIT 10
      `);
      const tickets = ticketStmt.all();
      updates.push(...tickets.map(t => ({
        id: `ticket-${t.id}`,
        type: 'ticket',
        title: t.title,
        description: `Status: ${getStatusLabel(t.status)}`,
        date: t.date,
        icon: 'ticket'
      })));
    } catch (e) {}

    // 2. Recent scheduled runs
    try {
      const runsStmt = dbInstance.prepare(`
        SELECT 'schedule' as type, id, schedule_name as title,
               summary as description, started_at as date, status
        FROM scheduled_runs
        ORDER BY started_at DESC
        LIMIT 5
      `);
      const runs = runsStmt.all();
      updates.push(...runs.map(r => ({
        id: `run-${r.id}`,
        type: 'schedule',
        title: `Scheduled Run: ${r.title}`,
        description: r.description || r.status,
        date: r.date,
        icon: 'clock'
      })));
    } catch (e) {}

    // 3. Knowledge base additions
    try {
      const kbStmt = dbInstance.prepare(`
        SELECT 'knowledge' as type, ticket_id as id, subject as title,
               category as description, indexed_at as date
        FROM knowledge_base
        ORDER BY indexed_at DESC
        LIMIT 5
      `);
      const kb = kbStmt.all();
      updates.push(...kb.map(k => ({
        id: `kb-${k.id}`,
        type: 'knowledge',
        title: `Learned: ${k.title?.substring(0, 50)}`,
        description: `Category: ${k.description}`,
        date: k.date,
        icon: 'brain'
      })));
    } catch (e) {}

    // 4. Agent interactions
    try {
      const agentStmt = dbInstance.prepare(`
        SELECT 'agent' as type, id, agent_id as title,
               interaction_type as description, created_at as date
        FROM agent_interactions
        ORDER BY created_at DESC
        LIMIT 5
      `);
      const agents = agentStmt.all();
      updates.push(...agents.map(a => ({
        id: `agent-${a.id}`,
        type: 'agent',
        title: `Agent: ${a.title}`,
        description: a.description,
        date: a.date,
        icon: 'bot'
      })));
    } catch (e) {}

    // Sort by date and limit
    return updates
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);

  } catch (error) {
    console.error('Error getting personal updates:', error.message);
    return [];
  }
}

/**
 * Get status label from code
 */
function getStatusLabel(status) {
  const labels = {
    2: 'Open',
    3: 'Pending',
    4: 'Resolved',
    5: 'Closed',
    6: 'Waiting on Customer',
    7: 'On Hold'
  };
  return labels[status] || 'Unknown';
}

/**
 * Get cached financial news
 */
export function getCachedFinancialNews(options = {}) {
  const { limit = 20, category = null } = options;

  try {
    const dbInstance = db.getDb();
    let query = `SELECT * FROM news_items WHERE type = 'financial'`;
    if (category) {
      query += ` AND category = '${category}'`;
    }
    query += ` ORDER BY published_at DESC LIMIT ${limit}`;

    const stmt = dbInstance.prepare(query);
    return stmt.all();
  } catch (e) {
    return newsCache.financial.slice(0, limit);
  }
}

/**
 * Get market summary (prices for watched assets)
 * Enhanced with RapidAPI sources (Coinranking, Binance) via marketData module
 */
export async function getMarketSummary() {
  try {
    // Try RapidAPI sources first (if configured) - more comprehensive data
    if (marketData.isConfigured()) {
      try {
        const overview = await marketData.getMarketOverview();
        if (overview && overview.crypto && Object.keys(overview.crypto).length > 0) {
          return {
            crypto: overview.crypto,
            stats: overview.stats || null,
            movers: overview.movers || null,
            lastUpdate: new Date().toISOString(),
            source: 'rapidapi',
            cached: overview.cached || false
          };
        }
      } catch (e) {
        console.log('RapidAPI market data failed, falling back to CoinGecko:', e.message);
      }
    }

    // Fallback to CoinGecko (free)
    const cryptoResponse = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana,ethereum&vs_currencies=usd&include_24hr_change=true'
    );

    let crypto = {};
    if (cryptoResponse.ok) {
      crypto = await cryptoResponse.json();
    }

    return {
      crypto: {
        BTC: {
          name: 'Bitcoin',
          price: crypto.bitcoin?.usd || 0,
          change24h: crypto.bitcoin?.usd_24h_change || 0
        },
        SOL: {
          name: 'Solana',
          price: crypto.solana?.usd || 0,
          change24h: crypto.solana?.usd_24h_change || 0
        },
        ETH: {
          name: 'Ethereum',
          price: crypto.ethereum?.usd || 0,
          change24h: crypto.ethereum?.usd_24h_change || 0
        }
      },
      lastUpdate: new Date().toISOString(),
      source: 'coingecko'
    };
  } catch (error) {
    console.error('Market summary error:', error.message);
    return { crypto: {}, lastUpdate: null, error: error.message };
  }
}

/**
 * Create a news summary for notifications
 */
export async function createNewsSummary(news) {
  const topStories = news.slice(0, 5).map(n => `- ${n.title}`).join('\n');

  return {
    count: news.length,
    topStories,
    categories: [...new Set(news.map(n => n.category))],
    generatedAt: new Date().toISOString()
  };
}

export default {
  fetchFinancialNews,
  getPersonalUpdates,
  getCachedFinancialNews,
  getMarketSummary,
  createNewsSummary,
  FINANCIAL_TOPICS
};
