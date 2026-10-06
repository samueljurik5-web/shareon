import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

const passthrough: RequestHandler = (_req, _res, next) => next();

const make = (windowMs: number, limit: number): RequestHandler =>
  env.RATE_LIMIT_ENABLED
    ? rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: { code: 'RATE_LIMITED', message: 'Príliš veľa požiadaviek. Skús to o chvíľu.' } },
      })
    : passthrough;

export const apiLimiter = make(15 * 60 * 1000, 600);
export const authLimiter = make(15 * 60 * 1000, 20);
export const uploadLimiter = make(15 * 60 * 1000, 60);
