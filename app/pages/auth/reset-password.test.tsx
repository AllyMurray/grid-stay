import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import type { PasswordResetActionData } from '~/lib/auth/password-auth.shared';
import { theme } from '~/theme';
import { ResetPasswordPage } from './reset-password';

function renderResetPasswordPage({
  actionData,
  token = 'reset-token',
}: {
  actionData?: PasswordResetActionData;
  token?: string;
} = {}) {
  const Stub = createRoutesStub([
    {
      path: '/auth/reset-password',
      action: async () => null,
      Component: () => (
        <MantineProvider theme={theme}>
          <ResetPasswordPage actionData={actionData} token={token} />
        </MantineProvider>
      ),
    },
    {
      path: '/auth/login',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/auth/reset-password']} />);
}

describe('ResetPasswordPage', () => {
  it('renders the new password form when a token is present', () => {
    const { container } = renderResetPasswordPage();

    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    expect(container.querySelector('input[name="token"]')).toHaveValue('reset-token');
    expect(container.querySelector('input[name="password"]')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeVisible();
  });

  it('shows an invalid-token state without the form', () => {
    renderResetPasswordPage({ token: '' });

    expect(screen.getByText('This reset link is invalid or has expired.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument();
  });

  it('shows server reset errors', () => {
    renderResetPasswordPage({
      actionData: {
        ok: false,
        formError: 'This reset link is invalid or has expired.',
        fieldErrors: {},
      },
    });

    expect(screen.getByText('This reset link is invalid or has expired.')).toBeVisible();
  });
});
