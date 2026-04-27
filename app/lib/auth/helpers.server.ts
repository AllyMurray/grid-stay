import { redirect } from 'react-router';
import { auth } from './auth.server';
import { isAdminUser } from './authorization';
import { ensureUserMemberAccess } from './member-invites.server';
import type { User } from './schemas';

interface AuthResult {
  user: User;
  headers?: HeadersInit;
}

async function readAuthSession(request: Request): Promise<{
  result: AuthResult | null;
  headers?: Headers;
}> {
  const sessionResult = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });
  const session = sessionResult.response;

  if (!session) {
    return { result: null, headers: sessionResult.headers };
  }

  return {
    result: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        picture: session.user.image ?? undefined,
        role: (session.user as any).role ?? 'member',
      },
      headers: sessionResult.headers,
    },
    headers: sessionResult.headers,
  };
}

/**
 * Get the current user from session, returning null if not authenticated.
 * Uses Better Auth's session API — no manual token handling needed.
 */
export async function getUser(request: Request): Promise<AuthResult | null> {
  const { result } = await readAuthSession(request);
  return result;
}

/**
 * Require authentication - redirect to login if not authenticated
 */
export async function requireUser(request: Request): Promise<AuthResult> {
  const { result, headers } = await readAuthSession(request);

  if (!result) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`, {
      headers,
    });
  }

  if (!(await ensureUserMemberAccess(result.user))) {
    throw new Response('Invite required', {
      status: 403,
      statusText: 'Invite required',
      headers,
    });
  }

  return result;
}

/**
 * Require admin role (owner or admin) - return 403 if not authorised
 */
export async function requireAdmin(request: Request): Promise<AuthResult> {
  const result = await requireUser(request);

  if (!isAdminUser(result.user)) {
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
  const { result, headers } = await readAuthSession(request);

  if (result) {
    throw redirect('/dashboard/days', { headers });
  }
}
