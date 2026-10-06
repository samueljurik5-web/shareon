import type {
  CreateProtectionInput,
  ProtectionProvider,
  ProtectionQuote,
  ProtectionQuoteInput,
  ProtectionRecord,
  ProtectionStatus,
} from './types.js';
import { DEMO_LABEL, DEMO_NOTICE_SK, PROTECTION_NOTICE_SK } from './types.js';
import { cancelRecord, persistProtection, recordStatus } from './records.js';

export interface MockProtectionConfig {
  minFeeCents: number;
  percentage: number;
  maxProtectedValueCents: number;
}

/**
 * INTERNAL DEMO CALCULATION – NOT INSURANCE PRICING.
 *
 *   baseProtectionFee  = max(minFee (1.50 €), protectedValue × percentage (2 %))
 *   durationMultiplier = 1 + max(0, rentalDays − 3) × 0.05
 *   protectionFee      = round(baseProtectionFee × durationMultiplier, 2)
 *
 * protectedValue = min(replacementValue, maxProtectedValue).
 * Risk signals are recorded for transparency/analysis only and do not change the fee in the MVP.
 */
export const calculateDemoProtectionFee = (
  replacementValueCents: number,
  rentalDays: number,
  cfg: MockProtectionConfig,
) => {
  const protectedValueCents = Math.min(replacementValueCents, cfg.maxProtectedValueCents);
  const baseFeeCents = Math.max(cfg.minFeeCents, protectedValueCents * cfg.percentage);
  const durationMultiplier = 1 + Math.max(0, rentalDays - 3) * 0.05;
  const feeCents = Math.round(baseFeeCents * durationMultiplier + 1e-9);
  return { protectedValueCents, baseFeeCents, durationMultiplier, feeCents };
};

export class MockProtectionProvider implements ProtectionProvider {
  readonly name = 'mock';

  constructor(private readonly cfg: MockProtectionConfig) {}

  async getQuote(input: ProtectionQuoteInput): Promise<ProtectionQuote> {
    const calc = calculateDemoProtectionFee(input.replacementValueCents, input.rentalDays, this.cfg);
    return {
      provider: this.name,
      mode: 'PROTECTION_FEE',
      isDemo: true,
      isInsurance: false,
      available: true,
      feeCents: calc.feeCents,
      protectedValueCents: calc.protectedValueCents,
      breakdown: {
        label: DEMO_LABEL,
        calculation: 'Interný demo výpočet – nejde o cenu poistenia.',
        category: input.category,
        rentalDays: input.rentalDays,
        baseFeeCents: Math.round(calc.baseFeeCents),
        durationMultiplier: calc.durationMultiplier,
        renterCompletedRentals: input.riskSignals.renterCompletedRentals,
        renterOpenReports: input.riskSignals.renterOpenReports,
        ownerCompletedRentals: input.riskSignals.ownerCompletedRentals,
      },
      disclaimer: `${DEMO_LABEL}: ${DEMO_NOTICE_SK} ${PROTECTION_NOTICE_SK}`,
    };
  }

  createProtection(input: CreateProtectionInput): Promise<ProtectionRecord> {
    return persistProtection(this.name, 'PROTECTION_FEE', input);
  }

  cancelProtection(id: string): Promise<void> {
    return cancelRecord(id);
  }

  getStatus(id: string): Promise<ProtectionStatus> {
    return recordStatus(id);
  }
}
