import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { initDatabase } from '../backend/src/config/database.js';
import authRoutes from '../backend/src/routes/auth.js';
import stockRoutes from '../backend/src/routes/stocks.js';
import alertRoutes from '../backend/src/routes/alerts.js';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/alerts', alertRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database on cold start
let initialized = false;
const initOnce = async () => {
  if (!initialized) {
    await initDatabase();
    initialized = true;
  }
};

// Export for Vercel
export default async function handler(req, res) {
  await initOnce();
  return app(req, res);
}
