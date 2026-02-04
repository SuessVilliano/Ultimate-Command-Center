/**
 * LIV8 Command Center - Email Service
 * Handles sending emails with attachments (daily reports, notifications)
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

let transporter = null;
let emailConfig = {
  enabled: false,
  from: null,
  to: null,
  host: null,
  port: null,
  secure: false,
  user: null,
  pass: null
};

/**
 * Initialize email service with SMTP configuration
 * Supports common providers: Gmail, Outlook, custom SMTP
 */
export function initEmailService() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || user;
  const to = process.env.REPORT_EMAIL || process.env.SMTP_TO;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    console.log('Email service not configured - SMTP_HOST, SMTP_USER, SMTP_PASS required');
    return null;
  }

  emailConfig = {
    enabled: true,
    from,
    to,
    host,
    port,
    secure,
    user,
    pass
  };

  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certs
      }
    });

    console.log(`Email service initialized: ${host}:${port}`);
    return transporter;
  } catch (error) {
    console.error('Failed to initialize email service:', error.message);
    return null;
  }
}

/**
 * Check if email service is available
 */
export function isEmailEnabled() {
  return emailConfig.enabled && transporter !== null;
}

/**
 * Get email configuration (without sensitive data)
 */
export function getEmailConfig() {
  return {
    enabled: emailConfig.enabled,
    host: emailConfig.host,
    port: emailConfig.port,
    from: emailConfig.from,
    to: emailConfig.to,
    hasCredentials: !!(emailConfig.user && emailConfig.pass)
  };
}

/**
 * Verify SMTP connection
 */
