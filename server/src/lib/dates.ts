const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a YYYY-MM-DD string as a UTC date (midnight). */
export const parseDateOnly = (value: string): Date => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const todayUtc = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * Number of billed rental days. A rental from 1.10. to 4.10. is 3 days; a same-day
 * rental counts as 1 day.
 */
export const rentalDays = (start: Date, end: Date): number =>
  Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

export const toDateOnlyString = (date: Date): string => date.toISOString().slice(0, 10);
