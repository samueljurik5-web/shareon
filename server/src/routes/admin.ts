import { Router } from 'express';
import { param } from '../lib/params.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody, parseQuery } from '../middleware/validate.js';
import { currentUser, requireAdmin, requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { euroAmount } from '../lib/validation.js';
import { toCents } from '../lib/money.js';
import { audit } from '../services/audit.js';
import { getSettings, settingsPatchSchema, updateSettings } from '../services/settings.js';
import { adminDecide, adminSetReportStatus } from '../services/reports.js';
import { isInsuranceProviderConfigured } from '../config/env.js';

const router = Router();
router.use(requireAuth, requireAdmin);

export const ADMIN_WARNING =
  'Pred aktiváciou skutočných platieb alebo poistného krytia musí byť nakonfigurovaný reálny payment provider, poisťovací partner a právne schválené podmienky.';

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().max(40).optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  city: true,
  role: true,
  isActive: true,
  createdAt: true,
  _count: { select: { items: true, rentalsAsRenter: true, rentalsAsOwner: true, reportsAgainst: true } },
} as const;

router.get('/overview', async (_req, res) => {
  const [users, items, rentals, openReports, heldDeposits, activeProtection] = await Promise.all([
    prisma.user.count(),
    prisma.item.count({ where: { isActive: true } }),
    prisma.rentalRequest.count(),
    prisma.damageReport.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'] } } }),
    prisma.deposit.count({ where: { status: { in: ['HELD', 'DISPUTED', 'RELEASE_REQUESTED'] } } }),
    prisma.protectionRecord.count({ where: { status: { in: ['ACTIVE', 'CLAIM_UNDER_REVIEW'] } } }),
  ]);
  res.json({ counts: { users, items, rentals, openReports, heldDeposits, activeProtection }, warning: ADMIN_WARNING });
});

router.get('/users', async (req, res) => {
  const q = parseQuery(listQuery, req);
  const users = await prisma.user.findMany({
    where: q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] } : undefined,
    select: userSelect,
    orderBy: { createdAt: 'desc' },
    take: q.take,
  });
  res.json({ users });
});

router.get('/items', async (req, res) => {
  const q = parseQuery(listQuery, req);
  const items = await prisma.item.findMany({
    where: q.q ? { title: { contains: q.q, mode: 'insensitive' } } : undefined,
    include: { owner: { select: { id: true, name: true } }, images: { take: 1, orderBy: { position: 'asc' } }, _count: { select: { rentals: true, reports: true } } },
    orderBy: { createdAt: 'desc' },
    take: q.take,
  });
  res.json({ items });
});

