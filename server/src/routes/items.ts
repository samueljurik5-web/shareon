import { Router } from 'express';
import { param } from '../lib/params.js';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { parseBody, parseQuery } from '../middleware/validate.js';
import { currentUser, optionalAuth, requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { dateOnly, euroAmount, itemImageUrl, PLACEHOLDER_IMAGE } from '../lib/validation.js';
import { parseDateOnly, toDateOnlyString } from '../lib/dates.js';
import { toCents } from '../lib/money.js';
import { storage } from '../services/storage/index.js';
import { BLOCKING_RENTAL_STATUSES, itemInclude, serializeItems } from '../services/items.js';
import { itemRatingSummary, userRatingSummary } from '../services/stats.js';
import { getSettings } from '../services/settings.js';
import { isProtectionAvailableFor } from '../services/protection/index.js';
import { calculatePriceForDays, calculateRentalPrice } from '../services/pricing.js';
import { addDaysToDate, zonedToUtc } from '../lib/time.js';
import { publicUser } from '../lib/serialize.js';
import { notifyAdmins } from '../services/notifications.js';

const router = Router();

const categoryEnum = z.enum(['GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE', 'OTHER'], {
  errorMap: () => ({ message: 'Vyber kategóriu.' }),
});
const conditionEnum = z.enum(['NEW', 'VERY_GOOD', 'GOOD', 'USED', 'WORN'], {
  errorMap: () => ({ message: 'Vyber stav predmetu.' }),
});

const intRange = (label: string, min: number, max: number) =>
  z.coerce
    .number({ invalid_type_error: `${label} musí byť číslo.` })
    .int(`${label} musí byť celé číslo.`)
    .min(min, `${label} musí byť aspoň ${min}.`)
    .max(max, `${label} môže byť najviac ${max}.`);

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Zadaj čas vo formáte HH:MM.');

interface RentalSettings {
  dailyRentalEnabled: boolean;
  hourlyRentalEnabled: boolean;
  dailyPriceCents: number | null;
  hourlyPriceCents: number | null;
  minRentalHours: number;
  maxRentalHours: number;
  minRentalDays: number;
  maxRentalDays: number;
  availableFromTime: string;
  availableToTime: string;
}

/** Cross-field rules for rental modes (also enforced by DB CHECK constraints). */
const assertRentalSettings = (r: RentalSettings) => {
  const errors: { path: string; message: string }[] = [];
  if (!r.dailyRentalEnabled && !r.hourlyRentalEnabled) {
    errors.push({ path: 'rentalModes', message: 'Povoľ aspoň jeden spôsob prenájmu – na dni alebo na hodiny.' });
  }
  if (r.dailyRentalEnabled && !(r.dailyPriceCents && r.dailyPriceCents >= 50)) {
    errors.push({ path: 'dailyPrice', message: 'Pri prenájme na dni je cena za deň povinná (aspoň 0,50 €).' });
  }
  if (r.hourlyRentalEnabled && !(r.hourlyPriceCents && r.hourlyPriceCents >= 10)) {
    errors.push({ path: 'hourlyPrice', message: 'Pri prenájme na hodiny je cena za hodinu povinná (aspoň 0,10 €).' });
  }
  if (r.maxRentalHours < r.minRentalHours) {
    errors.push({ path: 'maxRentalHours', message: 'Maximálny počet hodín musí byť aspoň taký ako minimálny.' });
  }
  if (r.maxRentalDays < r.minRentalDays) {
    errors.push({ path: 'maxRentalDays', message: 'Maximálny počet dní musí byť aspoň taký ako minimálny.' });
  }
  if (r.availableToTime <= r.availableFromTime) {
    errors.push({ path: 'availableToTime', message: 'Čas „dostupné do“ musí byť neskôr ako čas „dostupné od“.' });
  }
  if (r.hourlyRentalEnabled) {
    const window = Number(r.availableToTime.slice(0, 2)) * 60 + Number(r.availableToTime.slice(3)) -
      (Number(r.availableFromTime.slice(0, 2)) * 60 + Number(r.availableFromTime.slice(3)));
    if (window < r.minRentalHours * 60) {
      errors.push({ path: 'minRentalHours', message: 'Minimálna dĺžka prenájmu sa nezmestí do denného časového okna.' });
    }
  }
  if (errors.length) throw badRequest('Skontroluj nastavenia prenájmu.', errors);
};

const centsOrNull = (v: number | null | undefined) => (v == null ? null : toCents(v));

const mustBeTrue = (message: string) => z.literal(true, { errorMap: () => ({ message }) });

const itemBase = z.object({
  title: z.string({ required_error: 'Názov je povinný.' }).trim().min(3, 'Názov musí mať aspoň 3 znaky.').max(100, 'Názov je príliš dlhý.'),
  category: categoryEnum,
  description: z
    .string({ required_error: 'Popis je povinný.' })
    .trim()
    .min(20, 'Popis musí mať aspoň 20 znakov.')
    .max(3000, 'Popis je príliš dlhý.'),
  // Rental modes – the owner chooses daily only, hourly only, or both.
  dailyRentalEnabled: z.boolean().optional(),
  hourlyRentalEnabled: z.boolean().optional(),
  dailyPrice: euroAmount('Cena za deň', 500).nullable().optional(),
  hourlyPrice: euroAmount('Cena za hodinu', 200).nullable().optional(),
  minRentalHours: intRange('Minimálny počet hodín', 1, 24).optional(),
  maxRentalHours: intRange('Maximálny počet hodín', 1, 24).optional(),
  minRentalDays: intRange('Minimálny počet dní', 1, 90).optional(),
  maxRentalDays: intRange('Maximálny počet dní', 1, 90).optional(),
  availableFromTime: timeOfDay.optional(),
  availableToTime: timeOfDay.optional(),
  bufferHours: intRange('Rezerva medzi prenájmami', 0, 72).optional(),
  city: z.string({ required_error: 'Mesto je povinné.' }).trim().min(2, 'Zadaj mesto.').max(80),
  condition: conditionEnum,
  availableFrom: dateOnly,
  availableTo: dateOnly,
  replacementValue: euroAmount('Hodnota predmetu', 20000).refine((v) => v >= 1, 'Zadaj odhadovanú hodnotu predmetu.'),
  serialNote: z.string().trim().max(200, 'Poznámka je príliš dlhá.').optional().nullable(),
  protectionEligible: z.boolean().optional(),
  images: z
    .array(itemImageUrl, { required_error: 'Pridaj aspoň 1 fotografiu.' })
    .min(1, 'Pridaj aspoň 1 fotografiu.')
    .max(5, 'Môžeš pridať najviac 5 fotografií.'),
});

const createSchema = itemBase
  .extend({
    declarations: z.object(
      {
        rightToOffer: mustBeTrue('Potvrď, že máš právo predmet ponúkať.'),
        accurateDescription: mustBeTrue('Potvrď, že popis je pravdivý.'),
        damageDisclosed: mustBeTrue('Potvrď, že si uviedol existujúce poškodenia.'),
        photosCurrent: mustBeTrue('Potvrď, že fotografie zobrazujú aktuálny stav.'),
      },
      { required_error: 'Potvrď všetky vyhlásenia pred zverejnením.' },
    ),
  })
  .refine((d) => d.availableTo >= d.availableFrom, {
    message: 'Dátum „dostupné do“ musí byť po dátume „dostupné od“.',
    path: ['availableTo'],
  });

const updateSchema = itemBase.partial().extend({ isActive: z.boolean().optional() }).strict();

const assertImagesExist = async (urls: string[]) => {
  for (const url of urls) {
    if (PLACEHOLDER_IMAGE.test(url)) continue;
    if (!(await storage.exists(url))) throw badRequest('Niektorá z fotografií neexistuje. Nahraj ju znova.');
  }
};

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: categoryEnum.optional(),
  city: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  condition: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : undefined))
    .pipe(z.array(conditionEnum).optional()),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  protection: z.enum(['true', 'false']).optional(),
  mode: z.enum(['DAILY', 'HOURLY']).optional(),
  ownerId: z.string().max(64).optional(),
  favorites: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  page: z.coerce.number().int().min(1).default(1),
});

