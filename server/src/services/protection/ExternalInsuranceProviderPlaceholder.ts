import { AppError } from '../../lib/errors.js';
import type {
  CreateProtectionInput,
  ProtectionProvider,
  ProtectionQuote,
  ProtectionQuoteInput,
  ProtectionRecord,
  ProtectionStatus,
} from './types.js';

const notAvailable = () =>
  new AppError(
    501,
    'INSURANCE_NOT_AVAILABLE',
    'Skutočné poistenie zatiaľ nie je dostupné. Vyžaduje zmluvu s poisťovacím partnerom a právne schválené podmienky.',
  );

/**
 * EXTENSION POINT for a real insurance partner.
 *
 * This class intentionally does NOT produce quotes or policies. Before it can be implemented:
 *  - a real, licensed insurance partner must be contracted,
 *  - insurance terms (IPID etc.) must be provided by the partner,
 *  - legal review (incl. insurance distribution rules / IDD) must be completed,
 *  - INSURANCE_* env variables must be configured.
 * Never return fake prices or "insured" statuses from here.
 */
export class ExternalInsuranceProviderPlaceholder implements ProtectionProvider {
  readonly name = 'external-insurance-placeholder';

  async getQuote(_input: ProtectionQuoteInput): Promise<ProtectionQuote> {
    throw notAvailable();
  }

  async createProtection(_input: CreateProtectionInput): Promise<ProtectionRecord> {
    throw notAvailable();
  }

  async cancelProtection(_id: string): Promise<void> {
    throw notAvailable();
  }

  async getStatus(_id: string): Promise<ProtectionStatus> {
    throw notAvailable();
  }
}
