import type { User } from './schemas';

const ADMIN_EMAILS = new Set(['allymurray88@gmail.com']);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeMemberAccessEmail(email: string): string {
  const normalizedEmail = normalizeEmail(email);
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex <= 0) {
    return normalizedEmail;
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);
  const canonicalDomain = domain === 'googlemail.com' ? 'gmail.com' : domain;

  if (canonicalDomain !== 'gmail.com') {
    return normalizedEmail;
  }

  const canonicalLocalPart = localPart.split('+')[0]?.replaceAll('.', '');

  return `${canonicalLocalPart ?? localPart}@${canonicalDomain}`;
}

export function hasGmailAliasSemantics(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex <= 0) {
    return false;
  }

  const domain = normalizedEmail.slice(atIndex + 1);
  return domain === 'gmail.com' || domain === 'googlemail.com';
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

  return user.role === 'owner' || user.role === 'admin' || ADMIN_EMAILS.has(normalizedEmail);
}
