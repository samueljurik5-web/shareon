import { describe, expect, it } from 'vitest';
import { addDaysIso, formatEur, RATING_LABELS, CATEGORY_LABELS } from '../lib/format';

describe('format helpers', () => {
  it('formats euro amounts in Slovak locale', () => {
    expect(formatEur(5600).replace(/\s/g, ' ')).toMatch(/56,00 €/);
  });
  it('adds days to ISO dates', () => {
    expect(addDaysIso('2026-10-30', 3)).toBe('2026-11-02');
  });
  it('has Slovak labels', () => {
    expect(RATING_LABELS[1]).toBe('Veľmi zlé');
    expect(RATING_LABELS[5]).toBe('Výborné');
    expect(CATEGORY_LABELS.GARDEN).toBe('Záhradné náradie');
  });
});
