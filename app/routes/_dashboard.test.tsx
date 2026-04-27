import { MantineProvider } from '@mantine/core';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '~/theme';
import DashboardLayoutRoute from './_dashboard';

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser: vi.fn(),
}));

vi.mock('~/lib/db/services/day-notification.server', () => ({
  countUnreadDayNotifications: vi.fn(async () => 0),
}));

const dashboardUser = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member' as const,
};

function createPageShowEvent(persisted: boolean) {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', {
    configurable: true,
    value: persisted,
  });
  return event;
}

function renderDashboard() {
  const Stub = createRoutesStub([
    {
      path: '/dashboard',
      loader: () => ({ user: dashboardUser, unreadNotificationCount: 0 }),
      Component: () => (
        <MantineProvider theme={theme}>
          <DashboardLayoutRoute />
        </MantineProvider>
      ),
      children: [
        {
          index: true,
          Component: () => <div>Dashboard content</div>,
        },
      ],
    },
  ]);

  return render(<Stub initialEntries={['/dashboard']} />);
}

describe('DashboardLayoutRoute', () => {
  it('opens the mobile navigation drawer from the menu button', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const menuButton = await screen.findByRole('button', {
      name: 'Open menu',
    });

    await user.click(menuButton);

    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });

    expect(
      within(drawer).getByRole('link', { name: 'Members' }),
    ).toHaveAttribute('href', '/dashboard/members');
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('resets the mobile menu when Safari restores the page from back-forward cache', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const menuButton = await screen.findByRole('button', {
      name: 'Open menu',
    });

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    await act(async () => {
      window.dispatchEvent(createPageShowEvent(true));
    });

    await waitFor(() =>
      expect(menuButton).toHaveAttribute('aria-expanded', 'false'),
    );
  });
});
