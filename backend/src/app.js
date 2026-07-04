'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { errorHandler } = require('./middleware/error.middleware');
const { sendError } = require('./utils/response.utils');

const authRoutes      = require('./routes/auth.routes');
const resumeRoutes    = require('./routes/resume.routes');
const portfolioRoutes = require('./routes/portfolio.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();

// Behind a reverse proxy (nginx / Render / Railway) the client IP arrives in
// X-Forwarded-For; without this, rate limiting keys every request to the proxy IP.
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── Security headers ──────────────────────────────────────────────────────────
// CSP is tuned for the static frontend served below: Google Fonts + cdnjs
// (pdf.js / mammoth loaded on demand) + the GitHub API.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.github.com', 'https://cdnjs.cloudflare.com'],
        workerSrc: ["'self'", 'blob:', 'https://cdnjs.cloudflare.com'],
      },
    },
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Bearer tokens travel in the Authorization header, so credentials are not
// needed; an explicit origin allowlist replaces the previous '*' + credentials
// combination (which browsers reject outright).
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);

// ── Static frontend ───────────────────────────────────────────────────────────
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR, { extensions: ['html'], maxAge: '1h', index: 'index.html' }));

// Pretty public-portfolio URLs: /p/john-doe → portfolio.html (slug read client-side)
app.get('/p/:slug', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'portfolio.html'));
});

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiters (API only — static assets are exempt) ──────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
});

app.use('/api', generalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/resume',    resumeRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
