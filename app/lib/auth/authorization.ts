import type { User } from './schemas';

const ADMIN_EMAILS = new Set(['allymurray88@gmail.com']);

export function isAdminUser(user: Pick<User, 'email' | 'role'>): boolean {
  const normalizedEmail = user.email.trim().toLowerCase();

  return (
    user.role === 'owner' ||
    user.role === 'admin' ||
    ADMIN_EMAILS.has(normalizedEmail)
  );
}
