/**
 * LIV8 Command Center - Scheduler Module
 * Handles automated ticket polling, analysis, and daily report generation
 * Default schedule: 8 AM, 12 PM, 4 PM, 12 AM EST
 * Daily Report: 6 AM EST
 */

import cron from 'node-cron';
import * as db from './database.js';
import * as ai from './ai-provider.js';
import * as dailyReport from './daily-report.js';
import * as emailService from './email-service.js';

// Active scheduled jobs
const scheduledJobs = new Map();

// Configuration
let freshdeskConfig = {
  domain: null,
  apiKey: null,
  agentId: null
};

let notificationConfig = {
  n8nWebhookUrl: null,
  taskmagicToken: null
};

/**
 * Initialize scheduler with configuration
 */
export function initScheduler(config = {}) {
  freshdeskConfig = {
    domain: config.freshdeskDomain || process.env.FRESHDESK_DOMAIN,
    apiKey: config.freshdeskApiKey || process.env.FRESHDESK_API_KEY,
    agentId: config.freshdeskAgentId || process.env.FRESHDESK_AGENT_ID
  };

  notificationConfig = {
    n8nWebhookUrl: config.n8nWebhookUrl || process.env.N8N_WEBHOOK_URL,
    taskmagicToken: config.taskmagicToken || process.env.TASKMAGIC_MCP_TOKEN
  };

  console.log('Scheduler initialized with Freshdesk config:', {
    domain: freshdeskConfig.domain,
    agentId: freshdeskConfig.agentId,
    hasApiKey: !!freshdeskConfig.apiKey
  });

  return freshdeskConfig;
}

/**
 * Fetch tickets from Freshdesk API (with pagination)
 */
