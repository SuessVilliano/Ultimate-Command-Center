/**
 * GitHub Portfolio Auto-Sync Service
 *
 * Automatically syncs GitHub repos, analyzes code, and calculates real valuations
 * This replaces static portfolio data with live, growing metrics
 */

const GITHUB_USERNAME = 'SuessVilliano';

// Valuation multipliers based on industry standards
const VALUATION_MULTIPLIERS = {
  // Base value per 1000 lines of code by language
  locValue: {
    'JavaScript': 15,
    'TypeScript': 20,
    'Python': 18,
    'Solidity': 50,
    'Rust': 25,
    'Go': 22,
    'Java': 15,
    'default': 12
  },
  // Multipliers based on tech stack
  techStackBonus: {
    'React': 1.3,
    'Next.js': 1.4,
    'Node.js': 1.2,
    'Express': 1.1,
    'Flutter': 1.35,
    'Firebase': 1.2,
    'Web3': 1.5,
    'Solana': 1.6,
    'Ethereum': 1.5,
    'AI': 1.8,
    'ML': 1.7,
    'OpenAI': 1.6,
    'TailwindCSS': 1.1
  },
  // Status multipliers
  statusMultiplier: {
    'active': 1.5,      // Updated in last 7 days
    'recent': 1.2,      // Updated in last 30 days
    'stable': 1.0,      // Updated in last 90 days
    'archived': 0.5     // Not updated in 90+ days
  },
  // Category premiums
  categoryPremium: {
    'SaaS': 2.0,
    'Fintech': 2.5,
    'AI/ML': 2.2,
    'Trading': 2.3,
    'E-Commerce': 1.5,
    'Mobile': 1.8,
    'Web3': 2.0,
    'API': 1.6,
    'default': 1.0
  }
};

// Known product mappings - repos that map to known products
const PRODUCT_MAPPINGS = {
  'liv8-credit': { name: 'LIV8 Credit', category: 'SaaS', patentable: false },
  'hybrid-journal': { name: 'Hybrid Journal', category: 'SaaS', patentable: false },
  'trade-hybrid-app': { name: 'Trade Hybrid App', category: 'Mobile', patentable: false },
  'mcp-server': { name: 'MCP Server', category: 'AI/ML', patentable: false },
  'broker-aggregator': { name: 'Broker Aggregator', category: 'Fintech', patentable: true },
  'abatev': { name: 'ABATEV', category: 'Fintech', patentable: true },
  'smart-wallet': { name: 'Smart Wallet Suite', category: 'Web3', patentable: false },
  'Ultimate-Command-Center': { name: 'LIV8 Command Center', category: 'SaaS', patentable: false }
};

// Keywords to detect category
const CATEGORY_KEYWORDS = {
  'Fintech': ['trade', 'trading', 'broker', 'finance', 'payment', 'wallet', 'funding'],
  'AI/ML': ['ai', 'ml', 'gpt', 'openai', 'llm', 'agent', 'bot', 'neural'],
  'SaaS': ['dashboard', 'platform', 'portal', 'app', 'saas', 'service'],
  'E-Commerce': ['shop', 'store', 'commerce', 'product', 'cart'],
  'Web3': ['web3', 'solana', 'ethereum', 'blockchain', 'crypto', 'nft', 'defi'],
  'Mobile': ['mobile', 'flutter', 'react-native', 'ios', 'android'],
  'Trading': ['trade', 'signal', 'journal', 'forex', 'futures', 'stock']
};

/**
 * Fetch all repos from GitHub
 */
