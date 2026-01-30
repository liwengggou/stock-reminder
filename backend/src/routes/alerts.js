import express from 'express';
import yahooFinance from 'yahoo-finance2';
import { pool } from '../config/database.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// All alert routes require authentication
router.use(authMiddleware);

const MAX_ALERTS_PER_USER = 50;

// Get all alerts for current user
router.get('/', async (req, res) => {
  try {
    const [alerts] = await pool.execute(
      `SELECT id, symbol, stock_name, alert_type, target_price, 
              is_triggered, triggered_at, triggered_price, created_at 
       FROM alerts 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json({ alerts });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Get active alerts only
router.get('/active', async (req, res) => {
  try {
    const [alerts] = await pool.execute(
      `SELECT id, symbol, stock_name, alert_type, target_price, created_at 
       FROM alerts 
       WHERE user_id = ? AND is_triggered = FALSE 
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json({ alerts });
  } catch (error) {
    console.error('Get active alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Get triggered alerts (history)
router.get('/history', async (req, res) => {
  try {
    const [alerts] = await pool.execute(
      `SELECT id, symbol, stock_name, alert_type, target_price, 
              triggered_at, triggered_price, created_at 
       FROM alerts 
       WHERE user_id = ? AND is_triggered = TRUE 
       ORDER BY triggered_at DESC`,
      [req.user.userId]
    );

    res.json({ alerts });
  } catch (error) {
    console.error('Get alert history error:', error);
    res.status(500).json({ error: 'Failed to get alert history' });
  }
});

// Create new alert
router.post('/', async (req, res) => {
  try {
    const { symbol, alertType, targetPrice } = req.body;

    // Validation
    if (!symbol || !alertType || targetPrice === undefined) {
      return res.status(400).json({
        error: 'Symbol, alertType, and targetPrice are required'
      });
    }

    // Validate symbol format (1-5 letters, optionally with a dot for class shares like BRK.A)
    const symbolRegex = /^[A-Za-z]{1,5}(\.[A-Za-z])?$/;
    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid stock symbol format' });
    }

    if (!['below', 'above'].includes(alertType)) {
      return res.status(400).json({ error: 'alertType must be "below" or "above"' });
    }

    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'targetPrice must be a positive number' });
    }

    // Check user alert limit
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM alerts WHERE user_id = ? AND is_triggered = FALSE',
      [req.user.userId]
    );

    if (countResult[0].count >= MAX_ALERTS_PER_USER) {
      return res.status(400).json({ 
        error: `Maximum ${MAX_ALERTS_PER_USER} active alerts allowed` 
      });
    }

    // Validate stock symbol exists
    let stockName;
    const upperSymbol = symbol.toUpperCase();
    
    // Known stocks fallback for when Yahoo API is rate-limited
    const knownStocks = {
      'AAPL': 'Apple Inc.',
      'MSFT': 'Microsoft Corporation',
      'GOOGL': 'Alphabet Inc.',
      'AMZN': 'Amazon.com Inc.',
      'TSLA': 'Tesla Inc.',
      'META': 'Meta Platforms Inc.',
      'NVDA': 'NVIDIA Corporation',
      'JPM': 'JPMorgan Chase & Co.',
      'V': 'Visa Inc.',
      'WMT': 'Walmart Inc.',
      'SPY': 'SPDR S&P 500 ETF',
      'QQQ': 'Invesco QQQ Trust'
    };
    
    try {
      const quote = await yahooFinance.quote(upperSymbol);
      stockName = quote.shortName || quote.longName || symbol;
    } catch {
      // Fallback to known stocks if API fails
      if (knownStocks[upperSymbol]) {
        stockName = knownStocks[upperSymbol];
      } else {
        return res.status(400).json({ error: 'Invalid stock symbol' });
      }
    }

    // Create alert
    const [result] = await pool.execute(
      `INSERT INTO alerts (user_id, symbol, stock_name, alert_type, target_price) 
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.userId, symbol.toUpperCase(), stockName, alertType, price]
    );

    res.status(201).json({
      message: 'Alert created successfully',
      alert: {
        id: result.insertId,
        symbol: symbol.toUpperCase(),
        stockName,
        alertType,
        targetPrice: price
      }
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Update alert
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetPrice, alertType } = req.body;

    // Check ownership
    const [existing] = await pool.execute(
      'SELECT id, is_triggered FROM alerts WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (existing[0].is_triggered) {
      return res.status(400).json({ error: 'Cannot update triggered alert' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (targetPrice !== undefined) {
      const price = parseFloat(targetPrice);
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'targetPrice must be a positive number' });
      }
      updates.push('target_price = ?');
      values.push(price);
    }

    if (alertType !== undefined) {
      if (!['below', 'above'].includes(alertType)) {
        return res.status(400).json({ error: 'alertType must be "below" or "above"' });
      }
      updates.push('alert_type = ?');
      values.push(alertType);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id);
    await pool.execute(
      `UPDATE alerts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Alert updated successfully' });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Delete alert
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM alerts WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
