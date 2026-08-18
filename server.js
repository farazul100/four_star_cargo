/**
 * M/S FOUR STAR CARGO — HOSTINGER VPS EXPRESS BACKEND SERVER
 * Target Deployment: Hostinger VPS (Node.js + PM2 + Nginx)
 * Local Dev: Runs on port 5000 or alongside Vite frontend
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'M/S Four Star Cargo API',
    vps_target: 'Hostinger VPS (Node.js + PM2 + Nginx)',
    timestamp: new Date().toISOString(),
  });
});

// Database API routes placeholder for Hostinger VPS deployment
app.get('/api/warehouses', (req, res) => {
  res.json({ success: true, data: [] });
});

app.get('/api/cartons', (req, res) => {
  res.json({ success: true, data: [] });
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(process.cwd() + '/dist/index.html');
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Four Star Cargo VPS Server running on port ${PORT}`);
});
