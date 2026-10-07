import { Router } from 'express';
import { param } from '../lib/params.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../middleware/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { dateOnly, euroAmount, rentalPeriodFields, timeOfDayString, uploadedImageUrl } from '../lib/validation.js';
import { toCents } from '../lib/money.js';
import { badRequest } from '../lib/errors.js';
import { storage } from '../services/storage/index.js';
import {
  availableActions,
  changeRentalStatus,
  confirmHandover,
  confirmReturn,
  CONTACT_VISIBLE_STATUSES,
  createRentalRequest,
  loadRentalForParty,
  partyRole,
} from '../services/rentals.js';
import { createReport } from '../services/reports.js';
import { publicUser } from '../lib/serialize.js';
import { SIMULATED_PAYMENT_LABEL } from '../services/deposit/index.js';
import { DEMO_LABEL, DEMO_NOTICE_SK, PROTECTION_NOTICE_SK } from '../services/protection/index.js';
import { toDateOnlyString } from '../lib/dates.js';

const router = Router();
router.use(requireAuth);

const handoverMethod = z.enum(['PERSONAL_PICKUP', 'OWNER_DELIVERY', 'MEET_ELSEWHERE'], {
  errorMap: () => ({ message: 'Vyber spôsob odovzdania.' }),
});

const createSchema = z
  .object({
    itemId: z.string({ required_error: 'Chýba predmet.' }).min(1).max(64),
    ...rentalPeriodFields,
    message: z.string().trim().max(1000, 'Správa je príliš dlhá.').optional().nullable(),
    handoverMethod,
    acceptRules: z.literal(true, { errorMap: () => ({ message: 'Musíš súhlasiť s pravidlami ShareOn.' }) }),
    acceptProtectionDisclaimer: z.boolean().optional(),
  })
  // Any client-sent prices/fees/ids of other users are ignored by design (strip unknown keys).
  .strip();

router.post('/', async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(createSchema, req);
  const rental = await createRentalRequest(user, data);
  res.status(201).json({ rentalRequest: { id: rental.id, status: rental.status, totalCents: rental.totalCents } });
});

const listInclude = {
  item: { select: { id: true, title: true, category: true, images: { take: 1, orderBy: { position: 'asc' as const } } } },
  renter: { select: { id: true, name: true, avatarUrl: true } },
  owner: { select: { id: true, name: true, avatarUrl: true } },
  reviews: { select: { id: true, type: true, authorId: true } },
  itemReview: { select: { id: true } },
};

router.get('/sent', async (req, res) => {
  const user = currentUser(req);
  const rentals = await prisma.rentalRequest.findMany({
    where: { renterId: user.id },
    include: listInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ rentalRequests: rentals });
});

router.get('/received', async (req, res) => {
  const user = currentUser(req);
  const rentals = await prisma.rentalRequest.findMany({
    where: { ownerId: user.id },
    include: listInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ rentalRequests: rentals });
});

router.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const { rental } = await loadRentalForParty(param(req, 'id'), user);
  const role = partyRole(rental, user.id);
  const full = await prisma.rentalRequest.findUniqueOrThrow({
    where: { id: rental.id },
    include: {
      item: { include: { images: { orderBy: { position: 'asc' } } } },
      renter: true,
      owner: true,
      handoverRecords: { include: { photos: true, user: { select: { id: true, name: true } } }, orderBy: { confirmedAt: 'asc' } },
      protection: true,
      deposit: true,
      reports: { select: { id: true, type: true, status: true, createdAt: true, reporterId: true } },
      reviews: { where: { isHidden: false } },
      itemReview: true,
    },
  });
  const showContact = CONTACT_VISIBLE_STATUSES.includes(full.status) || user.role === 'ADMIN';
  const party = (u: typeof full.renter) => ({
    ...publicUser(u),
    // Contact details only after acceptance (privacy).
    phone: showContact ? u.phone : null,
    email: showContact ? u.email : null,
  });
  res.json({
    rentalRequest: {
      id: full.id,
      status: full.status,
      startDate: toDateOnlyString(full.startDate),
      endDate: toDateOnlyString(full.endDate),
      proposedStartDate: full.proposedStartDate ? toDateOnlyString(full.proposedStartDate) : null,
      proposedEndDate: full.proposedEndDate ? toDateOnlyString(full.proposedEndDate) : null,
      rentalMode: full.rentalMode,
      startTime: full.startTime,
      endTime: full.endTime,
      startAt: full.startAt,
      endAt: full.endAt,
      durationMinutes: full.durationMinutes,
      durationDays: full.durationDays,
      proposedStartTime: full.proposedStartTime,
      proposedEndTime: full.proposedEndTime,
      // Hourly/daily rental past its end and not yet returned → late return can be reported.
      isOverdue: ['ACTIVE', 'RETURN_PENDING'].includes(full.status) && full.endAt.getTime() < Date.now(),
      message: full.message,
      ownerNote: full.ownerNote,
      handoverMethod: full.handoverMethod,
      price: {
        pricePerUnitCents: full.pricePerUnitCents,
        rentalPriceCents: full.rentalPriceCents,
        protectionFeeCents: full.protectionFeeCents,
        depositCents: full.depositCents,
        platformFeeCents: full.platformFeeCents,
        totalCents: full.totalCents,
        refundableCents: full.refundableCents,
        currency: full.currency,
      },
      protectionMode: full.protectionMode,
      createdAt: full.createdAt,
      acceptedAt: full.acceptedAt,
      activeAt: full.activeAt,
      returnedAt: full.returnedAt,
      completedAt: full.completedAt,
      cancelledAt: full.cancelledAt,
      item: {
        id: full.item.id,
        title: full.item.title,
        category: full.item.category,
        images: full.item.images.map((i) => ({ id: i.id, url: i.url })),
        replacementValueCents: full.item.replacementValueCents,
      },
      renter: party(full.renter),
      owner: party(full.owner),
      contactVisible: showContact,
      handoverRecords: full.handoverRecords,
      protection: full.protection
        ? {
            ...full.protection,
            label: full.protection.isDemo ? DEMO_LABEL : null,
            notice: full.protection.isDemo ? `${DEMO_NOTICE_SK} ${PROTECTION_NOTICE_SK}` : PROTECTION_NOTICE_SK,
          }
        : null,
      deposit: full.deposit ? { ...full.deposit, label: full.deposit.isSimulated ? SIMULATED_PAYMENT_LABEL : null } : null,
      reports: full.reports,
      reviews: full.reviews,
      itemReview: full.itemReview,
      viewerRole: role,
      availableActions: availableActions(full, role),
    },
  });
});

