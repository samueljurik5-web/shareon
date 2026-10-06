import { z } from 'zod';
import type { Category, Prisma, ProtectionMode } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../lib/errors.js';
import { isInsuranceProviderConfigured } from '../config/env.js';

export const CATEGORIES: Category[] = ['GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE', 'OTHER'];

export interface AppSettings {
  protectionMode: ProtectionMode;
  protectionActive: boolean;
  minProtectionFeeCents: number;
  /** e.g. 0.02 = 2 % of (capped) replacement value */
  protectionPercentage: number;
  maxProtectedValueCents: number;
  /** Deposit = depositPercentage × replacement value, capped at maxDepositCents */
  depositPercentage: number;
  maxDepositCents: number;
  allowedCategories: Category[];
  platformFeeEnabled: boolean;
  platformFeePercentage: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  protectionMode: 'PROTECTION_FEE',
  protectionActive: true,
  minProtectionFeeCents: 150,
  protectionPercentage: 0.02,
  maxProtectedValueCents: 100000,
  depositPercentage: 0.3,
  maxDepositCents: 30000,
  allowedCategories: ['GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE'],
  platformFeeEnabled: false,
  platformFeePercentage: 0,
};

export const settingsPatchSchema = z
  .object({
    protectionMode: z.enum(['NONE', 'PROTECTION_FEE', 'INSURANCE']),
    protectionActive: z.boolean(),
    minProtectionFeeCents: z.number().int().min(0).max(10000),
    protectionPercentage: z.number().min(0).max(0.2),
    maxProtectedValueCents: z.number().int().min(0).max(1000000),
    depositPercentage: z.number().min(0).max(1),
    maxDepositCents: z.number().int().min(0).max(500000),
    allowedCategories: z.array(z.enum(['GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE', 'OTHER'])).max(5),
    platformFeeEnabled: z.boolean(),
    platformFeePercentage: z.number().min(0).max(0.3),
  })
  .partial()
  .strict();

export const getSettings = async (): Promise<AppSettings> => {
  const rows = await prisma.appSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const merged = { ...DEFAULT_SETTINGS, ...stored } as AppSettings;
  // Defensive: never run in INSURANCE mode without a configured real provider.
  if (merged.protectionMode === 'INSURANCE' && !isInsuranceProviderConfigured()) {
    merged.protectionMode = 'PROTECTION_FEE';
  }
  return merged;
};

export const INSURANCE_NOT_CONFIGURED_MESSAGE =
  'Režim INSURANCE nie je možné zapnúť: nie je nakonfigurovaný skutočný poisťovací partner, zmluva, poistné podmienky a právne schválenie.';

export const updateSettings = async (
  patch: z.infer<typeof settingsPatchSchema>,
): Promise<{ old: AppSettings; updated: AppSettings }> => {
  if (patch.protectionMode === 'INSURANCE' && !isInsuranceProviderConfigured()) {
    throw badRequest(INSURANCE_NOT_CONFIGURED_MESSAGE);
  }
  const old = await getSettings();
  await prisma.$transaction(
    Object.entries(patch).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue },
        update: { value: value as Prisma.InputJsonValue },
      }),
    ),
  );
  return { old, updated: await getSettings() };
};
