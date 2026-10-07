import type { Category, Condition, DepositStatus, RentalMode, RentalStatus, ReportStatus, ReportType } from '../api/types';

const eur = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' });
export const formatEur = (cents: number) => eur.format(cents / 100);

export const formatDate = (iso: string | Date) =>
  new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

export const formatDateTime = (iso: string | Date) =>
  new Intl.DateTimeFormat('sk-SK', { timeZone: 'Europe/Bratislava', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const todayIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const CATEGORY_LABELS: Record<Category, string> = {
  GARDEN: 'Záhradné náradie',
  SPORT: 'Šport',
  WORKSHOP: 'Dielňa',
  LEISURE: 'Voľný čas',
  OTHER: 'Ostatné',
};
export const CATEGORY_EMOJI: Record<Category, string> = { GARDEN: '🌿', SPORT: '🚴', WORKSHOP: '🛠️', LEISURE: '⛺', OTHER: '✨' };

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'Nový',
  VERY_GOOD: 'Veľmi dobrý',
  GOOD: 'Dobrý',
  USED: 'Používaný',
  WORN: 'Viditeľne opotrebovaný',
};

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  PENDING: 'Čaká na schválenie',
  ACCEPTED: 'Prijatá',
  REJECTED: 'Zamietnutá',
  CANCELLED: 'Zrušená',
  ACTIVE: 'Prebieha',
  RETURN_PENDING: 'Čaká na potvrdenie vrátenia',
  RETURNED: 'Vrátené',
  DISPUTED: 'V spore',
  COMPLETED: 'Dokončená',
};

export const RENTAL_STATUS_BADGE: Record<RentalStatus, string> = {
  PENDING: 'badge-warn',
  ACCEPTED: 'badge-info',
  REJECTED: 'badge-danger',
  CANCELLED: '',
  ACTIVE: 'badge-protect',
  RETURN_PENDING: 'badge-info',
  RETURNED: 'badge-info',
  DISPUTED: 'badge-danger',
  COMPLETED: 'badge-protect',
};

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  NOT_REQUIRED: 'Nevyžaduje sa',
  PENDING: 'Čaká',
  HELD: 'Blokovaná',
  RELEASE_REQUESTED: 'Požiadané o uvoľnenie',
  RELEASED: 'Uvoľnená',
  PARTIALLY_WITHHELD: 'Čiastočne zadržaná',
  WITHHELD: 'Zadržaná',
  DISPUTED: 'V spore',
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  ITEM_DAMAGED: 'Poškodený predmet',
  ITEM_NOT_RETURNED: 'Predmet nebol vrátený',
  LATE_RETURN: 'Oneskorené vrátenie',
  ITEM_DIFFERENT_THAN_DESCRIPTION: 'Predmet nezodpovedá popisu',
  USER_BEHAVIOR: 'Správanie používateľa',
  PAYMENT_PROBLEM: 'Problém s platbou',
  OTHER: 'Iné',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: 'Otvorené',
  UNDER_REVIEW: 'Posudzuje sa',
  NEEDS_MORE_INFORMATION: 'Potrebné viac informácií',
  APPROVED: 'Schválené',
  PARTIALLY_APPROVED: 'Čiastočne schválené',
  REJECTED: 'Zamietnuté',
  RESOLVED: 'Uzavreté',
};

export const HANDOVER_LABELS: Record<string, string> = {
  PERSONAL_PICKUP: 'Osobné vyzdvihnutie u majiteľa',
  OWNER_DELIVERY: 'Majiteľ prinesie predmet',
  MEET_ELSEWHERE: 'Stretnutie na dohodnutom mieste',
};

export const RATING_LABELS: Record<number, string> = { 1: 'Veľmi zlé', 2: 'Slabé', 3: 'Priemerné', 4: 'Dobré', 5: 'Výborné' };

export const PROTECTION_NOTICE =
  'ShareOn Rental Protection is not insurance coverage. It is an internal platform protection mechanism. Compensation is not automatic and is assessed according to ShareOn rules and available evidence.';
export const PROTECTION_NOTICE_SK =
  'Ochrana prenájmu ShareOn nie je poistné krytie. Je to interný ochranný mechanizmus platformy. Kompenzácia nie je automatická a posudzuje sa podľa pravidiel ShareOn a dostupných dôkazov.';
export const DAMAGE_DISCLAIMER =
  'ShareOn neposkytuje automatické rozhodnutie o škode. Prípad posudzuje administrátor podľa dostupných dôkazov a pravidiel platformy.';
