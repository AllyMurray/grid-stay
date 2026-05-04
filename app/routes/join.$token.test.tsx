import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn(),
}));
const {
  acceptMemberJoinLink,
  createClearMemberJoinLinkCookieHeader,
  createMemberJoinLinkCookieHeader,
  getMemberJoinLinkByToken,
} = vi.hoisted(() => ({
  acceptMemberJoinLink: vi.fn(),
  createClearMemberJoinLinkCookieHeader: vi.fn(),
  createMemberJoinLinkCookieHeader: vi.fn(),
  getMemberJoinLinkByToken: vi.fn(),
}));
const { createAcceptedMemberInviteForUser, ensureUserMemberAccess } =
  vi.hoisted(() => ({
    createAcceptedMemberInviteForUser: vi.fn(),
    ensureUserMemberAccess: vi.fn(),
  }));
const { recordAppEventSafely } = vi.hoisted(() => ({
  recordAppEventSafely: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  getUser,
}));

vi.mock('~/lib/auth/member-join-links.server', () => ({
  acceptMemberJoinLink,
  createClearMemberJoinLinkCookieHeader,
  createMemberJoinLinkCookieHeader,
  getMemberJoinLinkByToken,
}));

vi.mock('~/lib/auth/member-invites.server', () => ({
  createAcceptedMemberInviteForUser,
  ensureUserMemberAccess,
}));

vi.mock('~/lib/db/services/app-event.server', () => ({
  recordAppEventSafely,
}));

import { loader } from './join.$token';

const token = 'abcdefghijklmnopqrstuvwxyzABCDEFGH';
const link = {
  tokenHash: 'hash-1',
  tokenHint: 'ABCDEFGH',
  mode: 'usage_limit',
  maxUses: 5,
  acceptedUserIds: [],
  acceptedCount: 0,
  status: 'active',
  createdByUserId: 'admin-1',
  createdByName: 'Admin One',
  expiresAt: '2026-05-05T10:00:00.000Z',
  createdAt: '2026-05-04T10:00:00.000Z',
  updatedAt: '2026-05-04T10:00:00.000Z',
};
const user = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member' as const,
};

async function expectRedirect(promise: Promise<Response>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Response);
    return error as Response;
  }

  throw new Error('Expected redirect response to be thrown');
}

describe('join route', () => {
  beforeEach(() => {
    getUser.mockReset();
    getUser.mockResolvedValue(null);
    getMemberJoinLinkByToken.mockReset();
    getMemberJoinLinkByToken.mockResolvedValue({ ok: true, link });
    createMemberJoinLinkCookieHeader.mockReset();
    createMemberJoinLinkCookieHeader.mockReturnValue(
      `grid_stay_join_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
    );
    createClearMemberJoinLinkCookieHeader.mockReset();
    createClearMemberJoinLinkCookieHeader.mockReturnValue(
      'grid_stay_join_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    );
    ensureUserMemberAccess.mockReset();
    ensureUserMemberAccess.mockResolvedValue(false);
    acceptMemberJoinLink.mockReset();
    acceptMemberJoinLink.mockResolvedValue({
      ok: true,
      link: { ...link, acceptedCount: 1, acceptedUserIds: ['user-1'] },
    });
    createAcceptedMemberInviteForUser.mockReset();
    createAcceptedMemberInviteForUser.mockResolvedValue({});
    recordAppEventSafely.mockReset();
    recordAppEventSafely.mockResolvedValue(undefined);
  });

  it('shows a failure page for unavailable join links', async () => {
    getMemberJoinLinkByToken.mockResolvedValue({
      ok: false,
      reason: 'expired',
    });

    const response = (await loader({
      request: new Request(`https://gridstay.app/join/${token}`),
      params: { token },
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ reason: 'expired' });
    expect(response.headers.getSetCookie()).toEqual([
      'grid_stay_join_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    ]);
  });

  it('stores the join token for anonymous users and sends them to login', async () => {
    const response = await expectRedirect(
      loader({
        request: new Request(`https://gridstay.app/join/${token}`),
        params: { token },
        context: {},
      } as never),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      `/auth/login?redirectTo=%2Fjoin%2F${token}`,
    );
    expect(createMemberJoinLinkCookieHeader).toHaveBeenCalledWith({
      request: expect.any(Request),
      token,
      expiresAt: link.expiresAt,
    });
  });

  it('accepts valid join links for signed-in users without member access', async () => {
    getUser.mockResolvedValue({ user, headers: new Headers() });

    const response = await expectRedirect(
      loader({
        request: new Request(`https://gridstay.app/join/${token}`, {
          headers: { cookie: `grid_stay_join_token=${token}` },
        }),
        params: { token },
        context: {},
      } as never),
    );

    expect(response.headers.get('location')).toBe('/dashboard/days');
    expect(acceptMemberJoinLink).toHaveBeenCalledWith({ token, user });
    expect(createAcceptedMemberInviteForUser).toHaveBeenCalledWith({
      user,
      invitedBy: {
        id: 'admin-1',
        name: 'Admin One',
      },
    });
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'memberJoinLink.accepted',
        subject: { type: 'memberJoinLink', id: 'hash-1' },
      }),
    );
    expect(response.headers.getSetCookie()).toEqual([
      'grid_stay_join_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    ]);
  });
});
