import type { Category, ProtectionMode, ProtectionStatus, RentalMode } from '@prisma/client';

export interface RiskSignals {
  /** Completed rentals of the renter (more history = lower risk) */
  renterCompletedRentals: number;
  renterAverageRating: number | null;
  renterOpenReports: number;
  ownerCompletedRentals: number;
  ownerAverageRating: number | null;
}

/** Rental duration in the unit of its mode – minutes for hourly rentals, days for daily ones. */
export type RentalDuration = { mode: 'DAILY'; days: number } | { mode: 'HOURLY'; minutes: number };

export interface ProtectionQuoteInput {
  /** Rental price the fee is derived from (cents) */
  rentalPriceCents: number;
  replacementValueCents: number;
  category: Category;
  duration: RentalDuration;
  riskSignals: RiskSignals;
}

export type { RentalMode };

export interface ProtectionQuote {
  provider: string;
  mode: ProtectionMode;
  /** MVP: true – payments are simulated, no money is moved. */
  isDemo: boolean;
  isInsurance: boolean;
  available: boolean;
  unavailableReason?: string;
  feeCents: number;
  protectedValueCents: number;
  breakdown: Record<string, number | string | boolean>;
  disclaimer: string;
}

export interface CreateProtectionInput {
  rentalRequestId: string;
  idempotencyKey: string;
  quote: ProtectionQuote;
}

export interface ProtectionRecord {
  id: string;
  provider: string;
  status: ProtectionStatus;
  feeCents: number;
  protectedValueCents: number;
  isDemo: boolean;
}

export type { ProtectionStatus };

export interface ProtectionProvider {
  readonly name: string;
  getQuote(input: ProtectionQuoteInput): Promise<ProtectionQuote>;
  createProtection(input: CreateProtectionInput): Promise<ProtectionRecord>;
  cancelProtection(id: string): Promise<void>;
  getStatus(id: string): Promise<ProtectionStatus>;
}

/**
 * Ochrana prenájmu – MVP pricing, included in every rental (hourly and daily):
 *   fee = 10 % of the rental price, at least 0,50 €, at most 5,00 € per rental.
 */
export const PROTECTION_FEE = { rate: 0.1, minCents: 50, maxCents: 500 } as const;

/** Integer-cent fee for a rental price (10 % rounded half up, then clamped). */
export const calculateProtectionFee = (rentalPriceCents: number): number =>
  Math.min(PROTECTION_FEE.maxCents, Math.max(PROTECTION_FEE.minCents, Math.round(rentalPriceCents / 10)));

/** Short explanation shown under the fee. */
export const PROTECTION_FEE_HINT_SK = 'Chráni tvoj prenájom a pomáha riešiť prípadné škody alebo spory.';

/** Rules of Ochrana prenájmu – no guarantee, no automatic compensation. */
export const PROTECTION_NOTICE_SK =
  'Ochrana prenájmu je služba ShareOn, ktorá pomáha riešiť prípadné škody a spory. Každé hlásenie posudzuje tím ShareOn podľa pravidiel a dostupných dôkazov – náhrada nie je automatická ani garantovaná.';

/** First public test version – payments are simulated. */
export const MVP_NOTICE_SK = 'ShareOn je v prvej testovacej verzii. Pomôž nám ju zlepšiť svojou spätnou väzbou.';
export const PAYMENTS_SIMULATED_SK = 'V testovacej verzii sa platby zatiaľ reálne nestrhávajú – suma sa len prehľadne zaznamená v rezervácii.';
