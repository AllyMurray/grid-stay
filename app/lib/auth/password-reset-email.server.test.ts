import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { sendTransactionalEmail } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('~/lib/email/ses.server', () => ({
  sendTransactionalEmail,
}));

import { createPasswordResetUrl, sendPasswordResetEmail } from './password-reset-email.server';

describe('password reset email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('builds reset links on the app auth route', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://gridstay.app');

    expect(
      createPasswordResetUrl({
        request: new Request('https://gridstay.app/api/auth/request'),
        token: 'reset-token',
      }),
    ).toBe('https://gridstay.app/auth/reset-password?token=reset-token');
  });

  it('sends a reset email containing the one-time token link', async () => {
    await sendPasswordResetEmail({
      request: new Request('https://gridstay.app/api/auth/request'),
      to: 'driver@example.com',
      token: 'reset-token',
    });

    expect(sendTransactionalEmail).toHaveBeenCalledWith({
      to: 'driver@example.com',
      subject: 'Reset your Grid Stay password',
      text: expect.stringContaining('Grid Stay\n\nReset your password'),
      html: expect.stringContaining('background-color:#111827'),
    });
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('https://gridstay.app/auth/reset-password?token=reset-token'),
        html: expect.stringContaining(
          'href="https://gridstay.app/auth/reset-password?token=reset-token"',
        ),
      }),
    );
  });
});
