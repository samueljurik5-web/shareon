/* Seeds demo data on startup ONLY when DEMO_SEED_ON_EMPTY=true and the database has no users.
 * Used for disposable demo deployments (e.g. Render free tier, which has no shell access).
 * Never wipes an existing database. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const run = async () => {
  if (process.env.DEMO_SEED_ON_EMPTY !== 'true') return;
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.count();
    if (users > 0) {
      console.info(`[seed-if-empty] database has ${users} users – skipping demo seed`);
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
