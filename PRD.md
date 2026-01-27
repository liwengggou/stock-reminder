# Product Requirements Document (PRD)
## Stock Price Alert Website

**Version**: 1.0
**Date**: January 27, 2026
**Author**: Product Team

---

## 1. Overview

### 1.1 Product Summary
A web application that enables users to set price alerts for US stocks and ETFs. When a stock price crosses a user-defined threshold, the system automatically sends an email notification advising the user to consider selling.

### 1.2 Target Users
- Chinese mainland users who invest in US stock markets
- Individual investors who want automated price monitoring
- Users who cannot constantly watch market prices

### 1.3 Problem Statement
Individual investors often miss optimal selling opportunities because they cannot monitor stock prices throughout the trading day. This leads to missed profits or increased losses when prices move unexpectedly.

### 1.4 Solution
Provide an automated alert system that monitors US stock/ETF prices and notifies users via email when their predefined price thresholds are reached.

---

## 2. Goals and Success Metrics

### 2.1 Business Goals
- Provide a reliable price alert service for personal use
- Support < 100 users initially
- Maintain low operational costs (~100-150 CNY/month)

### 2.2 Success Metrics
| Metric | Target |
|--------|--------|
| Alert delivery rate | > 99% |
| Email delivery latency | < 5 minutes after trigger |
| System uptime | > 99% during market hours |
| Price data freshness | < 15 minutes delay |

---

## 3. User Stories

### 3.1 Authentication
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-1 | New user | Sign up with email and password | I can create an account |
| US-2 | Registered user | Log in to my account | I can access my alerts |
| US-3 | Logged-in user | Log out securely | My account stays protected |

### 3.2 Stock Search
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-4 | User | Search for stocks by symbol (e.g., "AAPL") | I can find specific stocks |
| US-5 | User | Search for stocks by name (e.g., "Apple") | I can find stocks even if I don't know the symbol |
| US-6 | User | See the current price of a stock | I can decide on alert thresholds |

### 3.3 Alert Management
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-7 | User | Create a "below price" alert | I'm notified when a stock drops to my target |
| US-8 | User | Create an "above price" alert | I'm notified when a stock rises to my target |
| US-9 | User | View all my active alerts | I can manage my watchlist |
| US-10 | User | Edit an existing alert | I can adjust my target price |
| US-11 | User | Delete an alert | I can remove alerts I no longer need |
| US-12 | User | View triggered alert history | I can see past notifications |

### 3.4 Notifications
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-13 | User | Receive an email when my alert triggers | I can take action on my investment |
| US-14 | User | See stock details in the notification | I have context without logging in |

---

## 4. Functional Requirements

### 4.1 Authentication System

**FR-1: User Registration**
- Accept email and password
- Validate email format
- Require password minimum 8 characters
- Hash passwords before storage (bcrypt)
- Prevent duplicate email registration

**FR-2: User Login**
- Authenticate with email and password
- Issue JWT token on successful login
- Token expires after 7 days

**FR-3: Session Management**
- Validate JWT on protected routes
- Return 401 for invalid/expired tokens

### 4.2 Stock Search System

**FR-4: Stock Search**
- Search US stocks and ETFs by symbol or company name
- Return results with: symbol, company name, current price
- Support NYSE and NASDAQ listed securities
- Limit search results to 20 items

**FR-5: Price Display**
- Show prices with 15-minute delay (free API limitation)
- Display price currency (USD)
- Show price change from previous close

### 4.3 Alert System

**FR-6: Alert Creation**
- Required fields: stock symbol, alert type (below/above), target price
- Validate target price is positive number
- Validate stock symbol exists
- Limit: 50 alerts per user

**FR-7: Alert Monitoring**
- Check prices every 5-10 minutes during US market hours
- Market hours: 9:30 AM - 4:00 PM Eastern Time
- Compare current price against all active alert thresholds
- Trigger alert when condition is met

**FR-8: Alert Trigger Logic**
- "Below" alert: triggers when current price ≤ target price
- "Above" alert: triggers when current price ≥ target price
- Mark alert as triggered after notification sent
- Prevent duplicate notifications for same alert

### 4.4 Email Notification System

**FR-9: Alert Email**
- Send email within 5 minutes of alert trigger
- Email content includes:
  - Stock symbol and name
  - Alert type (below/above)
  - Target price set by user
  - Current price at trigger time
  - Timestamp
  - Recommendation to review position

**FR-10: Email Delivery**
- Use Tencent Cloud SES
- Retry failed deliveries up to 3 times
- Log delivery status

---

## 5. Non-Functional Requirements

### 5.1 Performance
| Requirement | Specification |
|-------------|---------------|
| Page load time | < 3 seconds |
| API response time | < 500ms |
| Concurrent users | Support up to 100 |
| Price check cycle | Every 5-10 minutes |

### 5.2 Security
- Passwords hashed with bcrypt (cost factor 10)
- JWT tokens for authentication
- HTTPS only (TLS 1.2+)
- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization)
- Rate limiting on auth endpoints (10 requests/minute)

