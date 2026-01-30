import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { alertsAPI, stocksAPI } from '../api/client';
import Layout from '../components/Layout';
import { 
  Bell, Plus, Trash2, TrendingUp, TrendingDown, 
  RefreshCw, AlertCircle, Edit2, Check, X 
} from 'lucide-react';

export default function Dashboard() {
  const [alerts, setAlerts] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  const fetchAlerts = async () => {
    try {
      const response = await alertsAPI.getActive();
      setAlerts(response.data.alerts);
      
      // Fetch current prices for all symbols
      const symbols = [...new Set(response.data.alerts.map(a => a.symbol))];
      if (symbols.length > 0) {
        const priceResponse = await stocksAPI.getPrices(symbols);
        const priceMap = {};
        priceResponse.data.quotes.forEach(q => {
          if (!q.error) priceMap[q.symbol] = q;
        });
        setPrices(priceMap);
      }
    } catch (err) {
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this alert?')) return;
    
    try {
      await alertsAPI.delete(id);
      setAlerts(alerts.filter(a => a.id !== id));
    } catch {
      setError('Failed to delete alert');
    }
  };

  const handleEdit = (alert) => {
    setEditingId(alert.id);
    setEditPrice(alert.target_price);
  };

  const handleSaveEdit = async (id) => {
    try {
      await alertsAPI.update(id, { targetPrice: parseFloat(editPrice) });
      setAlerts(alerts.map(a => 
        a.id === id ? { ...a, target_price: editPrice } : a
      ));
      setEditingId(null);
    } catch {
      setError('Failed to update alert');
    }
  };

  const getAlertStatus = (alert) => {
    const currentPrice = prices[alert.symbol]?.price;
    if (!currentPrice) return 'pending';
    
    const target = parseFloat(alert.target_price);
    const diff = ((currentPrice - target) / target) * 100;
    
    if (alert.alert_type === 'below') {
      if (currentPrice <= target) return 'triggered';
      if (diff < 5) return 'close';
    } else {
      if (currentPrice >= target) return 'triggered';
      if (diff > -5) return 'close';
    }
    return 'pending';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Alerts</h1>
          <p className="text-gray-500">{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/create"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Alert
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts yet</h3>
          <p className="text-gray-500 mb-6">Create your first price alert to get started</p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5" />
            Create Alert
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => {
            const priceData = prices[alert.symbol];
            const status = getAlertStatus(alert);
            
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl border p-5 transition ${
                  status === 'close' ? 'border-yellow-300 bg-yellow-50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-lg ${
                      alert.alert_type === 'above' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {alert.alert_type === 'above' 
                        ? <TrendingUp className="w-6 h-6" />
                        : <TrendingDown className="w-6 h-6" />
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{alert.symbol}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          alert.alert_type === 'above'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {alert.alert_type.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm">{alert.stock_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {editingId !== alert.id && (
                      <>
                        <button
                          onClick={() => handleEdit(alert)}
                          className="p-2 text-gray-400 hover:text-indigo-600 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(alert.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Target Price</p>
                    {editingId === alert.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 border rounded text-lg font-semibold"
                          step="0.01"
                        />
                        <button
                          onClick={() => handleSaveEdit(alert.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-50 rounded"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-lg font-semibold">${parseFloat(alert.target_price).toFixed(2)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Current Price</p>
                    {priceData ? (
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold">${priceData.price?.toFixed(2)}</p>
                        <span className={`text-sm ${
                          priceData.change >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {priceData.change >= 0 ? '+' : ''}{priceData.changePercent?.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-gray-400">Loading...</p>
                    )}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs text-gray-500 uppercase">Distance</p>
                    {priceData && (
                      <p className={`text-lg font-semibold ${
                        status === 'close' ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {alert.alert_type === 'below' 
                          ? `${(((priceData.price - parseFloat(alert.target_price)) / parseFloat(alert.target_price)) * 100).toFixed(1)}%`
                          : `${(((parseFloat(alert.target_price) - priceData.price) / priceData.price) * 100).toFixed(1)}%`
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
