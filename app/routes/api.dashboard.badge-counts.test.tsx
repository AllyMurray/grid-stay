import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { countUnreadDayNotifications } = vi.hoisted(() => ({
  countUnreadDayNotifications: vi.fn(),
}));
const { countPendingIncomingGarageShareRequests } = vi.hoisted(() => ({
  countPendingIncomingGarageShareRequests: vi.fn(),
}));
const { countNewWhatsNewEntries } = vi.hoisted(() => ({
  countNewWhatsNewEntries: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/db/services/day-notification.server', () => ({
  countUnreadDayNotifications,
}));

vi.mock('~/lib/db/services/garage-sharing.server', () => ({
  countPendingIncomingGarageShareRequests,
}));

vi.mock('~/lib/db/services/whats-new-view.server', () => ({
  countNewWhatsNewEntries,
}));

import { loader } from './api.dashboard.badge-counts';

describe('dashboard badge counts resource route', () => {
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
    countUnreadDayNotifications.mockReset();
    countUnreadDayNotifications.mockResolvedValue(3);
    countPendingIncomingGarageShareRequests.mockReset();
    countPendingIncomingGarageShareRequests.mockResolvedValue(2);
    countNewWhatsNewEntries.mockReset();
    countNewWhatsNewEntries.mockResolvedValue(1);
  });

  it('loads dashboard badge counts for the current user', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/api/dashboard/badge-counts'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual({
      unreadNotificationCount: 5,
      newWhatsNewCount: 1,
    });
    expect(countUnreadDayNotifications).toHaveBeenCalledWith('user-1');
    expect(countPendingIncomingGarageShareRequests).toHaveBeenCalledWith('user-1');
    expect(countNewWhatsNewEntries).toHaveBeenCalledWith('user-1');
  });
});
