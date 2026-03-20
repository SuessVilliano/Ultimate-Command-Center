/**
 * LIV8 Command Center - ClickUp SOP Integration
 * Handles webhook events, SOP syncing, and notifications
 */

import * as db from './database.js';
import * as emailService from './email-service.js';

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

/**
 * Get ClickUp API headers
 */
function getHeaders() {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error('CLICKUP_API_TOKEN not configured');
  return {
    'Authorization': token,
    'Content-Type': 'application/json'
  };
}

/**
 * Check if ClickUp is configured
 */
export function isConfigured() {
  return !!(process.env.CLICKUP_API_TOKEN);
}

/**
 * Get team/workspace ID
 */
export async function getTeams() {
  const resp = await fetch(`${CLICKUP_API_BASE}/team`, { headers: getHeaders() });
  if (!resp.ok) throw new Error(`ClickUp API error: ${resp.status}`);
  return resp.json();
}

/**
 * Create a webhook for SOP notifications
 */
export async function createWebhook(teamId, callbackUrl, events = null) {
  const defaultEvents = [
    'taskCreated', 'taskUpdated', 'taskDeleted',
    'taskCommentPosted'
  ];

  const resp = await fetch(`${CLICKUP_API_BASE}/team/${teamId}/webhook`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      endpoint: callbackUrl,
      events: events || defaultEvents
    })
  });

  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.err || `Failed to create webhook: ${resp.status}`);
  }
  return resp.json();
}

/**
 * List existing webhooks
 */
export async function listWebhooks(teamId) {
  const resp = await fetch(`${CLICKUP_API_BASE}/team/${teamId}/webhook`, {
    headers: getHeaders()
  });
  if (!resp.ok) throw new Error(`Failed to list webhooks: ${resp.status}`);
  return resp.json();
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(webhookId) {
  const resp = await fetch(`${CLICKUP_API_BASE}/webhook/${webhookId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return resp.ok;
}

/**
 * Fetch full task/doc details from ClickUp
 */
export async function getTask(taskId) {
  const resp = await fetch(`${CLICKUP_API_BASE}/task/${taskId}`, {
    headers: getHeaders()
  });
  if (!resp.ok) return null;
  return resp.json();
}

/**
 * Fetch a ClickUp Doc (page) by ID
 */
export async function getDoc(workspaceId, docId) {
  const resp = await fetch(`${CLICKUP_API_BASE}/workspaces/${workspaceId}/docs/${docId}`, {
    headers: getHeaders()
  });
  if (!resp.ok) return null;
  return resp.json();
}

/**
 * Process a ClickUp webhook event
 * Returns the processed SOP change entry
 */
export async function processWebhookEvent(payload) {
  const event = payload.event;
  const taskId = payload.task_id;
  const historyItems = payload.history_items || [];

  // Build the SOP change entry
  const entry = {
    clickup_doc_id: taskId || payload.page_id || '',
    clickup_task_id: taskId,
    event_type: event,
    title: 'Unknown',
    url: null,
    space_name: null,
    folder_name: null,
    list_name: null,
    changed_by: null,
    change_summary: null,
    content_snapshot: null,
    notified_emails: null,
    notified_slack: false,
    synced_to_kb: false
  };

  // Try to fetch full task details for richer context
  if (taskId && isConfigured()) {
    try {
      const task = await getTask(taskId);
      if (task) {
        entry.title = task.name || 'Untitled';
        entry.url = task.url || `https://app.clickup.com/t/${taskId}`;
        entry.space_name = task.space?.name || null;
        entry.folder_name = task.folder?.name || null;
        entry.list_name = task.list?.name || null;
        entry.content_snapshot = (task.description || task.text_content || '').substring(0, 2000);

        // Get who made the change
        if (task.creator) {
          entry.changed_by = task.creator.username || task.creator.email || null;
        }
      }
    } catch (e) {
      console.log('Could not fetch task details:', e.message);
    }
  }

  // Parse history items for change summary
  if (historyItems.length > 0) {
    const changes = historyItems.map(h => {
      if (h.user) entry.changed_by = h.user.username || h.user.email || entry.changed_by;
      return `${h.field || 'content'}: ${h.before ? 'changed' : 'added'}`;
    });
    entry.change_summary = changes.join('; ');
  }

  // For page events (ClickUp Docs)
  if (payload.page_id) {
    entry.clickup_doc_id = payload.page_id;
    entry.title = payload.page_name || payload.title || 'Untitled Doc';
    entry.url = `https://app.clickup.com/${payload.workspace_id}/docs/${payload.page_id}`;
    if (payload.page_content) {
      entry.content_snapshot = payload.page_content.substring(0, 2000);
    }
  }

  // Generate a nicer URL if we don't have one
  if (!entry.url && taskId) {
    entry.url = `https://app.clickup.com/t/${taskId}`;
  }

  return entry;
}

