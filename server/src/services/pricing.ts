import type { Category } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../lib/errors.js';
import type { AppSettings } from './settings.js';
import { getProtectionProvider, isProtectionAvailableFor } from './protection/index.js';
import type { ProtectionQuote, RentalDuration, RiskSignals } from './protection/index.js';

export interface PricingItem {
  dailyPriceCents: number | null;
  hourlyPriceCents: number | null;
  replacementValueCents: number;
  category: Category;
  protectionEligible: boolean;
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
  /** Non-refundable protection fee (NOT insurance) */
  protectionFeeCents: number;
  /** Refundable deposit (simulated in MVP) */
  depositCents: number;
  /** Platform fee – 0 unless enabled in settings */
  platformFeeCents: number;
  totalCents: number;
  /** Returned to the renter when nothing is withheld (= deposit) */
  refundableCents: number;
  currency: 'EUR';
  protectionMode: AppSettings['protectionMode'];
  protectionAvailable: boolean;
  protection: ProtectionQuote | null;
}

/** Deposit = depositPercentage × replacement value, rounded to whole euros, capped. Same for both modes. */
export const calculateDeposit = (replacementValueCents: number, settings: AppSettings): number => {
  const raw = Math.round((replacementValueCents * settings.depositPercentage) / 100) * 100;
  return Math.max(0, Math.min(raw, settings.maxDepositCents));
};

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

  const protectionAvailable = isProtectionAvailableFor(settings, item);
  let protection: ProtectionQuote | null = null;
  if (protectionAvailable) {
    protection = await getProtectionProvider(settings).getQuote({
      replacementValueCents: item.replacementValueCents,
      category: item.category,
      duration,
      riskSignals,
    });
  }
  const protectionFeeCents = protection?.available ? protection.feeCents : 0;
  const depositCents = calculateDeposit(item.replacementValueCents, settings);
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
    depositCents,
    platformFeeCents,
    totalCents: rentalPriceCents + protectionFeeCents + depositCents + platformFeeCents,
    refundableCents: depositCents,
    currency: 'EUR',
    protectionMode: protectionAvailable ? settings.protectionMode : 'NONE',
    protectionAvailable: Boolean(protection?.available),
    protection,
  };
};

/** Convenience for estimates (item detail, seed): daily price for N days. */
export const calculatePriceForDays = (item: PricingItem, days: number, settings: AppSettings, risk?: RiskSignals) =>
  calculateRentalPrice(item, { mode: 'DAILY', days }, settings, risk);
