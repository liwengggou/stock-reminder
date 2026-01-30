import { checkAlerts, isMarketOpen } from '../backend/src/services/priceMonitor.js';
import { initDatabase } from '../backend/src/config/database.js';

let initialized = false;

export default async function handler(req, res) {
  // Verify this is a Vercel cron request (optional security)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    // Allow requests without CRON_SECRET for testing, but log a warning
    console.warn('Cron request without valid authorization');
  }

  try {
    // Initialize database on cold start
    if (!initialized) {
      await initDatabase();
      initialized = true;
    }

    // Check if market is open
    if (!isMarketOpen()) {
      return res.status(200).json({
        success: true,
        message: 'Market is closed, skipping price check',
        timestamp: new Date().toISOString()
      });
    }

    // Run the price check
    await checkAlerts();

    return res.status(200).json({
      success: true,
      message: 'Price check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
