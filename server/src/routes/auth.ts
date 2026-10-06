import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../middleware/validate.js';
import { currentUser, requireAuth, signToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { conflict, unauthorized } from '../lib/errors.js';
import { privateUser } from '../lib/serialize.js';
import { userRatingSummary, userRentalStats } from '../services/stats.js';

const router = Router();

const BCRYPT_ROUNDS = 12;

export const phoneSchema = z
  .string({ required_error: 'Telefón je povinný.' })
  .trim()
  .regex(/^\+?[0-9 ]{9,16}$/, 'Zadaj platné telefónne číslo, napr. +421 900 123 456.');

const registerSchema = z.object({
  name: z.string({ required_error: 'Meno je povinné.' }).trim().min(2, 'Meno musí mať aspoň 2 znaky.').max(80, 'Meno je príliš dlhé.'),
  email: z.string({ required_error: 'E-mail je povinný.' }).trim().toLowerCase().email('Zadaj platný e-mail.').max(160),
  password: z
    .string({ required_error: 'Heslo je povinné.' })
    .min(8, 'Heslo musí mať aspoň 8 znakov.')
    .max(128, 'Heslo je príliš dlhé.')
    .regex(/[A-Za-z]/, 'Heslo musí obsahovať aspoň jedno písmeno.')
    .regex(/[0-9]/, 'Heslo musí obsahovať aspoň jedno číslo.'),
  phone: phoneSchema,
  city: z.string({ required_error: 'Mesto je povinné.' }).trim().min(2, 'Zadaj mesto.').max(80),
});

const loginSchema = z.object({
  email: z.string({ required_error: 'E-mail je povinný.' }).trim().toLowerCase().email('Zadaj platný e-mail.'),
  password: z.string({ required_error: 'Heslo je povinné.' }).min(1, 'Heslo je povinné.').max(128),
});

router.post('/register', authLimiter, async (req, res) => {
  const data = parseBody(registerSchema, req);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw conflict('Účet s týmto e-mailom už existuje.');
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, city: data.city, passwordHash },
  });
  res.status(201).json({ token: signToken(user), user: privateUser(user) });
});

// Pre-computed hash so that login timing does not reveal whether an e-mail exists.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_ROUNDS);

router.post('/login', authLimiter, async (req, res) => {
  const data = parseBody(loginSchema, req);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const ok = await bcrypt.compare(data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Nesprávny e-mail alebo heslo.');
  if (!user.isActive) throw unauthorized('Tento účet bol deaktivovaný. Kontaktuj podporu.');
  res.json({ token: signToken(user), user: privateUser(user) });
});

/** Revokes all tokens of the user by bumping tokenVersion. */
router.post('/logout', requireAuth, async (req, res) => {
  const user = currentUser(req);
  await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const [rating, stats, unreadNotifications] = await Promise.all([
    userRatingSummary(user.id),
    userRentalStats(user.id),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  res.json({ user: { ...privateUser(user), rating, stats, unreadNotifications } });
});

export default router;
