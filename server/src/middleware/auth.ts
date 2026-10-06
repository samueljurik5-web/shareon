import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

interface TokenPayload {
  sub: string;
  tv: number;
}

export const signToken = (user: Pick<User, 'id' | 'tokenVersion'>): string =>
  jwt.sign({ sub: user.id, tv: user.tokenVersion } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });

const readToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
};

const resolveUser = async (token: string): Promise<User | null> => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as TokenPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) return null;
    return user;
  } catch {
    return null;
  }
};

/** Attaches req.user when a valid token is present; never fails. */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token = readToken(req);
  if (token) {
    const user = await resolveUser(token);
    if (user) req.user = user;
  }
  next();
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  const user = await resolveUser(token);
  if (!user) return next(unauthorized('Prihlásenie vypršalo alebo je neplatné. Prihlás sa znova.'));
  req.user = user;
  next();
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'ADMIN') return next(forbidden());
  next();
};

/** Helper for handlers that ran behind requireAuth. */
export const currentUser = (req: Request): User => {
  if (!req.user) throw unauthorized();
  return req.user;
};
