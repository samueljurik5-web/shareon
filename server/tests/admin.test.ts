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

  it('rejects INSURANCE mode without a configured insurance provider', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().patch('/api/admin/settings').set(admin.auth).send({ protectionMode: 'INSURANCE' }).expect(400);
    expect(res.body.error.message).toContain('nie je nakonfigurovaný skutočný poisťovací partner');
    const s = await api().get('/api/admin/settings').set(admin.auth).expect(200);
    expect(s.body.settings.protectionMode).toBe('PROTECTION_FEE');
  });

  it('changes protection settings with audit log', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const res = await api().patch('/api/admin/settings').set(admin.auth).send({ protectionMode: 'NONE', maxDepositCents: 20000 }).expect(200);
    expect(res.body.settings.protectionMode).toBe('NONE');
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'SETTINGS_UPDATED' } });
    expect((log.oldValue as { protectionMode: string }).protectionMode).toBe('PROTECTION_FEE');
    expect((log.newValue as { protectionMode: string }).protectionMode).toBe('NONE');
    // Unknown keys are rejected
    await api().patch('/api/admin/settings').set(admin.auth).send({ hack: true }).expect(400);
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