async function fetchGitHubRepos() {
  let allRepos = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&page=${page}&sort=updated`,
      {
        headers: process.env.GITHUB_TOKEN
          ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }
          : {}
      }
    );

    if (!response.ok) {
      if (response.status === 403) {
        console.warn('GitHub API rate limit - using cached data');
        break;
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

    // Safety limit
    if (page > 10) hasMore = false;
  }

  return allRepos;
}

/**
 * Detect repo status based on activity
 */
function detectStatus(repo) {
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceUpdate < 7) return 'active';
  if (daysSinceUpdate < 30) return 'recent';
  if (daysSinceUpdate < 90) return 'stable';
  return 'archived';
}

/**
 * Detect category from repo data
 */
function detectCategory(repo) {
  // Check known mappings first
  if (PRODUCT_MAPPINGS[repo.name]) {
    return PRODUCT_MAPPINGS[repo.name].category;
  }

  const searchText = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => searchText.includes(kw))) {
      return category;
    }
  }

  return 'default';
}

/**
 * Detect tech stack from repo
 */
function detectTechStack(repo) {
  const tech = [];
  const topics = (repo.topics || []).map(t => t.toLowerCase());
  const desc = (repo.description || '').toLowerCase();
  const name = repo.name.toLowerCase();

  // Language-based
  if (repo.language === 'JavaScript' || repo.language === 'TypeScript') {
    if (topics.includes('react') || desc.includes('react') || name.includes('react')) {
      tech.push('React');
    }
    if (topics.includes('nextjs') || desc.includes('next.js') || name.includes('next')) {
      tech.push('Next.js');
    }
    if (topics.includes('nodejs') || desc.includes('node')) {
      tech.push('Node.js');
    }
    if (topics.includes('express')) {
      tech.push('Express');
    }
  }

  if (repo.language === 'Dart') {
    tech.push('Flutter');
  }

  // Topic-based
  if (topics.includes('tailwindcss') || desc.includes('tailwind')) {
    tech.push('TailwindCSS');
  }
  if (topics.includes('firebase') || desc.includes('firebase')) {
    tech.push('Firebase');
  }
  if (topics.includes('web3') || desc.includes('web3')) {
    tech.push('Web3');
  }
  if (topics.includes('solana') || desc.includes('solana')) {
    tech.push('Solana');
  }
  if (topics.includes('ethereum') || desc.includes('ethereum')) {
    tech.push('Ethereum');
  }
  if (topics.includes('openai') || desc.includes('openai') || desc.includes('gpt')) {
    tech.push('OpenAI');
  }
  if (topics.includes('ai') || desc.includes('ai') || desc.includes('artificial intelligence')) {
    tech.push('AI');
  }

  return tech;
}

/**
 * Calculate estimated Lines of Code from repo size
 * GitHub size is in KB, roughly 40 LOC per KB for source code
 */
function estimateLOC(repo) {
  // Size in KB * ~40 LOC/KB, adjusted for non-code files
  return Math.round(repo.size * 25);
}

/**
 * Calculate repo valuation
 */
function calculateValuation(repo, analysis) {
  const { status, category, techStack, estimatedLOC } = analysis;

  // Base value from LOC
  const locMultiplier = VALUATION_MULTIPLIERS.locValue[repo.language] || VALUATION_MULTIPLIERS.locValue.default;
  let baseValue = (estimatedLOC / 1000) * locMultiplier * 100; // Convert to dollars

  // Apply tech stack bonuses
  let techBonus = 1;
  for (const tech of techStack) {
    if (VALUATION_MULTIPLIERS.techStackBonus[tech]) {
      techBonus *= VALUATION_MULTIPLIERS.techStackBonus[tech];
    }
  }

  // Apply status multiplier
  const statusMult = VALUATION_MULTIPLIERS.statusMultiplier[status] || 1;

  // Apply category premium
  const categoryMult = VALUATION_MULTIPLIERS.categoryPremium[category] || VALUATION_MULTIPLIERS.categoryPremium.default;

  // Stars and forks bonus (social proof)
  const socialBonus = 1 + (repo.stargazers_count * 0.05) + (repo.forks_count * 0.1);

  // Calculate final valuation range
  const conservativeValue = Math.round(baseValue * techBonus * statusMult * 0.7);
  const aggressiveValue = Math.round(baseValue * techBonus * statusMult * categoryMult * socialBonus * 1.5);

  return {
    conservative: Math.max(conservativeValue, 500), // Minimum $500
    aggressive: Math.max(aggressiveValue, 1000)     // Minimum $1000
  };
}

/**
 * Analyze a single repo
 */
function analyzeRepo(repo) {
  const status = detectStatus(repo);
  const category = detectCategory(repo);
  const techStack = detectTechStack(repo);
  const estimatedLOC = estimateLOC(repo);

  const analysis = { status, category, techStack, estimatedLOC };
  const valuation = calculateValuation(repo, analysis);

  // Check if this maps to a known product
  const knownProduct = PRODUCT_MAPPINGS[repo.name];

  return {
    id: repo.name,
    name: knownProduct?.name || formatRepoName(repo.name),
    description: repo.description || 'No description',
    github: `${GITHUB_USERNAME}/${repo.name}`,
    url: repo.html_url,
    language: repo.language || 'Unknown',
    category,
    techStack,
    status,
    stage: getStage(status, repo),
    estimatedLOC,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    isPrivate: repo.private,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    patentable: knownProduct?.patentable || false,
    valueMin: valuation.conservative,
    valueMax: valuation.aggressive,
    priority: calculatePriority(repo, analysis, valuation)
  };
}

/**
 * Format repo name to display name
 */
function formatRepoName(name) {
  return name
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Determine stage from status
 */
function getStage(status, repo) {
  if (status === 'active') return 'In Development';
  if (status === 'recent') return 'Ready to Deploy';
  if (status === 'stable') return 'Production Ready';
  return 'Archived';
}

/**
 * Calculate priority score
 */
function calculatePriority(repo, analysis, valuation) {
  let score = 0;

  // Higher value = higher priority
  score += valuation.aggressive / 10000;

  // Active development
  if (analysis.status === 'active') score += 50;
  else if (analysis.status === 'recent') score += 30;

  // Known products get priority
  if (PRODUCT_MAPPINGS[repo.name]) score += 20;

  // Stars and engagement
  score += repo.stargazers_count * 5;
  score += repo.forks_count * 3;

  // Patentable gets high priority
  if (PRODUCT_MAPPINGS[repo.name]?.patentable) score += 100;

  // Key business names
  const importantNames = ['liv8', 'hybrid', 'trade', 'credit', 'abate', 'funding', 'command'];
  if (importantNames.some(n => repo.name.toLowerCase().includes(n))) {
    score += 25;
  }

  return Math.round(score);
}

/**
 * Main sync function - fetches and analyzes all repos
 */
export async function syncGitHubPortfolio() {
  try {
    console.log('Starting GitHub portfolio sync...');

    const repos = await fetchGitHubRepos();
    console.log(`Fetched ${repos.length} repos from GitHub`);

    const analyzedRepos = repos.map(analyzeRepo);

    // Sort by priority
    analyzedRepos.sort((a, b) => b.priority - a.priority);

    // Calculate totals
    const totals = calculatePortfolioTotals(analyzedRepos);

    const portfolio = {
      lastSync: new Date().toISOString(),
      repoCount: analyzedRepos.length,
      products: analyzedRepos,
      totals,
      stats: generateStats(analyzedRepos)
    };

    console.log(`Portfolio sync complete: ${analyzedRepos.length} products, $${totals.conservative.toLocaleString()} - $${totals.aggressive.toLocaleString()}`);

    return portfolio;
  } catch (error) {
    console.error('GitHub portfolio sync error:', error);
    throw error;
  }
}

/**
 * Calculate portfolio totals
 */
function calculatePortfolioTotals(products) {
  const conservativeTotal = products.reduce((sum, p) => sum + p.valueMin, 0);
  const aggressiveTotal = products.reduce((sum, p) => sum + p.valueMax, 0);
  const totalLOC = products.reduce((sum, p) => sum + p.estimatedLOC, 0);

  return {
    conservative: conservativeTotal,
    aggressive: aggressiveTotal,
    totalLOC,
    avgValue: Math.round(aggressiveTotal / products.length)
  };
}

/**
 * Generate portfolio stats
 */
function generateStats(products) {
  // By status
  const byStatus = {
    active: products.filter(p => p.status === 'active').length,
    recent: products.filter(p => p.status === 'recent').length,
    stable: products.filter(p => p.status === 'stable').length,
    archived: products.filter(p => p.status === 'archived').length
  };

  // By category
  const byCategory = {};
  products.forEach(p => {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  });

  // By language
  const byLanguage = {};
  products.forEach(p => {
    byLanguage[p.language] = (byLanguage[p.language] || 0) + 1;
  });

  // Patentable count
  const patentable = products.filter(p => p.patentable).length;

  // Top products
  const topProducts = products.slice(0, 10).map(p => ({
    name: p.name,
    value: p.valueMax,
    status: p.status
  }));

  return {
    byStatus,
    byCategory,
    byLanguage,
    patentable,
    topProducts,
    totalStars: products.reduce((sum, p) => sum + p.stars, 0),
    totalForks: products.reduce((sum, p) => sum + p.forks, 0)
  };
}

// Cache for portfolio data
let portfolioCache = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get portfolio with caching
 */
export async function getPortfolio(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && portfolioCache && cacheTime && (now - cacheTime) < CACHE_DURATION) {
    return portfolioCache;
  }

  portfolioCache = await syncGitHubPortfolio();
  cacheTime = now;

  return portfolioCache;
}

/**
 * Get quick stats without full sync
 */
export async function getQuickStats() {
  const portfolio = await getPortfolio();

  return {
    repoCount: portfolio.repoCount,
    totalValue: {
      min: portfolio.totals.conservative,
      max: portfolio.totals.aggressive
    },
    activeRepos: portfolio.stats.byStatus.active,
    patentable: portfolio.stats.patentable,
    topProducts: portfolio.stats.topProducts.slice(0, 5),
    lastSync: portfolio.lastSync
  };
}

export default {
  syncGitHubPortfolio,
  getPortfolio,
  getQuickStats
};