router.get('/', optionalAuth, async (req, res) => {
  const q = parseQuery(listQuery, req);
  const where: Prisma.ItemWhereInput = { isActive: true, owner: { isActive: true } };
  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: 'insensitive' } },
      { description: { contains: q.q, mode: 'insensitive' } },
    ];
  }
  if (q.category) where.category = q.category;
  if (q.city) where.city = { contains: q.city, mode: 'insensitive' };
  if (q.mode === 'DAILY') where.dailyRentalEnabled = true;
  if (q.mode === 'HOURLY') where.hourlyRentalEnabled = true;
  if (q.condition?.length) where.condition = { in: q.condition };
  if (q.ownerId) where.ownerId = q.ownerId;
  if (q.favorites === 'true' && req.user) where.favorites = { some: { userId: req.user.id } };
  if (q.from || q.to) {
    const from = parseDateOnly(q.from ?? q.to!);
    const to = parseDateOnly(q.to ?? q.from!);
    where.availableFrom = { lte: from };
    where.availableTo = { gte: to };
    where.rentals = {
      none: {
        status: { in: [...BLOCKING_RENTAL_STATUSES] },
        startAt: { lt: zonedToUtc(addDaysToDate(q.to ?? q.from!, 1)) },
        endAt: { gt: zonedToUtc(q.from ?? q.to!) },
      },
    };
  }

  // MVP: filter & sort in memory on a bounded candidate set (sufficient for one city launch).
  const candidates = await prisma.item.findMany({
    where,
    include: itemInclude,
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  let items = await serializeItems(candidates, req.user?.id);
  if (q.protection === 'true') items = items.filter((i) => i.protectionAvailable);
  // Price filters/sorting: daily price when offered (or the price in the chosen mode).
  const priceOf = (i: (typeof items)[number]) =>
    q.mode === 'HOURLY' ? (i.hourlyPriceCents ?? 0) : (i.dailyPriceCents ?? i.hourlyPriceCents ?? 0);
  if (q.minPrice != null) items = items.filter((i) => priceOf(i) >= toCents(q.minPrice!));
  if (q.maxPrice != null) items = items.filter((i) => priceOf(i) <= toCents(q.maxPrice!));
  if (q.sort === 'price_asc') items.sort((a, b) => priceOf(a) - priceOf(b));
  if (q.sort === 'price_desc') items.sort((a, b) => priceOf(b) - priceOf(a));
  if (q.sort === 'rating')
    items.sort(
      (a, b) =>
        (b.rating.average ?? b.owner.rating.average ?? 0) - (a.rating.average ?? a.owner.rating.average ?? 0),
    );
  const total = items.length;
  const start = (q.page - 1) * q.limit;
  res.json({ items: items.slice(start, start + q.limit), total, page: q.page, limit: q.limit });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const item = await prisma.item.findUnique({
    where: { id: param(req, 'id') },
    include: { images: { orderBy: { position: 'asc' } }, owner: true },
  });
  const isOwner = req.user?.id === item?.ownerId;
  const isAdmin = req.user?.role === 'ADMIN';
  if (!item || ((!item.isActive || !item.owner.isActive) && !isOwner && !isAdmin)) throw notFound('Predmet sa nenašiel.');

  const [settings, ownerRating, rating, blocked, favorite] = await Promise.all([
    getSettings(),
    userRatingSummary(item.ownerId),
    itemRatingSummary(item.id),
    prisma.rentalRequest.findMany({
      where: { itemId: item.id, status: { in: [...BLOCKING_RENTAL_STATUSES] }, endAt: { gte: new Date() } },
      select: { rentalMode: true, startDate: true, endDate: true, startTime: true, endTime: true },
      orderBy: { startAt: 'asc' },
    }),
    req.user ? prisma.favorite.findUnique({ where: { userId_itemId: { userId: req.user.id, itemId: item.id } } }) : null,
  ]);
  // Example estimates shown before the renter picks a period.
  const estimateDaily = item.dailyRentalEnabled && item.dailyPriceCents ? await calculatePriceForDays(item, 3, settings) : null;
  const estimateHourly =
    item.hourlyRentalEnabled && item.hourlyPriceCents
      ? await calculateRentalPrice(item, { mode: 'HOURLY', minutes: Math.max(item.minRentalHours, 2) * 60 }, settings)
      : null;

  res.json({
    item: {
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      dailyRentalEnabled: item.dailyRentalEnabled,
      hourlyRentalEnabled: item.hourlyRentalEnabled,
      dailyPriceCents: item.dailyRentalEnabled ? item.dailyPriceCents : null,
      hourlyPriceCents: item.hourlyRentalEnabled ? item.hourlyPriceCents : null,
      minRentalHours: item.minRentalHours,
      maxRentalHours: item.maxRentalHours,
      minRentalDays: item.minRentalDays,
      maxRentalDays: item.maxRentalDays,
      availableFromTime: item.availableFromTime,
      availableToTime: item.availableToTime,
      bufferHours: item.bufferHours,
      city: item.city,
      condition: item.condition,
      availableFrom: toDateOnlyString(item.availableFrom),
      availableTo: toDateOnlyString(item.availableTo),
      replacementValueCents: item.replacementValueCents,
      // Identifying note is only for the owner/admin (helps with disputes, not public).
      serialNote: isOwner || isAdmin ? item.serialNote : undefined,
      isActive: item.isActive,
      deactivatedByAdmin: item.deactivatedByAdmin,
      protectionEligible: item.protectionEligible,
      protectionAvailable: isProtectionAvailableFor(settings, item),
      createdAt: item.createdAt,
      images: item.images.map((i) => ({ id: i.id, url: i.url })),
      owner: { ...publicUser(item.owner), rating: ownerRating },
      rating,
      isFavorite: Boolean(favorite),
      isOwner,
      blockedRanges: blocked.map((b) => ({
        mode: b.rentalMode,
        start: toDateOnlyString(b.startDate),
        end: toDateOnlyString(b.endDate),
        startTime: b.startTime,
        endTime: b.endTime,
      })),
      estimateDaily,
      estimateHourly,
    },
  });
});

