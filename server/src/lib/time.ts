/**
 * Time helpers for ShareOn. All user-facing dates/times are Europe/Bratislava wall-clock time;
 * exact instants are stored in UTC. Implemented with Intl only (no extra dependency).
 */
export const TIME_ZONE = 'Europe/Bratislava';

const MINUTE = 60_000;
const DAY_MS = 86_400_000;

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "14:30" → 870 */
export const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Wall-clock parts of a UTC instant in Europe/Bratislava. */
export const zonedParts = (instant: Date) => {
  const p = Object.fromEntries(partsFmt.formatToParts(instant).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    asUtcMs: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second),
  };
};

/** Offset of Europe/Bratislava from UTC at the given instant, in ms (+1h or +2h). */
const offsetAt = (instant: number) => zonedParts(new Date(instant)).asUtcMs - Math.floor(instant / 1000) * 1000;

/** Local Bratislava date + time → UTC instant (DST-safe). */
export const zonedToUtc = (date: string, time = '00:00'): Date => {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wall - offsetAt(wall);
  guess = wall - offsetAt(guess); // second pass handles DST transitions
  return new Date(guess);
};

/** Today's date in Bratislava as YYYY-MM-DD. */
export const todayLocal = (now = new Date()): string => zonedParts(now).date;

/** Add days to a YYYY-MM-DD string (calendar arithmetic, no TZ issues). */
export const addDaysToDate = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
};

/** Inclusive number of calendar days: 12.→14. = 3, same day = 1. */
export const inclusiveDays = (start: string, end: string): number => {
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS) + 1;
};

export const isValidDate = (date: string): boolean => {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

export const msToMinutes = (ms: number) => Math.round(ms / MINUTE);
