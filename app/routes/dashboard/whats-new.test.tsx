import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { markWhatsNewViewed } = vi.hoisted(() => ({
  markWhatsNewViewed: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/db/services/whats-new-view.server', () => ({
  markWhatsNewViewed,
}));

import { loader } from './whats-new';

describe('whats new route', () => {
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
    markWhatsNewViewed.mockReset();
    markWhatsNewViewed.mockResolvedValue(undefined);
  });

  it("marks what's new as viewed when the page is opened", async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/whats-new'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(markWhatsNewViewed).toHaveBeenCalledWith('user-1');
  });
});