router.get('/rentals', async (req, res) => {
  const q = parseQuery(listQuery, req);
  const rentals = await prisma.rentalRequest.findMany({
    where: q.status ? { status: q.status as never } : undefined,
    include: {
      item: { select: { id: true, title: true } },
      renter: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      deposit: { select: { id: true, status: true, amountCents: true } },
      protection: { select: { id: true, status: true, feeCents: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: q.take,
  });
  res.json({ rentals });
});

router.get('/reports', async (req, res) => {
  const q = parseQuery(listQuery, req);
  const reports = await prisma.damageReport.findMany({
    where: q.status ? { status: q.status as never } : undefined,
    include: {
      item: { select: { id: true, title: true } },
      reporter: { select: { id: true, name: true } },
      reportedUser: { select: { id: true, name: true } },
      rentalRequest: { select: { id: true, status: true, deposit: { select: { id: true, status: true, amountCents: true } } } },
      _count: { select: { evidence: true, decisions: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: q.take,
  });
  res.json({ reports });
});

router.get('/protection', async (req, res) => {
  const q = parseQuery(listQuery, req);
  const [records, quotes] = await Promise.all([
    prisma.protectionRecord.findMany({
      include: { rentalRequest: { select: { id: true, item: { select: { title: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: q.take,
    }),
    prisma.protectionQuote.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { item: { select: { title: true } } } }),
  ]);
  res.json({ records, quotes });
});

router.get('/deposits', async (req, res) => {
  const q = parseQuery(listQuery, req);
  const deposits = await prisma.deposit.findMany({
    include: { rentalRequest: { select: { id: true, status: true, item: { select: { title: true } }, renter: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: q.take,
  });
  res.json({ deposits });
});

router.get('/reviews', async (req, res) => {
  const q = parseQuery(listQuery, req);
  const [reviews, itemReviews] = await Promise.all([
    prisma.review.findMany({
      include: { author: { select: { id: true, name: true } }, target: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: q.take,
    }),
    prisma.itemReview.findMany({
      include: { author: { select: { id: true, name: true } }, item: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: q.take,
    }),
  ]);
  res.json({ reviews, itemReviews });
});

const activeSchema = z.object({ active: z.boolean().default(false) });

router.patch('/users/:id/deactivate', async (req, res) => {
  const admin = currentUser(req);
  const { active } = parseBody(activeSchema, req);
  const user = await prisma.user.findUnique({ where: { id: param(req, 'id') } });
  if (!user) throw notFound('Používateľ sa nenašiel.');
  if (user.id === admin.id) throw badRequest('Nemôžeš deaktivovať vlastný účet.');
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      // Deactivation also revokes all sessions.
      data: { isActive: active, tokenVersion: active ? undefined : { increment: 1 } },
    });
    await audit({ adminId: admin.id, action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', entityType: 'User', entityId: user.id, oldValue: { isActive: user.isActive }, newValue: { isActive: active } }, tx);
    return u;
  });
  res.json({ user: { id: updated.id, isActive: updated.isActive } });
});

router.patch('/items/:id/deactivate', async (req, res) => {
  const admin = currentUser(req);
  const { active } = parseBody(activeSchema, req);
  const item = await prisma.item.findUnique({ where: { id: param(req, 'id') } });
  if (!item) throw notFound('Predmet sa nenašiel.');
  const updated = await prisma.$transaction(async (tx) => {
    const i = await tx.item.update({ where: { id: item.id }, data: { isActive: active, deactivatedByAdmin: !active } });
    await audit({ adminId: admin.id, action: active ? 'ITEM_ACTIVATED' : 'ITEM_DEACTIVATED', entityType: 'Item', entityId: item.id, oldValue: { isActive: item.isActive }, newValue: { isActive: active } }, tx);
    return i;
  });
  res.json({ item: { id: updated.id, isActive: updated.isActive } });
});

const hideSchema = z.object({ hidden: z.boolean().default(true) });

router.patch('/reviews/:id/hide', async (req, res) => {
  const admin = currentUser(req);
  const { hidden } = parseBody(hideSchema, req);
  const review = await prisma.review.findUnique({ where: { id: param(req, 'id') } });
  if (!review) throw notFound('Hodnotenie sa nenašlo.');
  await prisma.review.update({ where: { id: review.id }, data: { isHidden: hidden } });
  await audit({ adminId: admin.id, action: hidden ? 'REVIEW_HIDDEN' : 'REVIEW_SHOWN', entityType: 'Review', entityId: review.id, oldValue: { isHidden: review.isHidden }, newValue: { isHidden: hidden } });
  res.json({ ok: true });
});

router.patch('/item-reviews/:id/hide', async (req, res) => {
  const admin = currentUser(req);
  const { hidden } = parseBody(hideSchema, req);
  const review = await prisma.itemReview.findUnique({ where: { id: param(req, 'id') } });
  if (!review) throw notFound('Hodnotenie sa nenašlo.');
  await prisma.itemReview.update({ where: { id: review.id }, data: { isHidden: hidden } });
  await audit({ adminId: admin.id, action: hidden ? 'ITEM_REVIEW_HIDDEN' : 'ITEM_REVIEW_SHOWN', entityType: 'ItemReview', entityId: review.id, oldValue: { isHidden: review.isHidden }, newValue: { isHidden: hidden } });
  res.json({ ok: true });
});

const reportStatusSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'NEEDS_MORE_INFORMATION', 'RESOLVED'], { errorMap: () => ({ message: 'Neplatný stav.' }) }),
  note: z.string().trim().max(2000).optional().nullable(),
});

router.patch('/reports/:id/status', async (req, res) => {
  const data = parseBody(reportStatusSchema, req);
  const report = await adminSetReportStatus(currentUser(req), param(req, 'id'), data.status, data.note);
  res.json({ report: { id: report.id, status: report.status } });
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'], { errorMap: () => ({ message: 'Vyber rozhodnutie.' }) }),
  approvedAmount: euroAmount('Schválená suma', 20000).default(0),
  publicNote: z.string().trim().max(2000).optional().nullable(),
  internalNote: z.string().trim().max(2000).optional().nullable(),
  depositAction: z.enum(['NONE', 'RELEASE', 'WITHHOLD', 'PARTIAL_WITHHOLD']).default('NONE'),
  withheldAmount: euroAmount('Zadržaná suma', 100000).optional(),
});

router.post('/reports/:id/decision', async (req, res) => {
  const data = parseBody(decisionSchema, req);
  const result = await adminDecide(currentUser(req), param(req, 'id'), {
    decision: data.decision,
    approvedAmountCents: toCents(data.approvedAmount),
    publicNote: data.publicNote,
    internalNote: data.internalNote,
    depositAction: data.depositAction,
    withheldAmountCents: data.withheldAmount != null ? toCents(data.withheldAmount) : undefined,
  });
  res.status(201).json({ report: { id: result.report.id, status: result.report.status }, decision: result.decision });
});

router.get('/settings', async (_req, res) => {
  res.json({ settings: await getSettings(), insuranceProviderConfigured: isInsuranceProviderConfigured(), warning: ADMIN_WARNING });
});

router.patch('/settings', async (req, res) => {
  const admin = currentUser(req);
  const patch = parseBody(settingsPatchSchema, req);
  const { old, updated } = await updateSettings(patch);
  await audit({ adminId: admin.id, action: 'SETTINGS_UPDATED', entityType: 'AppSetting', entityId: 'global', oldValue: old, newValue: updated });
  res.json({ settings: updated });
});

router.get('/audit-log', async (req, res) => {
  const q = parseQuery(listQuery, req);
  const entries = await prisma.auditLog.findMany({
    include: { admin: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: q.take,
  });
  res.json({ entries });
});

export default router;
