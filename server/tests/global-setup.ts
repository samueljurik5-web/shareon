import { execSync } from 'node:child_process';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://shareon:shareon@localhost:5432/shareon_test?schema=public';

export default function setup() {
  // Applies pending migrations to the dedicated TEST database (non-destructive).
  // Individual test files truncate tables via resetDb() in tests/helpers.ts.
  try {
    execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: 'pipe' });
  } catch (e) {
    const err = e as { stderr?: Buffer };
    throw new Error(`Test DB migration failed: ${err.stderr?.toString() ?? String(e)}`);
  }
}
