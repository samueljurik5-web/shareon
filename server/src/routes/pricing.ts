import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { rentalPeriodFields } from '../lib/validation.js';
import { quoteRental } from '../services/rentals.js';
import { describePeriod } from '../services/periodText.js';
import { DEMO_LABEL, DEMO_NOTICE_SK, PROTECTION_NOTICE_SK } from '../services/protection/index.js';

const router = Router();

const quoteSchema = z.object({ itemId: z.string().min(1).max(64), ...rentalPeriodFields }).strip();

/**
 * POST /api/pricing/quote – validates availability (mode, hours, min/max, overlaps incl. buffer)
 * and returns the full server-side price breakdown. Read-only: never creates a rental request.
 */
router.post('/quote', optionalAuth, async (req, res) => {
  const data = parseBody(quoteSchema, req);
  const item = await prisma.item.findUnique({ where: { id: data.itemId }, include: { owner: { select: { isActive: true } } } });
  if (!item || !item.isActive) throw notFound('Predmet sa nenašiel.');
  const { period, price } = await quoteRental(item, data, req.user?.id ?? null);
  res.json({
    quote: {
      available: true,
      period: {
        rentalMode: period.mode,
        startDate: period.startDate,
        endDate: period.endDate,
        startTime: period.startTime,
        endTime: period.endTime,
        startAt: period.startAt,
        endAt: period.endAt,
        label: describePeriod(period),
      },
      price,
    },
    notices: { protection: PROTECTION_NOTICE_SK, demoLabel: DEMO_LABEL, demoNotice: DEMO_NOTICE_SK },
  });
});

export default router;
