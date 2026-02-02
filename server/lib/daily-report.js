/**
 * LIV8 Command Center - Daily Report Generator
 * Generates PDF reports for daily ticket summaries with AI analysis
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as ai from './ai-provider.js';
import {
  getAllTicketsWithAnalysis,
  searchKnowledgeBase,
  getKnowledgeBaseStats,
  getRecentRuns
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Status code mapping
const STATUS_MAP = {
  2: 'Open',
  3: 'Pending',
  4: 'Resolved',
  5: 'Closed',
  6: 'Waiting on Customer',
  7: 'Waiting on Third Party'
};

// Priority mapping
const PRIORITY_MAP = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Urgent'
};

// Escalation type colors
const ESCALATION_COLORS = {
  DEV: '#ef4444',
  TWILIO: '#f97316',
  BILLING: '#eab308',
  BUG: '#ef4444',
  FEATURE: '#3b82f6',
  SUPPORT: '#22c55e'
};

/**
 * Generate daily report data with AI analysis
 */
export async function generateReportData() {
  console.log('Generating daily report data...');

  // Get all open/pending tickets with their analysis
  const tickets = getAllTicketsWithAnalysis([2, 3, 6, 7]) || [];

  // Get knowledge base stats
  let kbStats = { total: 0, lastUpdated: null };
  try {
    kbStats = getKnowledgeBaseStats();
  } catch (e) {
    console.log('Could not get KB stats:', e.message);
  }

  // Get recent scheduler runs
  let recentRuns = [];
  try {
    recentRuns = getRecentRuns(5);
  } catch (e) {
    console.log('Could not get recent runs:', e.message);
  }

  // Categorize tickets
  const ticketsByStatus = {};
  const ticketsByType = {};
  const ticketsByPriority = {};
  const urgentTickets = [];
  const needsWorkTickets = [];

  for (const ticket of tickets) {
    // By status
    const statusName = STATUS_MAP[ticket.status] || 'Unknown';
    if (!ticketsByStatus[statusName]) ticketsByStatus[statusName] = [];
    ticketsByStatus[statusName].push(ticket);

    // By escalation type
    const escType = ticket.escalation_type || 'SUPPORT';
    if (!ticketsByType[escType]) ticketsByType[escType] = [];
    ticketsByType[escType].push(ticket);

    // By priority
    const priorityName = PRIORITY_MAP[ticket.priority] || 'Unknown';
    if (!ticketsByPriority[priorityName]) ticketsByPriority[priorityName] = [];
    ticketsByPriority[priorityName].push(ticket);

    // Urgent tickets (score >= 7 or priority 4)
    if ((ticket.urgency_score && ticket.urgency_score >= 7) || ticket.priority === 4) {
      urgentTickets.push(ticket);
    }

    // Tickets needing work (open/pending without recent analysis or high urgency)
    if ([2, 3].includes(ticket.status)) {
      needsWorkTickets.push(ticket);
    }
  }

  // Generate AI summary for the entire queue
  let aiSummary = null;
  if (tickets.length > 0) {
    try {
      aiSummary = await ai.proactiveAnalysis(tickets);
    } catch (e) {
      console.log('Could not generate AI summary:', e.message);
    }
  }

  // Generate solutions for top priority tickets
  const ticketSolutions = [];
  const topTickets = [...urgentTickets, ...needsWorkTickets]
    .slice(0, 10)
    .filter((t, i, arr) => arr.findIndex(x => x.freshdesk_id === t.freshdesk_id) === i);

  for (const ticket of topTickets) {
    try {
      // Find similar resolved tickets for context
      const keywords = extractKeywords(ticket.subject + ' ' + (ticket.description || ''));
      const similarTickets = searchKnowledgeBase(keywords, 3);

      // Generate AI response
      const response = await ai.generateResponse(ticket, similarTickets);

      ticketSolutions.push({
        ticket,
        suggestedResponse: response?.response || ticket.suggested_response || 'No response generated',
        similarTickets: similarTickets.map(t => ({
          subject: t.subject,
          resolution: t.resolution
        }))
      });

      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.log(`Could not generate solution for ticket ${ticket.freshdesk_id}:`, e.message);
      ticketSolutions.push({
        ticket,
        suggestedResponse: ticket.suggested_response || 'Error generating response',
        similarTickets: []
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalOpen: tickets.length,
      byStatus: Object.entries(ticketsByStatus).map(([status, t]) => ({ status, count: t.length })),
      byType: Object.entries(ticketsByType).map(([type, t]) => ({ type, count: t.length })),
      byPriority: Object.entries(ticketsByPriority).map(([priority, t]) => ({ priority, count: t.length })),
      urgentCount: urgentTickets.length,
      needsWorkCount: needsWorkTickets.length
    },
    aiAnalysis: aiSummary,
    urgentTickets: urgentTickets.map(formatTicketForReport),
    needsWorkTickets: needsWorkTickets.slice(0, 15).map(formatTicketForReport),
    ticketSolutions,
    knowledgeBase: kbStats,
    recentRuns: recentRuns.slice(0, 3)
  };
}

/**
 * Extract keywords from text for knowledge base search
 */
function extractKeywords(text) {
  if (!text) return [];

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his',
    'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10);
}

/**
 * Format ticket for report display
 */
function formatTicketForReport(ticket) {
  return {
    id: ticket.freshdesk_id,
    subject: ticket.subject,
    status: STATUS_MAP[ticket.status] || 'Unknown',
    priority: PRIORITY_MAP[ticket.priority] || 'Unknown',
    requester: ticket.requester_name || ticket.requester_email || 'Unknown',
    createdAt: ticket.created_at,
    escalationType: ticket.escalation_type || 'SUPPORT',
    urgencyScore: ticket.urgency_score || 0,
    summary: ticket.summary || 'No analysis available',
    suggestedResponse: ticket.suggested_response || null,
    actionItems: parseActionItems(ticket.action_items)
  };
}

/**
 * Parse action items from JSON string or array
 */
function parseActionItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  try {
    return JSON.parse(items);
  } catch {
    return [];
  }
}

/**
 * Generate PDF report
 */
export async function generatePDFReport(reportData = null) {
  if (!reportData) {
    reportData = await generateReportData();
  }

  const reportsDir = path.join(__dirname, '..', 'data', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `daily-report-${timestamp}.pdf`;
  const filepath = path.join(reportsDir, filename);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `LIV8 Daily Support Report - ${timestamp}`,
          Author: 'LIV8 Command Center',
          Subject: 'Daily Ticket Summary and AI Analysis'
        }
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24)
         .fillColor('#7c3aed')
         .text('LIV8 Command Center', { align: 'center' });

      doc.fontSize(16)
         .fillColor('#374151')
         .text('Daily Support Report', { align: 'center' });

      doc.fontSize(10)
         .fillColor('#6b7280')
         .text(`Generated: ${new Date(reportData.generatedAt).toLocaleString()}`, { align: 'center' });

      doc.moveDown(2);

      // Executive Summary Box
      doc.rect(50, doc.y, 512, 80)
         .fill('#f3f4f6');

      const summaryY = doc.y + 10;
      doc.fillColor('#111827')
         .fontSize(14)
         .text('Executive Summary', 60, summaryY, { underline: true });

      doc.fontSize(11)
         .text(`Total Open Tickets: ${reportData.summary.totalOpen}`, 60, summaryY + 20);
      doc.text(`Urgent Items: ${reportData.summary.urgentCount}`, 60, summaryY + 35);
      doc.text(`Needs Attention: ${reportData.summary.needsWorkCount}`, 60, summaryY + 50);

      // Right side stats
      doc.text(`Knowledge Base: ${reportData.knowledgeBase.total} articles`, 320, summaryY + 20);

      doc.y = summaryY + 90;
      doc.moveDown();

      // Tickets by Type
      doc.fontSize(14)
         .fillColor('#7c3aed')
         .text('Tickets by Type', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor('#374151');
      for (const { type, count } of reportData.summary.byType) {
        const color = ESCALATION_COLORS[type] || '#6b7280';
        doc.fillColor(color).text(`● ${type}: ${count}`, { continued: false });
      }

      doc.moveDown();

      // Tickets by Priority
      doc.fontSize(14)
         .fillColor('#7c3aed')
         .text('Tickets by Priority', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor('#374151');
      for (const { priority, count } of reportData.summary.byPriority) {
        doc.text(`● ${priority}: ${count}`);
      }

      doc.moveDown();

      // AI Analysis Section
      if (reportData.aiAnalysis) {
        doc.addPage();

        doc.fontSize(18)
           .fillColor('#7c3aed')
           .text('AI Analysis & Recommendations', { underline: true });
        doc.moveDown();

        if (reportData.aiAnalysis.summary) {
          doc.fontSize(12)
             .fillColor('#111827')
             .text('Overview:', { underline: true });
          doc.fontSize(10)
             .fillColor('#374151')
             .text(reportData.aiAnalysis.summary);
          doc.moveDown();
        }

        if (reportData.aiAnalysis.recommendations?.length > 0) {
          doc.fontSize(12)
             .fillColor('#111827')
             .text('Recommendations:', { underline: true });
          doc.moveDown(0.5);

          for (const rec of reportData.aiAnalysis.recommendations.slice(0, 5)) {
            doc.fontSize(10)
               .fillColor('#374151')
               .text(`• ${rec.action || rec}`, { indent: 10 });
          }
          doc.moveDown();
        }

        if (reportData.aiAnalysis.patterns?.length > 0) {
          doc.fontSize(12)
             .fillColor('#111827')
             .text('Detected Patterns:', { underline: true });
          doc.moveDown(0.5);

          for (const pattern of reportData.aiAnalysis.patterns.slice(0, 3)) {
            doc.fontSize(10)
               .fillColor('#374151')
               .text(`• ${pattern}`, { indent: 10 });
          }
        }
      }

      // Urgent Tickets Section
      if (reportData.urgentTickets.length > 0) {
        doc.addPage();

        doc.fontSize(18)
           .fillColor('#ef4444')
           .text('URGENT TICKETS', { underline: true });
        doc.moveDown();

        for (const ticket of reportData.urgentTickets.slice(0, 5)) {
          renderTicketBlock(doc, ticket);
        }
      }

      // Tickets Needing Work
      if (reportData.needsWorkTickets.length > 0) {
        doc.addPage();

        doc.fontSize(18)
           .fillColor('#f59e0b')
           .text('Tickets Needing Attention', { underline: true });
        doc.moveDown();

        for (const ticket of reportData.needsWorkTickets.slice(0, 10)) {
          renderTicketBlock(doc, ticket, true);
        }
      }

      // Solutions Section
      if (reportData.ticketSolutions.length > 0) {
        doc.addPage();

        doc.fontSize(18)
           .fillColor('#22c55e')
           .text('Suggested Solutions', { underline: true });
        doc.moveDown();

        for (const solution of reportData.ticketSolutions.slice(0, 8)) {
          renderSolutionBlock(doc, solution);
        }
      }

      // Footer on last page
      doc.fontSize(8)
         .fillColor('#9ca3af')
         .text(
           'This report was automatically generated by LIV8 Command Center AI.',
           50,
           doc.page.height - 30,
           { align: 'center' }
         );

      doc.end();

      stream.on('finish', () => {
        console.log(`PDF report generated: ${filepath}`);
        resolve({
          filepath,
          filename,
          reportData
        });
      });

      stream.on('error', reject);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render a ticket block in the PDF
 */
function renderTicketBlock(doc, ticket, compact = false) {
  // Check if we need a new page
  if (doc.y > 650) {
    doc.addPage();
  }

  const startY = doc.y;

  // Ticket header
  doc.rect(50, startY, 512, compact ? 60 : 80)
     .fill('#fafafa')
     .stroke('#e5e7eb');

  doc.fillColor('#7c3aed')
     .fontSize(11)
     .text(`#${ticket.id}: ${ticket.subject.substring(0, 60)}${ticket.subject.length > 60 ? '...' : ''}`,
           60, startY + 8, { width: 490 });

  doc.fillColor('#6b7280')
     .fontSize(9)
     .text(`Status: ${ticket.status} | Priority: ${ticket.priority} | Type: ${ticket.escalationType}`,
           60, startY + 24);

  doc.text(`From: ${ticket.requester} | Urgency Score: ${ticket.urgencyScore}/10`,
           60, startY + 36);

  if (!compact && ticket.summary) {
    doc.fillColor('#374151')
       .fontSize(9)
       .text(`Summary: ${ticket.summary.substring(0, 120)}...`, 60, startY + 52, { width: 490 });
  }

  doc.y = startY + (compact ? 70 : 90);
}

/**
 * Render a solution block in the PDF
 */
function renderSolutionBlock(doc, solution) {
  const ticket = solution.ticket;

  // Check if we need a new page
  if (doc.y > 550) {
    doc.addPage();
  }

  const startY = doc.y;

  // Header
  doc.fillColor('#7c3aed')
     .fontSize(11)
     .text(`#${ticket.freshdesk_id}: ${ticket.subject.substring(0, 50)}...`, 50, startY);

  doc.moveDown(0.3);

  // Suggested response
  doc.fillColor('#111827')
     .fontSize(9)
     .text('Suggested Response:', { underline: true });

  doc.fillColor('#374151')
     .fontSize(9)
     .text(solution.suggestedResponse.substring(0, 400) +
           (solution.suggestedResponse.length > 400 ? '...' : ''),
           { width: 500, indent: 10 });

  // Similar tickets reference
  if (solution.similarTickets.length > 0) {
    doc.moveDown(0.3);
    doc.fillColor('#6b7280')
       .fontSize(8)
       .text(`Based on ${solution.similarTickets.length} similar resolved tickets`);
  }

  doc.moveDown();

  // Divider
  doc.strokeColor('#e5e7eb')
     .moveTo(50, doc.y)
     .lineTo(562, doc.y)
     .stroke();

  doc.moveDown();
}

/**
 * Get list of generated reports
 */
export function getReportsList() {
  const reportsDir = path.join(__dirname, '..', 'data', 'reports');

  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => ({
      filename: f,
      filepath: path.join(reportsDir, f),
      createdAt: fs.statSync(path.join(reportsDir, f)).mtime
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return files;
}

/**
 * Delete old reports (keep last N)
 */
export function cleanupOldReports(keepCount = 30) {
  const reports = getReportsList();

  if (reports.length <= keepCount) return 0;

  const toDelete = reports.slice(keepCount);
  let deleted = 0;

  for (const report of toDelete) {
    try {
      fs.unlinkSync(report.filepath);
      deleted++;
    } catch (e) {
      console.log(`Could not delete ${report.filename}:`, e.message);
    }
  }

  return deleted;
}

export default {
  generateReportData,
  generatePDFReport,
  getReportsList,
  cleanupOldReports
};
