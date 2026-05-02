import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { AccountPasswordActionData } from '~/lib/auth/password-auth.shared';
import type { User } from '~/lib/auth/schemas';
import { theme } from '~/theme';
import { AccountPage } from './account';

const user: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

function renderAccountPage({
  actionData,
  hasPassword = false,
  passwordAuthAvailable = true,
}: {
  actionData?: AccountPasswordActionData;
  hasPassword?: boolean;
  passwordAuthAvailable?: boolean;
} = {}) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/account',
      action: async () => null,
      Component: () => (
        <MantineProvider theme={theme}>
          <AccountPage
            actionData={actionData}
            hasPassword={hasPassword}
            passwordAuthAvailable={passwordAuthAvailable}
            user={user}
          />
        </MantineProvider>
      ),
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/account']} />);
}

describe('AccountPage', () => {
  it('lets a Google-only user set a password', () => {
    const { container } = renderAccountPage();

    expect(screen.getByRole('heading', { name: 'Security' })).toBeVisible();
    expect(screen.getByText('Google sign-in')).toBeVisible();
    expect(container.querySelector('input[name="password"]')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(screen.getByRole('button', { name: 'Set password' })).toBeVisible();
  });

  it('hides set-password controls when password auth is unavailable', () => {
    const { container } = renderAccountPage({ passwordAuthAvailable: false });

    expect(screen.getByText('Google sign-in')).toBeVisible();
    expect(screen.getByText('Your account uses Google sign-in.')).toBeVisible();
    expect(container.querySelector('input[name="password"]')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Set password' }),
    ).not.toBeInTheDocument();
  });

  it('shows password sign-in as enabled after a successful action', () => {
    renderAccountPage({
      actionData: {
        ok: true,
        message: 'Password sign-in is enabled for this account.',
        fieldErrors: {},
      },
    });

    expect(
      screen.getByText('Password sign-in is enabled for this account.'),
    ).toBeVisible();
    expect(screen.getByText('Password enabled')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Set password' }),
    ).not.toBeInTheDocument();
  });
});
