import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { ensureUserMemberAccess, getSession } = vi.hoisted(() => ({
  ensureUserMemberAccess: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('./auth.server', () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

vi.mock('./member-invites.server', () => ({
  ensureUserMemberAccess,
}));

import { getUser, requireAdmin, requireAnonymous, requireUser } from './helpers.server';

describe('auth helpers', () => {
  beforeEach(() => {
    ensureUserMemberAccess.mockReset();
    ensureUserMemberAccess.mockResolvedValue(true);
    getSession.mockReset();
  });

  it('propagates refreshed session cookie headers from Better Auth', async () => {
    const headers = new Headers();
    headers.append(
      'set-cookie',
      '__Secure-better-auth.session_token=token; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
    getSession.mockResolvedValue({
      headers,
      response: {
        session: {
          id: 'session-1',
          token: 'token',
          userId: 'user-1',
          expiresAt: new Date('2026-05-27T12:00:00.000Z'),
          createdAt: new Date('2026-04-27T12:00:00.000Z'),
          updatedAt: new Date('2026-04-27T12:00:00.000Z'),
        },
        user: {
          id: 'user-1',
          email: 'driver@example.com',
          name: 'Driver One',
          image: 'https://example.com/driver.png',
          role: 'member',
        },
      },
    });

    const request = new Request('https://gridstay.app/dashboard');
    const result = await getUser(request);

    expect(getSession).toHaveBeenCalledWith({
      headers: request.headers,
      returnHeaders: true,
    });
    expect(result).toMatchObject({
      user: {
        id: 'user-1',
        email: 'driver@example.com',
        name: 'Driver One',
        picture: 'https://example.com/driver.png',
        role: 'member',
      },
    });
    expect(result?.headers).toBe(headers);
  });

  it('allows required users with member access', async () => {
    getSession.mockResolvedValue({
      headers: new Headers(),
      response: {
        session: {
          id: 'session-1',
          token: 'token',
          userId: 'user-1',
          expiresAt: new Date('2026-05-27T12:00:00.000Z'),
          createdAt: new Date('2026-04-27T12:00:00.000Z'),
          updatedAt: new Date('2026-04-27T12:00:00.000Z'),
        },
        user: {
          id: 'user-1',
          email: 'driver@example.com',
          name: 'Driver One',
          role: 'member',
        },
      },
    });

    const result = await requireUser(new Request('https://gridstay.app/dashboard'));

    expect(result.user.email).toBe('driver@example.com');
    expect(ensureUserMemberAccess).toHaveBeenCalledWith(result.user);
  });

  it('rejects required users without an invite', async () => {
    ensureUserMemberAccess.mockResolvedValue(false);
    getSession.mockResolvedValue({
      headers: new Headers(),
      response: {
        session: {
          id: 'session-1',
          token: 'token',
          userId: 'user-1',
          expiresAt: new Date('2026-05-27T12:00:00.000Z'),
          createdAt: new Date('2026-04-27T12:00:00.000Z'),
          updatedAt: new Date('2026-04-27T12:00:00.000Z'),
        },
        user: {
          id: 'user-1',
          email: 'driver@example.com',
          name: 'Driver One',
          role: 'member',
        },
      },
    });

    await expect(requireUser(new Request('https://gridstay.app/dashboard'))).rejects.toMatchObject({
      status: 403,
      statusText: 'Invite required',
    });
  });

  it('returns Better Auth cleanup headers for anonymous users', async () => {
    const headers = new Headers();
    headers.append(
      'set-cookie',
      '__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
    getSession.mockResolvedValue({
      headers,
      response: null,
    });

    const result = await requireAnonymous(new Request('https://gridstay.app/auth/login'));

    expect(result).toBe(headers);
  });

  it('preserves refreshed session headers when rejecting non-admin users', async () => {
    const headers = new Headers();
    headers.append(
      'set-cookie',
      '__Secure-better-auth.session_token=token; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
    getSession.mockResolvedValue({
      headers,
      response: {
        session: {
          id: 'session-1',
          token: 'token',
          userId: 'user-1',
          expiresAt: new Date('2026-05-27T12:00:00.000Z'),
          createdAt: new Date('2026-04-27T12:00:00.000Z'),
          updatedAt: new Date('2026-04-27T12:00:00.000Z'),
        },
        user: {
          id: 'user-1',
          email: 'driver@example.com',
          name: 'Driver One',
          role: 'member',
        },
      },
    });

    let rejection: unknown;
    try {
      await requireAdmin(new Request('https://gridstay.app/dashboard/admin'));
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(Response);
    const response = rejection as Response;
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual(headers.getSetCookie());
  });
});
