/**
 * Vercel serverless API entry point
 * Mounts all route handlers
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  methods: ['POST', 'OPTIONS', 'GET'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/', function (req, res) {
  res.json({
    status: 'ok',
    service: 'ОфферДоктор API',
    demo_mode: process.env.DEMO_MODE === 'true'
  });
});

app.get('/health', function (req, res) {
  res.json({ status: 'ok', demo_mode: process.env.DEMO_MODE === 'true' });
});

// Mount routes
app.use('/api/analyze', require('./analyze'));
app.use('/api/payment', require('./payment'));

// Debug: list all orders
app.get('/api/debug/orders', async function(req, res) {
  try {
    const supabase = require('./supabase');
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    res.json({ 
      hasSupabaseUrl: hasUrl, 
      hasServiceKey: hasKey,
      envCheck: 'direct check in index.js'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Debug: test env in isolation
app.get('/api/debug/env', function(req, res) {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'NOT PRESENT',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'NOT PRESENT',
    DEMO_MODE: process.env.DEMO_MODE,
    GIGACHAT_MODEL: process.env.GIGACHAT_MODEL
  });
});

module.exports = app;