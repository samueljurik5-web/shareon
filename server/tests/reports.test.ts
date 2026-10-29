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

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d5a3b40000000049454e44ae426082',
  'hex',
);

const damage = {
  type: 'ITEM_DAMAGED',
  description: 'Kosačka sa vrátila s prasknutým krytom noža.',
  contactNote: 'Zastihnete ma po 17:00 na telefóne.',
};

/** Rental with the item handed back by both parties (status RETURNED, owner flagged a problem). */
const returnedRental = async () => {
  const ctx = await activeRental();
  await api().post(`/api/rental-requests/${ctx.rentalId}/return`).set(ctx.owner.auth).send({ itemOk: false }).expect(200);
  await api().post(`/api/rental-requests/${ctx.rentalId}/return`).set(ctx.renter.auth).send({}).expect(200);
  return ctx;
};

describe('claims (damage reports) and admin review', () => {
  beforeEach(resetDb);

  it('after return the owner reports damage: claim OPEN, rental DISPUTED, nothing approved automatically', async () => {
    const { owner, rentalId } = await returnedRental();
    const photo = (await api().post('/api/uploads').set(owner.auth).attach('file', PNG, { filename: 'kryt.png', contentType: 'image/png' }).expect(201)).body.url;
    const res = await api().post(`/api/rental-requests/${rentalId}/dispute`).set(owner.auth).send({ ...damage, photos: [photo] }).expect(201);
    expect(res.body.report.status).toBe('OPEN');
    const report = await prisma.damageReport.findUniqueOrThrow({ where: { id: res.body.report.id }, include: { evidence: true } });
    expect(report.contactNote).toBe('Zastihnete ma po 17:00 na telefóne.');
    expect(report.approvedAmountCents).toBeNull();
    expect(report.evidence.map((e) => e.fileUrl)).toEqual([photo]);
    const rental = await prisma.rentalRequest.findUniqueOrThrow({ where: { id: rentalId }, include: { protection: true } });
    expect(rental.status).toBe('DISPUTED');
    expect(rental.protection?.status).toBe('CLAIM_UNDER_REVIEW');

    const detail = await api().get(`/api/reports/${report.id}`).set(owner.auth).expect(200);
    expect(detail.body.report.disclaimer).toContain('automatickú náhradu');
    expect(detail.body.report.rental).toBeUndefined(); // reservation + contacts only for admins
  });

  it('the renter can report too; reporting closes 48 hours after the return', async () => {
    const { renter, rentalId } = await returnedRental();
    await api()
      .post('/api/reports')
      .set(renter.auth)
      .send({ type: 'OTHER', description: 'Majiteľ tvrdí poškodenie, ktoré tam bolo už pred požičaním.', rentalRequestId: rentalId })
      .expect(201);
    await prisma.rentalRequest.update({ where: { id: rentalId }, data: { returnedAt: new Date(Date.now() - 49 * 3_600_000) } });
    const late = await api().post('/api/reports').set(renter.auth).send({ ...damage, rentalRequestId: rentalId }).expect(409);
    expect(late.body.error.message).toBe('Problém je možné nahlásiť najneskôr 48 hodín po vrátení veci.');
    const detail = await api().get(`/api/rental-requests/${rentalId}`).set(renter.auth).expect(200);
    expect(detail.body.rentalRequest.availableActions).not.toContain('REPORT');
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

  it('admin reviews a claim: status changes with public/internal notes, audit-logged, no payout', async () => {
    const { owner, renter, rentalId } = await returnedRental();
    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().post('/api/reports').set(owner.auth).send({ ...damage, rentalRequestId: rentalId }).expect(201);
    const id = res.body.report.id;

    // non-admins cannot change the status or see the claim list
    await api().patch(`/api/admin/reports/${id}/status`).set(owner.auth).send({ status: 'RESOLVED' }).expect(403);
    await api().get('/api/admin/reports').set(renter.auth).expect(403);

    const list = await api().get('/api/admin/reports').set(admin.auth).expect(200);
    expect(list.body.reports.map((r: { id: string }) => r.id)).toContain(id);

    await api().patch(`/api/admin/reports/${id}/status`).set(admin.auth).send({ status: 'NEEDS_MORE_INFORMATION', publicNote: 'Pošlite fotky.' }).expect(200);
    await api().post(`/api/reports/${id}/evidence`).set(owner.auth).send({ text: 'Doplňujem fotky.' }).expect(201);
    expect((await prisma.damageReport.findUniqueOrThrow({ where: { id } })).status).toBe('UNDER_REVIEW');

    await api()
      .patch(`/api/admin/reports/${id}/status`)
      .set(admin.auth)
      .send({ status: 'RESOLVED', publicNote: 'Dohodli ste sa na oprave krytu.', internalNote: 'Staršie poškodenie pravdepodobné.' })
      .expect(200);
    const report = await prisma.damageReport.findUniqueOrThrow({ where: { id } });
    expect(report.status).toBe('RESOLVED');
    expect(report.approvedAmountCents).toBeNull();
    expect((await prisma.rentalRequest.findUniqueOrThrow({ where: { id: rentalId } })).status).toBe('COMPLETED');

    const logs = await prisma.auditLog.findMany({ where: { adminId: admin.user.id, entityId: id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => (l.newValue as { status: string }).status)).toEqual(['NEEDS_MORE_INFORMATION', 'RESOLVED']);

    // internal notes and reservation/contact details only for admins
    const forRenter = await api().get(`/api/reports/${id}`).set(renter.auth).expect(200);
    const last = forRenter.body.report.decisions.at(-1);
    expect(last.publicNote).toBe('Dohodli ste sa na oprave krytu.');
    expect(last.internalNote).toBeUndefined();
    const forAdmin = await api().get(`/api/reports/${id}`).set(admin.auth).expect(200);
    expect(forAdmin.body.report.decisions.at(-1).internalNote).toBe('Staršie poškodenie pravdepodobné.');
    expect(forAdmin.body.report.rental.renter.email).toBe(renter.user.email);
    expect(forAdmin.body.report.rental.protectionFeeCents).toBe(240);

    // closed claims cannot change any more
    await api().patch(`/api/admin/reports/${id}/status`).set(admin.auth).send({ status: 'REJECTED' }).expect(409);
  });

  it('admin can reject a claim', async () => {
    const { owner, rentalId } = await returnedRental();
    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().post('/api/reports').set(owner.auth).send({ ...damage, rentalRequestId: rentalId }).expect(201);
    await api().patch(`/api/admin/reports/${res.body.report.id}/status`).set(admin.auth).send({ status: 'REJECTED', publicNote: 'Chýbajú dôkazy.' }).expect(200);
    expect((await prisma.damageReport.findUniqueOrThrow({ where: { id: res.body.report.id } })).status).toBe('REJECTED');
  });

  it('listing report from item page', async () => {
    const { item, renter } = await setupPendingRental();
    await api().post(`/api/items/${item.id}/report`).set(renter.auth).send({ type: 'OTHER', description: 'Podozrivý inzerát, fotky nesedia.' }).expect(201);
  });
});
