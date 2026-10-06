import type { Category } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AppSettings } from './settings.js';
import { getProtectionProvider, isProtectionAvailableFor } from './protection/index.js';
import type { ProtectionQuote, RiskSignals } from './protection/index.js';
import { rentalDays as countDays } from '../lib/dates.js';

export interface PricingItem {
  pricePerDayCents: number;
  replacementValueCents: number;
  category: Category;
  protectionEligible: boolean;
}

export interface PriceBreakdown {
  rentalDays: number;
  pricePerDayCents: number;
  /** Non-refundable rental price */
  rentalPriceCents: number;
  /** Non-refundable protection fee (not insurance) */
  protectionFeeCents: number;
  /** Refundable deposit (simulated in MVP) */
  depositCents: number;
  /** Platform fee – 0 unless enabled in settings */
  platformFeeCents: number;
  totalCents: number;
  currency: 'EUR';
  protectionMode: AppSettings['protectionMode'];
  protectionAvailable: boolean;
  protection: ProtectionQuote | null;
}

/** Deposit = depositPercentage × replacement value, rounded to whole euros, capped. */
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
 * Single source of truth for all money amounts. Always called on the server;
 * values sent by clients are never used.
 */
export const calculatePrice = async (
  item: PricingItem,
  start: Date,
  end: Date,
  settings: AppSettings,
  riskSignals: RiskSignals = emptyRiskSignals,
): Promise<PriceBreakdown> => {
  const days = countDays(start, end);
  return calculatePriceForDays(item, days, settings, riskSignals);
};

export const calculatePriceForDays = async (
  item: PricingItem,
  days: number,
  settings: AppSettings,
  riskSignals: RiskSignals = emptyRiskSignals,
): Promise<PriceBreakdown> => {
  const rentalPriceCents = days * item.pricePerDayCents;
  const protectionAvailable = isProtectionAvailableFor(settings, item);
  let protection: ProtectionQuote | null = null;
  if (protectionAvailable) {
    protection = await getProtectionProvider(settings).getQuote({
      replacementValueCents: item.replacementValueCents,
      category: item.category,
      rentalDays: days,
      riskSignals,
    });
  }
  const protectionFeeCents = protection?.available ? protection.feeCents : 0;
  const depositCents = calculateDeposit(item.replacementValueCents, settings);
  const platformFeeCents = calculatePlatformFee(rentalPriceCents, settings);
  return {
    rentalDays: days,
    pricePerDayCents: item.pricePerDayCents,
    rentalPriceCents,
    protectionFeeCents,
    depositCents,
    platformFeeCents,
    totalCents: rentalPriceCents + protectionFeeCents + depositCents + platformFeeCents,
    currency: 'EUR',
    protectionMode: protectionAvailable ? settings.protectionMode : 'NONE',
    protectionAvailable: Boolean(protection?.available),
    protection,
  };
};
