import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createUser, resetDb } from './helpers.js';

describe('feedback', () => {
  beforeEach(resetDb);

  it('anyone can send feedback; it is stored and visible only to admins', async () => {
    await api().post('/api/feedback').send({ type: 'LIKE', contact: 'Jana', message: 'Super nápad, páči sa mi to!' }).expect(201);
    const user = await createUser();
    await api().post('/api/feedback').set(user.auth).send({ type: 'BUG', message: 'Na mobile sa mi zle zatvára menu.' }).expect(201);
    const stored = await prisma.feedback.findMany({ orderBy: { createdAt: 'asc' } });
    expect(stored.map((f) => [f.type, f.contact, f.userId])).toEqual([
      ['LIKE', 'Jana', null],
      ['BUG', null, user.user.id],
    ]);

    await api().get('/api/admin/feedback').set(user.auth).expect(403);
    const admin = await createUser({ role: 'ADMIN' });
    const list = await api().get('/api/admin/feedback').set(admin.auth).expect(200);
    expect(list.body.feedback).toHaveLength(2);
    expect(list.body.feedback[0].user.email).toBe(user.user.email);
    const overview = await api().get('/api/admin/overview').set(admin.auth).expect(200);
    expect(overview.body.counts.feedback).toBe(2);
  });

  it('validates type and message in Slovak', async () => {
    const bad = await api().post('/api/feedback').send({ type: 'SPAM', message: 'ok' }).expect(400);
    const messages = bad.body.error.details.map((d: { message: string }) => d.message);
    expect(messages).toEqual(expect.arrayContaining(['Vyber typ spätnej väzby.', 'Správa musí mať aspoň 5 znakov.']));
  });
});
