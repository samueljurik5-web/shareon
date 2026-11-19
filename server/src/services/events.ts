import { prisma } from '../lib/prisma.js';
import { todayLocal } from '../lib/time.js';

/** Events the browser may report (page views / clicks). Server-side events are tracked directly. */
export const CLIENT_EVENTS = ['visit_home', 'view_search', 'view_item', 'view_sample_item', 'rent_click', 'add_item_open'] as const;

/** All funnel events, in the order shown in the admin. */
export const EVENT_LABELS: Record<string, string> = {
  visit_home: 'Návšteva hlavnej stránky',
  view_search: 'Otvorené vyhľadávanie',
  search: 'Vyhľadávanie s textom',
  view_item: 'Otvorený detail veci',
  view_sample_item: 'Otvorená ukážková vec',
  rent_click: 'Klik na „Požiadať o prenájom“',
  rental_request: 'Odoslaná žiadosť o prenájom',
  register: 'Registrácia',
  add_item_open: 'Otvorený formulár „Pridať vec“',
  item_created: 'Pridaná vec',
  waitlist: 'Zápis „Chcem byť medzi prvými“',
  demand: 'Odoslané „Čo hľadáš“',
  feedback: 'Spätná väzba',
};

const today = () => new Date(`${todayLocal()}T00:00:00Z`);

/**
 * Anonymous daily counter (no user, cookie, IP or visitor id). Never throws –
 * analytics must not break the request that triggered it.
 */
export const trackEvent = async (name: string): Promise<void> => {
  const day = today();
  try {
    await prisma.eventCount.upsert({
      where: { day_name: { day, name } },
      create: { day, name, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    // Concurrent first insert of the day → the row exists now, increment it once more.
    await prisma.eventCount.update({ where: { day_name: { day, name } }, data: { count: { increment: 1 } } }).catch(() => undefined);
  }
};

/** Stores the text of a search (lower-cased, no user data) with its number of results. */
export const logSearch = async (query: string, categories: string[] | undefined, resultCount: number): Promise<void> => {
  const q = query.trim().toLowerCase().slice(0, 100);
  if (q.length < 2) return;
  await prisma.searchLog
    .create({ data: { query: q, category: categories?.length ? categories.join(',') : null, resultCount } })
    .catch(() => undefined);
  await trackEvent('search');
};
