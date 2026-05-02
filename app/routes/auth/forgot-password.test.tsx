import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAnonymous, submitPasswordResetRequest } = vi.hoisted(() => ({
  requireAnonymous: vi.fn(),
  submitPasswordResetRequest: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireAnonymous,
}));

vi.mock('~/lib/auth/password-auth.server', () => ({
  submitPasswordResetRequest,
}));

import { action, loader } from './forgot-password';

describe('forgot password route', () => {
  beforeEach(() => {
    requireAnonymous.mockReset();
    requireAnonymous.mockResolvedValue(undefined);
    submitPasswordResetRequest.mockReset();
    submitPasswordResetRequest.mockResolvedValue(Response.json({ ok: true }));
  });

  it('clears Better Auth dont-remember cookies for anonymous users', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/auth/forgot-password'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^__Secure-better-auth\.dont_remember=/),
        expect.stringMatching(/^better-auth\.dont_remember=/),
      ]),
    );
  });

  it('routes submissions to the password reset request helper', async () => {
    const formData = new FormData();
    formData.set('email', 'driver@example.com');
    const request = new Request('https://gridstay.app/auth/forgot-password', {
      method: 'POST',
      body: formData,
    });

    await action({ request, params: {}, context: {} } as never);

    expect(submitPasswordResetRequest).toHaveBeenCalledOnce();
    expect(submitPasswordResetRequest.mock.calls[0]?.[0]).toBe(request);
    expect(submitPasswordResetRequest.mock.calls[0]?.[1].get('email')).toBe(
      'driver@example.com',
    );
  });

  it('loads without a password-auth feature flag', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/auth/forgot-password'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(requireAnonymous).toHaveBeenCalledOnce();
  });
});
