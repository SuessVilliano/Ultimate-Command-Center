/**
 * Scraper API Routes
 * Provides REST endpoints for RapidAPI and Apify scraping
 */

import * as scrapers from '../lib/scrapers.js';

export function registerScraperRoutes(app) {
  // ============================================
  // SCRAPER STATUS & CONFIGURATION
  // ============================================

  // Get scraper status
  app.get('/api/scrapers/status', (req, res) => {
    try {
      const status = scrapers.getScraperStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update API key
  app.post('/api/scrapers/key', (req, res) => {
    try {
      const { provider, apiKey } = req.body;
      if (!provider || !apiKey) {
        return res.status(400).json({ error: 'Provider and apiKey required' });
      }

      const success = scrapers.updateScraperKey(provider, apiKey);
      if (success) {
        res.json({ success: true, message: `${provider} key updated` });
      } else {
        res.status(400).json({ error: 'Invalid provider' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // RAPIDAPI ENDPOINTS
  // ============================================

  // Basic webpage scrape
  app.post('/api/scrapers/rapidapi/scrape', async (req, res) => {
    try {
      const { url, options } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL required' });
      }

      const result = await scrapers.rapidApiScrape(url, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google search
  app.post('/api/scrapers/rapidapi/google', async (req, res) => {
    try {
      const { query, options } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'Query required' });
      }

      const result = await scrapers.rapidApiGoogleSearch(query, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // LinkedIn profile
  app.post('/api/scrapers/rapidapi/linkedin', async (req, res) => {
    try {
      const { profileUrl, options } = req.body;
      if (!profileUrl) {
        return res.status(400).json({ error: 'Profile URL required' });
      }

      const result = await scrapers.rapidApiLinkedInProfile(profileUrl, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // APIFY ENDPOINTS
  // ============================================

  // Run any Apify actor
  app.post('/api/scrapers/apify/run', async (req, res) => {
    try {
      const { actorId, input, options } = req.body;
      if (!actorId) {
        return res.status(400).json({ error: 'Actor ID required' });
      }

      const result = await scrapers.apifyRunActor(actorId, input || {}, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Web scraper
  app.post('/api/scrapers/apify/web', async (req, res) => {
    try {
      const { urls, options } = req.body;
      if (!urls) {
        return res.status(400).json({ error: 'URLs required' });
      }

      const result = await scrapers.apifyWebScraper(urls, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google search
  app.post('/api/scrapers/apify/google', async (req, res) => {
    try {
      const { queries, options } = req.body;
      if (!queries) {
        return res.status(400).json({ error: 'Queries required' });
      }

      const result = await scrapers.apifyGoogleSearch(queries, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Instagram profile
  app.post('/api/scrapers/apify/instagram', async (req, res) => {
    try {
      const { usernames, options } = req.body;
      if (!usernames) {
        return res.status(400).json({ error: 'Usernames required' });
      }

      const result = await scrapers.apifyInstagramProfile(usernames, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Twitter/X scraper
  app.post('/api/scrapers/apify/twitter', async (req, res) => {
    try {
      const { searchTerms, options } = req.body;
      if (!searchTerms) {
        return res.status(400).json({ error: 'Search terms required' });
      }

      const result = await scrapers.apifyTwitterScraper(searchTerms, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // YouTube scraper
  app.post('/api/scrapers/apify/youtube', async (req, res) => {
    try {
      const { urls, options } = req.body;
      if (!urls) {
        return res.status(400).json({ error: 'URLs required' });
      }

      const result = await scrapers.apifyYouTubeScraper(urls, options || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get run status
  app.get('/api/scrapers/apify/run/:runId', async (req, res) => {
    try {
      const { runId } = req.params;
      const result = await scrapers.apifyGetRunStatus(runId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get dataset items
  app.get('/api/scrapers/apify/dataset/:datasetId', async (req, res) => {
    try {
      const { datasetId } = req.params;
      const { limit, offset } = req.query;
      const result = await scrapers.apifyGetDatasetItems(datasetId, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('Scraper routes registered');
}

export default registerScraperRoutes;
