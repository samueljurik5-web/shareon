import { beforeEach, describe, expect, it } from 'vitest';
import { api, createItem, createUser, day, requestBody, resetDb } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { isAvailableToday, type AvailabilityItem } from '../src/services/availability.js';
import { distanceFromCenterKm } from '../src/lib/districts.js';

const itemPayload = (extra: object = {}) => ({
  title: 'Projektor Full HD',
  category: 'ELECTRONICS',
  description: 'Projektor s HDMI káblom, vhodný na prezentácie aj letné kino.',
  dailyRentalEnabled: true,
  dailyPrice: 9,
  city: 'Košice',
  condition: 'GOOD',
  availableFrom: day(0),
  availableTo: day(60),
  replacementValue: 200,
  images: ['/placeholders/leisure.svg'],
  declarations: { rightToOffer: true, accurateDescription: true, damageDisclosed: true, photosCurrent: true },
  ...extra,
});

describe('home page listing API', () => {
  beforeEach(resetDb);

  it('filters by a group of categories and returns an empty list for an unused category', async () => {
    const { user } = await createUser();
    await createItem(user.id, { category: 'GARDEN' });
    await createItem(user.id, { category: 'WORKSHOP' });
    await createItem(user.id, { category: 'SPORT' });

    const tools = await api().get('/api/items?category=WORKSHOP,GARDEN').expect(200);
    expect(tools.body.items.map((i: { category: string }) => i.category).sort()).toEqual(['GARDEN', 'WORKSHOP']);
    const single = await api().get('/api/items?category=SPORT').expect(200);
    expect(single.body.total).toBe(1);
    const none = await api().get('/api/items?category=HOUSEHOLD').expect(200);
    expect(none.body.items).toEqual([]);
    await api().get('/api/items?category=WEAPONS').expect(400);
  });

  it('sorts "popular" by actual rentals, newest first among equals', async () => {
    const owner = await createUser();
    const renter = await createUser();
    const rented = await createItem(owner.user.id);
    const newer = await createItem(owner.user.id);
    const res = await api().post('/api/rental-requests').set(renter.auth).send(requestBody(rented.id)).expect(201);
    // A pending request is not a rental yet.
    let list = await api().get('/api/items?sort=popular').expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([newer.id, rented.id]);

    await api().patch(`/api/rental-requests/${res.body.rentalRequest.id}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    list = await api().get('/api/items?sort=popular').expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([rented.id, newer.id]);
  });

  it('stores an optional Košice district and exposes only an approximate distance', async () => {
    const { auth } = await createUser();
    const created = await api().post('/api/items').set(auth).send(itemPayload({ district: 'Sever' })).expect(201);
    const detail = await api().get(`/api/items/${created.body.item.id}`).expect(200);
    expect(detail.body.item.district).toBe('Sever');
    expect(detail.body.item.distanceKm).toBe(distanceFromCenterKm('Sever'));
    expect(detail.body.item.distanceKm).toBeGreaterThan(1);
    expect(detail.body.item.distanceKm).toBeLessThan(4);

    const list = await api().get('/api/items').expect(200);
    expect(list.body.items[0]).toMatchObject({ district: 'Sever', distanceKm: detail.body.item.distanceKm, availableToday: true });

    const bad = await api().post('/api/items').set(auth).send(itemPayload({ district: 'Hlavná 12' })).expect(400);
    expect(JSON.stringify(bad.body)).toContain('Vyber mestskú časť zo zoznamu.');

    const noDistrict = await api().post('/api/items').set(auth).send(itemPayload()).expect(201);
    const plain = await api().get(`/api/items/${noDistrict.body.item.id}`).expect(200);
    expect(plain.body.item.distanceKm).toBeNull();
    await api().patch(`/api/items/${noDistrict.body.item.id}`).set(auth).send({ district: 'Juh' }).expect(200);
    expect((await prisma.item.findUnique({ where: { id: noDistrict.body.item.id } }))?.district).toBe('Juh');
  });
});

describe('isAvailableToday', () => {
  // 26. 10. 2026 10:00 in Bratislava (CET, UTC+1)
  const now = new Date('2026-10-26T09:00:00Z');
  const base: AvailabilityItem = {
    id: 'x',
    isActive: true,
    availableFrom: new Date('2026-10-01T00:00:00Z'),
    availableTo: new Date('2026-12-31T00:00:00Z'),
    dailyRentalEnabled: true,
    hourlyRentalEnabled: false,
    dailyPriceCents: 800,
    hourlyPriceCents: null,
    minRentalHours: 1,
    maxRentalHours: 10,
    minRentalDays: 1,
    maxRentalDays: 30,
    availableFromTime: '08:00',
    availableToTime: '20:00',
    bufferHours: 0,
  };
  const hourlyOnly = { ...base, dailyRentalEnabled: false, dailyPriceCents: null, hourlyRentalEnabled: true, hourlyPriceCents: 300 };
  const at = (iso: string) => new Date(iso);

  it('daily: free today → available; reserved today or outside the listing dates → not', () => {
    expect(isAvailableToday(base, [], now)).toBe(true);
    const today = { startAt: at('2026-10-25T23:00:00Z'), endAt: at('2026-10-26T23:00:00Z') };
    expect(isAvailableToday(base, [today], now)).toBe(false);
    expect(isAvailableToday({ ...base, availableFrom: new Date('2026-10-27T00:00:00Z') }, [], now)).toBe(false);
    expect(isAvailableToday({ ...base, isActive: false }, [], now)).toBe(false);
  });

  it('hourly: needs a free slot of the minimum length later today inside the pick-up window', () => {
    expect(isAvailableToday(hourlyOnly, [], now)).toBe(true);
    // Booked 10:00–20:00 local → nothing left today.
    const rest = { startAt: at('2026-10-26T09:00:00Z'), endAt: at('2026-10-26T19:00:00Z') };
    expect(isAvailableToday(hourlyOnly, [rest], now)).toBe(false);
    // Booked 10:00–12:00 → 12:00–20:00 still free.
    const morning = { startAt: at('2026-10-26T09:00:00Z'), endAt: at('2026-10-26T11:00:00Z') };
    expect(isAvailableToday(hourlyOnly, [morning], now)).toBe(true);
    // 19:30 local with a 1-hour minimum → too late today.
    expect(isAvailableToday(hourlyOnly, [], at('2026-10-26T18:30:00Z'))).toBe(false);
  });
});
