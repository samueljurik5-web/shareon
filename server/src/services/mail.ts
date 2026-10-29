import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

/**
 * E-mail notifications (optional): Resend HTTP API, configured with RESEND_API_KEY + MAIL_FROM.
 * Notifications are written to the database inside the business transaction; this outbox
 * e-mails them afterwards, so an e-mail is never sent for something that was rolled back.
 */
export const isMailConfigured = () => Boolean(env.RESEND_API_KEY && env.MAIL_FROM);

/** Notification types that are also sent by e-mail (the rest stay in-app only). */
export const EMAIL_NOTIFICATION_TYPES = [
  'RENTAL_REQUESTED',
  'RENTAL_ACCEPTED',
  'RENTAL_REJECTED',
  'RENTAL_DATES_PROPOSED',
  'RENTAL_CANCELLED',
  'REPORT_CREATED',
  'REPORT_STATUS',
];

const appUrl = () => (env.PUBLIC_APP_URL ?? env.RENDER_EXTERNAL_URL ?? '').replace(/\/$/, '');

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Plain-text + simple HTML e-mail for one notification. */
export const renderNotificationEmail = (n: { title: string; body: string | null; link: string | null }, name: string) => {
  const url = n.link ? `${appUrl()}${n.link}` : appUrl();
  const text = [`Ahoj ${name},`, '', n.title, ...(n.body ? [n.body] : []), '', `Otvoriť v ShareOn: ${url}`, '', '—', 'ShareOn · požičiavanie vecí v Košiciach'].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#111;line-height:1.5">
<p>Ahoj ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(n.title)}</strong>${n.body ? `<br>${escapeHtml(n.body)}` : ''}</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#9b5cff;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Otvoriť v ShareOn</a></p>
<p style="color:#666;font-size:12px">ShareOn · požičiavanie vecí v Košiciach. Tento e-mail sme poslali, lebo máš v ShareOn účet.</p>
</div>`;
  return { subject: `ShareOn: ${n.title}`, text, html };
};

export const sendMail = async (to: string, mail: { subject: string; text: string; html: string }): Promise<boolean> => {
  if (!isMailConfigured()) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[mail] Resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.ok;
  } catch (e) {
    console.error('[mail] sending failed:', e instanceof Error ? e.message : e);
    return false;
  }
};

/** Placeholder/demo addresses that must never be e-mailed. */
const isUndeliverable = (email: string, isDemo: boolean) => isDemo || /\.(local|test|example)$/i.test(email) || /@example\.(sk|com)$/i.test(email);

/** Sends pending e-mails for notifications created after `since`. Returns the number of e-mails sent. */
export const processMailOutbox = async (since: Date, batch = 20): Promise<number> => {
  const pending = await prisma.notification.findMany({
    where: { emailedAt: null, type: { in: EMAIL_NOTIFICATION_TYPES }, createdAt: { gte: since } },
    include: { user: { select: { email: true, name: true, isActive: true, isDemo: true } } },
    orderBy: { createdAt: 'asc' },
    take: batch,
  });
  let sent = 0;
  for (const n of pending) {
    // Claim the row first so that two server instances never send the same e-mail.
    const claimed = await prisma.notification.updateMany({ where: { id: n.id, emailedAt: null }, data: { emailedAt: new Date() } });
    if (claimed.count === 0 || !n.user.isActive || isUndeliverable(n.user.email, n.user.isDemo)) continue;
    if (await sendMail(n.user.email, renderNotificationEmail(n, n.user.name.split(' ')[0]))) sent += 1;
  }
  return sent;
};

/** Starts the outbox loop when e-mail is configured (not in tests). */
export const startMailOutbox = (intervalMs = 15_000) => {
  if (!isMailConfigured()) {
    console.info('[mail] RESEND_API_KEY/MAIL_FROM not set – e-mail notifications are off (in-app notifications only).');
    return () => undefined;
  }
  // Only notifications from (shortly before) this start – never a backlog of old ones.
  const since = new Date(Date.now() - 10 * 60_000);
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processMailOutbox(since);
    } catch (e) {
      console.error('[mail] outbox failed:', e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  }, intervalMs);
  console.info(`[mail] e-mail notifications on (from ${env.MAIL_FROM}).`);
  return () => clearInterval(timer);
};
