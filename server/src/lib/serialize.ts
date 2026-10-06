import type { User } from '@prisma/client';

/** Strip secrets. Never return passwordHash/tokenVersion. */
export const privateUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  city: u.city,
  bio: u.bio,
  avatarUrl: u.avatarUrl,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

/** Public view of a user: no email, no phone. */
export const publicUser = (u: Pick<User, 'id' | 'name' | 'city' | 'bio' | 'avatarUrl' | 'createdAt'>) => ({
  id: u.id,
  name: u.name,
  city: u.city,
  bio: u.bio,
  avatarUrl: u.avatarUrl,
  createdAt: u.createdAt,
});

export const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\s+/g, '');
  if (digits.length < 4) return '***';
  return `${digits.slice(0, 4)} *** ${digits.slice(-2)}`;
};
