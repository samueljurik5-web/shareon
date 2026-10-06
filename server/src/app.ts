import express from 'express';
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

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

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
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
};
