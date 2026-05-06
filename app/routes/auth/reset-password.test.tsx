import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireAnonymous, submitPasswordReset } = vi.hoisted(() => ({
  requireAnonymous: vi.fn(),
  submitPasswordReset: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireAnonymous,
}));

vi.mock('~/lib/auth/password-auth.server', () => ({
  submitPasswordReset,
}));

import { action, loader } from './reset-password';

describe('reset password route', () => {
  beforeEach(() => {
    requireAnonymous.mockReset();
    requireAnonymous.mockResolvedValue(undefined);
    submitPasswordReset.mockReset();
    submitPasswordReset.mockResolvedValue(Response.json({ ok: true }));
  });

  it('loads the reset token from the query string', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/auth/reset-password?token=reset-token'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({ token: 'reset-token' });
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^__Secure-better-auth\.dont_remember=/),
        expect.stringMatching(/^better-auth\.dont_remember=/),
      ]),
    );
  });

  it('routes submissions to the password reset helper', async () => {
    const formData = new FormData();
    formData.set('token', 'reset-token');
    formData.set('password', 'password123');
    const request = new Request('https://gridstay.app/auth/reset-password', {
      method: 'POST',
      body: formData,
    });

    await action({ request, params: {}, context: {} } as never);

    expect(submitPasswordReset).toHaveBeenCalledOnce();
    expect(submitPasswordReset.mock.calls[0]?.[0]).toBe(request);
    expect(submitPasswordReset.mock.calls[0]?.[1].get('token')).toBe('reset-token');
  });

  it('loads without a password-auth feature flag', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/auth/reset-password?token=reset-token'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(requireAnonymous).toHaveBeenCalledOnce();
  });
});
