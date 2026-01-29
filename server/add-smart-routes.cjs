const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// Check if routes already exist
if (content.includes('/api/briefing/smart-report')) {
  console.log('Smart report routes already exist');
  process.exit(0);
}

// Add the new routes after the /api/briefing route
const newRoutes = `});

// Smart Daily Report - Comprehensive ticket analysis
app.get('/api/briefing/smart-report', async (req, res) => {
  try {
    const report = await briefing.generateSmartDailyReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Smart Ticket Queue - Prioritized ticket view
app.get('/api/briefing/ticket-queue', (req, res) => {
  try {
    const queue = briefing.getSmartTicketQueue();
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Parking Lot - Quick capture`;

content = content.replace(
  /\}\);\n\n\/\/ Parking Lot - Quick capture/,
  newRoutes
);

fs.writeFileSync('server.js', content);
console.log('Smart report routes added!');
