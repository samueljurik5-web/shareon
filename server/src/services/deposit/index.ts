import type { Deposit, DepositStatus, Prisma, RentalRequest } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { canTransitionDeposit } from './transitions.js';
import { depositProvider } from './DepositProvider.js';

export { canTransitionDeposit, DEPOSIT_TRANSITIONS } from './transitions.js';
export { SIMULATED_PAYMENT_LABEL } from './DepositProvider.js';

type Tx = Prisma.TransactionClient;

/** Creates (idempotently) the deposit for an accepted rental and simulates the hold. */
export const createDepositForRental = async (rental: RentalRequest, tx: Tx = prisma): Promise<Deposit> => {
  const idempotencyKey = `rental:${rental.id}:deposit`;
  const existing = await tx.deposit.findUnique({ where: { rentalRequestId: rental.id } });
  if (existing) return existing;
  if (rental.depositCents === 0) {
    return tx.deposit.create({
      data: {
        rentalRequestId: rental.id,
        amountCents: 0,
        status: 'NOT_REQUIRED',
        provider: depositProvider.name,
        isSimulated: depositProvider.isSimulated,
        idempotencyKey,
      },
    });
  }
  await depositProvider.hold({ amountCents: rental.depositCents, currency: rental.currency, idempotencyKey });
  return tx.deposit.create({
    data: {
      rentalRequestId: rental.id,
      amountCents: rental.depositCents,
      currency: rental.currency,
      status: 'HELD',
      heldAt: new Date(),
      provider: depositProvider.name,
      isSimulated: depositProvider.isSimulated,
      idempotencyKey,
    },
  });
};

/** Moves a deposit to a new status, enforcing the state machine. Returns unchanged deposit if already there. */
export const transitionDeposit = async (
  depositId: string,
  to: DepositStatus,
  opts: { withheldCents?: number } = {},
  tx: Tx = prisma,
): Promise<Deposit> => {
  const deposit = await tx.deposit.findUniqueOrThrow({ where: { id: depositId } });
  if (deposit.status === to) return deposit; // idempotent
  if (!canTransitionDeposit(deposit.status, to)) {
    throw conflict(`Zálohu nie je možné zmeniť zo stavu ${deposit.status} na ${to}.`);
  }
  let withheldCents = deposit.withheldCents;
  if (to === 'WITHHELD') withheldCents = deposit.amountCents;
  if (to === 'PARTIALLY_WITHHELD') {
    const amount = opts.withheldCents ?? 0;
    if (amount <= 0 || amount >= deposit.amountCents) {
      throw badRequest('Čiastočne zadržaná suma musí byť väčšia ako 0 a menšia ako celá záloha.');
    }
    withheldCents = amount;
  }
  const reference = `sim_${deposit.idempotencyKey}`;
  if (to === 'RELEASED') await depositProvider.release(reference);
  if (to === 'WITHHELD' || to === 'PARTIALLY_WITHHELD') await depositProvider.withhold(reference, withheldCents);

  // Optimistic concurrency: only update if status has not changed meanwhile.
  const updated = await tx.deposit.updateMany({
    where: { id: deposit.id, status: deposit.status },
    data: {
      status: to,
      withheldCents,
      releasedAt: ['RELEASED', 'PARTIALLY_WITHHELD', 'WITHHELD'].includes(to) ? new Date() : deposit.releasedAt,
    },
  });
  if (updated.count === 0) throw conflict('Záloha bola medzitým zmenená. Obnov stránku.');
  return tx.deposit.findUniqueOrThrow({ where: { id: deposit.id } });
};

/** Transition only when allowed; silently ignore otherwise (used by side effects). */
export const tryTransitionDeposit = async (rentalRequestId: string, to: DepositStatus, tx: Tx = prisma) => {
  const deposit = await tx.deposit.findUnique({ where: { rentalRequestId } });
  if (!deposit || deposit.status === to || !canTransitionDeposit(deposit.status, to)) return deposit;
  return transitionDeposit(deposit.id, to, {}, tx);
};
