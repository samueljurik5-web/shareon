import { describe, expect, it } from 'vitest';
import { calculateDemoProtectionFee } from '../src/services/protection/index.js';
import { calculateDeposit, calculatePlatformFee, calculatePriceForDays } from '../src/services/pricing.js';
import { DEFAULT_SETTINGS } from '../src/services/settings.js';
import { rentalDays, parseDateOnly } from '../src/lib/dates.js';

const cfg = { minFeeCents: 150, percentage: 0.02, maxProtectedValueCents: 100000 };

describe('protection fee calculation (demo formula)', () => {
  it('uses the minimum fee of 1.50 € for cheap items', () => {
    expect(calculateDemoProtectionFee(5000, 3, cfg).feeCents).toBe(150);
  });

  it('uses 2 % of replacement value when above minimum', () => {
    expect(calculateDemoProtectionFee(10000, 3, cfg).feeCents).toBe(200);
  });

  it('applies duration multiplier of +5 % per day above 3 days', () => {
    // base 2.00 € × (1 + 4 × 0.05) = 2.40 €
    expect(calculateDemoProtectionFee(10000, 7, cfg).feeCents).toBe(240);
    expect(calculateDemoProtectionFee(10000, 7, cfg).durationMultiplier).toBeCloseTo(1.2);
  });

  it('caps protected value at the configured maximum', () => {
    const r = calculateDemoProtectionFee(500000, 3, cfg);
    expect(r.protectedValueCents).toBe(100000);
    expect(r.feeCents).toBe(2000);
  });

  it('rounds to cents', () => {
    // 2 % of 123.45 € = 2.469 € → ×1.05 (4 days) = 2.59245 → 2.59 €
    expect(calculateDemoProtectionFee(12345, 4, cfg).feeCents).toBe(259);
  });
});

describe('server-side price calculation', () => {
  it('matches the reference example: 3 days × 8 € + 2 € protection + 30 € deposit = 56 €', async () => {
    const price = await calculatePriceForDays(
      { pricePerDayCents: 800, replacementValueCents: 10000, category: 'GARDEN', protectionEligible: true },
      3,
      DEFAULT_SETTINGS,
    );
    expect(price.rentalPriceCents).toBe(2400);
    expect(price.protectionFeeCents).toBe(200);
    expect(price.depositCents).toBe(3000);
    expect(price.platformFeeCents).toBe(0);
    expect(price.totalCents).toBe(5600);
    expect(price.protection?.isDemo).toBe(true);
    expect(price.protection?.isInsurance).toBe(false);
  });

  it('charges no protection when mode is NONE', async () => {
    const price = await calculatePriceForDays(
      { pricePerDayCents: 800, replacementValueCents: 10000, category: 'GARDEN', protectionEligible: true },
      3,
      { ...DEFAULT_SETTINGS, protectionMode: 'NONE' },
    );
    expect(price.protectionFeeCents).toBe(0);
    expect(price.protectionAvailable).toBe(false);
    expect(price.totalCents).toBe(5400);
  });

  it('charges no protection for categories outside the allowed list', async () => {
    const price = await calculatePriceForDays(
      { pricePerDayCents: 800, replacementValueCents: 10000, category: 'OTHER', protectionEligible: true },
      3,
      DEFAULT_SETTINGS,
    );
    expect(price.protectionFeeCents).toBe(0);
  });

  it('caps deposit and computes platform fee only when enabled', () => {
    expect(calculateDeposit(10000, DEFAULT_SETTINGS)).toBe(3000);
    expect(calculateDeposit(10_000_000, DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS.maxDepositCents);
    expect(calculatePlatformFee(2400, DEFAULT_SETTINGS)).toBe(0);
    expect(calculatePlatformFee(2400, { ...DEFAULT_SETTINGS, platformFeeEnabled: true, platformFeePercentage: 0.1 })).toBe(240);
  });

  it('counts rental days (same day = 1)', () => {
    expect(rentalDays(parseDateOnly('2026-10-01'), parseDateOnly('2026-10-04'))).toBe(3);
    expect(rentalDays(parseDateOnly('2026-10-01'), parseDateOnly('2026-10-01'))).toBe(1);
  });
});
