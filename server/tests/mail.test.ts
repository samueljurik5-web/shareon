import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { processMailOutbox, renderNotificationEmail } from '../src/services/mail.js';
import { api, resetDb, setupPendingRental } from './helpers.js';

describe('e-mail notifications (outbox)', () => {
  const saved = { key: env.RESEND_API_KEY, from: env.MAIL_FROM, url: env.PUBLIC_APP_URL, admin: env.ADMIN_NOTIFY_EMAIL };
  beforeEach(resetDb);
  afterEach(() => {
    env.RESEND_API_KEY = saved.key;
    env.MAIL_FROM = saved.from;
    env.PUBLIC_APP_URL = saved.url;
    env.ADMIN_NOTIFY_EMAIL = saved.admin;
    vi.unstubAllGlobals();
  });

  it('is off without RESEND_API_KEY', async () => {
    env.RESEND_API_KEY = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await setupPendingRental();
    expect(await processMailOutbox(new Date(0))).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('e-mails the owner about a new request once, with a link; skips placeholder addresses', async () => {
    env.RESEND_API_KEY = 're_test';
    env.MAIL_FROM = 'ShareOn <noreply@shareon.sk>';
    env.PUBLIC_APP_URL = 'https://shareon.onrender.com';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { owner, rentalId } = await setupPendingRental();
    await prisma.user.update({ where: { id: owner.user.id }, data: { email: 'majitel@gmail.com' } });
    expect(await processMailOutbox(new Date(0))).toBe(1);
    expect(await processMailOutbox(new Date(0))).toBe(0); // never twice
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['majitel@gmail.com']);
    expect(body.subject).toMatch(/^ShareOn: Nová žiadosť o požičanie/);
    expect(body.text).toContain(`https://shareon.onrender.com/requests/${rentalId}`);

    // renter address is a placeholder (@example.sk) → marked as handled, not sent
    await api().patch(`/api/rental-requests/${rentalId}/status`).set(owner.auth).send({ action: 'ACCEPT' }).expect(200);
    expect(await processMailOutbox(new Date(0))).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.notification.count({ where: { type: 'RENTAL_ACCEPTED', emailedAt: { not: null } } })).toBe(1);
  });

  it('e-mails the operator about a new waitlist sign-up, demand request and feedback (only when ADMIN_NOTIFY_EMAIL is set)', async () => {
    env.RESEND_API_KEY = 're_test';
    env.MAIL_FROM = 'ShareOn <onboarding@resend.dev>';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    env.ADMIN_NOTIFY_EMAIL = undefined;
    await api().post('/api/launch/waitlist').send({ email: 'a@b.sk', role: 'BORROW', consent: true }).expect(201);
    expect(fetchMock).not.toHaveBeenCalled();

    env.ADMIN_NOTIFY_EMAIL = 'ja@gmail.com';
    await api().post('/api/launch/waitlist').send({ email: 'eva@gmail.com', role: 'LEND', city: 'Košice', wish: 'Stan <b>pre 6</b>', consent: true }).expect(201);
    await api().post('/api/launch/demand').send({ what: 'Zváračka' }).expect(201);
    await api().post('/api/feedback').send({ type: 'BUG', message: 'Nejde mi nahrať fotku.' }).expect(201);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse(((c as unknown as [string, RequestInit])[1]).body as string));
    expect(bodies.every((b) => b.to[0] === 'ja@gmail.com')).toBe(true);
    expect(bodies[0].subject).toBe('ShareOn: nový záujemca v zozname');
    expect(bodies[0].text).toContain('E-mail: eva@gmail.com');
    expect(bodies[0].text).toContain('Mesto: Košice');
    expect(bodies[0].text).toContain('Chce si požičať: Stan <b>pre 6</b>');
    expect(bodies[0].html).toContain('Stan &lt;b&gt;pre 6&lt;/b&gt;');
    expect(bodies[1].subject).toBe('ShareOn: niekto hľadá: Zváračka');
    expect(bodies[2].text).toContain('Správa: Nejde mi nahrať fotku.');
  });

  it('escapes user content in the HTML part', () => {
    const mail = renderNotificationEmail({ title: '<b>Pozor</b>', body: 'a & b', link: '/x' }, 'Jana');
    expect(mail.html).toContain('&lt;b&gt;Pozor&lt;/b&gt;');
    expect(mail.html).toContain('a &amp; b');
  });
});
