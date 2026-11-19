import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { eventsLimiter, launchFormLimiter } from '../middleware/rateLimit.js';
import { DISTRICT_NAMES } from '../lib/districts.js';
import { CLIENT_EVENTS, trackEvent } from '../services/events.js';
import { notifyOperator } from '../services/mail.js';

/** Launch / demand validation: waitlist, "Čo hľadáš", anonymous funnel events. */
const router = Router();

const email = z.string().trim().toLowerCase().email('Zadaj platný e-mail.').max(160);
const district = z
  .enum(DISTRICT_NAMES, { errorMap: () => ({ message: 'Vyber mestskú časť zo zoznamu.' }) })
  .nullable()
  .optional();
const consent = z.literal(true, { errorMap: () => ({ message: 'Potvrď, že ťa môžeme kontaktovať.' }) });

const waitlistSchema = z.object({
  email,
  role: z.enum(['BORROW', 'LEND', 'BOTH'], { errorMap: () => ({ message: 'Vyber, či chceš požičiavať alebo si požičať.' }) }),
  city: z.string().trim().max(80, 'Názov mesta je príliš dlhý.').optional().nullable(),
  wish: z.string().trim().max(300, 'Text je príliš dlhý (max. 300 znakov).').optional().nullable(),
  district,
  consent,
});

const ROLE_TEXT = { BORROW: 'chce si požičiavať', LEND: 'chce požičiavať svoje veci', BOTH: 'oboje' } as const;

/** "Chcem byť medzi prvými" – one row per e-mail; signing up again updates the choice. */
router.post('/waitlist', launchFormLimiter, optionalAuth, async (req, res) => {
  const data = parseBody(waitlistSchema, req);
  const existing = await prisma.waitlistSignup.findUnique({ where: { email: data.email } });
  await prisma.waitlistSignup.upsert({
    where: { email: data.email },
    create: { email: data.email, role: data.role, city: data.city || null, wish: data.wish || null, district: data.district ?? null, userId: req.user?.id ?? null },
    update: { role: data.role, city: data.city || null, wish: data.wish || null, district: data.district ?? null },
  });
  if (!existing) await trackEvent('waitlist');
  notifyOperator(existing ? 'záujemca aktualizoval zápis' : 'nový záujemca v zozname', [
    ['E-mail', data.email],
    ['Záujem', ROLE_TEXT[data.role]],
    ['Mesto', data.city],
    ['Mestská časť', data.district],
    ['Chce si požičať', data.wish],
  ]);
  res.status(existing ? 200 : 201).json({ ok: true, alreadySignedUp: Boolean(existing) });
});

const demandSchema = z
  .object({
    what: z.string({ required_error: 'Napíš, čo hľadáš.' }).trim().min(3, 'Napíš aspoň 3 znaky.').max(200, 'Text je príliš dlhý.'),
    email: email.optional().nullable(),
    district,
    consent: z.boolean().optional(),
  })
  .refine((d) => !d.email || d.consent === true, { message: 'Potvrď, že ťa môžeme kontaktovať.', path: ['consent'] });

/** "Daj nám vedieť, čo hľadáš" – demand for things nobody offers yet (e-mail optional). */
router.post('/demand', launchFormLimiter, optionalAuth, async (req, res) => {
  const data = parseBody(demandSchema, req);
  await prisma.demandRequest.create({
    data: { what: data.what, email: data.email || null, district: data.district ?? null, userId: req.user?.id ?? null },
  });
  await trackEvent('demand');
  notifyOperator(`niekto hľadá: ${data.what.slice(0, 60)}`, [
    ['Hľadá', data.what],
    ['E-mail', data.email],
    ['Mestská časť', data.district],
  ]);
  res.status(201).json({ ok: true });
});

const eventSchema = z.object({ name: z.enum(CLIENT_EVENTS) });

/** Anonymous page-view / click counter (no cookies, no identifiers). */
router.post('/events', eventsLimiter, async (req, res) => {
  const { name } = parseBody(eventSchema, req);
  await trackEvent(name);
  res.status(204).end();
});

export default router;
