import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createItem, createUser, resetDb } from './helpers.js';

describe('admin & access control', () => {
  beforeEach(resetDb);

  it('blocks non-admins and anonymous users from admin endpoints', async () => {
    const user = await createUser();
    for (const path of ['/api/admin/users', '/api/admin/items', '/api/admin/reports', '/api/admin/settings', '/api/admin/audit-log', '/api/admin/deposits', '/api/admin/protection', '/api/admin/rentals']) {
      await api().get(path).expect(401);
      await api().get(path).set(user.auth).expect(403);
    }
  });

  it('admin lists users without password hashes', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().get('/api/admin/users').set(admin.auth).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('old deposit/protection settings are gone; platform fee changes are audit-logged', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    await api().patch('/api/admin/settings').set(admin.auth).send({ protectionMode: 'NONE' }).expect(400);
    await api().patch('/api/admin/settings').set(admin.auth).send({ maxDepositCents: 20000 }).expect(400);
    const res = await api().patch('/api/admin/settings').set(admin.auth).send({ platformFeeEnabled: true, platformFeePercentage: 0.05 }).expect(200);
    expect(res.body.settings).toEqual({ platformFeeEnabled: true, platformFeePercentage: 0.05 });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'SETTINGS_UPDATED' } });
    expect((log.newValue as { platformFeeEnabled: boolean }).platformFeeEnabled).toBe(true);
    // Unknown keys are rejected
    await api().patch('/api/admin/settings').set(admin.auth).send({ hack: true }).expect(400);
    const s = await api().get('/api/admin/settings').set(admin.auth).expect(200);
    expect(JSON.stringify(s.body)).not.toMatch(/poist/i);
  });

  it('public settings expose the Ochrana prenájmu model and Slovak texts without "poistenie"', async () => {
    const res = await api().get('/api/settings/public').expect(200);
    expect(res.body.settings.protectionFee).toEqual({ rate: 0.1, minCents: 50, maxCents: 500 });
    expect(res.body.texts.protectionHint).toBe('Chráni tvoj prenájom a pomáha riešiť prípadné škody alebo spory.');
    expect(JSON.stringify(res.body)).not.toMatch(/poist|insur|kauci|deposit/i);
  });

  it('deactivating a user revokes their sessions and hides their items', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const user = await createUser();
    const item = await createItem(user.user.id);
    await api().patch(`/api/admin/users/${user.user.id}/deactivate`).set(admin.auth).send({ active: false }).expect(200);
    await api().get('/api/auth/me').set(user.auth).expect(401);
    await api().get(`/api/items/${item.id}`).expect(404);
  });

  it('deactivated item cannot be re-activated by the owner', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const owner = await createUser();
    const item = await createItem(owner.user.id);
    await api().patch(`/api/admin/items/${item.id}/deactivate`).set(admin.auth).send({ active: false }).expect(200);
    await api().patch(`/api/items/${item.id}`).set(owner.auth).send({ isActive: true }).expect(403);
    const logs = await prisma.auditLog.count({ where: { entityId: item.id, action: 'ITEM_DEACTIVATED' } });
    expect(logs).toBe(1);
  });

  it('public profile does not expose phone or e-mail', async () => {
    const user = await createUser();
    const res = await api().get(`/api/users/${user.user.id}`).expect(200);
    expect(res.body.user.phone).toBeUndefined();
    expect(res.body.user.email).toBeUndefined();
  });
});