async function fetchFreshdeskTickets(statuses = [2, 3, 6, 7]) {
  if (!freshdeskConfig.domain || !freshdeskConfig.apiKey) {
    throw new Error('Freshdesk not configured');
  }

  const allTickets = [];
  const baseUrl = `https://${freshdeskConfig.domain}.freshdesk.com/api/v2`;
  const auth = Buffer.from(`${freshdeskConfig.apiKey}:X`).toString('base64');

  for (const status of statuses) {
    let page = 1;
    const maxPages = 5; // Safety limit

    while (page <= maxPages) {
      try {
        let query = `"status:${status}"`;
        if (freshdeskConfig.agentId) {
          query = `"agent_id:${freshdeskConfig.agentId} AND status:${status}"`;
        }

        const url = `${baseUrl}/search/tickets?query=${encodeURIComponent(query)}&page=${page}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`Failed to fetch tickets with status ${status} page ${page}:`, response.status);
          break;
        }

        const data = await response.json();
        const results = data.results || [];
        allTickets.push(...results);

        // If less than 30 results, we've reached the last page
        if (results.length < 30) break;
        page++;
      } catch (error) {
        console.error(`Error fetching status ${status} page ${page}:`, error.message);
        break;
      }
    }
  }

  // Remove duplicates by ticket ID
  const seen = new Set();
  return allTickets.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/**
 * Send notification via n8n webhook
 */
async function sendN8nNotification(data) {
  if (!notificationConfig.n8nWebhookUrl) {
    console.log('n8n webhook not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(notificationConfig.n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'scheduled_analysis',
        timestamp: new Date().toISOString(),
        ...data
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send n8n notification:', error.message);
    return false;
  }
}

/**
 * Run a scheduled ticket analysis
 */
export async function runScheduledAnalysis(scheduleName = 'manual') {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Starting scheduled analysis: ${scheduleName}`);
  console.log(`Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`);
  console.log('='.repeat(50));

  // Start run logging
  let runId;
  try {
    runId = db.startScheduledRun('ticket_analysis', scheduleName);
  } catch (e) {
    console.log('Database logging not available');
  }

  const stats = {
    status: 'completed',
    ticketsFetched: 0,
    ticketsAnalyzed: 0,
    notificationsSent: 0,
    errorMessage: null,
    summary: ''
  };

  try {
    // 1. Fetch tickets from Freshdesk (include resolved for knowledge base)
    console.log('\n1. Fetching tickets from Freshdesk...');
    const tickets = await fetchFreshdeskTickets([2, 3, 6, 7, 4]); // Open, Pending, Waiting on Customer, Waiting on 3rd Party, Resolved
    stats.ticketsFetched = tickets.length;
    console.log(`   Fetched ${tickets.length} tickets`);

    if (tickets.length === 0) {
      stats.summary = 'No active tickets found';
      console.log('   No tickets to process');

      if (runId) {
        db.completeScheduledRun(runId, stats);
      }

      return stats;
    }

    // 2. Store tickets in database
    console.log('\n2. Storing tickets in database...');
    try {
      db.upsertTickets(tickets);
      console.log(`   Stored ${tickets.length} tickets`);
    } catch (e) {
      console.log('   Database storage skipped:', e.message);
    }

    // 3. Analyze each ticket
    console.log('\n3. Analyzing tickets with AI...');
    const analyses = [];
    const newTickets = [];
    const urgentTickets = [];

    for (const ticket of tickets) {
      try {
        // Check if already analyzed recently (within last 6 hours)
        let existingAnalysis;
        try {
          existingAnalysis = db.getLatestAnalysis(ticket.id);
        } catch (e) {}

        if (existingAnalysis) {
          const analyzedAt = new Date(existingAnalysis.analyzed_at);
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

          if (analyzedAt > sixHoursAgo) {
            console.log(`   Ticket #${ticket.id}: Using cached analysis`);
            analyses.push({ ticketId: ticket.id, ...existingAnalysis, cached: true });
            continue;
          }
        }

        // Analyze with AI (use cheapest available provider for bulk operations)
        const costProvider = ai.getCostEffectiveProvider();
        console.log(`   Analyzing ticket #${ticket.id}: ${ticket.subject.substring(0, 50)}... [${costProvider.provider}]`);
        const analysis = await ai.analyzeTicket(ticket, {
          provider: costProvider.provider,
          model: costProvider.model
        });

        // Store analysis
        try {
          db.saveAnalysis(ticket.id, analysis, analysis.provider, analysis.model);
        } catch (e) {}

        analyses.push({ ticketId: ticket.id, ...analysis });
        stats.ticketsAnalyzed++;

        // Track new and urgent tickets
        if (!existingAnalysis) {
          newTickets.push({ ticket, analysis });
        }
        if (analysis.URGENCY_SCORE >= 8) {
          urgentTickets.push({ ticket, analysis });
        }

        // Rate limiting - wait 500ms between API calls
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`   Error analyzing ticket #${ticket.id}:`, error.message);
      }
    }

    // 4. Generate proactive analysis summary
    console.log('\n4. Generating proactive summary...');
    let proactiveSummary;
    try {
      proactiveSummary = await ai.proactiveAnalysis(tickets);
      console.log(`   Summary: ${proactiveSummary.summary}`);
    } catch (e) {
      console.log('   Proactive analysis skipped:', e.message);
      proactiveSummary = { summary: `Analyzed ${stats.ticketsAnalyzed} tickets` };
    }

    // 5. Send notifications if configured
    if (notificationConfig.n8nWebhookUrl) {
      console.log('\n5. Sending notifications...');

      // Send summary notification
      const notificationSent = await sendN8nNotification({
        scheduleName,
        totalTickets: tickets.length,
        newTickets: newTickets.length,
        urgentTickets: urgentTickets.length,
        summary: proactiveSummary.summary,
        urgentItems: proactiveSummary.urgentItems || [],
        recommendations: (proactiveSummary.recommendations || []).slice(0, 5),
        tickets: tickets.map(t => ({
          id: t.id,
          subject: t.subject,
          priority: t.priority,
          status: t.status
        }))
      });

      if (notificationSent) {
        stats.notificationsSent++;
        console.log('   Notification sent successfully');
      }
    } else {
      console.log('\n5. Notifications skipped (n8n webhook not configured)');
    }

    // 6. Index resolved tickets to knowledge base
    console.log('\n6. Indexing resolved tickets to knowledge base...');
    try {
      const resolvedTickets = tickets.filter(t => t.status === 4 || t.status === 5);
      for (const ticket of resolvedTickets) {
        const keywords = extractKeywords(`${ticket.subject} ${ticket.description_text || ''}`);
        db.addToKnowledgeBase(ticket, '', keywords);
      }
      console.log(`   Indexed ${resolvedTickets.length} resolved tickets`);
    } catch (e) {
      console.log('   Knowledge base indexing skipped:', e.message);
    }

    // Build summary
    stats.summary = `${scheduleName}: ${tickets.length} tickets fetched, ${stats.ticketsAnalyzed} analyzed, ${urgentTickets.length} urgent`;

    console.log(`\nCompleted: ${stats.summary}`);
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    stats.status = 'error';
    stats.errorMessage = error.message;
    stats.summary = `Error: ${error.message}`;
    console.error('Scheduled analysis failed:', error);
  }

  // Complete run logging
  if (runId) {
    try {
      db.completeScheduledRun(runId, stats);
    } catch (e) {}
  }

  return stats;
}

/**
 * Extract keywords from text (same logic as server.js)
 */
function extractKeywords(text) {
  if (!text) return [];

  const importantTerms = [
    'port', 'porting', 'loa', 'number', 'phone', 'twilio', 'lc phone',
    'workflow', 'automation', 'trigger', 'action', 'email', 'smtp',
    'calendar', 'appointment', 'booking', 'funnel', 'landing page',
    'sms', 'text', 'message', 'campaign', 'broadcast', 'pipeline',
    'opportunity', 'contact', 'lead', 'tag', 'custom field',
    'integration', 'api', 'webhook', 'zapier', 'stripe', 'payment',
    'invoice', 'subscription', 'billing', 'cancel', 'refund',
    'login', 'password', 'access', '2fa', 'mfa', 'authentication',
    'whitelabel', 'white label', 'domain', 'dns', 'ssl', 'cname',
    'cnam', 'caller id', 'call tracking', 'missed call',
    'error', 'bug', 'issue', 'not working', 'broken', 'failed'
  ];

  const lowerText = text.toLowerCase();
  const foundTerms = importantTerms.filter(term => lowerText.includes(term));

  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'would', 'could', 'there', 'their', 'will', 'when', 'who', 'make', 'like', 'time', 'just', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'this', 'that', 'with', 'from', 'they', 'what', 'about', 'which', 'get', 'help', 'please', 'thanks', 'thank', 'hello', 'here']);

  const words = lowerText.match(/\b[a-z]{3,}\b/g) || [];
  const significantWords = words
    .filter(w => w.length > 3 && !stopWords.has(w))
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

  const topWords = Object.entries(significantWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return [...new Set([...foundTerms, ...topWords])];
}

