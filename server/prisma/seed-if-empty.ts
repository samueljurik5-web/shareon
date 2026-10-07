/* Startup data step for disposable DEMO deployments (DEMO_SEED_ON_EMPTY=true):
 *  1. empty database   → run the full demo seed;
 *  2. existing demo DB → apply pending demo-data upgrades exactly once (tracked in AppSetting
 *     "demoDataVersion"). Only items owned by the built-in demo accounts are touched.
 * Never wipes or overwrites data of real users. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const DEMO_EMAILS = [
  'jana@example.sk',
  'martin@example.sk',
  'lucia@example.sk',
  'peter@example.sk',
  'zuzana@example.sk',
  'tomas@example.sk',
  'eva@example.sk',
];

/** Rental-mode settings introduced with hourly rentals (mirrors prisma/seed.ts). */
const HOURLY_DEMO_ITEMS: { title: string; hourly: number; daily: number | null; bufferHours?: number; value?: number }[] = [
  { title: 'Plotostrih aku 18V', hourly: 2, daily: 7 },
  { title: 'Vertikutátor elektrický', hourly: 3, daily: null },
  { title: 'Príklepová vŕtačka Bosch-like 750W', hourly: 3, daily: 8, bufferHours: 1, value: 100 },
  { title: 'Tlakový čistič 140 bar', hourly: 4, daily: 11, bufferHours: 1 },
  { title: 'Prenosný projektor + plátno', hourly: 5, daily: 13 },
];

/** Bump when demo data needs a new one-time upgrade. prisma/seed.ts writes the current value. */
const DEMO_DATA_VERSION = 2;

const upgradeDemoData = async (prisma: PrismaClient) => {
  const marker = await prisma.appSetting.findUnique({ where: { key: 'demoDataVersion' } });
  const current = typeof marker?.value === 'number' ? marker.value : 1;
  if (current >= DEMO_DATA_VERSION) {
    console.info(`[demo-data] up to date (version ${current})`);
    return;
  }
  let updated = 0;
  for (const d of HOURLY_DEMO_ITEMS) {
    const res = await prisma.item.updateMany({
      where: { title: d.title, owner: { email: { in: DEMO_EMAILS } } },
      data: {
        hourlyRentalEnabled: true,
        hourlyPriceCents: d.hourly * 100,
        dailyRentalEnabled: d.daily != null,
        dailyPriceCents: d.daily != null ? d.daily * 100 : null,
        minRentalHours: 1,
        maxRentalHours: 10,
        availableFromTime: '08:00',
        availableToTime: '20:00',
        bufferHours: d.bufferHours ?? 0,
        ...(d.value ? { replacementValueCents: d.value * 100 } : {}),
      },
    });
    updated += res.count;
  }
  await prisma.appSetting.upsert({
    where: { key: 'demoDataVersion' },
    create: { key: 'demoDataVersion', value: DEMO_DATA_VERSION },
    update: { value: DEMO_DATA_VERSION },
  });
  console.info(`[demo-data] upgraded to version ${DEMO_DATA_VERSION}: hourly rental enabled on ${updated} demo items`);
};

const run = async () => {
  if (process.env.DEMO_SEED_ON_EMPTY !== 'true') return;
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.count();
    if (users > 0) {
      console.info(`[seed-if-empty] database has ${users} users – skipping demo seed`);
      await upgradeDemoData(prisma);
      return;
    }
  } finally {
    await prisma.$disconnect();
  }
  console.info('[seed-if-empty] empty database – inserting demo data');
  const seed = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed.js');
  const res = spawnSync(process.execPath, [seed], { stdio: 'inherit', env: { ...process.env, ALLOW_SEED: 'true' } });
  if (res.status !== 0) process.exit(res.status ?? 1);
};

run().catch((e) => {
  console.error('[seed-if-empty] failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
