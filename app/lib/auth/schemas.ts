import { z } from 'zod';
import { USER_ROLE_VALUES } from '../constants/enums';

/**
 * User data from Better Auth session.
 * All fields including role are stored on the Better Auth user record.
 */
export const User = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  picture: z.string().optional(),
  role: z.enum(USER_ROLE_VALUES).default('member'),
});
export type User = z.infer<typeof User>;