export const ADMIN_WARNING =
  'Pred aktiváciou skutočných platieb alebo poistného krytia musí byť nakonfigurovaný reálny payment provider, poisťovací partner a právne schválené podmienky.';

export const EMPTY = {
  items: 'Zatiaľ tu nie sú žiadne predmety.',
  results: 'Nenašli sme žiadne výsledky.',
  requests: 'Zatiaľ nemáš žiadne žiadosti.',
  reviews: 'Zatiaľ nemáš žiadne hodnotenia.',
};

/** Image URL helper – uploads are served by the API; bundled placeholders by the client. */
export const imageUrl = (url: string | undefined) => {
  if (!url) return '/placeholders/other.svg';
  return url.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL ?? ''}${url}` : url;
};

// ───────────── Rental modes, durations, Europe/Bratislava dates ─────────────

export const TIME_ZONE = 'Europe/Bratislava';

export const RENTAL_MODE_LABELS: Record<RentalMode, string> = { HOURLY: 'Na hodiny', DAILY: 'Na dni' };
export const RENTAL_MODE_TITLES: Record<RentalMode, string> = { HOURLY: 'PRENÁJOM NA HODINY', DAILY: 'PRENÁJOM NA DNI' };

/** The single daily-rental rule shown to users. */
export const DAILY_RULE_TEXT = 'Začiatočný aj koncový deň sa rátajú – prenájom od 12. do 14. októbra = 3 dni.';

const MONTHS_SK = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];

const ymd = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
};

/** "12. október 2026" (calendar date string YYYY-MM-DD, no TZ shift) */
export const formatDayLong = (iso: string) => {
  const { y, m, d } = ymd(iso);
  return `${d}. ${MONTHS_SK[m - 1]} ${y}`;
};

/** "12. – 14. október 2026" */
export const formatDateRangeLong = (a: string, b: string) => {
  if (a.slice(0, 10) === b.slice(0, 10)) return formatDayLong(a);
  const s = ymd(a);
  const e = ymd(b);
  if (s.y === e.y && s.m === e.m) return `${s.d}. – ${e.d}. ${MONTHS_SK[e.m - 1]} ${e.y}`;
  if (s.y === e.y) return `${s.d}. ${MONTHS_SK[s.m - 1]} – ${e.d}. ${MONTHS_SK[e.m - 1]} ${e.y}`;
  return `${formatDayLong(a)} – ${formatDayLong(b)}`;
};

/** Slovak plural: 1 hodina, 2–4 hodiny, 5+ hodín, decimals "1,5 hodiny". */
export const hoursLabel = (h: number) => {
  const n = Number.isInteger(h) ? String(h) : h.toLocaleString('sk-SK', { maximumFractionDigits: 2 });
  if (!Number.isInteger(h)) return `${n} hodiny`;
  return `${n} ${h === 1 ? 'hodina' : h >= 2 && h <= 4 ? 'hodiny' : 'hodín'}`;
};
export const daysLabel = (d: number) => `${d} ${d === 1 ? 'deň' : d >= 2 && d <= 4 ? 'dni' : 'dní'}`;

export const formatDuration = (p: { rentalMode: RentalMode; durationMinutes: number | null; durationDays: number | null }) =>
  p.rentalMode === 'HOURLY' ? hoursLabel((p.durationMinutes ?? 0) / 60) : daysLabel(p.durationDays ?? 0);

/** "12. október 2026, 14:00 – 18:00" or "12. – 14. október 2026" */
export const formatPeriod = (p: { rentalMode: RentalMode; startDate: string; endDate: string; startTime: string | null; endTime: string | null }) =>
  p.rentalMode === 'HOURLY' ? `${formatDayLong(p.startDate)}, ${p.startTime} – ${p.endTime}` : formatDateRangeLong(p.startDate, p.endDate);

/** Card / detail price label according to enabled modes, e.g. "3 € / hod." and "od 8 € / deň". */
export const priceLabels = (i: { dailyPriceCents: number | null; hourlyPriceCents: number | null }) => {
  const out: { mode: RentalMode; text: string }[] = [];
  if (i.hourlyPriceCents) out.push({ mode: 'HOURLY', text: `${formatEur(i.hourlyPriceCents)} / hod.` });
  if (i.dailyPriceCents) out.push({ mode: 'DAILY', text: `${formatEur(i.dailyPriceCents)} / deň` });
  return out;
};

/** Date/time of an instant in Europe/Bratislava, e.g. "12. 10. 2026 14:05". */
export const formatInstant = (iso: string) =>
  new Intl.DateTimeFormat('sk-SK', { timeZone: TIME_ZONE, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
