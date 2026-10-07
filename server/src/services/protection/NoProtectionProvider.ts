import { AppError } from '../../lib/errors.js';
import type {
  CreateProtectionInput,
  ProtectionProvider,
  ProtectionQuote,
  ProtectionQuoteInput,
  ProtectionRecord,
  ProtectionStatus,
} from './types.js';
import { cancelRecord, recordStatus } from './records.js';

/** Used when protectionMode = NONE or protection is switched off. */
export class NoProtectionProvider implements ProtectionProvider {
  readonly name = 'none';

  async getQuote(input: ProtectionQuoteInput): Promise<ProtectionQuote> {
    return {
      provider: this.name,
      mode: 'NONE',
      isDemo: false,
      isInsurance: false,
      available: false,
      unavailableReason: 'Ochrana prenájmu nie je aktívna.',
      feeCents: 0,
      protectedValueCents: 0,
      breakdown: { rentalMode: input.duration.mode },
      disclaimer: 'Pre tento prenájom nie je aktívna žiadna ochrana.',
    };
  }

  async createProtection(_input: CreateProtectionInput): Promise<ProtectionRecord> {
    throw new AppError(400, 'PROTECTION_DISABLED', 'Ochrana prenájmu nie je aktívna.');
  }

  cancelProtection(id: string): Promise<void> {
    return cancelRecord(id);
  }

  getStatus(id: string): Promise<ProtectionStatus> {
    return recordStatus(id);
  }
}
