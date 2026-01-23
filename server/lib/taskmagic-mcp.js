/**
 * TaskMagic Integration
 *
 * NOTE: TaskMagic does NOT have a REST API.
 * Integration works via webhooks only.
 *
 * The TASKMAGIC_MCP_TOKEN is for Model Context Protocol (AI) integration,
 * not for TaskMagic's internal API.
 */

/**
 * Trigger a TaskMagic webhook with payload
 */
async function triggerWebhook(webhookUrl, payload = {}) {
  if (!webhookUrl) {
    throw new Error('Webhook URL required');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TaskMagic webhook error: ${response.status} - ${errorText}`);
  }

  return { success: true, status: response.status };
}

export const taskmagicMCP = {
  // Check if webhook is configured
  isConfigured() {
    return !!process.env.TASKMAGIC_WEBHOOK_URL;
  },

  // Get webhook URL
  getWebhookUrl() {
    return process.env.TASKMAGIC_WEBHOOK_URL || null;
  },

  // Trigger the default webhook
  async trigger(payload = {}) {
    const webhookUrl = process.env.TASKMAGIC_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('TASKMAGIC_WEBHOOK_URL not configured');
    }
    return triggerWebhook(webhookUrl, payload);
  },

  // Trigger a specific webhook URL
  async triggerCustom(webhookUrl, payload = {}) {
    return triggerWebhook(webhookUrl, payload);
  },

  // Get integration status
  // Note: TaskMagic doesn't have an API to check connection,
  // we can only verify the webhook URL is configured
  async getStatus() {
    const configured = this.isConfigured();
    return {
      configured,
      connected: configured, // If webhook URL exists, consider it "connected"
      webhookUrl: configured ? this.getWebhookUrl() : null,
      note: 'TaskMagic uses webhooks only - no REST API available'
    };
  },

  // Simulate bots list (stored locally or retrieved from database)
  async getBots() {
    // Since TaskMagic has no API, bots must be configured manually
    // Return empty list or configured bots from database
    return {
      bots: [],
      note: 'Configure TaskMagic bots manually. Use webhooks to trigger automations.'
    };
  },

  // Run automation via webhook
  async runBot(botId, params = {}) {
    // For TaskMagic, "running a bot" means triggering its webhook
    // The botId would be the webhook identifier
    const webhookUrl = process.env.TASKMAGIC_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('No webhook URL configured');
    }

    return this.trigger({
      action: 'run_bot',
      botId,
      ...params
    });
  }
};

export default taskmagicMCP;
