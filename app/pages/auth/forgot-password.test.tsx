import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { PasswordResetRequestActionData } from '~/lib/auth/password-auth.shared';
import { theme } from '~/theme';
import { ForgotPasswordPage } from './forgot-password';

function renderForgotPasswordPage(actionData?: PasswordResetRequestActionData) {
  const Stub = createRoutesStub([
    {
      path: '/auth/forgot-password',
      action: async () => null,
      Component: () => (
        <MantineProvider theme={theme}>
          <ForgotPasswordPage actionData={actionData} />
        </MantineProvider>
      ),
    },
    {
      path: '/auth/login',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/auth/forgot-password']} />);
}

describe('ForgotPasswordPage', () => {
  it('collects an email address for reset links', () => {
    renderForgotPasswordPage();

    expect(
      screen.getByRole('heading', { name: 'Reset password' }),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Send reset link' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Back to sign in' }),
    ).toHaveAttribute('href', '/auth/login');
  });

  it('shows the non-enumerating success message after submission', () => {
    renderForgotPasswordPage({
      ok: true,
      message:
        'If there is an account for that email, we sent a password reset link.',
      fieldErrors: {},
    });

    expect(
      screen.getByText(
        'If there is an account for that email, we sent a password reset link.',
      ),
    ).toBeVisible();
  });
});