router.post('/', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(createSchema, req);
  const rental = {
    dailyRentalEnabled: data.dailyRentalEnabled ?? true,
    hourlyRentalEnabled: data.hourlyRentalEnabled ?? false,
    dailyPriceCents: centsOrNull(data.dailyPrice),
    hourlyPriceCents: centsOrNull(data.hourlyPrice),
    minRentalHours: data.minRentalHours ?? 1,
    maxRentalHours: data.maxRentalHours ?? 12,
    minRentalDays: data.minRentalDays ?? 1,
    maxRentalDays: data.maxRentalDays ?? 30,
    availableFromTime: data.availableFromTime ?? '08:00',
    availableToTime: data.availableToTime ?? '20:00',
    bufferHours: data.bufferHours ?? 0,
  };
  assertRentalSettings(rental);
  await assertImagesExist(data.images);
  const item = await prisma.item.create({
    data: {
      ownerId: user.id,
      title: data.title,
      category: data.category,
      description: data.description,
      ...rental,
      city: data.city,
      condition: data.condition,
      availableFrom: parseDateOnly(data.availableFrom),
      availableTo: parseDateOnly(data.availableTo),
      replacementValueCents: toCents(data.replacementValue),
      serialNote: data.serialNote ?? null,
      protectionEligible: data.protectionEligible ?? true,
      declarationsAcceptedAt: new Date(),
      images: { create: data.images.map((url, position) => ({ url, position })) },
    },
  });
  res.status(201).json({ item: { id: item.id } });
});

