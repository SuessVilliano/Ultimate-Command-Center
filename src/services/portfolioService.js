/**
 * Portfolio Service - Fetches live portfolio data from GitHub
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

// Cache for portfolio data
let portfolioCache = null;
let cacheTime = null;
const CACHE_DURATION = 60 * 1000; // 1 minute client-side cache

/**
 * Get full portfolio with all products
 */
export async function getPortfolio(forceRefresh = false) {
  const now = Date.now();

  // Return cache if valid
  if (!forceRefresh && portfolioCache && cacheTime && (now - cacheTime) < CACHE_DURATION) {
    return portfolioCache;
  }

  try {
    const response = await fetch(`${API_URL}/api/portfolio${forceRefresh ? '?refresh=true' : ''}`);
    if (!response.ok) throw new Error('Portfolio fetch failed');

    portfolioCache = await response.json();
    cacheTime = now;

    return portfolioCache;
  } catch (error) {
    console.error('Portfolio service error:', error);
    // Return cache if available, even if stale
    if (portfolioCache) return portfolioCache;
    throw error;
  }
}

/**
 * Get quick stats for dashboard
 */
export async function getQuickStats() {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/stats`);
    if (!response.ok) throw new Error('Stats fetch failed');
    return await response.json();
  } catch (error) {
    console.error('Quick stats error:', error);
    throw error;
  }
}

/**
 * Force sync portfolio from GitHub
 */
export async function syncPortfolio() {
  try {
    const response = await fetch(`${API_URL}/api/portfolio/sync`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Sync failed');

    // Clear cache to force refresh
    portfolioCache = null;
    cacheTime = null;

    return await response.json();
  } catch (error) {
    console.error('Portfolio sync error:', error);
    throw error;
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(value) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}

/**
 * Get valuation summary in the same format as the old portfolio.js
 * This provides backwards compatibility with existing components
 */
export async function getValuationSummary() {
  const portfolio = await getPortfolio();

  return {
    conservative: {
      software: { min: Math.round(portfolio.totals.conservative * 0.4), max: Math.round(portfolio.totals.conservative * 0.5) },
      trading: { min: Math.round(portfolio.totals.conservative * 0.15), max: Math.round(portfolio.totals.conservative * 0.2) },
      agents: { min: Math.round(portfolio.totals.conservative * 0.12), max: Math.round(portfolio.totals.conservative * 0.15) },
      brand: { min: Math.round(portfolio.totals.conservative * 0.06), max: Math.round(portfolio.totals.conservative * 0.08) },
      total: { min: Math.round(portfolio.totals.conservative * 0.8), max: portfolio.totals.conservative }
    },
    aggressive: {
      software: { min: Math.round(portfolio.totals.aggressive * 0.35), max: Math.round(portfolio.totals.aggressive * 0.45) },
      trading: { min: Math.round(portfolio.totals.aggressive * 0.12), max: Math.round(portfolio.totals.aggressive * 0.18) },
      agents: { min: Math.round(portfolio.totals.aggressive * 0.12), max: Math.round(portfolio.totals.aggressive * 0.2) },
      brand: { min: Math.round(portfolio.totals.aggressive * 0.05), max: Math.round(portfolio.totals.aggressive * 0.1) },
      total: { min: Math.round(portfolio.totals.aggressive * 0.8), max: portfolio.totals.aggressive }
    }
  };
}

/**
 * Get software products in legacy format
 */
export async function getSoftwareProducts() {
  const portfolio = await getPortfolio();
  return portfolio.products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    tech: p.techStack,
    status: p.status === 'active' ? 'development' : p.status === 'recent' ? 'complete' : 'stable',
    stage: p.stage,
    description: p.description,
    features: p.estimatedLOC ? Math.round(p.estimatedLOC / 100) : 0,
    valueMin: p.valueMin,
    valueMax: p.valueMax,
    github: p.github,
    patentable: p.patentable,
    priority: p.priority > 50 ? 'high' : p.priority > 20 ? 'medium' : 'low'
  }));
}

export default {
  getPortfolio,
  getQuickStats,
  syncPortfolio,
  formatCurrency,
  getValuationSummary,
  getSoftwareProducts
};
