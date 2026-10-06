import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetDb, createUser } from './helpers.js';

const valid = { name: 'Jana Nová', email: 'jana.nova@example.sk', password: 'Heslo12345', phone: '+421 905 123 456', city: 'Košice' };

describe('auth', () => {
  beforeEach(resetDb);

  it('registers a user, hashes the password and never returns it', async () => {
    const res = await api().post('/api/auth/register').send(valid).expect(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.email).toBe('jana.nova@example.sk');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.role).toBe('USER');
  });

  it('ignores a client attempt to register as admin', async () => {
    const res = await api().post('/api/auth/register').send({ ...valid, role: 'ADMIN' }).expect(201);
    expect(res.body.user.role).toBe('USER');
  });

  it('returns Slovak validation messages', async () => {
    const res = await api().post('/api/auth/register').send({ ...valid, email: 'zle', password: '123' }).expect(400);
    const messages = res.body.error.details.map((d: { message: string }) => d.message);
    expect(messages).toContain('Zadaj platný e-mail.');
    expect(messages).toContain('Heslo musí mať aspoň 8 znakov.');
  });

  it('rejects duplicate e-mail', async () => {
    await api().post('/api/auth/register').send(valid).expect(201);
    const res = await api().post('/api/auth/register').send(valid).expect(409);
    expect(res.body.error.message).toBe('Účet s týmto e-mailom už existuje.');
  });

  it('logs in with correct credentials and rejects wrong password', async () => {
    await api().post('/api/auth/register').send(valid).expect(201);
    const ok = await api().post('/api/auth/login').send({ email: valid.email, password: valid.password }).expect(200);
    expect(ok.body.token).toBeTypeOf('string');
    const bad = await api().post('/api/auth/login').send({ email: valid.email, password: 'Zlé-heslo1' }).expect(401);
    expect(bad.body.error.message).toBe('Nesprávny e-mail alebo heslo.');
  });

  it('returns current user and revokes token on logout', async () => {
    const { token } = await createUser();
    const auth = { Authorization: `Bearer ${token}` };
    const me = await api().get('/api/auth/me').set(auth).expect(200);
    expect(me.body.user.stats).toBeDefined();
    await api().post('/api/auth/logout').set(auth).expect(200);
    await api().get('/api/auth/me').set(auth).expect(401);
  });

  it('rejects requests without or with invalid token', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set({ Authorization: 'Bearer nonsense' }).expect(401);
  });
});
