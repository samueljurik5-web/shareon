import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type Tx = Prisma.TransactionClient;

export const notify = (
  userId: string,
  data: { type: string; title: string; body?: string; link?: string },
  tx: Tx = prisma,
) => tx.notification.create({ data: { userId, ...data } });

export const notifyAdmins = async (data: { type: string; title: string; body?: string; link?: string }, tx: Tx = prisma) => {
  const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  await tx.notification.createMany({ data: admins.map((a) => ({ userId: a.id, ...data })) });
};
