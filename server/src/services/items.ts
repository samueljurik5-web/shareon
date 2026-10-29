import type { Item, ItemImage, Prisma, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { itemRatingsMap, userRatingsMap } from './stats.js';
import { BLOCKING_RENTAL_STATUSES, isAvailableToday } from './availability.js';
import { distanceFromCenterKm } from '../lib/districts.js';
import { addDaysToDate, todayLocal, zonedToUtc } from '../lib/time.js';

export { BLOCKING_RENTAL_STATUSES };

type ItemWithRelations = Item & { images: ItemImage[]; owner: Pick<User, 'id' | 'name' | 'city' | 'avatarUrl'> };

export const itemInclude = {
  images: { orderBy: { position: 'asc' } },
  owner: { select: { id: true, name: true, city: true, avatarUrl: true } },
} satisfies Prisma.ItemInclude;

/** Card-level serialization for lists. */
export const serializeItems = async (items: ItemWithRelations[], viewerId?: string) => {
  const now = new Date();
  const [ownerRatings, itemRatings, favorites, reservations] = await Promise.all([
    userRatingsMap([...new Set(items.map((i) => i.ownerId))]),
    itemRatingsMap(items.map((i) => i.id)),
    viewerId
      ? prisma.favorite.findMany({ where: { userId: viewerId, itemId: { in: items.map((i) => i.id) } } })
      : Promise.resolve([]),
    // Reservations that could block a rental starting today (max. 90 days + 72 h buffer).
    prisma.rentalRequest.findMany({
      where: {
        itemId: { in: items.map((i) => i.id) },
        status: { in: [...BLOCKING_RENTAL_STATUSES] },
        endAt: { gt: new Date(now.getTime() - 72 * 3_600_000) },
        startAt: { lt: zonedToUtc(addDaysToDate(todayLocal(now), 94)) },
      },
      select: { itemId: true, startAt: true, endAt: true },
    }),
  ]);
  const favSet = new Set(favorites.map((f) => f.itemId));
  const reservationsByItem = new Map<string, typeof reservations>();
  for (const r of reservations) reservationsByItem.set(r.itemId, [...(reservationsByItem.get(r.itemId) ?? []), r]);
  return items.map((i) => ({
    id: i.id,
    title: i.title,
    category: i.category,
    description: i.description,
    dailyPriceCents: i.dailyRentalEnabled ? i.dailyPriceCents : null,
    hourlyPriceCents: i.hourlyRentalEnabled ? i.hourlyPriceCents : null,
    dailyRentalEnabled: i.dailyRentalEnabled,
    hourlyRentalEnabled: i.hourlyRentalEnabled,
    city: i.city,
    district: i.district,
    distanceKm: distanceFromCenterKm(i.district),
    isDemo: i.isDemo,
    availableToday: !i.isDemo && isAvailableToday(i, reservationsByItem.get(i.id) ?? [], now),
    condition: i.condition,
    availableFrom: i.availableFrom,
    availableTo: i.availableTo,
    isActive: i.isActive,
    deactivatedByAdmin: i.deactivatedByAdmin,
    createdAt: i.createdAt,
    images: i.images.map((img) => ({ id: img.id, url: img.url })),
    owner: { ...i.owner, rating: ownerRatings.get(i.ownerId) ?? { average: null, count: 0 } },
    rating: itemRatings.get(i.id) ?? { average: null, count: 0 },
    isFavorite: favSet.has(i.id),
  }));
};
