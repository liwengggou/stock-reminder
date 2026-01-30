# Stock Price Alert Tracker

A web application for monitoring US stock prices and receiving email notifications when stocks reach your target prices.

## Features

- **User Authentication** - Email/password signup and login with JWT
- **Stock Search** - Search US stocks and ETFs by symbol or company name
- **Price Alerts** - Create "above" or "below" price alerts
- **Email Notifications** - Automatic email when alerts trigger
- **Alert Management** - View, edit, and delete your alerts
- **Alert History** - Track past triggered alerts

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: MySQL
- **Stock Data**: yahoo-finance2
- **Email**: Nodemailer (Tencent Cloud SES)

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+

### 1. Clone and Install

```bash
# Backend
cd backend
cp .env.example .env
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Edit `backend/.env`:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=stock_tracker

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-key

# Email (Tencent Cloud SES)
SMTP_HOST=smtp.qcloudmail.com
SMTP_PORT=465
SMTP_USER=your-username
SMTP_PASS=your-password
EMAIL_FROM=alerts@yourdomain.com
```

### 3. Create Database

```sql
CREATE DATABASE stock_tracker;
```

Tables are created automatically on first run.

### 4. Start Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Stocks
- `GET /api/stocks/search?q=AAPL` - Search stocks
- `GET /api/stocks/:symbol/price` - Get stock price
- `POST /api/stocks/prices` - Batch get prices

### Alerts
- `GET /api/alerts` - Get all alerts
- `GET /api/alerts/active` - Get active alerts
- `GET /api/alerts/history` - Get triggered alerts
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

## Price Monitoring

The backend runs a cron job every 5 minutes during US market hours (9:30 AM - 4:00 PM ET, Mon-Fri) to check active alerts against current prices.

## Deployment

See `PRD.md` for detailed deployment instructions to Tencent Cloud.

## License

MIT