export async function verifyConnection() {
  if (!transporter) {
    return { success: false, error: 'Email service not initialized' };
  }

  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send daily report email with PDF attachment
 */
export async function sendDailyReport(reportPath, reportData, recipientEmail = null) {
  if (!transporter) {
    throw new Error('Email service not initialized');
  }

  const to = recipientEmail || emailConfig.to;
  if (!to) {
    throw new Error('No recipient email configured. Set REPORT_EMAIL environment variable.');
  }

  const filename = path.basename(reportPath);
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Build HTML email body
  const htmlBody = buildReportEmailHTML(reportData, date);
  const textBody = buildReportEmailText(reportData, date);

  const mailOptions = {
    from: emailConfig.from,
    to,
    subject: `LIV8 Daily Support Report - ${date}`,
    text: textBody,
    html: htmlBody,
    attachments: [
      {
        filename,
        path: reportPath,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`Daily report sent to ${to}: ${result.messageId}`);
    return {
      success: true,
      messageId: result.messageId,
      recipient: to
    };
  } catch (error) {
    console.error('Failed to send daily report:', error.message);
    throw error;
  }
}

/**
 * Send a simple notification email
 */
export async function sendNotification(subject, message, recipientEmail = null) {
  if (!transporter) {
    throw new Error('Email service not initialized');
  }

  const to = recipientEmail || emailConfig.to;
  if (!to) {
    throw new Error('No recipient email configured');
  }

  const mailOptions = {
    from: emailConfig.from,
    to,
    subject: `[LIV8] ${subject}`,
    text: message,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">LIV8 Command Center</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <h2 style="color: #111827;">${subject}</h2>
          <p style="color: #374151; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        <div style="padding: 10px; text-align: center; background: #e5e7eb;">
          <small style="color: #6b7280;">Sent from LIV8 Command Center</small>
        </div>
      </div>
    `
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send notification:', error.message);
    throw error;
  }
}

/**
 * Send urgent ticket alert
 */
export async function sendUrgentAlert(tickets, recipientEmail = null) {
  if (!transporter || !tickets || tickets.length === 0) {
    return { success: false, error: 'No tickets or email not configured' };
  }

  const to = recipientEmail || emailConfig.to;
  if (!to) {
    throw new Error('No recipient email configured');
  }

  const subject = `URGENT: ${tickets.length} High-Priority Ticket${tickets.length > 1 ? 's' : ''} Require Attention`;

  const ticketList = tickets.map(t => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">#${t.freshdesk_id || t.id}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${t.subject?.substring(0, 50) || 'No subject'}...</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${t.urgency_score || t.urgencyScore || 'N/A'}/10</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${t.escalation_type || t.escalationType || 'SUPPORT'}</td>
    </tr>
  `).join('');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #ef4444; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">⚠️ URGENT TICKETS ALERT</h1>
      </div>
      <div style="padding: 20px; background: #fef2f2;">
        <p style="color: #991b1b; font-size: 16px;">
          The following ${tickets.length} ticket${tickets.length > 1 ? 's' : ''} require immediate attention:
        </p>
        <table style="width: 100%; border-collapse: collapse; background: white; margin-top: 15px;">
          <thead>
            <tr style="background: #fee2e2;">
              <th style="padding: 10px; text-align: left;">ID</th>
              <th style="padding: 10px; text-align: left;">Subject</th>
              <th style="padding: 10px; text-align: left;">Urgency</th>
              <th style="padding: 10px; text-align: left;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${ticketList}
          </tbody>
        </table>
        <p style="margin-top: 20px; color: #374151;">
          <a href="${process.env.FRONTEND_URL || 'https://commandcenter.liv8.co'}/tickets"
             style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View in Command Center
          </a>
        </p>
      </div>
      <div style="padding: 10px; text-align: center; background: #e5e7eb;">
        <small style="color: #6b7280;">LIV8 Command Center Alert System</small>
      </div>
    </div>
  `;

  const mailOptions = {
    from: emailConfig.from,
    to,
    subject,
    html: htmlBody,
    priority: 'high'
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`Urgent alert sent to ${to}: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send urgent alert:', error.message);
    throw error;
  }
}

/**
 * Build HTML email body for daily report
 */
function buildReportEmailHTML(reportData, date) {
  const summary = reportData.summary || {};
  const aiAnalysis = reportData.aiAnalysis || {};

  const statusRows = (summary.byStatus || [])
    .map(s => `<tr><td style="padding: 8px;">${s.status}</td><td style="padding: 8px; text-align: right;">${s.count}</td></tr>`)
    .join('');

  const typeRows = (summary.byType || [])
    .map(t => `<tr><td style="padding: 8px;">${t.type}</td><td style="padding: 8px; text-align: right;">${t.count}</td></tr>`)
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">LIV8 Command Center</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Daily Support Report</p>
        <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0; font-size: 14px;">${date}</p>
      </div>

      <div style="padding: 30px;">
        <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
          📊 Executive Summary
        </h2>

        <div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0;">
          <div style="flex: 1; min-width: 120px; background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #7c3aed;">${summary.totalOpen || 0}</div>
            <div style="color: #6b7280; font-size: 12px;">Open Tickets</div>
          </div>
          <div style="flex: 1; min-width: 120px; background: #fef2f2; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #ef4444;">${summary.urgentCount || 0}</div>
            <div style="color: #6b7280; font-size: 12px;">Urgent</div>
          </div>
          <div style="flex: 1; min-width: 120px; background: #fef9c3; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #ca8a04;">${summary.needsWorkCount || 0}</div>
            <div style="color: #6b7280; font-size: 12px;">Needs Work</div>
          </div>
        </div>

        <div style="display: flex; gap: 20px; margin: 30px 0;">
          <div style="flex: 1;">
            <h3 style="color: #374151; margin-bottom: 10px;">By Status</h3>
            <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px;">
              ${statusRows || '<tr><td style="padding: 8px;">No data</td></tr>'}
            </table>
          </div>
          <div style="flex: 1;">
            <h3 style="color: #374151; margin-bottom: 10px;">By Type</h3>
            <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px;">
              ${typeRows || '<tr><td style="padding: 8px;">No data</td></tr>'}
            </table>
          </div>
        </div>

        ${aiAnalysis.summary ? `
          <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px; margin-top: 30px;">
            🤖 AI Analysis
          </h2>
          <p style="color: #374151; line-height: 1.6; background: #f3f4f6; padding: 15px; border-radius: 8px;">
            ${aiAnalysis.summary}
          </p>
        ` : ''}

        <div style="margin-top: 30px; text-align: center;">
          <a href="${process.env.FRONTEND_URL || 'https://commandcenter.liv8.co'}"
             style="background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Open Command Center
          </a>
        </div>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
          📎 Full PDF report attached
        </p>
      </div>

      <div style="padding: 15px; text-align: center; background: #f3f4f6; border-top: 1px solid #e5e7eb;">
        <small style="color: #6b7280;">
          Automatically generated by LIV8 Command Center AI<br>
          ${new Date().toISOString()}
        </small>
      </div>
    </div>
  `;
}

/**
 * Build plain text email body for daily report
 */
function buildReportEmailText(reportData, date) {
  const summary = reportData.summary || {};
  const aiAnalysis = reportData.aiAnalysis || {};

  let text = `
LIV8 COMMAND CENTER - DAILY SUPPORT REPORT
${date}
${'='.repeat(50)}

EXECUTIVE SUMMARY
-----------------
Total Open Tickets: ${summary.totalOpen || 0}
Urgent Items: ${summary.urgentCount || 0}
Needs Attention: ${summary.needsWorkCount || 0}

BY STATUS:
${(summary.byStatus || []).map(s => `  ${s.status}: ${s.count}`).join('\n')}

BY TYPE:
${(summary.byType || []).map(t => `  ${t.type}: ${t.count}`).join('\n')}
`;

  if (aiAnalysis.summary) {
    text += `
AI ANALYSIS
-----------
${aiAnalysis.summary}
`;
  }

  text += `
${'='.repeat(50)}
Full PDF report attached.
View online: ${process.env.FRONTEND_URL || 'https://commandcenter.liv8.co'}
`;

  return text;
}

export default {
  initEmailService,
  isEmailEnabled,
  getEmailConfig,
  verifyConnection,
  sendDailyReport,
  sendNotification,
  sendUrgentAlert
};
