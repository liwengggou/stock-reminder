import cron from 'node-cron';
import yahooFinance from 'yahoo-finance2';
import { pool } from '../config/database.js';
import { sendAlertEmail } from '../config/email.js';
import 'dotenv/config';

// Finnhub API fallback for price monitoring
const fetchPriceFromFinnhub = async (symbol) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
    );
    const data = await response.json();
    if (data.c && data.c > 0) {
      return data.c; // Current price
    }
  } catch (error) {
    console.error(`Finnhub error for ${symbol}:`, error.message);
  }
  return null;
};

// Check if market is open (9:30 AM - 4:00 PM ET, Mon-Fri)
const isMarketOpen = () => {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  // Monday = 1, Friday = 5
  const isWeekday = day >= 1 && day <= 5;
  // 9:30 AM = 570 minutes, 4:00 PM = 960 minutes
  const isDuringHours = timeInMinutes >= 570 && timeInMinutes <= 960;
  
  return isWeekday && isDuringHours;
};

// Get all active alerts grouped by symbol
const getActiveAlerts = async () => {
  const [alerts] = await pool.execute(`
    SELECT a.id, a.user_id, a.symbol, a.stock_name, a.alert_type, a.target_price,
           u.email
    FROM alerts a
    JOIN users u ON a.user_id = u.id
    WHERE a.is_triggered = FALSE
  `);
  return alerts;
};

// Check and trigger alerts
const checkAlerts = async () => {
  if (!isMarketOpen()) {
    console.log('Market closed, skipping price check');
    return;
  }

  console.log(`[${new Date().toISOString()}] Starting price check...`);

  try {
    const alerts = await getActiveAlerts();
    
    if (alerts.length === 0) {
      console.log('No active alerts to check');
      return;
    }

    // Get unique symbols
    const symbols = [...new Set(alerts.map(a => a.symbol))];
    console.log(`Checking ${symbols.length} symbols for ${alerts.length} alerts`);

    // Fetch prices in batches to respect rate limits
    const priceMap = new Map();
    const batchSize = 10;

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);

      await Promise.all(batch.map(async (symbol) => {
        let source = null;
        let price = null;
        let errorMsg = null;

        // Try Yahoo Finance first
        try {
          const quote = await yahooFinance.quote(symbol);
          price = quote.regularMarketPrice;
          source = 'yahoo';
          priceMap.set(symbol, price);
        } catch (error) {
          console.log(`Yahoo failed for ${symbol}, trying Finnhub...`);
          errorMsg = `Yahoo: ${error.message}`;
        }

        // Fallback to Finnhub if Yahoo failed
        if (!price) {
          const finnhubPrice = await fetchPriceFromFinnhub(symbol);
          if (finnhubPrice) {
            price = finnhubPrice;
            source = 'finnhub';
            priceMap.set(symbol, price);
            console.log(`Got ${symbol} price from Finnhub: $${price}`);
          } else {
            errorMsg = (errorMsg || '') + ', Finnhub: failed';
          }
        }

        // Log price check result
        try {
          await pool.execute(
            `INSERT INTO price_check_logs (symbol, status, price, source, error_message)
             VALUES (?, ?, ?, ?, ?)`,
            [
              symbol,
              price ? 'success' : 'failed',
              price,
              source,
              price ? null : errorMsg
            ]
          );
        } catch (logError) {
          console.error(`Failed to log price check for ${symbol}:`, logError.message);
        }

        if (!price) {
          console.error(`ALERT: Failed to fetch price for ${symbol} from both sources`);
        }
      }));

      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Check each alert
    for (const alert of alerts) {
      const currentPrice = priceMap.get(alert.symbol);

      if (currentPrice === undefined) {
        // Log that we couldn't check this alert due to missing price
        console.warn(`Skipping alert ${alert.id} (${alert.symbol}): no price data available`);
        continue;
      }

      const shouldTrigger =
        (alert.alert_type === 'below' && currentPrice <= parseFloat(alert.target_price)) ||
        (alert.alert_type === 'above' && currentPrice >= parseFloat(alert.target_price));

      if (shouldTrigger) {
        console.log(`Alert triggered: ${alert.symbol} ${alert.alert_type} $${alert.target_price} (current: $${currentPrice})`);

        // Log email attempt
        let emailLogId = null;
        try {
          const [logResult] = await pool.execute(
            `INSERT INTO email_logs (alert_id, user_id, email_type, status, attempts)
             VALUES (?, ?, 'alert', 'pending', 0)`,
            [alert.id, alert.user_id]
          );
          emailLogId = logResult.insertId;
        } catch (logError) {
          console.error('Failed to create email log:', logError.message);
        }

        // Send email notification FIRST
        let emailSent = false;
        try {
          await sendAlertEmail(alert.email, {
            symbol: alert.symbol,
            stockName: alert.stock_name,
            alertType: alert.alert_type,
            targetPrice: alert.target_price,
            currentPrice: currentPrice,
            triggeredAt: new Date()
          });
          emailSent = true;

          // Update email log to success
          if (emailLogId) {
            await pool.execute(
              `UPDATE email_logs SET status = 'sent', attempts = 1, last_attempt_at = NOW()
               WHERE id = ?`,
              [emailLogId]
            );
          }
        } catch (emailError) {
          console.error(`Failed to send email for alert ${alert.id}:`, emailError.message);

          // Update email log to failed
          if (emailLogId) {
            await pool.execute(
              `UPDATE email_logs SET status = 'failed', attempts = 3, last_attempt_at = NOW(),
               error_message = ? WHERE id = ?`,
              [emailError.message, emailLogId]
            );
          }
        }

        // Only mark alert as triggered if email was sent successfully
        if (emailSent) {
          try {
            await pool.execute(
              `UPDATE alerts
               SET is_triggered = TRUE, triggered_at = NOW(), triggered_price = ?
               WHERE id = ?`,
              [currentPrice, alert.id]
            );
            console.log(`Alert ${alert.id} marked as triggered`);
          } catch (dbError) {
            console.error(`Failed to mark alert ${alert.id} as triggered:`, dbError.message);
          }
        } else {
          console.warn(`Alert ${alert.id} NOT marked as triggered - email failed, will retry next check`);
        }
      }
    }

    console.log('Price check completed');
  } catch (error) {
    console.error('Price monitor error:', error);
  }
};

// Start the price monitoring cron job
const startPriceMonitor = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', checkAlerts);
  console.log('Price monitor started (every 5 minutes)');
  
  // Also run immediately on start if market is open
  if (isMarketOpen()) {
    setTimeout(checkAlerts, 5000);
  }
};

export { startPriceMonitor, checkAlerts, isMarketOpen };
