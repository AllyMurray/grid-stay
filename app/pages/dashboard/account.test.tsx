import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub, type ActionFunctionArgs } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import type { User } from '~/lib/auth/schemas';
import { EVENT_BRIEFING_FEATURE } from '~/lib/beta-features/config';
import { theme } from '~/theme';
import { AccountPage } from './account';

const user: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

function renderAccountPage({
  action,
  betaFeatures = {
    [EVENT_BRIEFING_FEATURE]: false,
  },
  hasPassword = false,
  paymentPreference = null,
}: {
  action?: (args: ActionFunctionArgs) => Promise<unknown>;
  betaFeatures?: {
    [EVENT_BRIEFING_FEATURE]: boolean;
  };
  hasPassword?: boolean;
  paymentPreference?: { label: string; url: string } | null;
} = {}) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/account',
      action: action ?? (async () => null),
      Component: () => (
        <MantineProvider theme={theme}>
          <AccountPage
            betaFeatures={betaFeatures}
            hasPassword={hasPassword}
            paymentPreference={paymentPreference}
            user={user}
          />
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
    expect(screen.queryByRole('button', { name: 'Set password' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Payment link').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Beta features' })).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Event briefing' })).not.toBeChecked();
  });

  it('shows password sign-in as enabled when the account has credentials', () => {
    renderAccountPage({ hasPassword: true });

    expect(screen.getByText('Password enabled')).toBeVisible();
    expect(screen.getAllByText('Available')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Set password' })).not.toBeInTheDocument();
  });

  it('shows reset-required status for accounts without password credentials', () => {
    renderAccountPage({ hasPassword: false });

    expect(screen.getByText('Email reset required')).toBeVisible();
    expect(screen.queryByText('Password enabled')).not.toBeInTheDocument();
  });

  it('renders a saved payment preference', () => {
    renderAccountPage({
      paymentPreference: {
        label: 'Monzo',
        url: 'https://monzo.me/driver',
      },
    });

    expect(screen.getByDisplayValue('Monzo')).toBeVisible();
    expect(screen.getByDisplayValue('https://monzo.me/driver')).toBeVisible();
  });

  it('shows enabled beta features', () => {
    renderAccountPage({
      betaFeatures: {
        [EVENT_BRIEFING_FEATURE]: true,
      },
    });

    expect(screen.getByRole('switch', { name: 'Event briefing' })).toBeChecked();
  });

  it('submits beta feature toggle updates', async () => {
    const userEventInstance = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderAccountPage({
      action: async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return {
          ok: true,
          betaFeatures: {
            [EVENT_BRIEFING_FEATURE]: true,
          },
          message: 'Beta feature enabled.',
        };
      },
    });

    await userEventInstance.click(
      screen.getByRole('switch', { name: 'Event briefing' }),
    );

    await waitFor(() =>
      expect(submitted).toEqual({
        intent: 'updateBetaFeature',
        featureKey: EVENT_BRIEFING_FEATURE,
        enabled: 'true',
      }),
    );
  });
});