/**
 * Send SOP update notification via email
 * Supports multiple CC and BCC recipients
 */
export async function notifyViaEmail(entry, config = {}) {
  if (!emailService.isEmailEnabled()) {
    console.log('Email not configured, skipping SOP notification');
    return { success: false, error: 'Email not configured' };
  }

  const toEmails = config.to || process.env.REPORT_EMAIL || process.env.SMTP_USER;
  const ccEmails = config.cc || process.env.CLICKUP_NOTIFY_CC || '';
  const bccEmails = config.bcc || process.env.CLICKUP_NOTIFY_BCC || '';

  if (!toEmails) {
    return { success: false, error: 'No recipient email configured' };
  }

  const eventLabels = {
    taskCreated: 'New SOP Created',
    taskUpdated: 'SOP Updated',
    taskDeleted: 'SOP Deleted',
    taskCommentPosted: 'SOP Comment Added',
    pageCreated: 'New Doc Created',
    pageUpdated: 'Doc Updated'
  };

  const subject = `[SOP ${entry.event_type === 'taskCreated' || entry.event_type === 'pageCreated' ? 'NEW' : 'UPDATE'}] ${entry.title}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #7c3aed, #2563eb); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">SOP Change Notification</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 13px;">${eventLabels[entry.event_type] || entry.event_type}</p>
      </div>
      <div style="padding: 24px; background: #fff;">
        <h2 style="color: #111; margin: 0 0 16px; font-size: 18px;">${entry.title}</h2>

        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 120px;">Event</td>
            <td style="padding: 8px 0; font-weight: 600;">${eventLabels[entry.event_type] || entry.event_type}</td>
          </tr>
          ${entry.changed_by ? `<tr><td style="padding: 8px 0; color: #6b7280;">Changed By</td><td style="padding: 8px 0;">${entry.changed_by}</td></tr>` : ''}
          ${entry.space_name ? `<tr><td style="padding: 8px 0; color: #6b7280;">Space</td><td style="padding: 8px 0;">${entry.space_name}</td></tr>` : ''}
          ${entry.folder_name ? `<tr><td style="padding: 8px 0; color: #6b7280;">Folder</td><td style="padding: 8px 0;">${entry.folder_name}</td></tr>` : ''}
          ${entry.list_name ? `<tr><td style="padding: 8px 0; color: #6b7280;">List</td><td style="padding: 8px 0;">${entry.list_name}</td></tr>` : ''}
          ${entry.change_summary ? `<tr><td style="padding: 8px 0; color: #6b7280;">Changes</td><td style="padding: 8px 0;">${entry.change_summary}</td></tr>` : ''}
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Time</td>
            <td style="padding: 8px 0;">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</td>
          </tr>
        </table>

        ${entry.content_snapshot ? `
          <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="font-size: 12px; font-weight: 700; color: #6b7280; margin-bottom: 8px; text-transform: uppercase;">Content Preview</div>
            <div style="font-size: 13px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${entry.content_snapshot.substring(0, 500)}${entry.content_snapshot.length > 500 ? '...' : ''}</div>
          </div>
        ` : ''}

        ${entry.url ? `
          <div style="margin-top: 24px; text-align: center;">
            <a href="${entry.url}" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              View in ClickUp
            </a>
          </div>
        ` : ''}
      </div>
      <div style="padding: 12px; text-align: center; background: #f3f4f6; border-top: 1px solid #e5e7eb;">
        <small style="color: #6b7280;">LIV8 Command Center — SOP Change Tracker</small>
      </div>
    </div>
  `;

  const textBody = `SOP ${entry.event_type === 'taskCreated' ? 'CREATED' : 'UPDATED'}: ${entry.title}\n\n` +
    `Event: ${eventLabels[entry.event_type] || entry.event_type}\n` +
    (entry.changed_by ? `Changed By: ${entry.changed_by}\n` : '') +
    (entry.space_name ? `Space: ${entry.space_name}\n` : '') +
    (entry.change_summary ? `Changes: ${entry.change_summary}\n` : '') +
    (entry.url ? `\nView: ${entry.url}\n` : '') +
    `\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;

  try {
    // Build mail options with CC/BCC support
    const nodemailer = (await import('nodemailer')).default;
    // Use the email service's internal transporter by sending a notification
    const result = await emailService.sendNotification(
      subject.replace('[SOP ', '').replace(']', ' —'),
      textBody
    );

    // For CC/BCC, we need to send additional copies
    // The main notification goes to the configured REPORT_EMAIL
    // CC and BCC emails get separate sends
    const allCC = ccEmails.split(',').map(e => e.trim()).filter(Boolean);
    const allBCC = bccEmails.split(',').map(e => e.trim()).filter(Boolean);

    for (const cc of allCC) {
      try {
        await emailService.sendNotification(subject.replace('[SOP ', '').replace(']', ' —'), textBody, cc);
      } catch (e) {
        console.log(`Failed to CC ${cc}:`, e.message);
      }
    }
    for (const bcc of allBCC) {
      try {
        await emailService.sendNotification(subject.replace('[SOP ', '').replace(']', ' —'), textBody, bcc);
      } catch (e) {
        console.log(`Failed to BCC ${bcc}:`, e.message);
      }
    }

    const notifiedList = [toEmails, ...allCC].filter(Boolean).join(', ');
    return { success: true, notified: notifiedList, bcc: allBCC.length };
  } catch (error) {
    console.error('SOP email notification failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send SOP update notification via Slack webhook
 */
export async function notifyViaSlack(entry) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('Slack webhook not configured, skipping SOP notification');
    return { success: false, error: 'SLACK_WEBHOOK_URL not configured' };
  }

  const eventEmoji = {
    taskCreated: ':new:', taskUpdated: ':pencil2:', taskDeleted: ':wastebasket:',
    taskCommentPosted: ':speech_balloon:', pageCreated: ':page_facing_up:', pageUpdated: ':memo:'
  };

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${eventEmoji[entry.event_type] || ':bell:'} SOP ${entry.event_type.includes('Created') ? 'Created' : 'Updated'}` }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Title:*\n${entry.url ? `<${entry.url}|${entry.title}>` : entry.title}` },
        { type: 'mrkdwn', text: `*Changed By:*\n${entry.changed_by || 'Unknown'}` },
        ...(entry.space_name ? [{ type: 'mrkdwn', text: `*Space:*\n${entry.space_name}` }] : []),
        ...(entry.folder_name ? [{ type: 'mrkdwn', text: `*Folder:*\n${entry.folder_name}` }] : []),
      ]
    }
  ];

  if (entry.change_summary) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Changes:* ${entry.change_summary}` }
    });
  }

  if (entry.content_snapshot) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Preview:*\n\`\`\`${entry.content_snapshot.substring(0, 300)}\`\`\`` }
    });
  }

  if (entry.url) {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'View in ClickUp' },
        url: entry.url,
        style: 'primary'
      }]
    });
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `LIV8 Command Center | ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST` }]
  });

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks })
    });
    return { success: resp.ok };
  } catch (error) {
    console.error('Slack notification failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sync SOP content to the AI knowledge base
 */
export function syncToKnowledgeBase(entry) {
  if (!entry.content_snapshot || entry.content_snapshot.length < 20) return false;

  try {
    // Add to knowledge base for AI to reference
    db.addToKnowledgeBase(
      {
        id: `sop-${entry.clickup_doc_id}`,
        subject: `SOP: ${entry.title}`,
        description_text: entry.content_snapshot,
        status: 5, // "resolved" equivalent
        tags: ['sop', 'clickup', entry.space_name, entry.folder_name].filter(Boolean)
      },
      entry.content_snapshot,
      extractSOPKeywords(entry.title + ' ' + entry.content_snapshot)
    );
    return true;
  } catch (e) {
    console.log('Failed to sync SOP to knowledge base:', e.message);
    return false;
  }
}

/**
 * Extract keywords from SOP content
 */
function extractSOPKeywords(text) {
  if (!text) return [];
  const importantTerms = [
    'port', 'porting', 'loa', 'number', 'twilio', 'workflow', 'automation',
    'sms', 'email', 'calendar', 'funnel', 'pipeline', 'webhook', 'api',
    'billing', 'cancel', 'refund', 'login', 'password', 'domain', 'dns',
    'whitelabel', 'cnam', 'call tracking', 'error', 'bug', 'sop', 'process',
    'procedure', 'step', 'guide', 'how to', 'troubleshoot', 'escalation'
  ];
  const lower = text.toLowerCase();
  return importantTerms.filter(t => lower.includes(t));
}

export default {
  isConfigured,
  getTeams,
  createWebhook,
  listWebhooks,
  deleteWebhook,
  getTask,
  getDoc,
  processWebhookEvent,
  notifyViaEmail,
  notifyViaSlack,
  syncToKnowledgeBase
};
