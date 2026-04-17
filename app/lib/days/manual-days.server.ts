import { isAdminUser } from '~/lib/auth/authorization';
import type { User } from '~/lib/auth/schemas';

export function canCreateManualDays(
  user: Pick<User, 'email' | 'role'>,
): boolean {
  return isAdminUser(user);
}
