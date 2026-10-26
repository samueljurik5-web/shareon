/* Demo-data facts shared by prisma/seed.ts (fresh DB) and prisma/seed-if-empty.ts (upgrades). */
import type { Category } from '@prisma/client';

/** Bump when demo data needs a new one-time upgrade (tracked in AppSetting "demoDataVersion"). */
export const DEMO_DATA_VERSION = 3;

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
