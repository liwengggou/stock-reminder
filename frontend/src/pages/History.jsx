import { useState, useEffect } from 'react';
import { alertsAPI } from '../api/client';
import Layout from '../components/Layout';
import { 
  Clock, TrendingUp, TrendingDown, RefreshCw, 
  Bell, CheckCircle 
} from 'lucide-react';

export default function History() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await alertsAPI.getHistory();
        setAlerts(response.data.alerts);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Alert History</h1>
        <p className="text-gray-500">{alerts.length} triggered alert{alerts.length !== 1 ? 's' : ''}</p>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No triggered alerts yet</h3>
          <p className="text-gray-500">When your alerts trigger, they'll appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white rounded-xl border p-5"
            >
              <div className="flex items-start gap-4">
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
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{alert.symbol}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      alert.alert_type === 'above'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {alert.alert_type.toUpperCase()}
                    </span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-gray-500 text-sm">{alert.stock_name}</p>
                  
                  <div className="mt-3 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Target</p>
                      <p className="font-semibold">${parseFloat(alert.target_price).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Triggered At</p>
                      <p className="font-semibold">${parseFloat(alert.triggered_price || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Date</p>
                      <p className="font-semibold text-sm">{formatDate(alert.triggered_at)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  <Bell className="w-4 h-4" />
                  <span className="text-sm font-medium">Sent</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
