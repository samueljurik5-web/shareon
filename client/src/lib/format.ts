import type { Category, Condition, DepositStatus, RentalStatus, ReportStatus, ReportType } from '../api/types';

const eur = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' });
export const formatEur = (cents: number) => eur.format(cents / 100);

export const formatDate = (iso: string | Date) =>
  new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

export const formatDateTime = (iso: string | Date) =>
  new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const todayIso = () => new Date().toISOString().slice(0, 10);
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
