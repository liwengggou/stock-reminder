# Stock Tracker Deployment Guide - Tencent Cloud

This guide walks you through deploying the Stock Tracker application to Tencent Cloud Hong Kong.

## Prerequisites

- Tencent Cloud account with real-name verification
- SSH client (Terminal on Mac/Linux, PuTTY on Windows)

---

## Step 1: Create CVM Instance

1. Go to [Tencent Cloud Console](https://console.cloud.tencent.com/cvm)
2. Click "Create Instance"
3. Configure:
   - **Region**: Hong Kong (ap-hongkong)
   - **Instance Type**: S5.MEDIUM2 (2 vCPU, 4GB RAM) or Lighthouse
   - **Image**: Ubuntu 22.04 LTS
   - **System Disk**: 50GB SSD
   - **Data Disk**: 20GB SSD (optional but recommended)
   - **Network**: Default VPC, assign public IP
   - **Security Group**: Create new or use existing

4. Set root password or SSH key
5. Purchase and wait for instance to start

---

## Step 2: Configure Security Group

Allow these ports:
- **22** (TCP) - SSH
- **80** (TCP) - HTTP
- **443** (TCP) - HTTPS

---

## Step 3: Connect to Server

```bash
ssh root@YOUR_CVM_IP
```

---

## Step 4: Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install other dependencies
apt install -y nginx git sqlite3 certbot python3-certbot-nginx

# Install PM2 globally
npm install -g pm2

# Verify installations
node --version    # Should show v18.x.x
npm --version
nginx -v
pm2 --version
```

---

## Step 5: Upload Application

### Option A: Clone from Git (if repo exists)
```bash
mkdir -p /var/www
cd /var/www
git clone YOUR_REPO_URL stock-tracker
```

### Option B: Upload via SCP (from your local machine)
```bash
# Run this on your LOCAL machine, not the server
cd /Users/liwengou/Desktop
scp -r stock-tracker root@YOUR_CVM_IP:/var/www/
```

---

## Step 6: Install Application Dependencies

```bash
# Backend
cd /var/www/stock-tracker/backend
npm install --production

# Create data directory for SQLite
mkdir -p data

# Frontend
cd /var/www/stock-tracker/frontend
npm install
npm run build
```

---

## Step 7: Configure Environment Variables

```bash
cd /var/www/stock-tracker/backend

# Copy example and edit
cp .env.example .env
nano .env
```

Update these values in `.env`:
```env
NODE_ENV=production

# Generate secure JWT secret (run this command and paste result):
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<paste-generated-secret-here>

# Configure your email (QQ Mail example)
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your-qq-number@qq.com
SMTP_PASS=your-qq-authorization-code
EMAIL_FROM=your-qq-number@qq.com

# Finnhub API key (optional but recommended)
FINNHUB_API_KEY=your-finnhub-api-key
```

---

## Step 8: Configure Nginx

```bash
# Copy the nginx config
cp /var/www/stock-tracker/deploy/nginx.conf /etc/nginx/sites-available/stock-tracker

# Enable the site
ln -s /etc/nginx/sites-available/stock-tracker /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

---

## Step 9: Set Up SSL Certificate

Replace `YOUR_IP` with your actual CVM IP (use dashes instead of dots):

```bash
# Example: If IP is 43.154.123.45, domain is 43-154-123-45.nip.io
certbot --nginx -d YOUR-IP.nip.io

# Follow the prompts:
# - Enter email for renewal notices
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

Certbot will automatically:
- Obtain SSL certificate
- Configure Nginx
- Set up auto-renewal

---

## Step 10: Start Backend with PM2

```bash
cd /var/www/stock-tracker/backend

# Start the application
pm2 start src/index.js --name stock-tracker-api

# Configure PM2 to start on boot
pm2 startup
# Follow the command it outputs (copy/paste and run it)

# Save the process list
pm2 save

# View logs
pm2 logs stock-tracker-api

# View status
pm2 status
```

---

## Step 11: Set Up Database Backup

```bash
# Copy backup script
cp /var/www/stock-tracker/deploy/backup-db.sh /root/
chmod +x /root/backup-db.sh

# Add to crontab (runs daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-db.sh") | crontab -

# Test the backup script
/root/backup-db.sh

# Verify backup was created
ls -la /var/backups/stock-tracker/
```

---

## Step 12: Verify Deployment

Test these URLs (replace with your actual IP):

1. **Frontend**: `https://YOUR-IP.nip.io`
   - Should show the login page

2. **API Health**: `https://YOUR-IP.nip.io/api/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

3. **Test functionality**:
   - Register a new account
   - Check email verification (if SMTP configured)
   - Search for stocks
   - Create a price alert

---

## Useful Commands

### PM2 Commands
```bash
pm2 status              # View process status
pm2 logs                # View logs (Ctrl+C to exit)
pm2 restart all         # Restart application
pm2 reload all          # Zero-downtime reload
pm2 stop all            # Stop application
```

### Nginx Commands
```bash
nginx -t                 # Test configuration
systemctl reload nginx   # Reload config
systemctl restart nginx  # Full restart
tail -f /var/log/nginx/error.log  # View errors
```

### Application Logs
```bash
pm2 logs stock-tracker-api        # Application logs
tail -f /var/log/nginx/access.log # Nginx access logs
tail -f /var/log/nginx/error.log  # Nginx error logs
```

### Database
```bash
# View database
sqlite3 /var/www/stock-tracker/backend/data/stock_tracker.db

# Inside SQLite shell:
.tables                  # List tables
SELECT * FROM users;     # View users
.quit                    # Exit
```

---

## Troubleshooting

### Application won't start
```bash
# Check PM2 logs
pm2 logs stock-tracker-api --lines 50

# Check if port 3001 is in use
lsof -i :3001

# Try running directly to see errors
cd /var/www/stock-tracker/backend
node src/index.js
```

### SSL certificate issues
```bash
# Renew certificate manually
certbot renew --dry-run

# Check certificate status
certbot certificates
```

### Nginx errors
```bash
# Test config
nginx -t

# Check error logs
tail -50 /var/log/nginx/error.log
```

### Stock prices not updating
```bash
# Check if cron job is running (inside PM2)
pm2 logs stock-tracker-api | grep -i price

# Yahoo Finance may be blocked - check Finnhub API key is set
grep FINNHUB /var/www/stock-tracker/backend/.env
```

---

## Updating the Application

```bash
cd /var/www/stock-tracker

# If using git
git pull origin main

# Rebuild frontend
cd frontend
npm install
npm run build

# Update backend dependencies
cd ../backend
npm install --production

# Restart backend
pm2 reload stock-tracker-api

# No need to restart nginx for code changes
```

---

## Cost Summary

| Item | Monthly Cost (CNY) |
|------|-------------------|
| CVM (2C4G Hong Kong) | ~60-80 |
| Bandwidth (3Mbps) | ~30-50 |
| SSL (Let's Encrypt) | Free |
| Domain (nip.io) | Free |
| **Total** | **~90-130** |
