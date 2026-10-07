import type { Item, Prisma, RentalMode } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict } from '../lib/errors.js';
import {
  addDaysToDate,
  inclusiveDays,
  isValidDate,
  TIME_RE,
  timeToMinutes,
  todayLocal,
  zonedToUtc,
} from '../lib/time.js';
import type { RentalDuration } from './protection/index.js';

type Tx = Prisma.TransactionClient;

/** Statuses that reserve the item (pending requests do not block the calendar). */
export const BLOCKING_RENTAL_STATUSES = ['ACCEPTED', 'ACTIVE', 'RETURN_PENDING', 'RETURNED', 'DISPUTED'] as const;

/** Hourly rentals are booked in 15-minute steps (e.g. 1,5 h). */
export const HOURLY_STEP_MINUTES = 15;

export interface RentalPeriodInput {
  rentalMode: RentalMode;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export interface ResolvedPeriod {
  mode: RentalMode;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  /** exact UTC interval of the reservation */
  startAt: Date;
  endAt: Date;
  duration: RentalDuration;
}

/**
 * Parses and normalises a requested period (shape only – no item rules).
 *  - DAILY: both dates are included (12.–14. = 3 days); interval = local midnight → midnight after endDate.
 *  - HOURLY: one calendar day, start < end, cannot cross midnight.
 */
export const resolvePeriod = (input: RentalPeriodInput): ResolvedPeriod => {
  if (!isValidDate(input.startDate)) throw badRequest('Zadaj platný dátum.');
  if (input.rentalMode === 'HOURLY') {
    if (input.endDate && input.endDate !== input.startDate) {
      throw badRequest('Prenájom na hodiny musí začať aj skončiť v ten istý deň.');
    }
    const { startTime, endTime } = input;
    if (!startTime || !TIME_RE.test(startTime)) throw badRequest('Zadaj platný čas začiatku (HH:MM).');
    if (!endTime || !TIME_RE.test(endTime)) throw badRequest('Zadaj platný čas konca (HH:MM).');
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (end <= start) {
      throw badRequest('Čas začiatku musí byť pred časom konca. Prenájom na hodiny nemôže prechádzať cez polnoc.');
    }
    if (start % HOURLY_STEP_MINUTES || end % HOURLY_STEP_MINUTES) {
      throw badRequest('Čas zadaj v 15-minútových krokoch (napr. 14:00, 14:15, 14:30).');
    }
    return {
      mode: 'HOURLY',
      startDate: input.startDate,
      endDate: input.startDate,
      startTime,
      endTime,
      startAt: zonedToUtc(input.startDate, startTime),
      endAt: zonedToUtc(input.startDate, endTime),
      duration: { mode: 'HOURLY', minutes: end - start },
    };
  }
  const endDate = input.endDate ?? input.startDate;
  if (!isValidDate(endDate)) throw badRequest('Zadaj platný dátum konca.');
  if (endDate < input.startDate) throw badRequest('Dátum konca nemôže byť pred dátumom začiatku.');
  return {
    mode: 'DAILY',
    startDate: input.startDate,
    endDate,
    startTime: null,
    endTime: null,
    startAt: zonedToUtc(input.startDate),
    endAt: zonedToUtc(addDaysToDate(endDate, 1)),
    duration: { mode: 'DAILY', days: inclusiveDays(input.startDate, endDate) },
  };
};

export type AvailabilityItem = Pick<
  Item,
  | 'id'
  | 'isActive'
  | 'availableFrom'
  | 'availableTo'
  | 'dailyRentalEnabled'
  | 'hourlyRentalEnabled'
  | 'dailyPriceCents'
  | 'hourlyPriceCents'
  | 'minRentalHours'
  | 'maxRentalHours'
  | 'minRentalDays'
  | 'maxRentalDays'
  | 'availableFromTime'
  | 'availableToTime'
  | 'bufferHours'
>;

const fmtHours = (h: number) => `${h} ${h === 1 ? 'hodina' : h >= 2 && h <= 4 ? 'hodiny' : 'hodín'}`;
const fmtDays = (d: number) => `${d} ${d === 1 ? 'deň' : d >= 2 && d <= 4 ? 'dni' : 'dní'}`;
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Server-side availability check used by quotes, rental creation, acceptance and date proposals.
 * Throws an AppError with a Slovak message when the period cannot be booked.
 */
export const checkItemAvailability = async (
  item: AvailabilityItem,
  period: ResolvedPeriod,
  opts: { excludeRentalId?: string; tx?: Tx; now?: Date; ownerActive?: boolean } = {},
): Promise<{ available: true }> => {
  const tx = opts.tx ?? prisma;
  const now = opts.now ?? new Date();

  if (!item.isActive || opts.ownerActive === false) throw conflict('Predmet momentálne nie je dostupný.');

  if (period.mode === 'HOURLY') {
    if (!item.hourlyRentalEnabled || !item.hourlyPriceCents) throw badRequest('Tento predmet sa nedá prenajať na hodiny.');
  } else if (!item.dailyRentalEnabled || !item.dailyPriceCents) {
    throw badRequest('Tento predmet sa nedá prenajať na dni.');
  }

  // Past
  if (period.mode === 'HOURLY' ? period.startAt <= now : period.startDate < todayLocal(now)) {
    throw badRequest('Začiatok prenájmu nemôže byť v minulosti.');
  }

  // Listing date range
  const from = dateOnly(item.availableFrom);
  const to = dateOnly(item.availableTo);
  if (period.startDate < from || period.endDate > to) {
    throw badRequest(`Predmet je dostupný len od ${from.split('-').reverse().join('. ')} do ${to.split('-').reverse().join('. ')}.`);
  }

  if (period.duration.mode === 'HOURLY') {
    const s = timeToMinutes(period.startTime!);
    const e = timeToMinutes(period.endTime!);
    if (s < timeToMinutes(item.availableFromTime) || e > timeToMinutes(item.availableToTime)) {
      throw badRequest(`Na hodiny je predmet dostupný len medzi ${item.availableFromTime} a ${item.availableToTime}.`);
    }
    const minutes = period.duration.minutes;
    if (minutes < item.minRentalHours * 60) throw badRequest(`Minimálna dĺžka prenájmu je ${fmtHours(item.minRentalHours)}.`);
    if (minutes > item.maxRentalHours * 60) throw badRequest(`Maximálna dĺžka prenájmu je ${fmtHours(item.maxRentalHours)}.`);
  } else {
    const days = period.duration.days;
    if (days < item.minRentalDays) throw badRequest(`Minimálna dĺžka prenájmu je ${fmtDays(item.minRentalDays)}.`);
    if (days > item.maxRentalDays) throw badRequest(`Maximálna dĺžka prenájmu je ${fmtDays(item.maxRentalDays)}.`);
  }

  // Overlap incl. buffer: [start, end) must keep `buffer` distance from every reservation.
  const bufferMs = item.bufferHours * 3_600_000;
  const overlapping = await tx.rentalRequest.count({
    where: {
      itemId: item.id,
      id: opts.excludeRentalId ? { not: opts.excludeRentalId } : undefined,
      status: { in: [...BLOCKING_RENTAL_STATUSES] },
      startAt: { lt: new Date(period.endAt.getTime() + bufferMs) },
      endAt: { gt: new Date(period.startAt.getTime() - bufferMs) },
    },
  });
  if (overlapping > 0) {
    throw conflict(
      item.bufferHours > 0
        ? `Predmet je v tomto termíne už rezervovaný (vrátane rezervy ${item.bufferHours} h medzi prenájmami).`
        : 'Predmet je v tomto termíne už rezervovaný.',
    );
  }
  return { available: true };
};
