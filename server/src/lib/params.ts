import type { Request } from 'express';

/** Route parameter as a string (Express 5 types params loosely when several handlers are chained). */
export const param = (req: Request, name: string): string => {
  const v = (req.params as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(v) ? v[0] : (v ?? '');
};
