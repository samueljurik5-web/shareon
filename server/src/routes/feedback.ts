import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { feedbackLimiter } from '../middleware/rateLimit.js';
import { trackEvent } from '../services/events.js';
import { notifyOperator } from '../services/mail.js';

const router = Router();

const feedbackSchema = z.object({
  type: z.enum(['LIKE', 'BUG', 'FEATURE', 'TESTER'], { errorMap: () => ({ message: 'Vyber typ spätnej väzby.' }) }),
  contact: z.string().trim().max(120, 'Meno alebo e-mail je príliš dlhé.').optional().nullable(),
  message: z
    .string({ required_error: 'Napíš nám správu.' })
    .trim()
    .min(5, 'Správa musí mať aspoň 5 znakov.')
    .max(2000, 'Správa je príliš dlhá (max. 2000 znakov).'),
});

/** Public feedback from the home page – anonymous or signed in; only admins can read it. */
router.post('/', feedbackLimiter, optionalAuth, async (req, res) => {
  const data = parseBody(feedbackSchema, req);
  const feedback = await prisma.feedback.create({
    data: { type: data.type, contact: data.contact || null, message: data.message, userId: req.user?.id ?? null },
  });
  await trackEvent('feedback');
  const TYPE_TEXT = { LIKE: 'Páči sa mi to', BUG: 'Niečo nefunguje', FEATURE: 'Chýba mi funkcia', TESTER: 'Chcem pomôcť testovať' } as const;
  notifyOperator(`spätná väzba – ${TYPE_TEXT[data.type]}`, [
    ['Typ', TYPE_TEXT[data.type]],
    ['Správa', data.message],
    ['Kontakt', data.contact],
    ['Účet', req.user?.email],
  ]);
  res.status(201).json({ feedback: { id: feedback.id } });
});

export default router;
