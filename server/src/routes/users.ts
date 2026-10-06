import { Router } from 'express';
import { param } from '../lib/params.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../middleware/validate.js';
import { currentUser, optionalAuth, requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { privateUser, publicUser } from '../lib/serialize.js';
import { userRatingSummary, userRentalStats } from '../services/stats.js';
import { itemInclude, serializeItems } from '../services/items.js';
import { phoneSchema } from './auth.js';
import { uploadedImageUrl } from '../lib/validation.js';
import { storage } from '../services/storage/index.js';

const router = Router();

const updateMeSchema = z
  .object({
    name: z.string().trim().min(2, 'Meno musí mať aspoň 2 znaky.').max(80),
    phone: phoneSchema,
    city: z.string().trim().min(2, 'Zadaj mesto.').max(80),
    bio: z.string().trim().max(500, 'Popis môže mať najviac 500 znakov.').nullable(),
    avatarUrl: uploadedImageUrl.nullable(),
  })
  .partial()
  .strict();

router.patch('/me', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(updateMeSchema, req);
  if (data.avatarUrl && !(await storage.exists(data.avatarUrl))) throw badRequest('Fotografia neexistuje.');
  const updated = await prisma.user.update({ where: { id: user.id }, data });
  res.json({ user: privateUser(updated) });
});

router.get('/me/favorites', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const favs = await prisma.favorite.findMany({
    where: { userId: user.id, item: { isActive: true } },
    include: { item: { include: itemInclude } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items: await serializeItems(favs.map((f) => f.item), user.id) });
});

router.get('/me/items', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const items = await prisma.item.findMany({
    where: { ownerId: user.id },
    include: itemInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items: await serializeItems(items, user.id) });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: param(req, 'id') } });
  if (!user || !user.isActive) throw notFound('Používateľ sa nenašiel.');
  const [rating, stats, items] = await Promise.all([
    userRatingSummary(user.id),
    userRentalStats(user.id),
    prisma.item.findMany({ where: { ownerId: user.id, isActive: true }, include: itemInclude, orderBy: { createdAt: 'desc' } }),
  ]);
  // Public profile: no e-mail, no phone number.
  res.json({ user: { ...publicUser(user), rating, stats }, items: await serializeItems(items, req.user?.id) });
});

router.get('/:id/reviews', async (req, res) => {
  const [reviews, summary] = await Promise.all([
    prisma.review.findMany({
      where: { targetId: param(req, 'id'), isHidden: false },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    userRatingSummary(param(req, 'id')),
  ]);
  res.json({ summary, reviews });
});

export default router;
