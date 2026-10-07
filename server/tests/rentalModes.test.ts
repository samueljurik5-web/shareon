import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createItem, createUser, day, hourlyBody, requestBody, resetDb } from './helpers.js';

const hourlyItem = (ownerId: string, extra: Parameters<typeof createItem>[1] = {}) =>
  createItem(ownerId, {
    hourlyRentalEnabled: true,
    hourlyPriceCents: 300,
    minRentalHours: 2,
    maxRentalHours: 6,
    availableFromTime: '08:00',
    availableToTime: '20:00',
    ...extra,
  });

describe('rental modes – quote, availability and requests', () => {
  beforeEach(resetDb);

  it('POST /api/pricing/quote returns the hourly breakdown and never creates a rental', async () => {
    const owner = await createUser();
    const item = await hourlyItem(owner.user.id);
    const res = await api()
      .post('/api/pricing/quote')
      .send({ itemId: item.id, rentalMode: 'HOURLY', startDate: day(3), startTime: '14:00', endTime: '18:00', totalCents: 1 })
      .expect(200);
    expect(res.body.quote.price).toMatchObject({
      rentalMode: 'HOURLY',
      durationMinutes: 240,
      rentalPriceCents: 1200,
      protectionFeeCents: 150,
      depositCents: 3000,
      totalCents: 4350,
      refundableCents: 3000,
    });
    expect(res.body.quote.period.label).toMatch(/14:00 – 18:00$/);
    expect(await prisma.rentalRequest.count()).toBe(0);
  });

  it('creates an hourly request with server-side prices and exact UTC interval', async () => {
    const owner = await createUser();
    const renter = await createUser();
    const item = await hourlyItem(owner.user.id, { minRentalHours: 1 });
    const res = await api()
      .post('/api/rental-requests')
      .set(renter.auth)
      .send({ ...hourlyBody(item.id, 3, '09:30', '11:00'), rentalPriceCents: 1, durationMinutes: 999 })
      .expect(201);
    const r = await prisma.rentalRequest.findUniqueOrThrow({ where: { id: res.body.rentalRequest.id } });
    expect(r).toMatchObject({ rentalMode: 'HOURLY', startTime: '09:30', endTime: '11:00', durationMinutes: 90, durationDays: null });
    expect(r.rentalPriceCents).toBe(450);
    expect((r.endAt.getTime() - r.startAt.getTime()) / 60000).toBe(90);
    const detail = await api().get(`/api/rental-requests/${r.id}`).set(renter.auth).expect(200);
    expect(detail.body.rentalRequest).toMatchObject({ rentalMode: 'HOURLY', durationMinutes: 90, startTime: '09:30' });
    expect(detail.body.rentalRequest.price.refundableCents).toBe(3000);
  });

  it('rejects disabled modes, outside hours, too short/long, past dates and midnight crossing', async () => {
    const owner = await createUser();
    const renter = await createUser();
    const dailyOnly = await createItem(owner.user.id);
    const item = await hourlyItem(owner.user.id);
    const msg = async (body: object) =>
      (await api().post('/api/rental-requests').set(renter.auth).send(body)).body.error.message as string;

    expect(await msg(hourlyBody(dailyOnly.id, 3, '10:00', '12:00'))).toBe('Tento predmet sa nedá prenajať na hodiny.');
    expect(await msg(hourlyBody(item.id, 3, '06:00', '09:00'))).toBe('Na hodiny je predmet dostupný len medzi 08:00 a 20:00.');
    expect(await msg(hourlyBody(item.id, 3, '10:00', '11:00'))).toBe('Minimálna dĺžka prenájmu je 2 hodiny.');
    expect(await msg(hourlyBody(item.id, 3, '08:00', '15:00'))).toBe('Maximálna dĺžka prenájmu je 6 hodín.');
    expect(await msg(hourlyBody(item.id, -1, '10:00', '12:00'))).toBe('Začiatok prenájmu nemôže byť v minulosti.');
    expect(await msg(hourlyBody(item.id, 3, '19:00', '01:00'))).toMatch(/polnoc/);
    const hourlyOnly = await createItem(owner.user.id, { dailyRentalEnabled: false, dailyPriceCents: null, hourlyRentalEnabled: true, hourlyPriceCents: 300 });
    expect(await msg(requestBody(hourlyOnly.id, 3, 4))).toBe('Tento predmet sa nedá prenajať na dni.');
    const daily = await createItem(owner.user.id, { minRentalDays: 2, maxRentalDays: 3 });
    expect(await msg(requestBody(daily.id, 3, 3))).toBe('Minimálna dĺžka prenájmu je 2 dni.');
    expect(await msg(requestBody(daily.id, 3, 6))).toBe('Maximálna dĺžka prenájmu je 3 dni.');
    expect(await prisma.rentalRequest.count()).toBe(0);
  });

  it('rejects overlapping reservations including the buffer time', async () => {
    const owner = await createUser();
    const a = await createUser();
    const b = await createUser();
    const item = await hourlyItem(owner.user.id, { bufferHours: 1 });
    const first = await api().post('/api/rental-requests').set(a.auth).send(hourlyBody(item.id, 3, '10:00', '12:00')).expect(201);
    await api().patch(`/api/rental-requests/${first.body.rentalRequest.id}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);

    // 12:30 is inside the 1 h buffer after 12:00
    const inBuffer = await api().post('/api/rental-requests').set(b.auth).send(hourlyBody(item.id, 3, '12:30', '14:30')).expect(409);
    expect(inBuffer.body.error.message).toMatch(/vrátane rezervy 1 h medzi prenájmami/);
    // overlapping directly
    await api().post('/api/pricing/quote').send({ itemId: item.id, rentalMode: 'HOURLY', startDate: day(3), startTime: '11:00', endTime: '13:00' }).expect(409);
    // a daily rental covering that day also conflicts
    await api().post('/api/pricing/quote').send({ itemId: item.id, rentalMode: 'DAILY', startDate: day(3), endDate: day(3) }).expect(409);
    // after the buffer it is free
    await api().post('/api/rental-requests').set(b.auth).send(hourlyBody(item.id, 3, '13:00', '15:00')).expect(201);
  });

  it('owner proposes a different time for an hourly request; renter accepts and price is recalculated', async () => {
    const owner = await createUser();
    const renter = await createUser();
    const item = await hourlyItem(owner.user.id);
    const r = await api().post('/api/rental-requests').set(renter.auth).send(hourlyBody(item.id, 3, '10:00', '12:00')).expect(201);
    const id = r.body.rentalRequest.id;
    await api()
      .patch(`/api/rental-requests/${id}/status`)
      .set(owner.auth)
      .send({ action: 'PROPOSE_DATES', startDate: day(4), startTime: '14:00', endTime: '18:00' })
      .expect(200);
    await api().patch(`/api/rental-requests/${id}/status`).set(renter.auth).send({ action: 'ACCEPT_PROPOSAL' }).expect(200);
    const updated = await prisma.rentalRequest.findUniqueOrThrow({ where: { id } });
    expect(updated).toMatchObject({ status: 'ACCEPTED', startTime: '14:00', endTime: '18:00', durationMinutes: 240, rentalPriceCents: 1200 });
  });

  it('hourly rental goes through handover and return to completion; late return can be reported', async () => {
    const owner = await createUser();
    const renter = await createUser();
    const item = await hourlyItem(owner.user.id);
    const r = await api().post('/api/rental-requests').set(renter.auth).send(hourlyBody(item.id, 3, '10:00', '12:00')).expect(201);
    const id = r.body.rentalRequest.id;
    await api().patch(`/api/rental-requests/${id}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    await api().post(`/api/rental-requests/${id}/handover`).set(owner.auth).send({}).expect(200);
    await api().post(`/api/rental-requests/${id}/handover`).set(renter.auth).send({}).expect(200);
    await api()
      .post(`/api/rental-requests/${id}/dispute`)
      .set(owner.auth)
      .send({ type: 'LATE_RETURN', description: 'Predmet bol vrátený o dve hodiny neskôr, ako bolo dohodnuté.', requestedAmount: 6 })
      .expect(201);
    const rental = await prisma.rentalRequest.findUniqueOrThrow({ where: { id } });
    expect(rental.status).toBe('DISPUTED');
  });
});
