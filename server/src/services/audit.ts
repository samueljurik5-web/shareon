import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type Tx = Prisma.TransactionClient;

export const audit = async (
  entry: {
    adminId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
  },
  tx: Tx = prisma,
) =>
  tx.auditLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValue: entry.oldValue === undefined ? undefined : (JSON.parse(JSON.stringify(entry.oldValue)) as Prisma.InputJsonValue),
      newValue: entry.newValue === undefined ? undefined : (JSON.parse(JSON.stringify(entry.newValue)) as Prisma.InputJsonValue),
    },
  });
