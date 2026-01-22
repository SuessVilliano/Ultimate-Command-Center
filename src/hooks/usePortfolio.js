/**
 * Portfolio Hook - Provides live GitHub portfolio data
 */

import { useState, useEffect, useCallback } from 'react';
import * as portfolioService from '../services/portfolioService';

// Static data that doesn't come from GitHub
import { businesses, aiAgents, domains } from '../data/portfolio';

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const fetchPortfolio = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const data = await portfolioService.getPortfolio(forceRefresh);
      setPortfolio(data);
      setLastSync(data.lastSync);
    } catch (err) {
      console.error('Portfolio fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      const result = await portfolioService.syncPortfolio();
      await fetchPortfolio(true);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolio]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // Combine live and static data
  const combinedData = {
    // Live from GitHub
    softwareProducts: portfolio?.products || [],
    repoCount: portfolio?.repoCount || 0,
    totalLOC: portfolio?.totals?.totalLOC || 0,

    // Static data
    businesses,
    aiAgents,
    domains,

    // Valuations - live from GitHub
    valuationSummary: portfolio ? {
      conservative: {
        software: { min: Math.round(portfolio.totals.conservative * 0.5), max: Math.round(portfolio.totals.conservative * 0.6) },
        trading: { min: 60000, max: 120000 },
        agents: { min: 50000, max: 100000 },
        brand: { min: 25000, max: 50000 },
        total: {
          min: Math.round(portfolio.totals.conservative * 0.5) + 135000,
          max: Math.round(portfolio.totals.conservative * 0.6) + 270000
        }
      },
      aggressive: {
        software: { min: Math.round(portfolio.totals.aggressive * 0.4), max: Math.round(portfolio.totals.aggressive * 0.6) },
        trading: { min: 100000, max: 200000 },
        agents: { min: 100000, max: 250000 },
        brand: { min: 50000, max: 100000 },
        total: {
          min: Math.round(portfolio.totals.aggressive * 0.4) + 250000,
          max: Math.round(portfolio.totals.aggressive * 0.6) + 550000
        }
      }
    } : null,

    // Stats
    stats: portfolio?.stats || null
  };

  return {
    ...combinedData,
    loading,
    error,
    lastSync,
    refresh: () => fetchPortfolio(true),
    sync: syncPortfolio,
    raw: portfolio
  };
}

export function useQuickStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portfolioService.getQuickStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

export default usePortfolio;
