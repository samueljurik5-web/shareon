import type { Category } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../lib/errors.js';
import type { AppSettings } from './settings.js';
import { getProtectionProvider } from './protection/index.js';
import type { ProtectionQuote, RentalDuration, RiskSignals } from './protection/index.js';

export interface PricingItem {
  dailyPriceCents: number | null;
  hourlyPriceCents: number | null;
  replacementValueCents: number;
  category: Category;
}

/**
 * Complete server-side price breakdown. All amounts are integer cents (EUR).
 * Clients may display it but never send any of these values back as truth.
 */
export interface PriceBreakdown {
  rentalMode: 'DAILY' | 'HOURLY';
  /** Hourly rentals: exact minutes; daily: null */
  durationMinutes: number | null;
  /** Daily rentals: inclusive day count; hourly: null */
  durationDays: number | null;
  /** Billing quantity: hours (may be fractional, e.g. 1.5) or days */
  units: number;
  unit: 'HOUR' | 'DAY';
  pricePerUnitCents: number;
  /** Non-refundable rental price = units × pricePerUnit */
  rentalPriceCents: number;
  /** Ochrana prenájmu – included in every rental (10 %, 0,50–5,00 €) */
  protectionFeeCents: number;
  /** Platform fee – 0 unless enabled in settings */
  platformFeeCents: number;
  /** rental + Ochrana prenájmu + platform fee. There is no deposit in ShareOn. */
  totalCents: number;
  currency: 'EUR';
  protection: ProtectionQuote;
}

export const calculatePlatformFee = (rentalPriceCents: number, settings: AppSettings): number =>
  settings.platformFeeEnabled ? Math.round(rentalPriceCents * settings.platformFeePercentage) : 0;

export const emptyRiskSignals: RiskSignals = {
  renterCompletedRentals: 0,
  renterAverageRating: null,
  renterOpenReports: 0,
  ownerCompletedRentals: 0,
  ownerAverageRating: null,
};

export const loadRiskSignals = async (renterId: string | null, ownerId: string | null): Promise<RiskSignals> => {
  const signals = { ...emptyRiskSignals };
  if (renterId) {
    const [completed, avg, open] = await Promise.all([
      prisma.rentalRequest.count({ where: { renterId, status: 'COMPLETED' } }),
      prisma.review.aggregate({ where: { targetId: renterId, isHidden: false }, _avg: { overall: true } }),
      prisma.damageReport.count({
        where: { reportedUserId: renterId, status: { in: ['OPEN', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'] } },
      }),
    ]);
    signals.renterCompletedRentals = completed;
    signals.renterAverageRating = avg._avg.overall;
    signals.renterOpenReports = open;
  }
  if (ownerId) {
    const [completed, avg] = await Promise.all([
      prisma.rentalRequest.count({ where: { ownerId, status: 'COMPLETED' } }),
      prisma.review.aggregate({ where: { targetId: ownerId, isHidden: false }, _avg: { overall: true } }),
    ]);
    signals.ownerCompletedRentals = completed;
    signals.ownerAverageRating = avg._avg.overall;
  }
  return signals;
};

/**
 * THE single source of truth for rental money amounts (hourly and daily).
 *   hourly: rentalPrice = totalHours × pricePerHour   (computed from minutes, rounded to cents)
 *   daily:  rentalPrice = totalDays × pricePerDay      (inclusive day rule)
 */
export const calculateRentalPrice = async (
  item: PricingItem,
  duration: RentalDuration,
  settings: AppSettings,
  riskSignals: RiskSignals = emptyRiskSignals,
): Promise<PriceBreakdown> => {
  const hourly = duration.mode === 'HOURLY';
  const pricePerUnitCents = hourly ? item.hourlyPriceCents : item.dailyPriceCents;
  if (!pricePerUnitCents || pricePerUnitCents <= 0) {
    throw badRequest(hourly ? 'Predmet nemá nastavenú cenu za hodinu.' : 'Predmet nemá nastavenú cenu za deň.');
  }
  const units = hourly ? duration.minutes / 60 : duration.days;
  const rentalPriceCents = hourly
    ? Math.round((duration.minutes * pricePerUnitCents) / 60)
    : duration.days * pricePerUnitCents;

  const protection = await getProtectionProvider().getQuote({
    rentalPriceCents,
    replacementValueCents: item.replacementValueCents,
    category: item.category,
    duration,
    riskSignals,
  });
  const protectionFeeCents = protection.feeCents;
  const platformFeeCents = calculatePlatformFee(rentalPriceCents, settings);
  return {
    rentalMode: duration.mode,
    durationMinutes: hourly ? duration.minutes : null,
    durationDays: hourly ? null : duration.days,
    units,
    unit: hourly ? 'HOUR' : 'DAY',
    pricePerUnitCents,
    rentalPriceCents,
    protectionFeeCents,
    platformFeeCents,
    totalCents: rentalPriceCents + protectionFeeCents + platformFeeCents,
    currency: 'EUR',
    protection,
  };
};

/** Convenience for estimates (item detail, seed): daily price for N days. */
export const calculatePriceForDays = (item: PricingItem, days: number, settings: AppSettings, risk?: RiskSignals) =>
  calculateRentalPrice(item, { mode: 'DAILY', days }, settings, risk);