### 5.3 Reliability
- 99% uptime during US market hours
- Automated restart on crash (PM2)
- Database backups daily

### 5.4 Scalability
- Designed for < 100 users initially
- Can scale horizontally if needed
- Rate limit aware (Yahoo Finance ~360 req/hr)

---

## 6. Technical Architecture

### 6.1 Tech Stack
| Component | Technology |
|-----------|------------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | MySQL (TencentDB) |
| Stock Data | yahoo-finance2 (unofficial API) |
| Email | Tencent Cloud SES |
| Hosting | Tencent Cloud Lighthouse (Hong Kong) |

### 6.2 System Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│  Express API    │────▶│     MySQL       │
│   (Frontend)    │     │   (Backend)     │     │   (Database)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Yahoo    │ │ Tencent  │ │ Cron     │
              │ Finance  │ │ SES      │ │ Scheduler│
              └──────────┘ └──────────┘ └──────────┘
```

### 6.3 Database Schema

**Users Table**
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP |

**Alerts Table**
| Column | Type | Constraints |
|--------|------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT |
| user_id | INT | FOREIGN KEY → users.id |
| symbol | VARCHAR(10) | NOT NULL |
| stock_name | VARCHAR(100) | |
| alert_type | ENUM('below', 'above') | NOT NULL |
| target_price | DECIMAL(10, 2) | NOT NULL |
| is_triggered | BOOLEAN | DEFAULT FALSE |
| triggered_at | TIMESTAMP | NULL |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### 6.4 API Endpoints

**Authentication**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Register new user |
| POST | /api/auth/login | Login, return JWT |
| POST | /api/auth/logout | Invalidate session |

**Stocks**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/stocks/search?q={query} | Search stocks |
| GET | /api/stocks/:symbol/price | Get current price |

**Alerts**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/alerts | Get user's alerts |
| POST | /api/alerts | Create new alert |
| PUT | /api/alerts/:id | Update alert |
| DELETE | /api/alerts/:id | Delete alert |

---

## 7. User Interface

### 7.1 Pages
1. **Login Page** - Email/password form
2. **Signup Page** - Registration form
3. **Dashboard** - List of user's alerts with current prices
4. **Create Alert** - Stock search + alert form
5. **Alert History** - Past triggered alerts

### 7.2 Key UI Components
- Stock search autocomplete
- Alert card (showing symbol, target, current price, status)
- Price badge (green for up, red for down)
- Alert form (stock selector, type toggle, price input)

---

## 8. Constraints and Limitations

### 8.1 Known Limitations
| Limitation | Impact | Mitigation |
|------------|--------|------------|
| 15-minute price delay | Alerts may trigger late | Document in UI, use free tier |
| Yahoo Finance rate limit (~360/hr) | Limited symbols per check | Batch requests, cache prices |
| Unofficial stock API | May break without notice | Monitor for failures, plan backup |
| No real-time WebSocket | Not instant notifications | Check every 5-10 minutes |

### 8.2 Out of Scope (v1)
- Mobile app
- SMS notifications
- Multiple notification channels
- Portfolio tracking
- Buy alerts (only sell alerts)
- Pre-market/after-hours prices
- Options and futures
- Non-US markets

---

## 9. Deployment

### 9.1 Infrastructure
- **Region**: Tencent Cloud Hong Kong (no ICP required)
- **Server**: Lighthouse 2C2G instance
- **Database**: TencentDB MySQL
- **Domain**: User's choice of registrar

### 9.2 Estimated Monthly Costs
| Service | Cost (CNY) |
|---------|------------|
| Lighthouse (2C2G) | 40-60 |
| TencentDB MySQL | 30-50 |
| Domain | ~50/year |
| Email SES | Free (1000/month) |
| **Total** | **~100-150/month** |

---

## 10. Release Plan

### Phase 1: MVP
- User authentication (signup/login)
- Stock search
- Create/view/delete alerts
- Email notifications
- Deploy to Tencent Cloud HK

### Phase 2: Enhancements (Future)
- Alert edit functionality
- Alert history page
- Email preferences
- Multiple alerts per stock
- Password reset

---

## 11. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Yahoo Finance API blocked | Medium | High | Monitor, prepare Alpha Vantage backup |
| Email marked as spam | Medium | Medium | Proper SPF/DKIM setup, user whitelist |
| Database failure | Low | High | Daily backups, TencentDB reliability |
| Rate limit exceeded | Medium | Medium | Aggressive caching, batch requests |

---

## 12. Appendix

### A. Glossary
- **Alert**: A user-defined price threshold for a stock
- **Trigger**: When current price meets alert condition
- **Symbol**: Stock ticker (e.g., AAPL, MSFT)
- **ETF**: Exchange-Traded Fund

### B. References
- [yahoo-finance2 npm package](https://www.npmjs.com/package/yahoo-finance2)
- [Tencent Cloud SES Documentation](https://cloud.tencent.com/document/product/1288)
- [US Market Hours](https://www.nyse.com/markets/hours-calendars)
