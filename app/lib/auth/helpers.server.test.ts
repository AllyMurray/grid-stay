import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { getUser, requireUser } from './helpers.server';

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
          createdAt: new Date('2026-04-27T11:00:00.000Z'),
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
        createdAt: '2026-04-27T11:00:00.000Z',
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
          createdAt: new Date('2026-04-27T11:00:00.000Z'),
        },
      },
    });

    const result = await requireUser(
      new Request('https://gridstay.app/dashboard'),
    );

    expect(result.user.email).toBe('driver@example.com');
    expect(ensureUserMemberAccess).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'driver@example.com',
      name: 'Driver One',
      picture: undefined,
      role: 'member',
      createdAt: '2026-04-27T11:00:00.000Z',
    });
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

    await expect(
      requireUser(new Request('https://gridstay.app/dashboard')),
    ).rejects.toMatchObject({
      status: 403,
      statusText: 'Invite required',
    });
  });
});
