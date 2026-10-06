import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createUser, resetDb, setupPendingRental } from './helpers.js';

const activeRental = async () => {
  const ctx = await setupPendingRental();
  await api().patch(`/api/rental-requests/${ctx.rentalId}/status`).set(ctx.owner.auth).send({ action: 'ACCEPT' }).expect(200);
  await api().post(`/api/rental-requests/${ctx.rentalId}/handover`).set(ctx.owner.auth).send({}).expect(200);
  await api().post(`/api/rental-requests/${ctx.rentalId}/handover`).set(ctx.renter.auth).send({}).expect(200);
  return ctx;
};

const damage = { type: 'ITEM_DAMAGED', description: 'Kosačka sa vrátila s prasknutým krytom noža.', requestedAmount: 40 };

describe('damage reports and admin decisions', () => {
  beforeEach(resetDb);

  it('creates a damage report: rental becomes DISPUTED, deposit DISPUTED, nothing approved automatically', async () => {
    const { owner, rentalId } = await activeRental();
    const res = await api().post(`/api/rental-requests/${rentalId}/dispute`).set(owner.auth).send(damage).expect(201);
    expect(res.body.report.status).toBe('OPEN');
    const report = await prisma.damageReport.findUniqueOrThrow({ where: { id: res.body.report.id } });
    expect(report.requestedAmountCents).toBe(4000);
    expect(report.approvedAmountCents).toBeNull();
    const rental = await prisma.rentalRequest.findUniqueOrThrow({ where: { id: rentalId }, include: { deposit: true } });
    expect(rental.status).toBe('DISPUTED');
    expect(rental.deposit?.status).toBe('DISPUTED');

    const detail = await api().get(`/api/reports/${report.id}`).set(owner.auth).expect(200);
    expect(detail.body.report.disclaimer).toContain('neposkytuje automatické rozhodnutie');
  });

  it('cannot report before acceptance or as an outsider', async () => {
    const { owner, rentalId } = await setupPendingRental();
    await api().post(`/api/rental-requests/${rentalId}/dispute`).set(owner.auth).send(damage).expect(409);
    const outsider = await createUser();
    await api().post('/api/reports').set(outsider.auth).send({ ...damage, rentalRequestId: rentalId }).expect(403);
  });

  it('other party responds; only the reported user may respond', async () => {
    const { owner, renter, rentalId } = await activeRental();
    const res = await api().post('/api/reports').set(owner.auth).send({ ...damage, rentalRequestId: rentalId }).expect(201);
    const id = res.body.report.id;
    await api().post(`/api/reports/${id}/response`).set(owner.auth).send({ text: 'x' }).expect(403);
    await api().post(`/api/reports/${id}/response`).set(renter.auth).send({ text: 'Kryt bol prasknutý už pred požičaním.' }).expect(201);
    await api().post(`/api/reports/${id}/evidence`).set(owner.auth).send({ text: 'Fotky z odovzdania ukazujú celý kryt.' }).expect(201);
    const detail = await api().get(`/api/reports/${id}`).set(renter.auth).expect(200);
    expect(detail.body.report.evidence).toHaveLength(2);
  });

  it('admin partially approves compensation, withholds part of deposit, and it is audit-logged', async () => {
    const { owner, renter, rentalId } = await activeRental();
    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().post('/api/reports').set(owner.auth).send({ ...damage, rentalRequestId: rentalId }).expect(201);
    const id = res.body.report.id;

    // non-admins cannot decide
    await api().post(`/api/admin/reports/${id}/decision`).set(owner.auth).send({ decision: 'APPROVED', approvedAmount: 40 }).expect(403);

    await api().patch(`/api/admin/reports/${id}/status`).set(admin.auth).send({ status: 'NEEDS_MORE_INFORMATION', note: 'Pošlite fotky.' }).expect(200);
    await api().post(`/api/reports/${id}/evidence`).set(owner.auth).send({ text: 'Doplňujem fotky.' }).expect(201);
    expect((await prisma.damageReport.findUniqueOrThrow({ where: { id } })).status).toBe('UNDER_REVIEW');

    // invalid partial amount
    await api().post(`/api/admin/reports/${id}/decision`).set(admin.auth).send({ decision: 'PARTIALLY_APPROVED', approvedAmount: 40 }).expect(400);

    const decision = await api()
      .post(`/api/admin/reports/${id}/decision`)
      .set(admin.auth)
      .send({ decision: 'PARTIALLY_APPROVED', approvedAmount: 20, publicNote: 'Čiastočne oprávnené.', internalNote: 'Staršie poškodenie pravdepodobné.', depositAction: 'PARTIAL_WITHHOLD', withheldAmount: 20 })
      .expect(201);
    expect(decision.body.report.status).toBe('PARTIALLY_APPROVED');

    const dep = await prisma.deposit.findUniqueOrThrow({ where: { rentalRequestId: rentalId } });
    expect(dep.status).toBe('PARTIALLY_WITHHELD');
    expect(dep.withheldCents).toBe(2000);

    const logs = await prisma.auditLog.findMany({ where: { adminId: admin.user.id } });
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['REPORT_STATUS_CHANGED', 'REPORT_DECISION', 'DEPOSIT_PARTIALLY_WITHHELD']));

    // internal notes hidden from users
    const forRenter = await api().get(`/api/reports/${id}`).set(renter.auth).expect(200);
    expect(forRenter.body.report.decisions[0].internalNote).toBeUndefined();
    expect(forRenter.body.report.decisions[0].publicNote).toBe('Čiastočne oprávnené.');
    const forAdmin = await api().get(`/api/reports/${id}`).set(admin.auth).expect(200);
    expect(forAdmin.body.report.decisions[0].internalNote).toBe('Staršie poškodenie pravdepodobné.');

    // cannot decide twice
    await api().post(`/api/admin/reports/${id}/decision`).set(admin.auth).send({ decision: 'REJECTED' }).expect(409);
  });

  it('listing report from item page', async () => {
    const { item, renter } = await setupPendingRental();
    await api().post(`/api/items/${item.id}/report`).set(renter.auth).send({ type: 'OTHER', description: 'Podozrivý inzerát, fotky nesedia.' }).expect(201);
  });
});
