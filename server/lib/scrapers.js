/**
 * LIV8 Command Center - Scraper Integrations
 * Provides web scraping capabilities via RapidAPI and Apify
 */

import { getSetting, setSetting } from './database.js';

// API Keys
let rapidApiKey = null;
let apifyApiKey = null;

/**
 * Initialize scraper integrations
 */
export function initScrapers(config = {}) {
  // Try to load from database
  let persistedRapidKey = null;
  let persistedApifyKey = null;

  try {
    persistedRapidKey = getSetting('rapidapi_key', null);
    persistedApifyKey = getSetting('apify_api_key', null);
  } catch (e) {
    // Database might not be ready
  }

  rapidApiKey = config.rapidApiKey || persistedRapidKey || process.env.RAPIDAPI_KEY;
  apifyApiKey = config.apifyApiKey || persistedApifyKey || process.env.APIFY_API_KEY;

  console.log(`Scrapers initialized: RapidAPI: ${!!rapidApiKey}, Apify: ${!!apifyApiKey}`);

  return {
    rapidApi: !!rapidApiKey,
    apify: !!apifyApiKey
  };
}

/**
 * Update API key
 */
export function updateScraperKey(provider, apiKey) {
  if (provider === 'rapidapi') {
    rapidApiKey = apiKey;
    try {
      setSetting('rapidapi_key', apiKey);
    } catch (e) {
      console.log('Could not persist RapidAPI key');
    }
    console.log('RapidAPI key updated');
    return true;
  }

  if (provider === 'apify') {
    apifyApiKey = apiKey;
    try {
      setSetting('apify_api_key', apiKey);
    } catch (e) {
      console.log('Could not persist Apify key');
    }
    console.log('Apify API key updated');
    return true;
  }

  return false;
}

/**
 * Get scraper status
 */
export function getScraperStatus() {
  return {
    rapidApi: {
      configured: !!rapidApiKey,
      key: rapidApiKey ? `${rapidApiKey.substring(0, 8)}...` : null
    },
    apify: {
      configured: !!apifyApiKey,
      key: apifyApiKey ? `${apifyApiKey.substring(0, 12)}...` : null
    }
  };
}

// ============================================
// RAPIDAPI SCRAPING FUNCTIONS
// ============================================

/**
 * Scrape a webpage using RapidAPI Web Scraper
 */
