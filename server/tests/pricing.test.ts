import { describe, expect, it } from 'vitest';
import { calculateDemoProtectionFee } from '../src/services/protection/index.js';
import { calculateDeposit, calculatePlatformFee, calculateRentalPrice } from '../src/services/pricing.js';
import { DEFAULT_SETTINGS } from '../src/services/settings.js';
import { rentalDays, parseDateOnly } from '../src/lib/dates.js';
import { inclusiveDays, zonedToUtc } from '../src/lib/time.js';
import { resolvePeriod } from '../src/services/availability.js';

const cfg = { minFeeCents: 150, percentage: 0.02, maxProtectedValueCents: 100000 };
const days = (n: number) => ({ mode: 'DAILY' as const, days: n });
const hours = (h: number) => ({ mode: 'HOURLY' as const, minutes: Math.round(h * 60) });
const item = { dailyPriceCents: 800, hourlyPriceCents: 300, replacementValueCents: 10000, category: 'GARDEN' as const, protectionEligible: true };

describe('protection fee calculation (demo formula)', () => {
  it('daily: minimum fee 1.50 €, 2 % of value, +5 % per day above 3, capped value, cent rounding', () => {
    expect(calculateDemoProtectionFee(5000, days(3), cfg).feeCents).toBe(150);
    expect(calculateDemoProtectionFee(10000, days(3), cfg).feeCents).toBe(200);
    expect(calculateDemoProtectionFee(10000, days(7), cfg).feeCents).toBe(240);
    const capped = calculateDemoProtectionFee(500000, days(3), cfg);
    expect(capped.protectedValueCents).toBe(100000);
    expect(capped.feeCents).toBe(2000);
    expect(calculateDemoProtectionFee(12345, days(4), cfg).feeCents).toBe(259);
  });

  it('hourly: share of one day, never below the minimum and never above a 1-day fee', () => {
    expect(calculateDemoProtectionFee(10000, hours(4), cfg).feeCents).toBe(150);
    // 2 % of 1 000 € = 20 € per day → 12 h = 10 €
    expect(calculateDemoProtectionFee(100000, hours(12), cfg).feeCents).toBe(1000);
    expect(calculateDemoProtectionFee(100000, hours(24), cfg).feeCents).toBe(calculateDemoProtectionFee(100000, days(1), cfg).feeCents);
  });
});

