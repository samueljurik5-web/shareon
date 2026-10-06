import { z } from 'zod';

export const dateOnly = z
  .string({ required_error: 'Dátum je povinný.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dátum musí byť vo formáte RRRR-MM-DD.')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Neplatný dátum.');

/** Euro amount from the client (e.g. "8.50" or 8.5) – max 2 decimals, non-negative. */
export const euroAmount = (label: string, max = 100000) =>
  z.coerce
    .number({ invalid_type_error: `${label} musí byť číslo.` })
    .nonnegative(`${label} nemôže byť záporná.`)
    .max(max, `${label} je príliš vysoká.`)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, `${label} môže mať najviac 2 desatinné miesta.`);

export const rating = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} musí byť číslo.` })
    .int(`${label} musí byť celé číslo.`)
    .min(1, `${label} musí byť od 1 do 5.`)
    .max(5, `${label} musí byť od 1 do 5.`);

/** Only URLs produced by our own storage provider are accepted as references. */
export const uploadedImageUrl = z
  .string()
  .regex(/^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/, 'Neplatný odkaz na fotografiu.');

export const id = z.string().min(1).max(64);

/** Bundled neutral placeholder images (used by seed data). */
export const PLACEHOLDER_IMAGE = /^\/placeholders\/[a-z0-9-]+\.svg$/;

export const itemImageUrl = z
  .string()
  .refine(
    (v) => /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(v) || PLACEHOLDER_IMAGE.test(v),
    'Neplatný odkaz na fotografiu.',
  );
