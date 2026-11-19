import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createItem, createUser, requestBody, resetDb } from './helpers.js';

describe('launch: sample listings, demand validation and insights', () => {
  beforeEach(resetDb);

  it('sample ("Ukážka") listings are shown after real ones and cannot be booked', async () => {
    const owner = await createUser();
    const renter = await createUser();
    const sample = await createItem(owner.user.id);
    await prisma.item.update({ where: { id: sample.id }, data: { isDemo: true } });
    const real = await createItem(owner.user.id); // newer, but would come first anyway
    const older = await createItem(owner.user.id);
    await prisma.item.update({ where: { id: older.id }, data: { createdAt: new Date('2020-01-01') } });

    const list = await api().get('/api/items').expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([real.id, older.id, sample.id]);
    expect(list.body.items.at(-1)).toMatchObject({ isDemo: true, availableToday: false });

    const res = await api().post('/api/rental-requests').set(renter.auth).send(requestBody(sample.id)).expect(409);
    expect(res.body.error.message).toContain('ukážková ponuka');
    await api().post('/api/rental-requests').set(renter.auth).send(requestBody(real.id)).expect(201);
  });

  it('waitlist: one row per e-mail, consent required, signing up again updates the choice', async () => {
    const bad = await api().post('/api/launch/waitlist').send({ email: 'zle', role: 'X' }).expect(400);
    expect(bad.body.error.details.map((d: { message: string }) => d.message)).toEqual(
      expect.arrayContaining(['Zadaj platný e-mail.', 'Vyber, či chceš požičiavať alebo si požičať.', 'Potvrď, že ťa môžeme kontaktovať.']),
    );
    await api()
      .post('/api/launch/waitlist')
      .send({ email: 'Eva@Example.sk', role: 'BORROW', city: 'Prešov', wish: 'Vozík za auto na víkend', consent: true })
      .expect(201);
    expect(await prisma.waitlistSignup.findFirstOrThrow()).toMatchObject({ city: 'Prešov', wish: 'Vozík za auto na víkend' });
    const again = await api().post('/api/launch/waitlist').send({ email: 'eva@example.sk', role: 'BOTH', consent: true }).expect(200);
    expect(again.body.alreadySignedUp).toBe(true);
    const rows = await prisma.waitlistSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'eva@example.sk', role: 'BOTH', district: null, city: null, wish: null });
  });

  it('demand: text required, e-mail optional but needs consent', async () => {
    await api().post('/api/launch/demand').send({ what: 'ab' }).expect(400);
    const noConsent = await api().post('/api/launch/demand').send({ what: 'Stan pre 6 osôb', email: 'a@b.sk' }).expect(400);
    expect(JSON.stringify(noConsent.body)).toContain('Potvrď, že ťa môžeme kontaktovať.');
    await api().post('/api/launch/demand').send({ what: 'Stan pre 6 osôb' }).expect(201);
    await api().post('/api/launch/demand').send({ what: 'Kosačka', email: 'a@b.sk', consent: true, district: 'Juh' }).expect(201);
    expect(await prisma.demandRequest.count()).toBe(2);
  });

  it('counts anonymous events (allow-listed only), logs searches and shows everything to admins only', async () => {
    const owner = await createUser();
    await createItem(owner.user.id); // "Testovacia kosačka"
    await api().post('/api/launch/events').send({ name: 'visit_home' }).expect(204);
    await api().post('/api/launch/events').send({ name: 'visit_home' }).expect(204);
    await api().post('/api/launch/events').send({ name: 'drop_table' }).expect(400);
    await api().get('/api/items?q=kosačka').expect(200);
    await api().get('/api/items?q=Vŕtačka').expect(200);
    await api().get('/api/items?q=vŕtačka').expect(200);
    await api().post('/api/launch/waitlist').send({ email: 'x@y.sk', role: 'LEND', consent: true }).expect(201);

    const user = await createUser();
    await api().get('/api/admin/insights').set(user.auth).expect(403);
    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().get('/api/admin/insights').set(admin.auth).expect(200);
    const count = (name: string) => res.body.funnel.find((f: { name: string }) => f.name === name).count;
    expect(count('visit_home')).toBe(2);
    expect(count('search')).toBe(3);
    expect(count('waitlist')).toBe(1);
    expect(res.body.zeroResultSearches).toEqual([{ query: 'vŕtačka', count: 2 }]);
    expect(res.body.searches).toEqual(expect.arrayContaining([{ query: 'kosačka', count: 1, maxResults: 1 }]));
    expect(res.body.waitlist.byRole).toEqual({ LEND: 1 });
    // no identifiers are stored with events or searches
    expect(Object.keys((await prisma.searchLog.findFirstOrThrow()) as object).sort()).toEqual(['category', 'createdAt', 'id', 'query', 'resultCount']);
  });
});
