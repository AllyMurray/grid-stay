import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '~/theme';

const { signInSocial } = vi.hoisted(() => ({
  signInSocial: vi.fn(),
}));

vi.mock('~/lib/auth/auth-client', () => ({
  authClient: {
    signIn: {
      social: signInSocial,
    },
  },
}));

import { LoginPage } from './login';

describe('LoginPage', () => {
  beforeEach(() => {
    signInSocial.mockClear();
  });

  it('starts the Google sign-in flow on mount', async () => {
    render(
      <MantineProvider theme={theme}>
        <LoginPage redirectTo="/dashboard/bookings" />
      </MantineProvider>,
    );

    expect(
      screen.getByRole('heading', { name: /get back to the weekend plan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledWith({
        provider: 'google',
        callbackURL: '/dashboard/bookings',
      });
    });
  });

  it('lets the user retry the Google redirect manually', async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider theme={theme}>
        <LoginPage redirectTo="/dashboard" />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole('button', { name: /continue with google/i }),
    );

    expect(signInSocial).toHaveBeenCalledTimes(2);
    expect(signInSocial).toHaveBeenLastCalledWith({
      provider: 'google',
      callbackURL: '/dashboard',
    });
  });
});
