import type { Request } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { badRequest } from '../lib/errors.js';

const format = (error: z.ZodError) =>
  error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));

export const parseBody = <T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) throw badRequest('Skontroluj zadané údaje.', format(result.error));
  return result.data;
};

export const parseQuery = <T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> => {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) throw badRequest('Neplatné parametre vyhľadávania.', format(result.error));
  return result.data;
};