describe('calculateRentalPrice (server-side, both modes)', () => {
  it('daily reference example: 12.–14. = 3 days × 8 € + 2 € protection + 30 € deposit = 56 €', async () => {
    const period = resolvePeriod({ rentalMode: 'DAILY', startDate: '2026-10-12', endDate: '2026-10-14' });
    expect(period.duration).toEqual({ mode: 'DAILY', days: 3 });
    const p = await calculateRentalPrice(item, period.duration, DEFAULT_SETTINGS);
    expect(p).toMatchObject({
      rentalMode: 'DAILY',
      durationDays: 3,
      durationMinutes: null,
      pricePerUnitCents: 800,
      rentalPriceCents: 2400,
      protectionFeeCents: 200,
      depositCents: 3000,
      platformFeeCents: 0,
      totalCents: 5600,
      refundableCents: 3000,
    });
    expect(p.protection?.isInsurance).toBe(false);
  });

  it('hourly reference example: 14:00–18:00 = 4 h × 3 € + 1.50 € protection + 30 € deposit = 43.50 €', async () => {
    const period = resolvePeriod({ rentalMode: 'HOURLY', startDate: '2026-10-12', startTime: '14:00', endTime: '18:00' });
    expect(period.duration).toEqual({ mode: 'HOURLY', minutes: 240 });
    const p = await calculateRentalPrice(item, period.duration, DEFAULT_SETTINGS);
    expect(p).toMatchObject({
      rentalMode: 'HOURLY',
      durationMinutes: 240,
      durationDays: null,
      units: 4,
      pricePerUnitCents: 300,
      rentalPriceCents: 1200,
      protectionFeeCents: 150,
      depositCents: 3000,
      totalCents: 4350,
      refundableCents: 3000,
    });
  });

  it('supports fractional hours via minutes (1.5 h × 3 € = 4.50 €)', async () => {
    const p = await calculateRentalPrice(item, hours(1.5), DEFAULT_SETTINGS);
    expect(p.durationMinutes).toBe(90);
    expect(p.rentalPriceCents).toBe(450);
  });

  it('rejects a mode without a configured price', async () => {
    await expect(calculateRentalPrice({ ...item, hourlyPriceCents: null }, hours(2), DEFAULT_SETTINGS)).rejects.toThrow(
      'Predmet nemá nastavenú cenu za hodinu.',
    );
  });

  it('no protection when mode NONE or category not allowed; platform fee only when enabled', async () => {
    expect((await calculateRentalPrice(item, days(3), { ...DEFAULT_SETTINGS, protectionMode: 'NONE' })).protectionFeeCents).toBe(0);
    expect((await calculateRentalPrice({ ...item, category: 'OTHER' }, days(3), DEFAULT_SETTINGS)).protectionFeeCents).toBe(0);
    const withFee = await calculateRentalPrice(item, hours(4), { ...DEFAULT_SETTINGS, platformFeeEnabled: true, platformFeePercentage: 0.1 });
    expect(withFee.platformFeeCents).toBe(120);
    expect(withFee.totalCents).toBe(1200 + 150 + 3000 + 120);
  });

  it('deposit capped; platform fee off by default', () => {
    expect(calculateDeposit(10000, DEFAULT_SETTINGS)).toBe(3000);
    expect(calculateDeposit(10_000_000, DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS.maxDepositCents);
    expect(calculatePlatformFee(2400, DEFAULT_SETTINGS)).toBe(0);
  });
});

describe('date & time rules', () => {
  it('daily rentals include both start and end date', () => {
    expect(inclusiveDays('2026-10-12', '2026-10-14')).toBe(3);
    expect(inclusiveDays('2026-10-12', '2026-10-12')).toBe(1);
    expect(rentalDays(parseDateOnly('2026-10-12'), parseDateOnly('2026-10-14'))).toBe(3);
  });

  it('converts Europe/Bratislava wall time to UTC incl. DST', () => {
    expect(zonedToUtc('2026-10-12', '14:00').toISOString()).toBe('2026-10-12T12:00:00.000Z'); // CEST +2
    expect(zonedToUtc('2026-12-12', '14:00').toISOString()).toBe('2026-12-12T13:00:00.000Z'); // CET +1
    // DST ends 25.10.2026 – a daily rental that day still spans the full local day (25 h)
    const p = resolvePeriod({ rentalMode: 'DAILY', startDate: '2026-10-25', endDate: '2026-10-25' });
    expect((p.endAt.getTime() - p.startAt.getTime()) / 3_600_000).toBe(25);
  });

  it('hourly periods: same day, start before end, 15-minute steps, no midnight crossing', () => {
    expect(() => resolvePeriod({ rentalMode: 'HOURLY', startDate: '2026-10-12', startTime: '18:00', endTime: '14:00' })).toThrow(
      /polnoc/,
    );
    expect(() =>
      resolvePeriod({ rentalMode: 'HOURLY', startDate: '2026-10-12', endDate: '2026-10-13', startTime: '10:00', endTime: '12:00' }),
    ).toThrow('Prenájom na hodiny musí začať aj skončiť v ten istý deň.');
    expect(() => resolvePeriod({ rentalMode: 'HOURLY', startDate: '2026-10-12', startTime: '10:10', endTime: '12:00' })).toThrow(/15-minútových/);
    expect(() => resolvePeriod({ rentalMode: 'DAILY', startDate: '2026-10-14', endDate: '2026-10-12' })).toThrow(/pred dátumom začiatku/);
  });
});
