import { redirect } from 'react-router';
import { auth } from './auth.server';
import type { User } from './schemas';

interface AuthResult {
  user: User;
  headers?: HeadersInit;
}

/**
 * Get the current user from session, returning null if not authenticated.
 * Uses Better Auth's session API — no manual token handling needed.
 */
export async function getUser(request: Request): Promise<AuthResult | null> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      picture: session.user.image ?? undefined,
      role: (session.user as any).role ?? 'member',
    },
  };
}

/**
 * Require authentication - redirect to login if not authenticated
 */
export async function requireUser(request: Request): Promise<AuthResult> {
  const result = await getUser(request);

  if (!result) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return result;
}

/**
 * Require admin role (owner or admin) - return 403 if not authorised
 */
export async function requireAdmin(request: Request): Promise<AuthResult> {
  const result = await requireUser(request);

  if (result.user.role !== 'owner' && result.user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }

  return result;
}

/**
 * Require owner role - return 403 if not the site owner
 */
export async function requireOwner(request: Request): Promise<AuthResult> {
  const result = await requireUser(request);

  if (result.user.role !== 'owner') {
    throw new Response('Forbidden', { status: 403 });
  }

  return result;
}

/**
 * Require anonymous - redirect to dashboard if already authenticated
 */
export async function requireAnonymous(request: Request): Promise<void> {
  const result = await getUser(request);

  if (result) {
    throw redirect('/dashboard/days');
  }
}
