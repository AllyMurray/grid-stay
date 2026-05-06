import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { listMemberDateLeaderboard } = vi.hoisted(() => ({
  listMemberDateLeaderboard: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/auth/members.server', () => ({
  listMemberDateLeaderboard,
}));

import { loader } from './members.leaderboard';

const leaderboard = [
  {
    id: 'user-1',
    name: 'Driver One',
    totalCount: 3,
    raceDayCount: 1,
    testDayCount: 0,
    trackDayCount: 2,
  },
];

describe('member date leaderboard route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'driver@example.com',
        name: 'Driver One',
        role: 'member',
      },
      headers: new Headers(),
    });
    listMemberDateLeaderboard.mockReset();
    listMemberDateLeaderboard.mockResolvedValue(leaderboard);
  });

  it('loads the member date leaderboard', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/members/leaderboard'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual({
      leaderboard,
    });
    expect(listMemberDateLeaderboard).toHaveBeenCalledOnce();
  });
});
