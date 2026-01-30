import express from 'express';
import cors from 'cors';

import { initDatabase } from '../backend/src/config/database.js';
import { checkAlerts, isMarketOpen } from '../backend/src/services/priceMonitor.js';
import authRoutes from '../backend/src/routes/auth.js';
import stockRoutes from '../backend/src/routes/stocks.js';
import alertRoutes from '../backend/src/routes/alerts.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Health check with debug info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: 'v2-cron',
    timestamp: new Date().toISOString(),
    hasDbUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/alerts', alertRoutes);

// Cron endpoint for Vercel scheduled jobs
app.get('/api/cron', async (req, res) => {
  try {
    if (!isMarketOpen()) {
      return res.status(200).json({
        success: true,
        message: 'Market is closed, skipping price check',
        timestamp: new Date().toISOString()
      });
    }

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
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database on cold start
let initialized = false;
let initError = null;

const initOnce = async () => {
  if (initialized) return;
  if (initError) throw initError;

  try {
    await initDatabase();
    initialized = true;
  } catch (error) {
    initError = error;
    console.error('Database init failed:', error);
    throw error;
  }
};

// Export for Vercel
export default async function handler(req, res) {
  try {
    await initOnce();
    return app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Server initialization failed', message: error.message });
  }
}
