import type { ProtectionMode } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { CreateProtectionInput, ProtectionRecord, ProtectionStatus } from './types.js';

/** Shared persistence for internal providers. Idempotent on idempotencyKey. */
export const persistProtection = async (
  provider: string,
  mode: ProtectionMode,
  input: CreateProtectionInput,
): Promise<ProtectionRecord> => {
  const existing = await prisma.protectionRecord.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;
  const byRental = await prisma.protectionRecord.findUnique({ where: { rentalRequestId: input.rentalRequestId } });
  if (byRental) return byRental;
  return prisma.protectionRecord.create({
    data: {
      rentalRequestId: input.rentalRequestId,
      provider,
      mode,
      status: 'ACTIVE',
      isDemo: input.quote.isDemo,
      feeCents: input.quote.feeCents,
      protectedValueCents: input.quote.protectedValueCents,
      idempotencyKey: input.idempotencyKey,
    },
  });
};

export const cancelRecord = async (id: string): Promise<void> => {
  await prisma.protectionRecord.updateMany({
    where: { id, status: { in: ['QUOTED', 'ACTIVE'] } },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
};

export const recordStatus = async (id: string): Promise<ProtectionStatus> => {
  const r = await prisma.protectionRecord.findUniqueOrThrow({ where: { id } });
  return r.status;
};
