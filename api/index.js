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
app.use(require('./analyze'));
app.use(require('./payment'));

module.exports = app;