import type { ResolvedPeriod } from './availability.js';

const MONTHS = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];

const parts = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
};

/** "12. október 2026" */
export const formatDateSk = (d: string) => {
  const { y, m, day } = parts(d);
  return `${day}. ${MONTHS[m - 1]} ${y}`;
};

/** "12. – 14. október 2026" / "30. september – 2. október 2026" */
export const formatDateRangeSk = (a: string, b: string) => {
  if (a === b) return formatDateSk(a);
  const s = parts(a);
  const e = parts(b);
  if (s.y === e.y && s.m === e.m) return `${s.day}. – ${e.day}. ${MONTHS[e.m - 1]} ${e.y}`;
  if (s.y === e.y) return `${s.day}. ${MONTHS[s.m - 1]} – ${e.day}. ${MONTHS[e.m - 1]} ${e.y}`;
  return `${formatDateSk(a)} – ${formatDateSk(b)}`;
};

/** Human-readable period for notifications (server side, Slovak). */
export const describePeriod = (p: Pick<ResolvedPeriod, 'mode' | 'startDate' | 'endDate' | 'startTime' | 'endTime'>) =>
  p.mode === 'HOURLY'
    ? `${formatDateSk(p.startDate)}, ${p.startTime} – ${p.endTime}`
    : formatDateRangeSk(p.startDate, p.endDate);
