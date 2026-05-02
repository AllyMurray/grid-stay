import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authHandler } = vi.hoisted(() => ({
  authHandler: vi.fn(),
}));

vi.mock('~/lib/auth/auth.server', () => ({
  auth: {
    handler: authHandler,
  },
}));

import { action, loader } from './api.auth.$';

describe('api auth route', () => {
  beforeEach(() => {
    authHandler.mockReset();
    authHandler.mockResolvedValue(Response.json({ ok: true }));
  });

  it('blocks the raw set-password endpoint', async () => {
    const response = (await action({
      request: new Request('https://gridstay.app/api/auth/set-password', {
        method: 'POST',
      }),
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: 'Not found' });
    expect(authHandler).not.toHaveBeenCalled();
  });

  it('blocks the raw set-password endpoint with a trailing slash', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/api/auth/set-password/'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(404);
    expect(authHandler).not.toHaveBeenCalled();
  });

  it('passes other auth requests to Better Auth', async () => {
    const request = new Request(
      'https://gridstay.app/api/auth/reset-password',
      {
        method: 'POST',
      },
    );

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(authHandler).toHaveBeenCalledWith(request);
  });
});