const statusSchema = z.discriminatedUnion(
  'action',
  [
    z.object({ action: z.literal('ACCEPT'), note: z.string().trim().max(500).optional() }),
    z.object({ action: z.literal('REJECT'), note: z.string().trim().max(500).optional() }),
    z.object({
      action: z.literal('PROPOSE_DATES'),
      startDate: dateOnly,
      endDate: dateOnly.optional(),
      startTime: timeOfDayString.optional(),
      endTime: timeOfDayString.optional(),
      note: z.string().trim().max(500).optional(),
    }),
    z.object({ action: z.literal('ACCEPT_PROPOSAL') }),
    z.object({ action: z.literal('DECLINE_PROPOSAL') }),
    z.object({ action: z.literal('CANCEL'), note: z.string().trim().max(500).optional() }),
    z.object({ action: z.literal('COMPLETE') }),
  ],
  { errorMap: () => ({ message: 'Neplatná akcia.' }) },
);

router.patch('/:id/status', async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(statusSchema, req);
  const updated = await changeRentalStatus(user, param(req, 'id'), data);
  res.json({ rentalRequest: { id: updated.id, status: updated.status } });
});

const photosSchema = z.array(uploadedImageUrl).max(5, 'Najviac 5 fotografií.').default([]);

const checklistSchema = z.object({
  note: z.string().trim().max(1000, 'Poznámka je príliš dlhá.').optional().nullable(),
  photos: photosSchema,
  itemOk: z.boolean().optional(),
});

const assertPhotos = async (urls: string[]) => {
  for (const url of urls) if (!(await storage.exists(url))) throw badRequest('Niektorá z fotografií neexistuje.');
};

router.post('/:id/handover', async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(checklistSchema, req);
  await assertPhotos(data.photos);
  const updated = await confirmHandover(user, param(req, 'id'), data);
  res.json({ rentalRequest: { id: updated.id, status: updated.status } });
});

router.post('/:id/return', async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(checklistSchema, req);
  await assertPhotos(data.photos);
  const updated = await confirmReturn(user, param(req, 'id'), data);
  res.json({ rentalRequest: { id: updated.id, status: updated.status } });
});

export const reportSchema = z.object({
  type: z.enum(
    ['ITEM_DAMAGED', 'ITEM_NOT_RETURNED', 'LATE_RETURN', 'ITEM_DIFFERENT_THAN_DESCRIPTION', 'USER_BEHAVIOR', 'PAYMENT_PROBLEM', 'OTHER'],
    { errorMap: () => ({ message: 'Vyber typ problému.' }) },
  ),
  description: z.string({ required_error: 'Popíš problém.' }).trim().min(20, 'Popíš problém aspoň 20 znakmi.').max(3000),
  requestedAmount: euroAmount('Požadovaná suma', 20000).default(0),
  photos: photosSchema,
});

router.post('/:id/dispute', async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(reportSchema, req);
  await assertPhotos(data.photos);
  const report = await createReport(user, {
    rentalRequestId: param(req, 'id'),
    type: data.type,
    description: data.description,
    requestedAmountCents: toCents(data.requestedAmount),
    photos: data.photos,
  });
  res.status(201).json({ report: { id: report.id, status: report.status } });
});

export default router;
