const fs = require('fs');
let content = fs.readFileSync('proactive-briefing.js', 'utf8');

const newFunctions = `
// ============================================
// SMART DAILY REPORT
// ============================================

export async function generateSmartDailyReport() {
  const dbInstance = db.getDb();
  let tickets = [];
  try {
    const stmt = dbInstance.prepare(\`
      SELECT t.*, a.escalation_type, a.urgency_score, a.summary as ai_summary
      FROM tickets t LEFT JOIN ticket_analysis a ON t.id = a.ticket_id
      WHERE t.status IN (2, 3, 6, 7)
      ORDER BY a.urgency_score DESC NULLS LAST
    \`);
    tickets = stmt.all();
  } catch (e) {}

  const critical = tickets.filter(t => t.urgency_score >= 8);
  const high = tickets.filter(t => t.urgency_score >= 5 && t.urgency_score < 8);
  const medium = tickets.filter(t => t.urgency_score >= 3 && t.urgency_score < 5);
  const low = tickets.filter(t => !t.urgency_score || t.urgency_score < 3);

  const byType = {};
  tickets.forEach(t => {
    const type = t.escalation_type || 'UNANALYZED';
    if (!byType[type]) byType[type] = [];
    byType[type].push(t);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    summary: { totalTickets: tickets.length, critical: critical.length, high: high.length, medium: medium.length, low: low.length },
    byType,
    attackPlan: [],
    quickWins: low.slice(0, 3).map(t => ({ id: t.id, subject: t.subject })),
  };

  if (critical.length > 0) {
    report.attackPlan.push({ priority: 'CRITICAL', action: 'Handle immediately', tickets: critical.slice(0, 3).map(t => ({ id: t.id, subject: t.subject, urgency: t.urgency_score })) });
  }
  if (high.length > 0) {
    report.attackPlan.push({ priority: 'HIGH', action: 'Address next', tickets: high.slice(0, 5).map(t => ({ id: t.id, subject: t.subject, urgency: t.urgency_score })) });
  }

  try {
    const result = await ai.chat([{ role: 'user', content: 'Give 3 quick tips for handling ' + tickets.length + ' support tickets with ' + critical.length + ' critical.' }], { maxTokens: 200 });
    report.aiInsights = result.text;
  } catch (e) { report.aiInsights = 'unavailable'; }

  return report;
}

export function getSmartTicketQueue() {
  const dbInstance = db.getDb();
  try {
    const stmt = dbInstance.prepare(\`
      SELECT t.*, a.escalation_type, a.urgency_score, a.summary as ai_summary
      FROM tickets t LEFT JOIN ticket_analysis a ON t.id = a.ticket_id
      WHERE t.status IN (2, 3, 6, 7)
      ORDER BY a.urgency_score DESC NULLS LAST
    \`);
    const tickets = stmt.all();
    return {
      total: tickets.length,
      critical: tickets.filter(t => t.urgency_score >= 8),
      high: tickets.filter(t => t.urgency_score >= 5 && t.urgency_score < 8),
      other: tickets.filter(t => !t.urgency_score || t.urgency_score < 5),
      nextUp: tickets.slice(0, 5)
    };
  } catch (e) { return { total: 0, critical: [], high: [], other: [], nextUp: [] }; }
}

`;

// Add before export default
content = content.replace(
  'export default {',
  newFunctions + 'export default {'
);

// Add to exports
content = content.replace(
  'initBriefingTables,',
  'initBriefingTables,\n  generateSmartDailyReport,\n  getSmartTicketQueue,'
);

fs.writeFileSync('proactive-briefing.js', content);
console.log('Smart report functions added');
