const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const { xssClean } = require('../middlewares');
app.use(xssClean);

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use(generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/orders/create', orderLimiter);

app.get('/api/health', async (req, res) => {
  const prisma = require('../db');
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[HEALTH]', err.message);
    res.status(503).json({ status: 'degraded', database: 'error' });
  }
});

app.use('/api', require('../routes'));

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message || err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error') });
});

module.exports = app;
