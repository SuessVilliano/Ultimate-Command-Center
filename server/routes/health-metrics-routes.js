import * as oura from '../lib/oura-adapter.js';
import * as appleHealth from '../lib/apple-health-adapter.js';

function latestApple(rows = [], metricNames = []) {
  const names = metricNames.map(x => String(x).toLowerCase());
  return [...rows].reverse().find(row => {
    const key = String(row.metric || row.type || row.identifier || row.name || '').toLowerCase();
    return names.some(n => key.includes(n));
  }) || null;
}

export function registerHealthMetricsRoutes(app) {
  app.get('/api/hs/health/metrics/live', async (req, res) => {
    try {
      const days = Math.max(1, Math.min(Number(req.query.days || 14), 90));
      const [ouraDetails, appleRows] = await Promise.all([
        oura.details({ days }),
        Promise.resolve(appleHealth.history(days)).catch(() => []),
      ]);

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        days,
        oura: ouraDetails,
        appleHealth: {
          configured: appleHealth.isConfigured(),
          rows: appleRows,
          latest: {
            heartRate: latestApple(appleRows, ['heart rate', 'heartrate']),
            restingHeartRate: latestApple(appleRows, ['resting heart rate', 'restingheartrate']),
            hrv: latestApple(appleRows, ['hrv', 'heart rate variability']),
            respiratoryRate: latestApple(appleRows, ['respiratory']),
            steps: latestApple(appleRows, ['steps', 'step count']),
            sleep: latestApple(appleRows, ['sleep']),
            activeEnergy: latestApple(appleRows, ['active energy', 'calories']),
            walkingSpeed: latestApple(appleRows, ['walking speed']),
            weight: latestApple(appleRows, ['weight', 'body mass']),
            vo2Max: latestApple(appleRows, ['vo2']),
          },
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || 'Health metrics unavailable' });
    }
  });
}

export default registerHealthMetricsRoutes;
