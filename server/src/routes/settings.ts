import { Router } from 'express';
import { getSettings } from '../services/settings.js';
import {
  MVP_NOTICE_SK,
  PAYMENTS_SIMULATED_SK,
  PROTECTION_FEE,
  PROTECTION_FEE_HINT_SK,
  PROTECTION_NOTICE_SK,
} from '../services/protection/index.js';
import { DAMAGE_DISCLAIMER, REPORT_WINDOW_HOURS } from '../services/reports.js';

const router = Router();

/**
 * Operator name, contact e-mail and Instagram from the server environment (Render → Environment),
 * read at runtime – no rebuild needed. Same variable names as the client build (VITE_*).
 */
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
const siteInfo = () => {
  const email = clean(process.env.VITE_CONTACT_EMAIL);
  const instagram = clean(process.env.VITE_INSTAGRAM_URL);
  return {
    operatorName: clean(process.env.VITE_OPERATOR_NAME)?.slice(0, 120) ?? null,
    contactEmail: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    instagramUrl: instagram && /^https:\/\/\S+$/.test(instagram) ? instagram : null,
  };
};

/** Public, non-sensitive configuration for the UI. */
router.get('/public', async (_req, res) => {
  const s = await getSettings();
  res.json({
    settings: {
      // Ochrana prenájmu is included in every rental; there is no deposit.
      protectionFee: { rate: PROTECTION_FEE.rate, minCents: PROTECTION_FEE.minCents, maxCents: PROTECTION_FEE.maxCents },
      reportWindowHours: REPORT_WINDOW_HOURS,
      platformFeeEnabled: s.platformFeeEnabled,
      platformFeePercentage: s.platformFeePercentage,
      paymentsSimulated: true,
    },
    site: siteInfo(),
    texts: {
      protectionNotice: PROTECTION_NOTICE_SK,
      protectionHint: PROTECTION_FEE_HINT_SK,
      paymentNotice: PAYMENTS_SIMULATED_SK,
      mvpNotice: MVP_NOTICE_SK,
      damageDisclaimer: DAMAGE_DISCLAIMER,
    },
  });
});

export default router;
