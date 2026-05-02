import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
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
  hasPassword = false,
}: {
  hasPassword?: boolean;
} = {}) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/account',
      action: async () => null,
      Component: () => (
        <MantineProvider theme={theme}>
          <AccountPage hasPassword={hasPassword} user={user} />
        </MantineProvider>
      ),
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/account']} />);
}

describe('AccountPage', () => {
  it('shows sign-in methods without set-password controls', () => {
    const { container } = renderAccountPage();

    expect(screen.getByRole('heading', { name: 'Security' })).toBeVisible();
    expect(screen.getAllByText('Google sign-in')).not.toHaveLength(0);
    expect(screen.getByText('Password sign-in')).toBeVisible();
    expect(screen.getByText('Email reset required')).toBeVisible();
    expect(container.querySelector('input[name="password"]')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Set password' }),
    ).not.toBeInTheDocument();
  });

  it('shows password sign-in as enabled when the account has credentials', () => {
    renderAccountPage({ hasPassword: true });

    expect(screen.getByText('Password enabled')).toBeVisible();
    expect(screen.getAllByText('Available')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Set password' }),
    ).not.toBeInTheDocument();
  });

  it('shows reset-required status for accounts without password credentials', () => {
    renderAccountPage({ hasPassword: false });

    expect(screen.getByText('Email reset required')).toBeVisible();
    expect(screen.queryByText('Password enabled')).not.toBeInTheDocument();
  });
});
