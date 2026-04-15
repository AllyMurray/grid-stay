import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
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
      screen.getByRole('status', { name: /signing in/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledWith({
        provider: 'google',
        callbackURL: '/dashboard/bookings',
      });
    });
  });

  it('keeps the redirect view free of product copy', () => {
    render(
      <MantineProvider theme={theme}>
        <LoginPage redirectTo="/dashboard" />
      </MantineProvider>,
    );

    expect(
      screen.queryByText(/caterham-run race series only/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/grid stay/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue with google/i }),
    ).not.toBeInTheDocument();
  });
});
