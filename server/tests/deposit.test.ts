import { beforeEach, describe, expect, it } from 'vitest';
import { canTransitionDeposit } from '../src/services/deposit/index.js';
import { prisma } from '../src/lib/prisma.js';
import { api, resetDb, setupPendingRental, createUser } from './helpers.js';

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

describe('deposit API', () => {
  beforeEach(resetDb);

  it('holds a simulated deposit on acceptance, idempotently, and releases on cancel', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);

    const first = await api().post(`/api/deposits/${rentalId}/create`).set(renter.auth).expect(201);
    const second = await api().post(`/api/deposits/${rentalId}/create`).set(renter.auth).expect(201);
    expect(first.body.deposit.id).toBe(second.body.deposit.id);
    expect(first.body.deposit.status).toBe('HELD');
    expect(first.body.deposit.label).toBe('SIMULATED PAYMENT');
    expect(await prisma.deposit.count()).toBe(1);

    await api().patch(`/api/rental-requests/${rentalId}/status`).set(renter.auth).send({ action: 'CANCEL' }).expect(200);
    const after = await api().get(`/api/deposits/${rentalId}`).set(renter.auth).expect(200);
    expect(after.body.deposit.status).toBe('RELEASED');
  });

  it('only admins can withhold; renters cannot release', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    const dep = await prisma.deposit.findUniqueOrThrow({ where: { rentalRequestId: rentalId } });

    await api().post(`/api/deposits/${dep.id}/withhold`).set(owner.auth).send({}).expect(403);
    await api().post(`/api/deposits/${dep.id}/release`).set(renter.auth).expect(403);

    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().post(`/api/deposits/${dep.id}/withhold`).set(admin.auth).send({ amount: 10 }).expect(200);
    expect(res.body.deposit.status).toBe('PARTIALLY_WITHHELD');
    expect(res.body.deposit.withheldCents).toBe(1000);
    // terminal state – cannot be released any more
    await api().post(`/api/deposits/${dep.id}/release`).set(admin.auth).expect(409);
    expect(await prisma.auditLog.count({ where: { entityId: dep.id } })).toBe(1);
  });
});
