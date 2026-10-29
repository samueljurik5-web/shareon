import type {
  CreateProtectionInput,
  ProtectionProvider,
  ProtectionQuote,
  ProtectionQuoteInput,
  ProtectionRecord,
  ProtectionStatus,
} from './types.js';
import { calculateProtectionFee, PROTECTION_FEE, PROTECTION_NOTICE_SK } from './types.js';
import { cancelRecord, persistProtection, recordStatus } from './records.js';

/**
 * Ochrana prenájmu (MVP) – an internal ShareOn mechanism, priced from the rental price
 * (see PROTECTION_FEE). Payments are simulated in the MVP, so every quote/record is isDemo.
 * Risk signals are stored for transparency only and do not change the fee.
 */
export class MockProtectionProvider implements ProtectionProvider {
  readonly name = 'mock';

  async getQuote(input: ProtectionQuoteInput): Promise<ProtectionQuote> {
    return {
      provider: this.name,
      mode: 'PROTECTION_FEE',
      isDemo: true,
      isInsurance: false,
      available: true,
      feeCents: calculateProtectionFee(input.rentalPriceCents),
      protectedValueCents: input.replacementValueCents,
      breakdown: {
        rentalPriceCents: input.rentalPriceCents,
        rate: PROTECTION_FEE.rate,
        minCents: PROTECTION_FEE.minCents,
        maxCents: PROTECTION_FEE.maxCents,
        category: input.category,
        rentalMode: input.duration.mode,
        duration: input.duration.mode === 'HOURLY' ? `${input.duration.minutes} min` : `${input.duration.days} d`,
        renterCompletedRentals: input.riskSignals.renterCompletedRentals,
        renterOpenReports: input.riskSignals.renterOpenReports,
        ownerCompletedRentals: input.riskSignals.ownerCompletedRentals,
      },
      disclaimer: PROTECTION_NOTICE_SK,
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
