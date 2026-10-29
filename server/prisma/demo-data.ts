/* Demo-data facts shared by prisma/seed.ts (fresh DB) and prisma/seed-if-empty.ts (upgrades). */
import type { Category } from '@prisma/client';

/** Bump when demo data needs a new one-time upgrade (tracked in AppSetting "demoDataVersion"). */
export const DEMO_DATA_VERSION = 5;

/** Košice district of each demo owner (approximate location for distances – see src/lib/districts.ts). */
export const DEMO_OWNER_DISTRICTS: Record<string, string> = {
  'jana@example.sk': 'Západ',
  'martin@example.sk': 'Sídlisko KVP',
  'lucia@example.sk': 'Staré Mesto',
  'peter@example.sk': 'Sever',
  'zuzana@example.sk': 'Dargovských hrdinov',
  'tomas@example.sk': 'Juh',
  'eva@example.sk': 'Barca',
};

/** Demo items moved to the categories added for the home page quick filters. */
export const DEMO_CATEGORY_MOVES: { title: string; category: Category }[] = [
  { title: 'Prenosný projektor + plátno', category: 'ELECTRONICS' },
  { title: 'Plynový gril s 3 horákmi', category: 'HOUSEHOLD' },
];

/**
 * Realistic Slovak-market prices (€) for the demo items – hourly and daily on every item,
 * daily ≈ 4–5× hourly. Used by prisma/seed.ts and by the v4 demo-data upgrade.
 */
export const DEMO_PRICES: Record<string, { hourly: number; daily: number }> = {
  'Benzínová kosačka na trávu': { hourly: 3, daily: 14 },
  'Plotostrih aku 18V': { hourly: 2, daily: 9 },
  'Vertikutátor elektrický': { hourly: 3, daily: 12 },
  'Záhradný drvič konárov': { hourly: 4, daily: 18 },
  'Príklepová vŕtačka Bosch-like 750W': { hourly: 3, daily: 12 },
  'Kotúčová píla 1400W': { hourly: 3, daily: 14 },
  'Tlakový čistič 140 bar': { hourly: 5, daily: 20 },
  'Hliníkový rebrík 3×9': { hourly: 2, daily: 8 },
  'Paddleboard nafukovací 320 cm': { hourly: 5, daily: 22 },
  'Horský bicykel 29" veľkosť L': { hourly: 4, daily: 15 },
  'Bežky s viazaním, veľ. 190 cm': { hourly: 2, daily: 10 },
  'Stan pre 4 osoby': { hourly: 3, daily: 12 },
  'Prenosný projektor + plátno': { hourly: 5, daily: 18 },
  'Detský bicyklový vozík': { hourly: 2, daily: 9 },
  'Plynový gril s 3 horákmi': { hourly: 3, daily: 14 },
};
