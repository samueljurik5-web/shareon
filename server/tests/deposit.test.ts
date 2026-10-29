import { beforeEach, describe, expect, it } from 'vitest';
import { canTransitionDeposit } from '../src/services/deposit/index.js';
import { prisma } from '../src/lib/prisma.js';
import { api, resetDb, setupPendingRental } from './helpers.js';

describe('deposit state machine', () => {
  it('allows valid transitions', () => {
    expect(canTransitionDeposit('PENDING', 'HELD')).toBe(true);
    expect(canTransitionDeposit('HELD', 'RELEASED')).toBe(true);
    expect(canTransitionDeposit('HELD', 'DISPUTED')).toBe(true);
    expect(canTransitionDeposit('DISPUTED', 'PARTIALLY_WITHHELD')).toBe(true);
    expect(canTransitionDeposit('RELEASE_REQUESTED', 'RELEASED')).toBe(true);
  });

  it('rejects invalid transitions from terminal states', () => {
    expect(canTransitionDeposit('RELEASED', 'HELD')).toBe(false);
    expect(canTransitionDeposit('WITHHELD', 'RELEASED')).toBe(false);
    expect(canTransitionDeposit('NOT_REQUIRED', 'HELD')).toBe(false);
    expect(canTransitionDeposit('PENDING', 'WITHHELD')).toBe(false);
  });
});

describe('no deposit in the rental flow', () => {
  beforeEach(resetDb);

  it('accepting a rental creates no deposit and the deposit API no longer exists', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    expect(await prisma.deposit.count()).toBe(0);
    await api().post(`/api/deposits/${rentalId}/create`).set(renter.auth).expect(404);
    const rental = await prisma.rentalRequest.findUniqueOrThrow({ where: { id: rentalId } });
    expect(rental.depositCents).toBe(0);
    expect(rental.totalCents).toBe(rental.rentalPriceCents + rental.protectionFeeCents);
  });

  it('a legacy rental that stored a deposit is shown without it and its deposit is released on cancel', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    const r = await prisma.rentalRequest.update({ where: { id: rentalId }, data: { depositCents: 3000, refundableCents: 3000, totalCents: { increment: 3000 } } });
    await prisma.deposit.create({ data: { rentalRequestId: rentalId, amountCents: 3000, status: 'HELD', provider: 'mock', idempotencyKey: `rental:${rentalId}:deposit` } });

    const detail = await api().get(`/api/rental-requests/${rentalId}`).set(renter.auth).expect(200);
    expect(detail.body.rentalRequest.price.totalCents).toBe(r.rentalPriceCents + r.protectionFeeCents);
    expect(JSON.stringify(detail.body.rentalRequest)).not.toMatch(/deposit/i);

    await api().patch(`/api/rental-requests/${rentalId}/status`).set(renter.auth).send({ action: 'CANCEL' }).expect(200);
    expect((await prisma.deposit.findUniqueOrThrow({ where: { rentalRequestId: rentalId } })).status).toBe('RELEASED');
  });
});
