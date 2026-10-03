const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

function installHttpSecurity(app, { env = process.env, limit = 600 } = {}) {
  app.disable('x-powered-by');
  // Do not trust arbitrary X-Forwarded-For values. Behind an unconfigured proxy
  // this is an aggregate safety ceiling, not a per-visitor identity boundary.
  app.set('trust proxy', false);
  app.set('query parser', 'simple');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const origins = new Set(['https://gold-terminal-1.onrender.com',
    ...(env.API_ALLOWED_ORIGINS || env.PUSH_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)]);
  if (env.NODE_ENV !== 'production' && env.RENDER !== 'true') {
    origins.add('http://localhost:5173'); origins.add('http://127.0.0.1:5173');
  }
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('Origin');
    if (origin && !origins.has(origin)) return res.status(403).json({ message: 'Website origin not allowed.' });
    next();
  });
  app.use(cors({ origin: [...origins], methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token'], maxAge: 600 }));
  app.use('/api', rateLimit({ windowMs: 60000, limit,
    standardHeaders: 'draft-8', legacyHeaders: false,
    // Ignore spoofed forwarded headers rather than accepting them as client IDs.
    validate: { xForwardedForHeader: false },
    skip: req => req.path === '/health' || req.path === '/push/run',
    message: { message: 'Too many requests. Please wait a minute and try again.' } }));
}

function safeErrors(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  // Neither error bodies nor stacks are sent back to callers.
  res.status(status).json({ message: status === 413 ? 'Request body is too large.'
    : status === 400 ? 'Invalid JSON request.' : 'Request could not be completed.' });
}
module.exports = { installHttpSecurity, safeErrors };