/**
 * Generate and send daily report
 */
export async function generateAndSendDailyReport(recipientEmail = null) {
  console.log('\n📊 Starting daily report generation...');

  try {
    // Generate the PDF report
    const { filepath, filename, reportData } = await dailyReport.generatePDFReport();
    console.log(`PDF report generated: ${filename}`);

    // Send the daily report email (includes urgent tickets in the full report)
    let emailSent = false;
    let emailRecipient = null;
    if (emailService.isEmailEnabled()) {
      const emailResult = await emailService.sendDailyReport(filepath, reportData, recipientEmail);
      console.log(`Daily report email sent to ${emailResult.recipient}`);
      emailSent = true;
      emailRecipient = emailResult.recipient;
    } else {
      console.log('Email not configured - report generated but not sent via email');
    }

    // Always send to Telegram PA for planning
    let telegramSent = false;
    try {
      const telegramResult = await dailyReport.sendReportToTelegram(reportData);
      if (telegramResult.success) {
        console.log('Daily report sent to Personal Assistant via Telegram');
        telegramSent = true;
      }
    } catch (e) {
      console.log('Could not send to Telegram PA:', e.message);
    }

    // Cleanup old reports (keep last 30)
    const deleted = dailyReport.cleanupOldReports(30);
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old report(s)`);
    }

    return {
      success: true,
      filepath,
      filename,
      emailSent,
      telegramSent,
      recipient: emailRecipient,
      summary: reportData.summary
    };
  } catch (error) {
    console.error('Failed to generate/send daily report:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Schedule all automated jobs
 */
export function startScheduledJobs(enabled = true) {
  if (!enabled) {
    console.log('Scheduled jobs disabled');
    return;
  }

  const timezone = process.env.SCHEDULE_TIMEZONE || 'America/New_York';

  // Clear any existing jobs
  stopScheduledJobs();

  // Initialize email service
  emailService.initEmailService();

  // 6 AM EST - Daily Report Generation & Email
  const dailyReportCron = process.env.SCHEDULE_DAILY_REPORT || '0 6 * * *';
  const dailyReportJob = cron.schedule(dailyReportCron, () => {
    generateAndSendDailyReport();
  }, { timezone });
  scheduledJobs.set('daily_report', dailyReportJob);
  console.log(`Scheduled: Daily Report at 6 AM EST (${dailyReportCron})`);

  // 8 AM EST - Morning brief
  const morningCron = process.env.SCHEDULE_MORNING || '0 8 * * *';
  const morningJob = cron.schedule(morningCron, () => {
    runScheduledAnalysis('morning_8am');
  }, { timezone });
  scheduledJobs.set('morning', morningJob);
  console.log(`Scheduled: Morning analysis at 8 AM EST (${morningCron})`);

  // 12 PM EST - Noon check
  const noonCron = process.env.SCHEDULE_NOON || '0 12 * * *';
  const noonJob = cron.schedule(noonCron, () => {
    runScheduledAnalysis('noon_12pm');
  }, { timezone });
  scheduledJobs.set('noon', noonJob);
  console.log(`Scheduled: Noon analysis at 12 PM EST (${noonCron})`);

  // 4 PM EST - Afternoon review
  const afternoonCron = process.env.SCHEDULE_AFTERNOON || '0 16 * * *';
  const afternoonJob = cron.schedule(afternoonCron, () => {
    runScheduledAnalysis('afternoon_4pm');
  }, { timezone });
  scheduledJobs.set('afternoon', afternoonJob);
  console.log(`Scheduled: Afternoon analysis at 4 PM EST (${afternoonCron})`);

  // 12 AM EST - Midnight overnight prep
  const midnightCron = process.env.SCHEDULE_MIDNIGHT || '0 0 * * *';
  const midnightJob = cron.schedule(midnightCron, () => {
    runScheduledAnalysis('midnight_12am');
  }, { timezone });
  scheduledJobs.set('midnight', midnightJob);
  console.log(`Scheduled: Midnight analysis at 12 AM EST (${midnightCron})`);

  console.log(`\nAll scheduled jobs started (timezone: ${timezone})`);
  console.log('Daily Report: 6 AM | Analysis: 8 AM, 12 PM, 4 PM, 12 AM EST');

  return scheduledJobs;
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduledJobs() {
  for (const [name, job] of scheduledJobs) {
    job.stop();
    console.log(`Stopped scheduled job: ${name}`);
  }
  scheduledJobs.clear();
}

/**
 * Get scheduled jobs status
 */
export function getScheduleStatus() {
  const jobs = [];
  for (const [name, job] of scheduledJobs) {
    jobs.push({
      name,
      running: true // cron jobs are always "running" when scheduled
    });
  }

  return {
    enabled: scheduledJobs.size > 0,
    timezone: process.env.SCHEDULE_TIMEZONE || 'America/New_York',
    jobs,
    schedules: {
      daily_report: process.env.SCHEDULE_DAILY_REPORT || '0 6 * * *',
      morning: process.env.SCHEDULE_MORNING || '0 8 * * *',
      noon: process.env.SCHEDULE_NOON || '0 12 * * *',
      afternoon: process.env.SCHEDULE_AFTERNOON || '0 16 * * *',
      midnight: process.env.SCHEDULE_MIDNIGHT || '0 0 * * *'
    },
    email: emailService.getEmailConfig()
  };
}

/**
 * Run analysis manually (for testing or on-demand)
 */
export async function runManualAnalysis() {
  return await runScheduledAnalysis('manual');
}

export default {
  initScheduler,
  startScheduledJobs,
  stopScheduledJobs,
  getScheduleStatus,
  runScheduledAnalysis,
  runManualAnalysis,
  generateAndSendDailyReport
};
