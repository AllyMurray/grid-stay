import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { listUserDayNotifications, markAllDayNotificationsRead } = vi.hoisted(
  () => ({
    listUserDayNotifications: vi.fn(),
    markAllDayNotificationsRead: vi.fn(),
  }),
);
const { listPendingIncomingGarageShareRequests } = vi.hoisted(() => ({
  listPendingIncomingGarageShareRequests: vi.fn(),
}));
const { submitGarageShareDecision } = vi.hoisted(() => ({
  submitGarageShareDecision: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/db/services/day-notification.server', () => ({
  listUserDayNotifications,
  markAllDayNotificationsRead,
}));

vi.mock('~/lib/db/services/garage-sharing.server', () => ({
  listPendingIncomingGarageShareRequests,
}));

vi.mock('~/lib/garage-sharing/actions.server', () => ({
  submitGarageShareDecision,
}));

import { action, loader } from './notifications';

describe('notifications route', () => {
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
    listUserDayNotifications.mockReset();
    listUserDayNotifications.mockResolvedValue([]);
    markAllDayNotificationsRead.mockReset();
    markAllDayNotificationsRead.mockResolvedValue(undefined);
    listPendingIncomingGarageShareRequests.mockReset();
    listPendingIncomingGarageShareRequests.mockResolvedValue([]);
    submitGarageShareDecision.mockReset();
    submitGarageShareDecision.mockResolvedValue({ ok: true });
  });

  it('loads day notifications and pending garage requests', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/notifications'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({
      notifications: [],
      garageShareRequests: [],
    });
    expect(listUserDayNotifications).toHaveBeenCalledWith('user-1');
    expect(listPendingIncomingGarageShareRequests).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('returns garage decision errors instead of redirecting them away', async () => {
    submitGarageShareDecision.mockResolvedValue({
      ok: false,
      formError: 'This garage no longer has a free space.',
      fieldErrors: {},
    });
    const formData = new FormData();
    formData.set('intent', 'updateGarageShareRequest');
    formData.set('requestId', 'garage-request-1');
    formData.set('status', 'approved');
    const request = new Request(
      'https://gridstay.app/dashboard/notifications',
      {
        method: 'POST',
        body: formData,
      },
    );

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      formError: 'This garage no longer has a free space.',
    });
  });
});
