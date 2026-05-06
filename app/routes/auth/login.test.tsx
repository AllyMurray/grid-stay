import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireAnonymous } = vi.hoisted(() => ({
  requireAnonymous: vi.fn(),
}));
const { sanitizeRedirectTo, submitPasswordSignIn, submitPasswordSignUp } = vi.hoisted(() => ({
  sanitizeRedirectTo: vi.fn(),
  submitPasswordSignIn: vi.fn(),
  submitPasswordSignUp: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireAnonymous,
}));

vi.mock('~/lib/auth/password-auth.server', () => ({
  sanitizeRedirectTo,
  submitPasswordSignIn,
  submitPasswordSignUp,
}));

import { action, loader } from './login';

describe('auth login route', () => {
  beforeEach(() => {
    requireAnonymous.mockReset();
    requireAnonymous.mockResolvedValue(undefined);
    sanitizeRedirectTo.mockReset();
    sanitizeRedirectTo.mockImplementation((value) => {
      const raw = value?.toString() || '/dashboard';
      return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
    });
    submitPasswordSignIn.mockReset();
    submitPasswordSignIn.mockResolvedValue(Response.json({ ok: true }));
    submitPasswordSignUp.mockReset();
    submitPasswordSignUp.mockResolvedValue(Response.json({ ok: true }));
  });

  it('clears Better Auth dont-remember cookies before starting Google sign-in', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/auth/login?redirectTo=/dashboard/days'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({
      redirectTo: '/dashboard/days',
    });

    const setCookieHeaders = response.headers.getSetCookie();
    expect(setCookieHeaders).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^__Secure-better-auth\.dont_remember=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=\/; HttpOnly; Secure; SameSite=Lax/,
        ),
        expect.stringMatching(
          /^better-auth\.dont_remember=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=\/; HttpOnly; SameSite=Lax/,
        ),
      ]),
    );
  });

  it('keeps Better Auth cleanup headers from the anonymous session check', async () => {
    const authHeaders = new Headers();
    authHeaders.append(
      'set-cookie',
      '__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
    requireAnonymous.mockResolvedValue(authHeaders);

    const response = (await loader({
      request: new Request('https://gridstay.app/auth/login'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        '__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
        expect.stringMatching(/^__Secure-better-auth\.dont_remember=/),
        expect.stringMatching(/^better-auth\.dont_remember=/),
      ]),
    );
  });

  it('returns a success notice after password reset', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/auth/login?passwordReset=success'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({
      notice: 'Password reset. You can sign in with your new password.',
      redirectTo: '/dashboard',
    });
  });

  it('returns a Google auth error from the OAuth callback query string', async () => {
    const response = (await loader({
      request: new Request(
        'https://gridstay.app/auth/login?redirectTo=/dashboard/days&error=unable_to_create_user',
      ),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({
      authError:
        'Google could not create an account for that address. Check the invited email or join link, or use password sign-up.',
      redirectTo: '/dashboard/days',
    });
  });

  it('advertises reset notices without a password-auth feature flag', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/auth/login?passwordReset=success'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({
      notice: 'Password reset. You can sign in with your new password.',
      redirectTo: '/dashboard',
    });
  });

  it('routes password sign-in submissions to the password sign-in helper', async () => {
    const formData = new FormData();
    formData.set('intent', 'passwordSignIn');
    formData.set('email', 'driver@example.com');
    formData.set('password', 'password123');
    const request = new Request('https://gridstay.app/auth/login', {
      method: 'POST',
      body: formData,
    });

    await action({ request, params: {}, context: {} } as never);

    expect(submitPasswordSignIn).toHaveBeenCalledOnce();
    expect(submitPasswordSignIn.mock.calls[0]?.[0]).toBe(request);
    expect(submitPasswordSignIn.mock.calls[0]?.[1].get('email')).toBe('driver@example.com');
    expect(submitPasswordSignUp).not.toHaveBeenCalled();
  });

  it('routes password sign-up submissions to the password sign-up helper', async () => {
    const formData = new FormData();
    formData.set('intent', 'passwordSignUp');
    formData.set('email', 'driver@example.com');
    formData.set('password', 'password123');
    const request = new Request('https://gridstay.app/auth/login', {
      method: 'POST',
      body: formData,
    });

    await action({ request, params: {}, context: {} } as never);

    expect(submitPasswordSignUp).toHaveBeenCalledOnce();
    expect(submitPasswordSignUp.mock.calls[0]?.[0]).toBe(request);
    expect(submitPasswordSignUp.mock.calls[0]?.[1].get('email')).toBe('driver@example.com');
    expect(submitPasswordSignIn).not.toHaveBeenCalled();
  });
});
