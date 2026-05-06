import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { authApi, canCreateMemberAccountForEmail } = vi.hoisted(() => ({
  authApi: {
    listUserAccounts: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
  },
  canCreateMemberAccountForEmail: vi.fn(),
}));

vi.mock('./auth.server', () => ({
  auth: {
    api: authApi,
  },
}));

vi.mock('./member-invites.server', () => ({
  canCreateMemberAccountForEmail,
}));

import {
  getPasswordAccountStatus,
  submitPasswordReset,
  submitPasswordResetRequest,
  submitPasswordSignIn,
  submitPasswordSignUp,
} from './password-auth.server';

function createFormData(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

function jsonResponse(
  body: unknown,
  {
    status = 200,
    setCookie,
  }: {
    status?: number;
    setCookie?: string;
  } = {},
) {
  const headers = new Headers({ 'content-type': 'application/json' });

  if (setCookie) {
    headers.append('set-cookie', setCookie);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

async function expectRedirect(promise: Promise<Response>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Response);
    return error as Response;
  }

  throw new Error('Expected redirect response to be thrown');
}

describe('password auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('signs in with email and preserves Better Auth cookies on redirect', async () => {
    authApi.signInEmail.mockResolvedValue(
      jsonResponse(
        { user: { id: 'user-1' } },
        {
          setCookie:
            '__Secure-better-auth.session_token=abc; Path=/; HttpOnly; Secure; SameSite=Lax',
        },
      ),
    );
    const request = new Request('https://gridstay.app/auth/login');

    const response = await expectRedirect(
      submitPasswordSignIn(
        request,
        createFormData({
          email: ' Driver@Example.com ',
          password: 'password123',
          redirectTo: '/dashboard/days',
        }),
      ),
    );

    expect(authApi.signInEmail).toHaveBeenCalledWith({
      body: {
        email: 'driver@example.com',
        password: 'password123',
        callbackURL: '/dashboard/days',
        rememberMe: true,
      },
      headers: request.headers,
      asResponse: true,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/dashboard/days');
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^__Secure-better-auth\.session_token=abc/),
        expect.stringMatching(/^__Secure-better-auth\.dont_remember=/),
        expect.stringMatching(/^better-auth\.dont_remember=/),
      ]),
    );
  });

  it('rejects password sign-up when the email has not been invited', async () => {
    canCreateMemberAccountForEmail.mockResolvedValue(false);
    const response = await submitPasswordSignUp(
      new Request('https://gridstay.app/auth/login'),
      createFormData({
        firstName: 'New',
        lastName: 'Driver',
        email: 'new.driver@example.com',
        password: 'password123',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      intent: 'passwordSignUp',
      formError: 'Ask an existing member to invite this email before creating an account.',
    });
    expect(authApi.signUpEmail).not.toHaveBeenCalled();
  });

  it('creates password accounts with first and last name for invited emails', async () => {
    canCreateMemberAccountForEmail.mockResolvedValue(true);
    authApi.signUpEmail.mockResolvedValue(
      jsonResponse(
        { user: { id: 'user-2' } },
        {
          setCookie:
            '__Secure-better-auth.session_token=def; Path=/; HttpOnly; Secure; SameSite=Lax',
        },
      ),
    );
    const request = new Request('https://gridstay.app/auth/login');

    const response = await expectRedirect(
      submitPasswordSignUp(
        request,
        createFormData({
          firstName: ' New ',
          lastName: ' Driver ',
          email: 'New.Driver@Example.com',
          password: 'password123',
          redirectTo: '/dashboard',
        }),
      ),
    );

    expect(canCreateMemberAccountForEmail).toHaveBeenCalledWith('new.driver@example.com');
    expect(authApi.signUpEmail).toHaveBeenCalledWith({
      body: {
        name: 'New Driver',
        email: 'new.driver@example.com',
        password: 'password123',
        callbackURL: '/dashboard',
        rememberMe: true,
      },
      headers: request.headers,
      asResponse: true,
    });
    expect(response.status).toBe(302);
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([expect.stringMatching(/^__Secure-better-auth\.session_token=def/)]),
    );
  });

  it('reports whether the current user already has a credential account', async () => {
    authApi.listUserAccounts.mockResolvedValue(
      jsonResponse([{ providerId: 'google' }, { providerId: 'credential' }]),
    );

    await expect(
      getPasswordAccountStatus(new Request('https://gridstay.app/dashboard')),
    ).resolves.toMatchObject({ hasPassword: true });
  });

  it('reports false when the current user does not have a credential account', async () => {
    authApi.listUserAccounts.mockResolvedValue(jsonResponse([{ providerId: 'google' }]));

    await expect(
      getPasswordAccountStatus(new Request('https://gridstay.app/dashboard')),
    ).resolves.toMatchObject({ hasPassword: false });
    expect(authApi.listUserAccounts).toHaveBeenCalledOnce();
  });

  it('requests a password reset link without exposing whether the user exists', async () => {
    authApi.requestPasswordReset.mockResolvedValue(
      jsonResponse({
        status: true,
        message: 'If this email exists in our system, check your email for the reset link',
      }),
    );
    const request = new Request('https://gridstay.app/auth/forgot-password');

    const response = await submitPasswordResetRequest(
      request,
      createFormData({ email: ' Driver@Example.com ' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      message: 'If there is an account for that email, we sent a password reset link.',
    });
    expect(authApi.requestPasswordReset).toHaveBeenCalledWith({
      body: {
        email: 'driver@example.com',
        redirectTo: 'https://gridstay.app/auth/reset-password',
      },
      headers: request.headers,
      asResponse: true,
    });
  });

  it('resets a password with a valid reset token', async () => {
    authApi.resetPassword.mockResolvedValue(jsonResponse({ status: true }));

    const response = await expectRedirect(
      submitPasswordReset(
        new Request('https://gridstay.app/auth/reset-password'),
        createFormData({
          token: 'reset-token',
          password: 'password123',
        }),
      ),
    );

    expect(authApi.resetPassword).toHaveBeenCalledWith({
      body: {
        token: 'reset-token',
        newPassword: 'password123',
      },
      headers: expect.any(Headers),
      asResponse: true,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/auth/login?passwordReset=success');
  });

  it('returns reset token errors without changing the password', async () => {
    authApi.resetPassword.mockResolvedValue(
      jsonResponse(
        {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
        },
        { status: 400 },
      ),
    );

    const response = await submitPasswordReset(
      new Request('https://gridstay.app/auth/reset-password'),
      createFormData({
        token: 'expired-token',
        password: 'password123',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      formError: 'This reset link is invalid or has expired.',
    });
  });
});
