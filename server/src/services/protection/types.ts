import type { Category, ProtectionMode, ProtectionStatus } from '@prisma/client';

export interface RiskSignals {
  /** Completed rentals of the renter (more history = lower risk) */
  renterCompletedRentals: number;
  renterAverageRating: number | null;
  renterOpenReports: number;
  ownerCompletedRentals: number;
  ownerAverageRating: number | null;
}

export interface ProtectionQuoteInput {
  replacementValueCents: number;
  category: Category;
  rentalDays: number;
  riskSignals: RiskSignals;
}

export interface ProtectionQuote {
  provider: string;
  mode: ProtectionMode;
  /** Mock/demo provider: true. Must be shown as “DEMO / TEST MODE”. */
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

export const PROTECTION_NOTICE =
  'ShareOn Rental Protection is not insurance coverage. It is an internal platform protection mechanism. Compensation is not automatic and is assessed according to ShareOn rules and available evidence.';

export const PROTECTION_NOTICE_SK =
  'Ochrana prenájmu ShareOn nie je poistné krytie. Je to interný ochranný mechanizmus platformy. Kompenzácia nie je automatická a posudzuje sa podľa pravidiel ShareOn a dostupných dôkazov.';

export const DEMO_LABEL = 'DEMO / TEST MODE';
export const DEMO_NOTICE_SK = 'Toto nie je skutočné poistné krytie.';
