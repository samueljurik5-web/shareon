import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetDb, createUser } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

const valid = { name: 'Jana Nová', email: 'jana.nova@example.sk', password: 'Heslo12345', phone: '+421 905 123 456', city: 'Košice', acceptTerms: true };

describe('auth', () => {
  beforeEach(resetDb);

  it('requires accepting the terms and stores when they were accepted', async () => {
    const withoutConsent: Partial<typeof valid> = { ...valid };
    delete withoutConsent.acceptTerms;
    const res = await api().post('/api/auth/register').send(withoutConsent).expect(400);
    expect(JSON.stringify(res.body)).toContain('súhlas s podmienkami');
    await api().post('/api/auth/register').send(valid).expect(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: valid.email } });
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it('blocks built-in demo accounts in production (public password), not in development', async () => {
    const { user } = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { isDemo: true } });
    await api().post('/api/auth/login').send({ email: user.email, password: 'Heslo12345' }).expect(200);
    const original = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const res = await api().post('/api/auth/login').send({ email: user.email, password: 'Heslo12345' }).expect(403);
      expect(res.body.error.message).toContain('Ukážkový účet');
    } finally {
      env.NODE_ENV = original;
    }
  });

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
