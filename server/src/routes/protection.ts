import { Router } from 'express';
import { param } from '../lib/params.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../middleware/validate.js';
import { currentUser, optionalAuth, requireAdmin, requireAuth } from '../middleware/auth.js';
import { dateOnly, euroAmount } from '../lib/validation.js';
import { parseDateOnly } from '../lib/dates.js';
import { toCents } from '../lib/money.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { getSettings } from '../services/settings.js';
import { calculatePrice, calculatePriceForDays, loadRiskSignals } from '../services/pricing.js';
import { createProtectionForRental, loadRentalForParty, MAX_RENTAL_DAYS } from '../services/rentals.js';
import { getProtectionProvider, DEMO_LABEL, DEMO_NOTICE_SK, PROTECTION_NOTICE, PROTECTION_NOTICE_SK } from '../services/protection/index.js';
import { audit } from '../services/audit.js';

const router = Router();

const quoteSchema = z.union([
  z.object({ itemId: z.string().min(1).max(64), startDate: dateOnly, endDate: dateOnly }),
  // Preview for a listing that is not yet published (Add item form).
  z.object({
    category: z.enum(['GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE', 'OTHER']),
    pricePerDay: euroAmount('Cena za deň', 500),
    replacementValue: euroAmount('Hodnota predmetu', 20000),
    rentalDays: z.coerce.number().int().min(1).max(MAX_RENTAL_DAYS).default(3),
    protectionEligible: z.boolean().default(true),
  }),
]);

/** Server-side price & protection quote. Never trusts client amounts beyond the listing inputs. */
router.post('/quote', optionalAuth, async (req, res) => {
  const data = parseBody(quoteSchema, req);
  const settings = await getSettings();
  const notices = {
    notice: PROTECTION_NOTICE,
    noticeSk: PROTECTION_NOTICE_SK,
    demoLabel: DEMO_LABEL,
    demoNotice: DEMO_NOTICE_SK,
  };
  if ('itemId' in data) {
    const item = await prisma.item.findUnique({ where: { id: data.itemId } });
    if (!item || !item.isActive) throw notFound('Predmet sa nenašiel.');
    const start = parseDateOnly(data.startDate);
    const end = parseDateOnly(data.endDate);
    if (end < start) throw badRequest('Dátum vrátenia musí byť po dátume začiatku.');
    const price = await calculatePrice(item, start, end, settings, await loadRiskSignals(req.user?.id ?? null, item.ownerId));
    let quoteId: string | null = null;
    if (price.protection?.available) {
      const q = await prisma.protectionQuote.create({
        data: {
          itemId: item.id,
          userId: req.user?.id ?? null,
          provider: price.protection.provider,
          mode: price.protection.mode,
          isDemo: price.protection.isDemo,
          replacementValueCents: item.replacementValueCents,
          protectedValueCents: price.protection.protectedValueCents,
          rentalDays: price.rentalDays,
          feeCents: price.protection.feeCents,
          inputs: price.protection.breakdown,
          expiresAt: new Date(Date.now() + 24 * 3600000),
        },
      });
      quoteId = q.id;
    }
    return res.json({ quoteId, price, ...notices });
  }
  const price = await calculatePriceForDays(
    {
      category: data.category,
      pricePerDayCents: toCents(data.pricePerDay),
      replacementValueCents: toCents(data.replacementValue),
      protectionEligible: data.protectionEligible,
    },
    data.rentalDays,
    settings,
  );
  res.json({ quoteId: null, price, ...notices });
});

router.post('/:rentalRequestId/create', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const { rental } = await loadRentalForParty(param(req, 'rentalRequestId'), user);
  if (!['ACCEPTED', 'ACTIVE'].includes(rental.status)) throw conflict('Ochranu je možné vytvoriť len pre prijatý prenájom.');
  // Idempotent: returns the existing record when called repeatedly.
  const record = await createProtectionForRental(rental);
  res.status(201).json({ protection: record });
});

router.get('/:rentalRequestId', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const { rental } = await loadRentalForParty(param(req, 'rentalRequestId'), user);
  const [record, quotes] = await Promise.all([
    prisma.protectionRecord.findUnique({ where: { rentalRequestId: rental.id } }),
    prisma.protectionQuote.findMany({ where: { rentalRequestId: rental.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  res.json({
    protection: record ? { ...record, label: record.isDemo ? DEMO_LABEL : null } : null,
    quotes,
    notice: PROTECTION_NOTICE_SK,
  });
});

router.post('/:id/cancel', requireAuth, requireAdmin, async (req, res) => {
  const admin = currentUser(req);
  const record = await prisma.protectionRecord.findUnique({ where: { id: param(req, 'id') } });
  if (!record) throw notFound('Záznam ochrany sa nenašiel.');
  const settings = await getSettings();
  await getProtectionProvider(settings).cancelProtection(record.id);
  const updated = await prisma.protectionRecord.findUniqueOrThrow({ where: { id: record.id } });
  await audit({ adminId: admin.id, action: 'PROTECTION_CANCELLED', entityType: 'ProtectionRecord', entityId: record.id, oldValue: { status: record.status }, newValue: { status: updated.status } });
  res.json({ protection: updated });
});

export default router;
