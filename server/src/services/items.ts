import type { Item, ItemImage, Prisma, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getSettings } from './settings.js';
import { isProtectionAvailableFor } from './protection/index.js';
import { itemRatingsMap, userRatingsMap } from './stats.js';

export const BLOCKING_RENTAL_STATUSES = ['ACCEPTED', 'ACTIVE', 'RETURN_PENDING', 'RETURNED', 'DISPUTED'] as const;

type ItemWithRelations = Item & { images: ItemImage[]; owner: Pick<User, 'id' | 'name' | 'city' | 'avatarUrl'> };

export const itemInclude = {
  images: { orderBy: { position: 'asc' } },
  owner: { select: { id: true, name: true, city: true, avatarUrl: true } },
} satisfies Prisma.ItemInclude;

/** Card-level serialization for lists. */
export const serializeItems = async (items: ItemWithRelations[], viewerId?: string) => {
  const settings = await getSettings();
  const [ownerRatings, itemRatings, favorites] = await Promise.all([
    userRatingsMap([...new Set(items.map((i) => i.ownerId))]),
    itemRatingsMap(items.map((i) => i.id)),
    viewerId
      ? prisma.favorite.findMany({ where: { userId: viewerId, itemId: { in: items.map((i) => i.id) } } })
      : Promise.resolve([]),
  ]);
  const favSet = new Set(favorites.map((f) => f.itemId));
  return items.map((i) => ({
    id: i.id,
    title: i.title,
    category: i.category,
    description: i.description,
    pricePerDayCents: i.pricePerDayCents,
    city: i.city,
    condition: i.condition,
    availableFrom: i.availableFrom,
    availableTo: i.availableTo,
    isActive: i.isActive,
    deactivatedByAdmin: i.deactivatedByAdmin,
    createdAt: i.createdAt,
    images: i.images.map((img) => ({ id: img.id, url: img.url })),
    owner: { ...i.owner, rating: ownerRatings.get(i.ownerId) ?? { average: null, count: 0 } },
    rating: itemRatings.get(i.id) ?? { average: null, count: 0 },
    protectionAvailable: isProtectionAvailableFor(settings, i),
    isFavorite: favSet.has(i.id),
  }));
};
