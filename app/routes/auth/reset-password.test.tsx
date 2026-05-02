import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isPasswordAuthEnabled, requireAnonymous, submitPasswordReset } =
  vi.hoisted(() => ({
    isPasswordAuthEnabled: vi.fn(),
    requireAnonymous: vi.fn(),
    submitPasswordReset: vi.fn(),
  }));

vi.mock('~/lib/auth/password-auth-availability.server', () => ({
  isPasswordAuthEnabled,
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireAnonymous,
}));

vi.mock('~/lib/auth/password-auth.server', () => ({
  submitPasswordReset,
}));

import { action, loader } from './reset-password';

async function expectRedirect(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Response);
    return error as Response;
  }

  throw new Error('Expected redirect response to be thrown');
}

describe('reset password route', () => {
  beforeEach(() => {
    isPasswordAuthEnabled.mockReset();
    isPasswordAuthEnabled.mockReturnValue(true);
    requireAnonymous.mockReset();
    requireAnonymous.mockResolvedValue(undefined);
    submitPasswordReset.mockReset();
    submitPasswordReset.mockResolvedValue(Response.json({ ok: true }));
  });

  it('loads the reset token from the query string', async () => {
    const response = (await loader({
      request: new Request(
        'https://gridstay.app/auth/reset-password?token=reset-token',
      ),
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
    expect(submitPasswordReset.mock.calls[0]?.[1].get('token')).toBe(
      'reset-token',
    );
  });

  it('redirects to login when password auth is unavailable', async () => {
    isPasswordAuthEnabled.mockReturnValue(false);

    const response = await expectRedirect(
      loader({
        request: new Request(
          'https://gridstay.app/auth/reset-password?token=reset-token',
        ),
        params: {},
        context: {},
      } as never),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/auth/login');
    expect(requireAnonymous).not.toHaveBeenCalled();
  });
});
