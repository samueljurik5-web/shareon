import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { uploadDir } from './services/storage/index.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import itemRoutes from './routes/items.js';
import rentalRoutes from './routes/rentals.js';
import protectionRoutes from './routes/protection.js';
import depositRoutes from './routes/deposits.js';
import reviewRoutes from './routes/reviews.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/uploads.js';
import notificationRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import pricingRoutes from './routes/pricing.js';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'blob:'],
          'connect-src': ["'self'"],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
        },
      },
    }),
  );

  const allowed = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow same-origin / non-browser requests (no Origin header) and explicitly allowed origins only.
        if (!origin || allowed.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  // Uploaded images – served as static files; nosniff is set by helmet.
  app.use(
    '/uploads',
    express.static(uploadDir, {
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'"),
    }),
  );

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/rental-requests', rentalRoutes);
  app.use('/api/protection', protectionRoutes);
  app.use('/api/deposits', depositRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/pricing', pricingRoutes);
  app.use('/api', notFoundHandler);

  // Optional: serve the built React app from the same origin (single-service hosting, no CORS needed).
  if (env.CLIENT_DIST_DIR) {
    const clientDir = path.resolve(process.cwd(), env.CLIENT_DIST_DIR);
    const indexHtml = path.join(clientDir, 'index.html');
    if (existsSync(indexHtml)) {
      app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
      // SPA fallback for client-side routes (everything except /api and /uploads).
      app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(indexHtml));
    } else {
      console.warn(`[client] CLIENT_DIST_DIR set but ${indexHtml} not found – frontend not served`);
    }
  }

  app.use(errorHandler);
  return app;
};
