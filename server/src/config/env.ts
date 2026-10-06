import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  RATE_LIMIT_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  // Payments – only "mock" exists. A real provider must be implemented before production use.
  PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),
  // Real insurance – ALL of these must be set (and legally reviewed) before INSURANCE mode can be enabled.
  INSURANCE_PROVIDER_NAME: z.string().optional(),
  INSURANCE_CONTRACT_REFERENCE: z.string().optional(),
  INSURANCE_TERMS_URL: z.string().url().optional(),
  INSURANCE_LEGAL_REVIEW_APPROVED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
});

// Treat empty strings (e.g. `INSURANCE_TERMS_URL=`) as unset.
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET.startsWith('dev-only')) {
  throw new Error('Refusing to start in production with a development JWT_SECRET');
}

export const env = parsed.data;

export const isInsuranceProviderConfigured = (): boolean =>
  Boolean(
    env.INSURANCE_PROVIDER_NAME &&
      env.INSURANCE_CONTRACT_REFERENCE &&
      env.INSURANCE_TERMS_URL &&
      env.INSURANCE_LEGAL_REVIEW_APPROVED,
  );
