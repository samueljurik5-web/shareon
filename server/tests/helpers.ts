import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Category, Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { signToken } from '../src/middleware/auth.js';
import { addDays, todayUtc } from '../src/lib/dates.js';
import { addDaysToDate, todayLocal } from '../src/lib/time.js';

export const app = createApp();
export const api = () => request(app);

export const resetDb = async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
};

let counter = 0;
const fastHash = bcrypt.hashSync('Heslo12345', 4);

export const createUser = async (overrides: { role?: Role; name?: string } = {}) => {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Test User ${counter}`,
      email: `user${counter}-${Date.now()}@example.sk`,
      phone: '+421 900 123 456',
      city: 'Košice',
      role: overrides.role ?? 'USER',
      passwordHash: fastHash,
    },
  });
  return { user, token: signToken(user), auth: { Authorization: `Bearer ${signToken(user)}` } };
};

/** Local (Europe/Bratislava) date string `offset` days from today. */
export const day = (offset: number) => addDaysToDate(todayLocal(), offset);

export const hourlyBody = (itemId: string, dayOffset: number, startTime: string, endTime: string) => ({
  itemId,
  rentalMode: 'HOURLY',
  startDate: day(dayOffset),
  startTime,
  endTime,
  message: 'Potrebujem to na pár hodín.',
  handoverMethod: 'PERSONAL_PICKUP',
  acceptRules: true,
  acceptProtectionDisclaimer: true,
});

export const createItem = async (
  ownerId: string,
  overrides: Partial<{
    dailyPriceCents: number | null;
    hourlyPriceCents: number | null;
    dailyRentalEnabled: boolean;
    hourlyRentalEnabled: boolean;
    replacementValueCents: number;
    category: Category;
    protectionEligible: boolean;
    minRentalHours: number;
    maxRentalHours: number;
    minRentalDays: number;
    maxRentalDays: number;
    availableFromTime: string;
    availableToTime: string;
    bufferHours: number;
  }> = {},
) =>
  prisma.item.create({
    data: {
      ownerId,
      title: 'Testovacia kosačka',
      category: 'GARDEN',
      description: 'Testovací predmet s dostatočne dlhým popisom.',
      replacementValueCents: 10000,
      protectionEligible: true,
      dailyRentalEnabled: true,
      dailyPriceCents: 800,
      ...overrides,
      city: 'Košice',
      condition: 'GOOD',
      availableFrom: addDays(todayUtc(), -10),
      availableTo: addDays(todayUtc(), 120),
      declarationsAcceptedAt: new Date(),
      images: { create: [{ url: '/placeholders/garden.svg', position: 0 }] },
    },
  });

/** Daily request; days are inclusive, so (5, 7) = 3 days. */
export const requestBody = (itemId: string, start = 5, end = 7) => ({
  itemId,
  rentalMode: 'DAILY',
  startDate: day(start),
  endDate: day(end),
  message: 'Dobrý deň, rád by som si predmet požičal.',
  handoverMethod: 'PERSONAL_PICKUP',
  acceptRules: true,
  acceptProtectionDisclaimer: true,
});

/** Creates owner, renter, item and a PENDING request via the API. */
export const setupPendingRental = async () => {
  const owner = await createUser({ name: 'Majiteľ' });
  const renter = await createUser({ name: 'Nájomca' });
  const item = await createItem(owner.user.id);
  const res = await api().post('/api/rental-requests').set(renter.auth).send(requestBody(item.id));
  if (res.status !== 201) throw new Error(`setup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { owner, renter, item, rentalId: res.body.rentalRequest.id as string };
};

/** Drives a rental through to COMPLETED via the API. */
export const setupCompletedRental = async () => {
  const ctx = await setupPendingRental();
  const { owner, renter, rentalId } = ctx;
  await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
  await api().post(`/api/rental-requests/${rentalId}/handover`).set(owner.auth).send({ note: 'OK' }).expect(200);
  await api().post(`/api/rental-requests/${rentalId}/handover`).set(renter.auth).send({ note: 'Prevzaté' }).expect(200);
  await api().post(`/api/rental-requests/${rentalId}/return`).set(renter.auth).send({}).expect(200);
  const r = await api().post(`/api/rental-requests/${rentalId}/return`).set(owner.auth).send({ itemOk: true }).expect(200);
  if (r.body.rentalRequest.status !== 'COMPLETED') throw new Error('expected COMPLETED');
  return ctx;
};
