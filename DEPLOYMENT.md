# 🚀 Hostinger VPS Deployment Guide
## M/S Four Star Cargo Operations Management System

This document details step-by-step instructions to deploy the production build of the **Four Star Cargo** system on a Hostinger VPS running Ubuntu/Debian Linux with Node.js, PM2, PostgreSQL/MySQL, Nginx, and Let's Encrypt SSL.

---

## 🛠️ Step 1: Server Environment Setup

1. **Connect to Hostinger VPS via SSH**:
   ```bash
   ssh root@YOUR_HOSTINGER_VPS_IP
   ```

2. **Update System Packages**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Install Node.js (v18 or v20 LTS) & PM2**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs nginx git
   sudo npm install -g pm2
   ```

4. **Verify Installations**:
   ```bash
   node -v
   npm -v
   pm2 -v
   nginx -v
   ```

---

## 🗄️ Step 2: Database Initialization

1. **Install & Start Database Engine**:
   ```bash
   sudo apt install -y postgresql postgresql-contrib
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

2. **Import System Schema**:
   Upload `/database/schema.sql` to `/var/www/fourstarcargo/database/schema.sql` and execute:
   ```bash
   sudo -u postgres psql -d four_star_cargo_db -f /var/www/fourstarcargo/database/schema.sql
   ```

---

## 📁 Step 3: Application Code & Production Build Upload

1. **Create Project Directory**:
   ```bash
   mkdir -p /var/www/fourstarcargo
   cd /var/www/fourstarcargo
   ```

2. **Upload Files or Git Clone**:
   Upload `dist/`, `server.js`, `package.json`, and `ecosystem.config.js` to `/var/www/fourstarcargo`.

3. **Install Production Dependencies**:
   ```bash
   npm install --production
   ```

---

## ⚙️ Step 4: PM2 Process Management

1. **Start Express Server with PM2 Cluster Mode**:
   ```bash
   pm2 start ecosystem.config.js
   ```

2. **Configure PM2 Startup on Server Boot**:
   ```bash
   pm2 startup
   pm2 save
   ```

3. **Check Running Status**:
   ```bash
   pm2 status
   pm2 logs
   ```

---

## 🌐 Step 5: Nginx Reverse Proxy & Let's Encrypt SSL

1. **Copy Nginx Configuration**:
   Copy `nginx.conf` content to `/etc/nginx/sites-available/fourstarcargo`:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/fourstarcargo
   sudo ln -s /etc/nginx/sites-available/fourstarcargo /etc/nginx/sites-enabled/
   ```

2. **Test Nginx Configuration**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **Install Let's Encrypt SSL (HTTPS)**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d fourstarcargo.com -d www.fourstarcargo.com
   ```

---

## ✅ Step 6: Post-Deployment Verification

1. Access **`https://fourstarcargo.com`** in your browser.
2. Verify public tracking page at **`https://fourstarcargo.com/track`**.
3. Log in to each role dashboard (`/admin/login`, `/operations/login`, `/warehouse/login`, `/accounts/login`).
4. Perform end-to-end test: Booking Entry ➡️ Daily Flight Proposal ➡️ Flight Approval ➡️ Transit Receiving ➡️ Customer Delivery & Cash Collection ➡️ Financial Ledger.

---

### 🎉 Production Ready!
For server maintenance or logs:
```bash
pm2 status
pm2 logs four-star-cargo-system
sudo systemctl status nginx
```
