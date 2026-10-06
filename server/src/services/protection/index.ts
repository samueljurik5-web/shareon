import type { Category } from '@prisma/client';
import type { AppSettings } from '../settings.js';
import { isInsuranceProviderConfigured } from '../../config/env.js';
import { ExternalInsuranceProviderPlaceholder } from './ExternalInsuranceProviderPlaceholder.js';
import { MockProtectionProvider } from './MockProtectionProvider.js';
import { NoProtectionProvider } from './NoProtectionProvider.js';
import type { ProtectionProvider } from './types.js';

export * from './types.js';
export { calculateDemoProtectionFee } from './MockProtectionProvider.js';

/** Selects the provider for the current settings. */
export const getProtectionProvider = (settings: AppSettings): ProtectionProvider => {
  if (!settings.protectionActive || settings.protectionMode === 'NONE') return new NoProtectionProvider();
  if (settings.protectionMode === 'INSURANCE') {
    if (!isInsuranceProviderConfigured()) return new NoProtectionProvider();
    return new ExternalInsuranceProviderPlaceholder();
  }
  // PROTECTION_FEE – MVP uses the clearly labelled mock provider.
  return new MockProtectionProvider({
    minFeeCents: settings.minProtectionFeeCents,
    percentage: settings.protectionPercentage,
    maxProtectedValueCents: settings.maxProtectedValueCents,
  });
};

/** Whether an item can be protected under current settings. */
export const isProtectionAvailableFor = (
  settings: AppSettings,
  item: { category: Category; protectionEligible: boolean },
): boolean =>
  settings.protectionActive &&
  settings.protectionMode !== 'NONE' &&
  item.protectionEligible &&
  settings.allowedCategories.includes(item.category);
