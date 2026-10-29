import { MockProtectionProvider } from './MockProtectionProvider.js';
import type { ProtectionProvider } from './types.js';

export * from './types.js';

/** Ochrana prenájmu is included in every rental – a single internal provider in the MVP. */
export const getProtectionProvider = (): ProtectionProvider => new MockProtectionProvider();