export async function rapidApiScrape(url, options = {}) {
  if (!rapidApiKey) {
    throw new Error('RapidAPI key not configured');
  }

  try {
    const response = await fetch('https://scrapeninja.p.rapidapi.com/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'scrapeninja.p.rapidapi.com'
      },
      body: JSON.stringify({
        url,
        method: options.method || 'GET',
        retryNum: options.retries || 1,
        geo: options.geo || 'us',
        js: options.js !== false, // Enable JS rendering by default
        ...options.extra
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`RapidAPI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      body: data.body,
      status: data.info?.statusCode,
      headers: data.info?.headers,
      url: data.info?.url
    };
  } catch (error) {
    console.error('RapidAPI scrape error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Google Search via RapidAPI
 */
export async function rapidApiGoogleSearch(query, options = {}) {
  if (!rapidApiKey) {
    throw new Error('RapidAPI key not configured');
  }

  try {
    const params = new URLSearchParams({
      query,
      limit: String(options.limit || 10),
      related_keywords: options.relatedKeywords || 'true'
    });

    const response = await fetch(`https://google-search74.p.rapidapi.com/?${params}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'google-search74.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`RapidAPI Google Search error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      results: data.results || [],
      relatedKeywords: data.related_keywords || []
    };
  } catch (error) {
    console.error('RapidAPI Google Search error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * LinkedIn Profile Scraper via RapidAPI
 */
export async function rapidApiLinkedInProfile(profileUrl, options = {}) {
  if (!rapidApiKey) {
    throw new Error('RapidAPI key not configured');
  }

  try {
    const response = await fetch('https://linkedin-data-api.p.rapidapi.com/get-profile-data-by-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'linkedin-data-api.p.rapidapi.com'
      },
      body: JSON.stringify({
        url: profileUrl
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`RapidAPI LinkedIn error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      success: true,
      profile: data
    };
  } catch (error) {
    console.error('RapidAPI LinkedIn error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// APIFY SCRAPING FUNCTIONS
// ============================================

/**
 * Run an Apify actor
 */
export async function apifyRunActor(actorId, input = {}, options = {}) {
  if (!apifyApiKey) {
    throw new Error('Apify API key not configured');
  }

  try {
    // Start the actor run
    const startResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      }
    );

    if (!startResponse.ok) {
      const error = await startResponse.text();
      throw new Error(`Apify start error: ${startResponse.status} - ${error}`);
    }

    const runData = await startResponse.json();
    const runId = runData.data.id;

    // If waitForFinish is true, poll until done
    if (options.waitForFinish !== false) {
      const maxWait = options.maxWaitSeconds || 120;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait * 1000) {
        const statusResponse = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyApiKey}`
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const status = statusData.data.status;

          if (status === 'SUCCEEDED') {
            // Get the dataset results
            const datasetId = statusData.data.defaultDatasetId;
            const resultsResponse = await fetch(
              `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyApiKey}`
            );

            if (resultsResponse.ok) {
              const results = await resultsResponse.json();
              return {
                success: true,
                runId,
                status: 'SUCCEEDED',
                results
              };
            }
          } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
            return {
              success: false,
              runId,
              status,
              error: `Actor run ${status}`
            };
          }
        }

        // Wait 2 seconds before next poll
        await new Promise(r => setTimeout(r, 2000));
      }

      return {
        success: false,
        runId,
        status: 'TIMEOUT',
        error: 'Polling timeout exceeded'
      };
    }

    return {
      success: true,
      runId,
      status: 'RUNNING',
      message: 'Actor started, check status later'
    };
  } catch (error) {
    console.error('Apify run error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Web Scraper using Apify
 */
export async function apifyWebScraper(urls, options = {}) {
  const input = {
    startUrls: Array.isArray(urls) ? urls.map(u => ({ url: u })) : [{ url: urls }],
    keepUrlFragments: false,
    maxCrawlingDepth: options.depth || 0,
    maxPagesPerCrawl: options.maxPages || 10,
    pageFunction: options.pageFunction || `
      async function pageFunction(context) {
        const { page, request } = context;
        const title = await page.title();
        const content = await page.$eval('body', el => el.innerText.substring(0, 10000));
        return {
          url: request.url,
          title,
          content
        };
      }
    `,
    proxyConfiguration: {
      useApifyProxy: true
    }
  };

  return await apifyRunActor('apify/web-scraper', input, options);
}

/**
 * Google Search Results Scraper using Apify
 */
export async function apifyGoogleSearch(queries, options = {}) {
  const input = {
    queries: Array.isArray(queries) ? queries : [queries],
    resultsPerPage: options.resultsPerPage || 10,
    maxPagesPerQuery: options.maxPages || 1,
    mobileResults: false,
    languageCode: options.language || 'en',
    countryCode: options.country || 'us'
  };

  return await apifyRunActor('apify/google-search-scraper', input, options);
}

/**
 * Instagram Profile Scraper using Apify
 */
export async function apifyInstagramProfile(usernames, options = {}) {
  const input = {
    usernames: Array.isArray(usernames) ? usernames : [usernames],
    resultsLimit: options.limit || 30
  };

  return await apifyRunActor('apify/instagram-profile-scraper', input, options);
}

/**
 * Twitter/X Scraper using Apify
 */
export async function apifyTwitterScraper(searchTerms, options = {}) {
  const input = {
    searchTerms: Array.isArray(searchTerms) ? searchTerms : [searchTerms],
    maxTweets: options.maxTweets || 100,
    mode: options.mode || 'own'
  };

  return await apifyRunActor('quacker/twitter-scraper', input, options);
}

/**
 * YouTube Video Scraper using Apify
 */
export async function apifyYouTubeScraper(urls, options = {}) {
  const input = {
    startUrls: Array.isArray(urls) ? urls.map(u => ({ url: u })) : [{ url: urls }],
    maxResults: options.maxResults || 50,
    ...options.extra
  };

  return await apifyRunActor('bernardo/youtube-scraper', input, options);
}

/**
 * Get status of an Apify run
 */
export async function apifyGetRunStatus(runId) {
  if (!apifyApiKey) {
    throw new Error('Apify API key not configured');
  }

  try {
    const response = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyApiKey}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get run status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      runId,
      status: data.data.status,
      startedAt: data.data.startedAt,
      finishedAt: data.data.finishedAt,
      datasetId: data.data.defaultDatasetId
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get results from an Apify dataset
 */
export async function apifyGetDatasetItems(datasetId, options = {}) {
  if (!apifyApiKey) {
    throw new Error('Apify API key not configured');
  }

  try {
    const params = new URLSearchParams({
      token: apifyApiKey,
      limit: String(options.limit || 100),
      offset: String(options.offset || 0)
    });

    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?${params}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get dataset items: ${response.status}`);
    }

    const items = await response.json();
    return {
      success: true,
      items
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  initScrapers,
  updateScraperKey,
  getScraperStatus,
  // RapidAPI
  rapidApiScrape,
  rapidApiGoogleSearch,
  rapidApiLinkedInProfile,
  // Apify
  apifyRunActor,
  apifyWebScraper,
  apifyGoogleSearch,
  apifyInstagramProfile,
  apifyTwitterScraper,
  apifyYouTubeScraper,
  apifyGetRunStatus,
  apifyGetDatasetItems
};
