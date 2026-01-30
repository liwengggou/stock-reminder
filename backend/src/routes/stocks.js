import express from 'express';
import YahooFinance from 'yahoo-finance2';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const yahooFinance = new YahooFinance();

// Finnhub API fallback
const fetchFromFinnhub = async (symbol) => {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
  );
  const data = await response.json();

  if (data.c && data.c > 0) {
    return {
      symbol: symbol,
      price: data.c,           // Current price
      previousClose: data.pc,   // Previous close
      change: data.d,           // Change
      changePercent: data.dp,   // Change percent
      high: data.h,             // High of day
      low: data.l,              // Low of day
      open: data.o              // Open price
    };
  }
  return null;
};

// All stock routes require authentication
router.use(authMiddleware);

// Search stocks by symbol or name
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 1) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Try to get quote for exact symbol match first
    const upperQuery = q.toUpperCase().trim();
    const stocks = [];
    
    try {
      const quote = await yahooFinance.quote(upperQuery);
      if (quote && quote.symbol) {
        stocks.push({
          symbol: quote.symbol,
          name: quote.shortName || quote.longName || quote.symbol,
          exchange: quote.exchange || 'UNKNOWN',
          type: quote.quoteType || 'EQUITY'
        });
      }
    } catch (quoteErr) {
      // Symbol not found, that's okay
    }
    
    // Add common stocks that match the query as suggestions
    const commonStocks = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'META', name: 'Meta Platforms Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
      { symbol: 'V', name: 'Visa Inc.' },
      { symbol: 'WMT', name: 'Walmart Inc.' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
      { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
    ];
    
    const matches = commonStocks.filter(s => 
      s.symbol.includes(upperQuery) || 
      s.name.toLowerCase().includes(q.toLowerCase())
    );
    
    for (const match of matches) {
      if (!stocks.find(s => s.symbol === match.symbol)) {
        stocks.push({ ...match, exchange: 'NASDAQ', type: 'EQUITY' });
      }
    }

    res.json({ stocks });
  } catch (error) {
    console.error('Stock search error:', error);
    res.status(500).json({ error: 'Failed to search stocks' });
  }
});

// Stock name lookup for Finnhub fallback (Finnhub quote doesn't include name)
const stockNames = {
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
  'QQQ': 'Invesco QQQ Trust',
};

// Get stock price by symbol
router.get('/:symbol/price', async (req, res) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();

    // Try Yahoo Finance first
    try {
      const quote = await yahooFinance.quote(upperSymbol);
      if (quote) {
        return res.json({
          symbol: quote.symbol,
          name: quote.shortName || quote.longName || quote.symbol,
          price: quote.regularMarketPrice,
          previousClose: quote.regularMarketPreviousClose,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          currency: quote.currency || 'USD',
          marketState: quote.marketState,
          updatedAt: quote.regularMarketTime,
          source: 'yahoo'
        });
      }
    } catch (apiError) {
      console.log('Yahoo API error, trying Finnhub:', apiError.message);
    }

    // Fallback to Finnhub
    try {
      const finnhubData = await fetchFromFinnhub(upperSymbol);
      if (finnhubData) {
        return res.json({
          symbol: upperSymbol,
          name: stockNames[upperSymbol] || upperSymbol,
          price: finnhubData.price,
          previousClose: finnhubData.previousClose,
          change: finnhubData.change,
          changePercent: finnhubData.changePercent,
          currency: 'USD',
          marketState: 'REGULAR',
          updatedAt: new Date().toISOString(),
          source: 'finnhub'
        });
      }
    } catch (finnhubError) {
      console.log('Finnhub API error:', finnhubError.message);
    }

    res.status(404).json({ error: 'Stock not found' });
  } catch (error) {
    console.error('Get price error:', error);
    res.status(500).json({ error: 'Failed to get stock price' });
  }
});

// Batch get prices for multiple symbols
router.post('/prices', async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }

    if (symbols.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 symbols per request' });
    }

    const quotes = await Promise.all(
      symbols.map(async (symbol) => {
        const upperSymbol = symbol.toUpperCase();

        // Try Yahoo Finance first
        try {
          const quote = await yahooFinance.quote(upperSymbol);
          return {
            symbol: quote.symbol,
            name: quote.shortName || quote.longName,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            source: 'yahoo'
          };
        } catch {
          // Fallback to Finnhub
          try {
            const finnhubData = await fetchFromFinnhub(upperSymbol);
            if (finnhubData) {
              return {
                symbol: upperSymbol,
                name: stockNames[upperSymbol] || upperSymbol,
                price: finnhubData.price,
                change: finnhubData.change,
                changePercent: finnhubData.changePercent,
                source: 'finnhub'
              };
            }
          } catch {
            // Both APIs failed
          }
          return { symbol: upperSymbol, error: 'Failed to fetch' };
        }
      })
    );

    res.json({ quotes });
  } catch (error) {
    console.error('Batch price error:', error);
    res.status(500).json({ error: 'Failed to get stock prices' });
  }
});

export default router;
