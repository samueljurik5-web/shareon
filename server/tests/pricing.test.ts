import { describe, expect, it } from 'vitest';
import { calculateProtectionFee } from '../src/services/protection/index.js';
import { calculatePlatformFee, calculateRentalPrice } from '../src/services/pricing.js';
import { DEFAULT_SETTINGS } from '../src/services/settings.js';
import { rentalDays, parseDateOnly } from '../src/lib/dates.js';
import { inclusiveDays, zonedToUtc } from '../src/lib/time.js';
import { resolvePeriod } from '../src/services/availability.js';

const days = (n: number) => ({ mode: 'DAILY' as const, days: n });
const hours = (h: number) => ({ mode: 'HOURLY' as const, minutes: Math.round(h * 60) });
const item = { dailyPriceCents: 800, hourlyPriceCents: 300, replacementValueCents: 10000, category: 'GARDEN' as const };

describe('Ochrana prenájmu fee: 10 % of the rental price, 0,50 € – 5,00 €', () => {
  it.each([
    [500, 50, 550],
    [1200, 120, 1320],
    [3000, 300, 3300],
    [8000, 500, 8500],
    [12000, 500, 12500],
  ])('rental %i ct → fee %i ct → total %i ct', async (rental, fee, total) => {
    expect(calculateProtectionFee(rental)).toBe(fee);
    // Same through the full server-side breakdown (daily price × 1 day)
    const p = await calculateRentalPrice({ ...item, dailyPriceCents: rental }, days(1), DEFAULT_SETTINGS);
    expect(p).toMatchObject({ rentalPriceCents: rental, protectionFeeCents: fee, totalCents: total });
  });

  it('minimum for tiny rentals, cent rounding in between', () => {
    expect(calculateProtectionFee(100)).toBe(50);
    expect(calculateProtectionFee(1205)).toBe(121);
    expect(calculateProtectionFee(4999)).toBe(500);
  });
});

describe('calculateRentalPrice (server-side, both modes, no deposit)', () => {
  it('daily: 12.–14. = 3 days × 8 € = 24 € + 2,40 € Ochrana prenájmu = 26,40 €', async () => {
    const period = resolvePeriod({ rentalMode: 'DAILY', startDate: '2026-10-12', endDate: '2026-10-14' });
    expect(period.duration).toEqual({ mode: 'DAILY', days: 3 });
    const p = await calculateRentalPrice(item, period.duration, DEFAULT_SETTINGS);
    expect(p).toMatchObject({
      rentalMode: 'DAILY',
      durationDays: 3,
      durationMinutes: null,
      pricePerUnitCents: 800,
      rentalPriceCents: 2400,
      protectionFeeCents: 240,
      platformFeeCents: 0,
      totalCents: 2640,
    });
    expect(p).not.toHaveProperty('depositCents');
    expect(p.protection.isInsurance).toBe(false);
  });

  it('hourly: 14:00–18:00 = 4 h × 3 € = 12 € + 1,20 € Ochrana prenájmu = 13,20 €', async () => {
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
      protectionFeeCents: 120,
      totalCents: 1320,
    });
  });

  it('supports fractional hours via minutes (1,5 h × 3 € = 4,50 € + 0,50 € minimum fee)', async () => {
    const p = await calculateRentalPrice(item, hours(1.5), DEFAULT_SETTINGS);
    expect(p.durationMinutes).toBe(90);
    expect(p.rentalPriceCents).toBe(450);
    expect(p.protectionFeeCents).toBe(50);
  });

  it('rejects a mode without a configured price', async () => {
    await expect(calculateRentalPrice({ ...item, hourlyPriceCents: null }, hours(2), DEFAULT_SETTINGS)).rejects.toThrow(
      'Predmet nemá nastavenú cenu za hodinu.',
    );
  });

  it('protection in every category; platform fee only when enabled', async () => {
    expect((await calculateRentalPrice({ ...item, category: 'OTHER' }, days(3), DEFAULT_SETTINGS)).protectionFeeCents).toBe(240);
    expect(calculatePlatformFee(2400, DEFAULT_SETTINGS)).toBe(0);
    const withFee = await calculateRentalPrice(item, hours(4), { ...DEFAULT_SETTINGS, platformFeeEnabled: true, platformFeePercentage: 0.1 });
    expect(withFee.platformFeeCents).toBe(120);
    expect(withFee.totalCents).toBe(1200 + 120 + 120);
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
