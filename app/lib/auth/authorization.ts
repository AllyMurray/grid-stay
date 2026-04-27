import type { User } from './schemas';

const ADMIN_EMAILS = new Set(['allymurray88@gmail.com']);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getBootstrapMemberEmails(
  value = process.env.GRID_STAY_BOOTSTRAP_MEMBER_EMAILS ?? '',
): Set<string> {
  return new Set(value.split(',').map(normalizeEmail).filter(Boolean));
}

export function isBootstrapMemberEmail(email: string): boolean {
  return getBootstrapMemberEmails().has(normalizeEmail(email));
}

export function isAdminUser(user: Pick<User, 'email' | 'role'>): boolean {
  const normalizedEmail = normalizeEmail(user.email);

  return (
    user.role === 'owner' ||
    user.role === 'admin' ||
    ADMIN_EMAILS.has(normalizedEmail)
  );
}
