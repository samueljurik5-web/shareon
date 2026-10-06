import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../lib/errors.js';

 
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Súbor je príliš veľký.' : 'Súbor sa nepodarilo nahrať.';
    return res.status(400).json({ error: { code: 'UPLOAD_ERROR', message } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Záznam už existuje.' } });
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Neplatný formát požiadavky.' } });
  }
  // Log only safe metadata – never the request body (may contain passwords) or auth headers.
  console.error(`[error] ${req.method} ${req.path}`, err instanceof Error ? err.message : err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Nastala neočakávaná chyba. Skús to znova.' } });
};

export const notFoundHandler = (_req: Request, res: Response) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint neexistuje.' } });
