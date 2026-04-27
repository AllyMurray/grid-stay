import type { User } from './schemas';

const ADMIN_EMAILS = new Set(['allymurray88@gmail.com']);
const DEFAULT_INVITE_GRANDFATHERED_BEFORE = '2026-04-27T19:10:00.000Z';

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

function toTimestamp(value: Date | string | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getInviteGrandfatheredBefore(
  value = process.env.GRID_STAY_INVITE_GRANDFATHERED_BEFORE ??
    DEFAULT_INVITE_GRANDFATHERED_BEFORE,
): string {
  return value;
}

export function isGrandfatheredMemberUser(
  user: Pick<User, 'createdAt'>,
  grandfatheredBefore = getInviteGrandfatheredBefore(),
): boolean {
  const userCreatedAt = toTimestamp(user.createdAt);
  const cutoff = toTimestamp(grandfatheredBefore);

  return userCreatedAt !== null && cutoff !== null && userCreatedAt <= cutoff;
}
