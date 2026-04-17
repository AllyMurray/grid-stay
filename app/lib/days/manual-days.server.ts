import type { User } from '~/lib/auth/schemas';

const MANUAL_DAY_CREATOR_EMAILS = new Set(['allymurray88@gmail.com']);

export function canCreateManualDays(user: Pick<User, 'email'>): boolean {
  return MANUAL_DAY_CREATOR_EMAILS.has(user.email.trim().toLowerCase());
}