const loadOwnedItem = async (id: string, userId: string) => {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw notFound('Predmet sa nenašiel.');
  if (item.ownerId !== userId) throw forbidden('Tento predmet môže upravovať len jeho vlastník.');
  return item;
};

router.patch('/:id', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const item = await loadOwnedItem(param(req, 'id'), user.id);
  const data = parseBody(updateSchema, req);
  if (data.isActive === true && item.deactivatedByAdmin) {
    throw forbidden('Predmet deaktivoval administrátor. Kontaktuj podporu.');
  }
  const from = data.availableFrom ? parseDateOnly(data.availableFrom) : item.availableFrom;
  const to = data.availableTo ? parseDateOnly(data.availableTo) : item.availableTo;
  if (to < from) throw badRequest('Dátum „dostupné do“ musí byť po dátume „dostupné od“.');
  if (data.images) await assertImagesExist(data.images);
  const rentalSettings = {
    dailyRentalEnabled: data.dailyRentalEnabled ?? item.dailyRentalEnabled,
    hourlyRentalEnabled: data.hourlyRentalEnabled ?? item.hourlyRentalEnabled,
    dailyPriceCents: data.dailyPrice !== undefined ? centsOrNull(data.dailyPrice) : item.dailyPriceCents,
    hourlyPriceCents: data.hourlyPrice !== undefined ? centsOrNull(data.hourlyPrice) : item.hourlyPriceCents,
    minRentalHours: data.minRentalHours ?? item.minRentalHours,
    maxRentalHours: data.maxRentalHours ?? item.maxRentalHours,
    minRentalDays: data.minRentalDays ?? item.minRentalDays,
    maxRentalDays: data.maxRentalDays ?? item.maxRentalDays,
    availableFromTime: data.availableFromTime ?? item.availableFromTime,
    availableToTime: data.availableToTime ?? item.availableToTime,
    bufferHours: data.bufferHours ?? item.bufferHours,
  };
  assertRentalSettings(rentalSettings);

  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: { id: item.id },
      data: {
        title: data.title,
        category: data.category,
        description: data.description,
        ...rentalSettings,
        city: data.city,
        condition: data.condition,
        availableFrom: from,
        availableTo: to,
        replacementValueCents: data.replacementValue != null ? toCents(data.replacementValue) : undefined,
        serialNote: data.serialNote,
        protectionEligible: data.protectionEligible,
        isActive: data.isActive,
      },
    });
    if (data.images) {
      await tx.itemImage.deleteMany({ where: { itemId: item.id } });
      await tx.itemImage.createMany({ data: data.images.map((url, position) => ({ itemId: item.id, url, position })) });
    }
  });
  res.json({ item: { id: item.id } });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const item = await loadOwnedItem(param(req, 'id'), user.id);
  const openRentals = await prisma.rentalRequest.count({
    where: { itemId: item.id, status: { in: ['PENDING', ...BLOCKING_RENTAL_STATUSES] } },
  });
  if (openRentals > 0) throw conflict('Predmet má otvorené žiadosti alebo prebiehajúci prenájom. Najprv ich ukonči.');
  const history = await prisma.rentalRequest.count({ where: { itemId: item.id } });
  const reports = await prisma.damageReport.count({ where: { itemId: item.id } });
  if (history > 0 || reports > 0) {
    // Keep history for reviews/disputes – soft delete.
    await prisma.item.update({ where: { id: item.id }, data: { isActive: false } });
    return res.json({ ok: true, softDeleted: true });
  }
  await prisma.item.delete({ where: { id: item.id } });
  res.json({ ok: true, softDeleted: false });
});

