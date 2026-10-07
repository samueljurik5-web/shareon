import { describe, expect, it } from 'vitest';
import {
  addDaysIso, CATEGORY_LABELS, daysLabel, formatDateRangeLong, formatDayLong, formatDuration, formatEur, formatPeriod, hoursLabel,
  priceLabels, RATING_LABELS,
} from '../lib/format';

const n = (s: string) => s.replace(/\s/g, ' ');

describe('format helpers', () => {
  it('formats euro amounts in Slovak locale', () => {
    expect(n(formatEur(5600))).toMatch(/56,00 €/);
  });
  it('adds days to ISO dates', () => {
    expect(addDaysIso('2026-10-30', 3)).toBe('2026-11-02');
  });
  it('has Slovak labels', () => {
    expect(RATING_LABELS[1]).toBe('Veľmi zlé');
    expect(CATEGORY_LABELS.GARDEN).toBe('Záhradné náradie');
  });
});

describe('rental periods (Slovak)', () => {
  it('formats dates and ranges like "12. – 14. október 2026"', () => {
    expect(formatDayLong('2026-10-12')).toBe('12. október 2026');
    expect(formatDateRangeLong('2026-10-12', '2026-10-14')).toBe('12. – 14. október 2026');
    expect(formatDateRangeLong('2026-09-30', '2026-10-02')).toBe('30. september – 2. október 2026');
  });
  it('formats hourly and daily periods and durations', () => {
    const hourly = { rentalMode: 'HOURLY' as const, startDate: '2026-10-12', endDate: '2026-10-12', startTime: '14:00', endTime: '18:00', durationMinutes: 240, durationDays: null };
    expect(formatPeriod(hourly)).toBe('12. október 2026, 14:00 – 18:00');
    expect(formatDuration(hourly)).toBe('4 hodiny');
    const daily = { rentalMode: 'DAILY' as const, startDate: '2026-10-12', endDate: '2026-10-14', startTime: null, endTime: null, durationMinutes: null, durationDays: 3 };
    expect(formatPeriod(daily)).toBe('12. – 14. október 2026');
    expect(formatDuration(daily)).toBe('3 dni');
  });
  it('uses correct Slovak plurals', () => {
    expect([1, 2, 5].map(hoursLabel)).toEqual(['1 hodina', '2 hodiny', '5 hodín']);
    expect(hoursLabel(1.5)).toBe('1,5 hodiny');
    expect([1, 3, 7].map(daysLabel)).toEqual(['1 deň', '3 dni', '7 dní']);
  });
  it('shows card prices by enabled mode', () => {
    expect(priceLabels({ hourlyPriceCents: 300, dailyPriceCents: 800 }).map((p) => n(p.text))).toEqual(['3,00 € / hod.', '8,00 € / deň']);
    expect(priceLabels({ hourlyPriceCents: null, dailyPriceCents: 800 })).toHaveLength(1);
  });
});
