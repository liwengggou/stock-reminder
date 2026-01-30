import axios from 'axios';

const API_BASE = '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: (email, password) => client.post('/auth/signup', { email, password }),
  login: (email, password) => client.post('/auth/login', { email, password }),
  getMe: () => client.get('/auth/me'),
  forgotPassword: (email) => client.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => client.post('/auth/reset-password', { token, password }),
  verifyEmail: (token) => client.get(`/auth/verify-email/${token}`),
  resendVerification: () => client.post('/auth/resend-verification')
};

// Stocks API
export const stocksAPI = {
  search: (query) => client.get(`/stocks/search?q=${encodeURIComponent(query)}`),
  getPrice: (symbol) => client.get(`/stocks/${symbol}/price`),
  getPrices: (symbols) => client.post('/stocks/prices', { symbols })
};

// Alerts API
export const alertsAPI = {
  getAll: () => client.get('/alerts'),
  getActive: () => client.get('/alerts/active'),
  getHistory: () => client.get('/alerts/history'),
  create: (data) => client.post('/alerts', data),
  update: (id, data) => client.put(`/alerts/${id}`, data),
  delete: (id) => client.delete(`/alerts/${id}`)
};

export default client;