router.post('/:id/favorite', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const item = await prisma.item.findUnique({ where: { id: param(req, 'id') } });
  if (!item || !item.isActive) throw notFound('Predmet sa nenašiel.');
  await prisma.favorite.upsert({
    where: { userId_itemId: { userId: user.id, itemId: item.id } },
    create: { userId: user.id, itemId: item.id },
    update: {},
  });
  res.json({ isFavorite: true });
});

router.delete('/:id/favorite', requireAuth, async (req, res) => {
  const user = currentUser(req);
  await prisma.favorite.deleteMany({ where: { userId: user.id, itemId: param(req, 'id') } });
  res.json({ isFavorite: false });
});

const listingReportSchema = z.object({
  type: z.enum(['ITEM_DIFFERENT_THAN_DESCRIPTION', 'USER_BEHAVIOR', 'OTHER'], {
    errorMap: () => ({ message: 'Vyber dôvod nahlásenia.' }),
  }),
  description: z.string().trim().min(10, 'Popíš problém aspoň 10 znakmi.').max(2000),
});

/** Report a listing (not tied to a rental) – goes to admin review. */
router.post('/:id/report', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(listingReportSchema, req);
  const item = await prisma.item.findUnique({ where: { id: param(req, 'id') } });
  if (!item) throw notFound('Predmet sa nenašiel.');
  if (item.ownerId === user.id) throw badRequest('Nemôžeš nahlásiť vlastný predmet.');
  const report = await prisma.damageReport.create({
    data: {
      itemId: item.id,
      reporterId: user.id,
      reportedUserId: item.ownerId,
      type: data.type,
      description: data.description,
    },
  });
  await notifyAdmins({ type: 'REPORT_CREATED', title: 'Nové nahlásenie inzerátu', link: `/admin/reports` });
  res.status(201).json({ report: { id: report.id, status: report.status } });
});

router.get('/:id/reviews', async (req, res) => {
  const [reviews, summary] = await Promise.all([
    prisma.itemReview.findMany({
      where: { itemId: param(req, 'id'), isHidden: false },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    itemRatingSummary(param(req, 'id')),
  ]);
  res.json({ summary, reviews });
});

export default router;
