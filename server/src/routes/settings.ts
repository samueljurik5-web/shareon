import { Router } from 'express';
import { getSettings } from '../services/settings.js';
import { isInsuranceProviderConfigured } from '../config/env.js';
import { DEMO_LABEL, DEMO_NOTICE_SK, PROTECTION_NOTICE, PROTECTION_NOTICE_SK } from '../services/protection/index.js';
import { SIMULATED_PAYMENT_LABEL } from '../services/deposit/index.js';
import { DAMAGE_DISCLAIMER } from '../services/reports.js';

const router = Router();

/** Public, non-sensitive configuration for the UI. */
router.get('/public', async (_req, res) => {
  const s = await getSettings();
  res.json({
    settings: {
      protectionMode: s.protectionMode,
      protectionActive: s.protectionActive,
      minProtectionFeeCents: s.minProtectionFeeCents,
      protectionPercentage: s.protectionPercentage,
      maxProtectedValueCents: s.maxProtectedValueCents,
      maxDepositCents: s.maxDepositCents,
      depositPercentage: s.depositPercentage,
      allowedCategories: s.allowedCategories,
      platformFeeEnabled: s.platformFeeEnabled,
      platformFeePercentage: s.platformFeePercentage,
      protectionProvider: s.protectionMode === 'PROTECTION_FEE' ? 'mock' : s.protectionMode === 'NONE' ? 'none' : 'external',
      insuranceAvailable: isInsuranceProviderConfigured(),
      paymentsSimulated: true,
    },
    texts: {
      protectionNotice: PROTECTION_NOTICE,
      protectionNoticeSk: PROTECTION_NOTICE_SK,
      demoLabel: DEMO_LABEL,
      demoNotice: DEMO_NOTICE_SK,
      simulatedPaymentLabel: SIMULATED_PAYMENT_LABEL,
      damageDisclaimer: DAMAGE_DISCLAIMER,
    },
  });
});

export default router;
