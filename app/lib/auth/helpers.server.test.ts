import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('./auth.server', () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

import { getUser } from './helpers.server';

describe('auth helpers', () => {
  beforeEach(() => {
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
});
