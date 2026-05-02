import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
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

function renderLoginPage(
  props: React.ComponentProps<typeof LoginPage> = {
    redirectTo: '/dashboard/bookings',
  },
) {
  const Stub = createRoutesStub([
    {
      path: '/auth/login',
      action: async () => null,
      Component: () => (
        <MantineProvider theme={theme}>
          <LoginPage {...props} />
        </MantineProvider>
      ),
    },
    {
      path: '/auth/forgot-password',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/auth/login']} />);
}

describe('LoginPage', () => {
  beforeEach(() => {
    signInSocial.mockClear();
  });

  it('starts the Google sign-in flow from the Google button', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(
      screen.getByRole('button', { name: /continue with google/i }),
    );

    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/dashboard/bookings',
    });
  });

  it('renders password sign-in fields by default', () => {
    const { container } = renderLoginPage();

    expect(screen.getByRole('heading', { name: 'Grid Stay' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeVisible();
    expect(container.querySelector('input[name="password"]')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('collects first and last name when creating a password account', async () => {
    const user = userEvent.setup();
    const { container } = renderLoginPage();

    await user.click(screen.getByRole('tab', { name: 'Create account' }));

    expect(screen.getByRole('textbox', { name: 'First name' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Last name' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeVisible();
    expect(container.querySelector('input[name="password"]')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
  });

  it('opens the create account tab when sign-up has an error', () => {
    renderLoginPage({
      redirectTo: '/dashboard',
      actionData: {
        intent: 'passwordSignUp',
        formError: 'Ask an existing member to invite this email.',
        fieldErrors: {
          firstName: ['First name is required.'],
        },
      },
    });

    expect(
      screen.getByText('Ask an existing member to invite this email.'),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'First name' })).toBeVisible();
  });

  it('shows a password-reset success notice', () => {
    renderLoginPage({
      redirectTo: '/dashboard',
      notice: 'Password reset. You can sign in with your new password.',
    });

    expect(
      screen.getByText(
        'Password reset. You can sign in with your new password.',
      ),
    ).toBeVisible();
  });
});
