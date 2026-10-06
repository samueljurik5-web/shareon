import { Router } from 'express';
import { param } from '../lib/params.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../middleware/validate.js';
import { currentUser, requireAdmin, requireAuth } from '../middleware/auth.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { euroAmount } from '../lib/validation.js';
import { toCents } from '../lib/money.js';
import { loadRentalForParty } from '../services/rentals.js';
import { createDepositForRental, SIMULATED_PAYMENT_LABEL, transitionDeposit } from '../services/deposit/index.js';
import { audit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

const withLabel = <T extends { isSimulated: boolean }>(d: T) => ({ ...d, label: d.isSimulated ? SIMULATED_PAYMENT_LABEL : null });

router.post('/:rentalRequestId/create', async (req, res) => {
  const user = currentUser(req);
  const { rental } = await loadRentalForParty(param(req, 'rentalRequestId'), user);
  if (!['ACCEPTED', 'ACTIVE'].includes(rental.status)) throw conflict('Zálohu je možné vytvoriť len pre prijatý prenájom.');
  const deposit = await createDepositForRental(rental); // idempotent
  res.status(201).json({ deposit: withLabel(deposit) });
});

router.get('/:rentalRequestId', async (req, res) => {
  const user = currentUser(req);
  const { rental } = await loadRentalForParty(param(req, 'rentalRequestId'), user);
  const deposit = await prisma.deposit.findUnique({ where: { rentalRequestId: rental.id } });
  res.json({ deposit: deposit ? withLabel(deposit) : null });
});

/** Owner may release the deposit back to the renter (never against renter's interest); admin always. */
router.post('/:id/release', async (req, res) => {
  const user = currentUser(req);
  const deposit = await prisma.deposit.findUnique({ where: { id: param(req, 'id') }, include: { rentalRequest: true } });
  if (!deposit) throw notFound('Záloha sa nenašla.');
  const isAdmin = user.role === 'ADMIN';
  if (!isAdmin) {
    if (deposit.rentalRequest.ownerId !== user.id) throw forbidden('Zálohu môže uvoľniť len majiteľ alebo administrátor.');
    if (deposit.status === 'DISPUTED') throw forbidden('Záloha je v spore – rozhodne administrátor.');
  }
  const updated = await transitionDeposit(deposit.id, 'RELEASED');
  if (isAdmin) {
    await audit({ adminId: user.id, action: 'DEPOSIT_RELEASED', entityType: 'Deposit', entityId: deposit.id, oldValue: { status: deposit.status }, newValue: { status: updated.status } });
  }
  res.json({ deposit: withLabel(updated) });
});

const withholdSchema = z.object({ amount: euroAmount('Suma', 100000).optional() });

/** Admin only: withhold (fully or partially) a simulated deposit. */
router.post('/:id/withhold', requireAdmin, async (req, res) => {
  const admin = currentUser(req);
  const data = parseBody(withholdSchema, req);
  const deposit = await prisma.deposit.findUnique({ where: { id: param(req, 'id') } });
  if (!deposit) throw notFound('Záloha sa nenašla.');
  const amountCents = data.amount != null ? toCents(data.amount) : deposit.amountCents;
  const target = amountCents >= deposit.amountCents ? 'WITHHELD' : 'PARTIALLY_WITHHELD';
  const updated = await transitionDeposit(deposit.id, target, { withheldCents: amountCents });
  await audit({ adminId: admin.id, action: `DEPOSIT_${target}`, entityType: 'Deposit', entityId: deposit.id, oldValue: { status: deposit.status }, newValue: { status: updated.status, withheldCents: updated.withheldCents } });
  res.json({ deposit: withLabel(updated) });
});

export default router;
