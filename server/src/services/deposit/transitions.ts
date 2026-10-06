import type { DepositStatus } from '@prisma/client';

/** Allowed deposit status transitions (state machine). */
export const DEPOSIT_TRANSITIONS: Record<DepositStatus, DepositStatus[]> = {
  NOT_REQUIRED: [],
  PENDING: ['HELD', 'RELEASED'],
  HELD: ['RELEASE_REQUESTED', 'RELEASED', 'DISPUTED', 'PARTIALLY_WITHHELD', 'WITHHELD'],
  RELEASE_REQUESTED: ['RELEASED', 'DISPUTED'],
  DISPUTED: ['RELEASED', 'PARTIALLY_WITHHELD', 'WITHHELD'],
  RELEASED: [],
  PARTIALLY_WITHHELD: [],
  WITHHELD: [],
};

export const canTransitionDeposit = (from: DepositStatus, to: DepositStatus): boolean =>
  DEPOSIT_TRANSITIONS[from].includes(to);
