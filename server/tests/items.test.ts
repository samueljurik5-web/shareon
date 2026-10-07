import { beforeEach, describe, expect, it } from 'vitest';
import { api, createItem, createUser, day, resetDb } from './helpers.js';

const itemPayload = () => ({
  title: 'Elektrická kosačka',
  category: 'GARDEN',
  description: 'Elektrická kosačka v dobrom stave so záberom 38 cm.',
  dailyRentalEnabled: true,
  dailyPrice: 8,
  city: 'Košice',
  condition: 'GOOD',
  availableFrom: day(0),
  availableTo: day(60),
  replacementValue: 100,
  protectionEligible: true,
  images: ['/placeholders/garden.svg'],
  declarations: { rightToOffer: true, accurateDescription: true, damageDisclosed: true, photosCurrent: true },
});

describe('items', () => {
  beforeEach(resetDb);

  it('creates an item for an authenticated user', async () => {
    const { auth, user } = await createUser();
    const res = await api().post('/api/items').set(auth).send(itemPayload()).expect(201);
    const detail = await api().get(`/api/items/${res.body.item.id}`).expect(200);
    expect(detail.body.item.title).toBe('Elektrická kosačka');
    expect(detail.body.item.dailyPriceCents).toBe(800);
    expect(detail.body.item.hourlyRentalEnabled).toBe(false);
    expect(detail.body.item.owner.id).toBe(user.id);
    expect(detail.body.item.owner.phone).toBeUndefined();
    expect(detail.body.item.owner.email).toBeUndefined();
    expect(detail.body.item.protectionAvailable).toBe(true);
  });

  it('requires all owner declarations', async () => {
    const { auth } = await createUser();
    const payload = { ...itemPayload(), declarations: { rightToOffer: true, accurateDescription: true, damageDisclosed: false, photosCurrent: true } };
    const res = await api().post('/api/items').set(auth).send(payload).expect(400);
    expect(JSON.stringify(res.body)).toContain('Potvrď, že si uviedol existujúce poškodenia.');
  });

  it('requires 1–5 photos and rejects foreign URLs', async () => {
    const { auth } = await createUser();
    await api().post('/api/items').set(auth).send({ ...itemPayload(), images: [] }).expect(400);
    await api().post('/api/items').set(auth).send({ ...itemPayload(), images: ['https://evil.example/x.jpg'] }).expect(400);
    await api().post('/api/items').set(auth).send({ ...itemPayload(), images: Array(6).fill('/placeholders/garden.svg') }).expect(400);
  });

  it('validates rental modes: required prices, at least one mode, sane limits and hours', async () => {
    const { auth } = await createUser();
    const msgs = async (body: object) =>
      (await api().post('/api/items').set(auth).send({ ...itemPayload(), ...body }).expect(400)).body.error.details.map(
        (d: { message: string }) => d.message,
      );
    expect(await msgs({ hourlyRentalEnabled: true })).toContain('Pri prenájme na hodiny je cena za hodinu povinná (aspoň 0,10 €).');
    expect(await msgs({ dailyPrice: null })).toContain('Pri prenájme na dni je cena za deň povinná (aspoň 0,50 €).');
    expect(await msgs({ dailyRentalEnabled: false })).toContain('Povoľ aspoň jeden spôsob prenájmu – na dni alebo na hodiny.');
    expect(await msgs({ minRentalDays: 5, maxRentalDays: 2 })).toContain('Maximálny počet dní musí byť aspoň taký ako minimálny.');
    expect(await msgs({ availableFromTime: '18:00', availableToTime: '09:00' })).toContain(
      'Čas „dostupné do“ musí byť neskôr ako čas „dostupné od“.',
    );
  });

  it('creates an hourly-only item and lists it with the hourly price', async () => {
    const { auth } = await createUser();
    const res = await api()
      .post('/api/items')
      .set(auth)
      .send({ ...itemPayload(), dailyRentalEnabled: false, dailyPrice: null, hourlyRentalEnabled: true, hourlyPrice: 3, minRentalHours: 2, maxRentalHours: 6, bufferHours: 1 })
      .expect(201);
    const detail = await api().get(`/api/items/${res.body.item.id}`).expect(200);
    expect(detail.body.item).toMatchObject({ hourlyPriceCents: 300, dailyPriceCents: null, minRentalHours: 2, maxRentalHours: 6, bufferHours: 1 });
    expect(detail.body.item.estimateDaily).toBeNull();
    expect(detail.body.item.estimateHourly.rentalPriceCents).toBe(600); // 2 h × 3 €
    const list = await api().get('/api/items?mode=HOURLY').expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toContain(res.body.item.id);
  });

  it('PATCH does not reset unrelated fields (e.g. protection eligibility)', async () => {
    const owner = await createUser();
    const item = await createItem(owner.user.id, { protectionEligible: false });
    await api().patch(`/api/items/${item.id}`).set(owner.auth).send({ title: 'Nový názov predmetu' }).expect(200);
    const detail = await api().get(`/api/items/${item.id}`).expect(200);
    expect(detail.body.item.protectionEligible).toBe(false);
  });

  it('requires authentication to create', async () => {
    await api().post('/api/items').send(itemPayload()).expect(401);
  });

  it('prevents editing or deleting an item by a non-owner', async () => {
    const owner = await createUser();
    const other = await createUser();
    const item = await createItem(owner.user.id);
    await api().patch(`/api/items/${item.id}`).set(other.auth).send({ title: 'Ukradnutý' }).expect(403);
    await api().delete(`/api/items/${item.id}`).set(other.auth).expect(403);
    await api().patch(`/api/items/${item.id}`).set(owner.auth).send({ title: 'Nový názov' }).expect(200);
  });

  it('searches with filters and sorting', async () => {
    const owner = await createUser();
    await createItem(owner.user.id, { dailyPriceCents: 500 });
    await createItem(owner.user.id, { dailyPriceCents: 1500, category: 'SPORT' });
    const sport = await api().get('/api/items?category=SPORT').expect(200);
    expect(sport.body.items).toHaveLength(1);
    const cheap = await api().get('/api/items?maxPrice=10').expect(200);
    expect(cheap.body.items).toHaveLength(1);
    const sorted = await api().get('/api/items?sort=price_desc').expect(200);
    expect(sorted.body.items[0].dailyPriceCents).toBe(1500);
  });

  it('toggles favorites', async () => {
    const owner = await createUser();
    const user = await createUser();
    const item = await createItem(owner.user.id);
    await api().post(`/api/items/${item.id}/favorite`).set(user.auth).expect(200);
    const list = await api().get('/api/items?favorites=true').set(user.auth).expect(200);
    expect(list.body.items[0].isFavorite).toBe(true);
    await api().delete(`/api/items/${item.id}/favorite`).set(user.auth).expect(200);
  });
});
