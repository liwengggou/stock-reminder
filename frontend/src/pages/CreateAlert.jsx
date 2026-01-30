import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stocksAPI, alertsAPI } from '../api/client';
import Layout from '../components/Layout';
import { 
  Search, TrendingUp, TrendingDown, AlertCircle, 
  Check, DollarSign, ArrowLeft 
} from 'lucide-react';

export default function CreateAlert() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockPrice, setStockPrice] = useState(null);
  const [alertType, setAlertType] = useState('below');
  const [targetPrice, setTargetPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await stocksAPI.search(query);
      setSearchResults(response.data.stocks.slice(0, 10));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectStock = async (stock) => {
    setSelectedStock(stock);
    setSearchQuery('');
    setSearchResults([]);
    setError('');

    try {
      const response = await stocksAPI.getPrice(stock.symbol);
      setStockPrice(response.data);
      setTargetPrice(response.data.price?.toFixed(2) || '');
    } catch {
      setError('Failed to fetch stock price');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStock || !targetPrice) return;

    setSubmitting(true);
    setError('');

    try {
      await alertsAPI.create({
        symbol: selectedStock.symbol,
        alertType,
        targetPrice: parseFloat(targetPrice)
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Price Alert</h1>
        <p className="text-gray-500 mb-8">Get notified when a stock reaches your target price</p>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Stock Search */}
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">1. Select Stock</h2>
          
          {selectedStock ? (
            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
              <div>
                <p className="font-bold text-lg">{selectedStock.symbol}</p>
                <p className="text-gray-600">{selectedStock.name}</p>
              </div>
              <div className="text-right">
                {stockPrice && (
                  <>
                    <p className="font-bold text-xl">${stockPrice.price?.toFixed(2)}</p>
                    <p className={`text-sm ${stockPrice.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stockPrice.change >= 0 ? '+' : ''}{stockPrice.changePercent?.toFixed(2)}%
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedStock(null);
                  setStockPrice(null);
                }}
                className="ml-4 text-indigo-600 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by symbol or company name (e.g., AAPL, Apple)"
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  {searchResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleSelectStock(stock)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center border-b last:border-0"
                    >
                      <div>
                        <span className="font-medium">{stock.symbol}</span>
                        <span className="text-gray-500 ml-2">{stock.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">{stock.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {searching && (
                <p className="absolute top-full left-0 mt-1 text-gray-500 text-sm">Searching...</p>
              )}
            </div>
          )}
        </div>

        {/* Alert Configuration */}
        {selectedStock && (
          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-xl border p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">2. Set Alert Condition</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setAlertType('below')}
                  className={`p-4 rounded-lg border-2 flex items-center gap-3 transition ${
                    alertType === 'below'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${alertType === 'below' ? 'bg-red-100' : 'bg-gray-100'}`}>
                    <TrendingDown className={`w-5 h-5 ${alertType === 'below' ? 'text-red-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Below Price</p>
                    <p className="text-sm text-gray-500">Notify when price drops</p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setAlertType('above')}
                  className={`p-4 rounded-lg border-2 flex items-center gap-3 transition ${
                    alertType === 'above'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${alertType === 'above' ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <TrendingUp className={`w-5 h-5 ${alertType === 'above' ? 'text-green-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Above Price</p>
                    <p className="text-sm text-gray-500">Notify when price rises</p>
                  </div>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Price (USD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    step="0.01"
                    min="0.01"
                    required
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                    placeholder="0.00"
                  />
                </div>
                {stockPrice && targetPrice && (
                  <p className="mt-2 text-sm text-gray-500">
                    {alertType === 'below' 
                      ? `Alert when ${selectedStock.symbol} drops ${((1 - parseFloat(targetPrice) / stockPrice.price) * 100).toFixed(1)}% from current price`
                      : `Alert when ${selectedStock.symbol} rises ${((parseFloat(targetPrice) / stockPrice.price - 1) * 100).toFixed(1)}% from current price`
                    }
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !targetPrice}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-xl font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-5 h-5" />
              {submitting ? 'Creating...' : 'Create Alert'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}
