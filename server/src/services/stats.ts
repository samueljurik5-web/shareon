import { prisma } from '../lib/prisma.js';

export interface RatingSummary {
  average: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

const emptyDistribution = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }) as RatingSummary['distribution'];

const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export const userRatingSummary = async (userId: string): Promise<RatingSummary> => {
  const groups = await prisma.review.groupBy({
    by: ['overall'],
    where: { targetId: userId, isHidden: false },
    _count: { _all: true },
  });
  return summarize(groups.map((g) => ({ value: g.overall, count: g._count._all })));
};

export const itemRatingSummary = async (itemId: string): Promise<RatingSummary> => {
  const groups = await prisma.itemReview.groupBy({
    by: ['overall'],
    where: { itemId, isHidden: false },
    _count: { _all: true },
  });
  return summarize(groups.map((g) => ({ value: g.overall, count: g._count._all })));
};

const summarize = (rows: { value: number; count: number }[]): RatingSummary => {
  const distribution = emptyDistribution();
  let total = 0;
  let sum = 0;
  for (const r of rows) {
    distribution[r.value as 1 | 2 | 3 | 4 | 5] = r.count;
    total += r.count;
    sum += r.value * r.count;
  }
  return { average: total ? round1(sum / total) : null, count: total, distribution };
};

/** Average rating & count for many users at once (for item cards). */
export const userRatingsMap = async (userIds: string[]) => {
  if (!userIds.length) return new Map<string, { average: number | null; count: number }>();
  const groups = await prisma.review.groupBy({
    by: ['targetId'],
    where: { targetId: { in: userIds }, isHidden: false },
    _avg: { overall: true },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.targetId, { average: round1(g._avg.overall), count: g._count._all }]));
};

export const itemRatingsMap = async (itemIds: string[]) => {
  if (!itemIds.length) return new Map<string, { average: number | null; count: number }>();
  const groups = await prisma.itemReview.groupBy({
    by: ['itemId'],
    where: { itemId: { in: itemIds }, isHidden: false },
    _avg: { overall: true },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.itemId, { average: round1(g._avg.overall), count: g._count._all }]));
};

export const userRentalStats = async (userId: string) => {
  const [completedRentals, successfulReturns, cancelledRentals] = await Promise.all([
    prisma.rentalRequest.count({ where: { status: 'COMPLETED', OR: [{ renterId: userId }, { ownerId: userId }] } }),
    prisma.rentalRequest.count({ where: { renterId: userId, status: 'COMPLETED', returnedAt: { not: null } } }),
    prisma.rentalRequest.count({ where: { status: 'CANCELLED', cancelledById: userId } }),
  ]);
  return { completedRentals, successfulReturns, cancelledRentals };
};
