import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createItem, createUser, day, requestBody, resetDb, setupCompletedRental, setupPendingRental } from './helpers.js';

describe('rental requests', () => {
  beforeEach(resetDb);

  it('creates a request with server-side prices and ignores client-sent amounts', async () => {
    const owner = await createUser();
    const renter = await createUser();
    const item = await createItem(owner.user.id); // 8 €/day, value 100 €
    const res = await api()
      .post('/api/rental-requests')
      .set(renter.auth)
      .send({ ...requestBody(item.id, 5, 7), totalCents: 1, rentalPriceCents: 1, protectionFeeCents: 0, renterId: owner.user.id, status: 'COMPLETED' })
      .expect(201);
    const rental = await prisma.rentalRequest.findUniqueOrThrow({ where: { id: res.body.rentalRequest.id } });
    expect(rental.status).toBe('PENDING');
    expect(rental.renterId).toBe(renter.user.id);
    expect(rental.durationDays).toBe(3);
    expect(rental.rentalMode).toBe('DAILY');
    expect(rental.refundableCents).toBe(3000);
    expect(rental.rentalPriceCents).toBe(2400);
    expect(rental.protectionFeeCents).toBe(200);
    expect(rental.depositCents).toBe(3000);
    expect(rental.totalCents).toBe(5600);
    expect(await prisma.protectionQuote.count({ where: { rentalRequestId: rental.id } })).toBe(1);
  });

  it('rejects own item, past dates and missing rules agreement', async () => {
    const owner = await createUser();
    const item = await createItem(owner.user.id);
    await api().post('/api/rental-requests').set(owner.auth).send(requestBody(item.id)).expect(400);
    const renter = await createUser();
    await api().post('/api/rental-requests').set(renter.auth).send(requestBody(item.id, -3, -1)).expect(400);
    await api().post('/api/rental-requests').set(renter.auth).send({ ...requestBody(item.id), acceptRules: false }).expect(400);
  });

  it('requires the protection disclaimer when a protection fee applies', async () => {
    const owner = await createUser();
    const renter = await createUser();
    const item = await createItem(owner.user.id);
    const res = await api()
      .post('/api/rental-requests')
      .set(renter.auth)
      .send({ ...requestBody(item.id), acceptProtectionDisclaimer: false })
      .expect(400);
    expect(res.body.error.message).toContain('nie je poistenie');
  });

  it('hides contact details until accepted, then shows them', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    const before = await api().get(`/api/rental-requests/${rentalId}`).set(renter.auth).expect(200);
    expect(before.body.rentalRequest.owner.phone).toBeNull();
    expect(before.body.rentalRequest.owner.email).toBeNull();
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    const after = await api().get(`/api/rental-requests/${rentalId}`).set(renter.auth).expect(200);
    expect(after.body.rentalRequest.owner.phone).toBe('+421 900 123 456');
  });

  it('owner accepts: creates protection record and simulated deposit; renter cannot accept', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(renter.auth).send({ action: 'ACCEPT' }).expect(409);
    const res = await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    expect(res.body.rentalRequest.status).toBe('ACCEPTED');
    const protection = await prisma.protectionRecord.findUniqueOrThrow({ where: { rentalRequestId: rentalId } });
    expect(protection.isDemo).toBe(true);
    expect(protection.feeCents).toBe(200);
    const deposit = await prisma.deposit.findUniqueOrThrow({ where: { rentalRequestId: rentalId } });
    expect(deposit.status).toBe('HELD');
    expect(deposit.isSimulated).toBe(true);
    // idempotent protection creation
    const again = await api().post(`/api/protection/${rentalId}/create`).set(owner.auth).expect(201);
    expect(again.body.protection.id).toBe(protection.id);
  });

  it('owner rejects a request', async () => {
    const { owner, rentalId } = await setupPendingRental();
    const res = await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'REJECT', note: 'Nedá sa' }).expect(200);
    expect(res.body.rentalRequest.status).toBe('REJECTED');
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(409);
  });

  it('renter can cancel before acceptance; outsider cannot see the request', async () => {
    const { renter, rentalId } = await setupPendingRental();
    const outsider = await createUser();
    await api().get(`/api/rental-requests/${rentalId}`).set(outsider.auth).expect(403);
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(outsider.auth).send({ action: 'CANCEL' }).expect(403);
    const res = await api().patch(`/api/rental-requests/${rentalId}/status`).set(renter.auth).send({ action: 'CANCEL' }).expect(200);
    expect(res.body.rentalRequest.status).toBe('CANCELLED');
  });

  it('owner proposes different dates, renter accepts and price is recalculated', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    await api()
      .patch(`/api/rental-requests/${rentalId}/status`)
      .set(owner.auth)
      .send({ action: 'PROPOSE_DATES', startDate: day(10), endDate: day(15) })
      .expect(200);
    const res = await api().patch(`/api/rental-requests/${rentalId}/status`).set(renter.auth).send({ action: 'ACCEPT_PROPOSAL' }).expect(200);
    expect(res.body.rentalRequest.status).toBe('ACCEPTED');
    const rental = await prisma.rentalRequest.findUniqueOrThrow({ where: { id: rentalId } });
    expect(rental.durationDays).toBe(6); // 10.–15. inclusive
    expect(rental.rentalPriceCents).toBe(4800);
  });

  it('prevents overlapping accepted rentals', async () => {
    const { owner, item, rentalId } = await setupPendingRental();
    const renter2 = await createUser();
    const second = await api().post('/api/rental-requests').set(renter2.auth).send(requestBody(item.id, 6, 8)).expect(201);
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    await api().patch(`/api/rental-requests/${second.body.rentalRequest.id}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(409);
  });

  it('completes a rental via handover and return checklists and releases the deposit', async () => {
    const { rentalId } = await setupCompletedRental();
    const rental = await prisma.rentalRequest.findUniqueOrThrow({ where: { id: rentalId }, include: { deposit: true, handoverRecords: true } });
    expect(rental.status).toBe('COMPLETED');
    expect(rental.deposit?.status).toBe('RELEASED');
    expect(rental.handoverRecords).toHaveLength(4);
    expect(rental.handoverRecords.every((r) => r.userId && r.confirmedAt)).toBe(true);
  });

  it('owner reporting a return issue keeps the deposit held', async () => {
    const { owner, renter, rentalId } = await setupPendingRental();
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    await api().post(`/api/rental-requests/${rentalId}/handover`).set(owner.auth).send({}).expect(200);
    await api().post(`/api/rental-requests/${rentalId}/handover`).set(renter.auth).send({}).expect(200);
    await api().post(`/api/rental-requests/${rentalId}/handover`).set(renter.auth).send({}).expect(409);
    await api().post(`/api/rental-requests/${rentalId}/return`).set(owner.auth).send({}).expect(400); // itemOk required
    await api().post(`/api/rental-requests/${rentalId}/return`).set(owner.auth).send({ itemOk: false }).expect(200);
    const r = await api().post(`/api/rental-requests/${rentalId}/return`).set(renter.auth).send({}).expect(200);
    expect(r.body.rentalRequest.status).toBe('RETURNED');
    const dep = await prisma.deposit.findUniqueOrThrow({ where: { rentalRequestId: rentalId } });
    expect(dep.status).toBe('HELD');
  });
});
