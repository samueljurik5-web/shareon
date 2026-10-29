import { z } from 'zod';
import type { Category, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export const CATEGORIES = ['GARDEN', 'SPORT', 'WORKSHOP', 'LEISURE', 'ELECTRONICS', 'HOUSEHOLD', 'OTHER'] as const satisfies readonly Category[];

export interface AppSettings {
  platformFeeEnabled: boolean;
  platformFeePercentage: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  platformFeeEnabled: false,
  platformFeePercentage: 0,
};

export const settingsPatchSchema = z
  .object({
    platformFeeEnabled: z.boolean(),
    platformFeePercentage: z.number().min(0).max(0.3),
  })
  .partial()
  .strict();

/** Stored settings over defaults – keys of removed settings (deposit, old protection modes) are ignored. */
export const getSettings = async (): Promise<AppSettings> => {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) } as AppSettings;
};

export const updateSettings = async (
  patch: z.infer<typeof settingsPatchSchema>,
): Promise<{ old: AppSettings; updated: AppSettings }> => {
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
