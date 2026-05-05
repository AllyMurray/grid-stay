import { MantineProvider } from '@mantine/core';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '~/lib/auth/schemas';
import { theme } from '~/theme';
import DashboardLayoutRoute from './_dashboard';

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser: vi.fn(),
}));

vi.mock('~/lib/db/services/day-notification.server', () => ({
  countUnreadDayNotifications: vi.fn(async () => 0),
}));

vi.mock('~/lib/db/services/garage-sharing.server', () => ({
  countPendingIncomingGarageShareRequests: vi.fn(async () => 0),
}));

vi.mock('~/lib/db/services/whats-new-view.server', () => ({
  countNewWhatsNewEntries: vi.fn(async () => 0),
}));

const dashboardUser: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

function createPageShowEvent(persisted: boolean) {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', {
    configurable: true,
    value: persisted,
  });
  return event;
}

function renderDashboard(
  user: User = dashboardUser,
  options: {
    initialEntries?: string[];
    newWhatsNewCount?: number;
  } = {},
) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard',
      loader: () => ({
        user,
        unreadNotificationCount: 0,
        newWhatsNewCount: options.newWhatsNewCount ?? 0,
      }),
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
        {
          path: 'whats-new',
          Component: () => <div>What's new content</div>,
        },
      ],
    },
  ]);

  return render(
    <Stub initialEntries={options.initialEntries ?? ['/dashboard']} />,
  );
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
    expect(
      within(drawer).getByRole('link', { name: 'Account' }),
    ).toHaveAttribute('href', '/dashboard/account');
    expect(
      within(drawer).getByRole('link', { name: "What's New" }),
    ).toHaveAttribute('href', '/dashboard/whats-new');
    expect(
      within(drawer).getByRole('link', { name: 'Feedback' }),
    ).toHaveAttribute('href', '/dashboard/feedback');
    expect(
      within(drawer)
        .getAllByRole('link')
        .map((link) => link.textContent?.trim())
        .filter(Boolean),
    ).toEqual([
      'Log out',
      'Overview',
      'Available Days',
      'My Bookings',
      'Group Calendar',
      'Members',
      'Notifications',
      'Feedback',
      "What's New",
      'Account',
    ]);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows a single admin hub link for admins', async () => {
    const user = userEvent.setup();
    renderDashboard({ ...dashboardUser, role: 'admin' });

    const menuButton = await screen.findByRole('button', {
      name: 'Open menu',
    });

    await user.click(menuButton);

    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });

    expect(within(drawer).getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/dashboard/admin',
    );
    expect(
      within(drawer).queryByRole('link', { name: 'Manual days' }),
    ).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('link', { name: 'Feed Status' }),
    ).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('link', { name: 'Member Management' }),
    ).not.toBeInTheDocument();
  });

  it("shows a what's new menu badge for unseen updates", async () => {
    const user = userEvent.setup();
    renderDashboard(dashboardUser, { newWhatsNewCount: 2 });

    await user.click(await screen.findByRole('button', { name: 'Open menu' }));

    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    const whatsNewLink = within(drawer).getByRole('link', {
      name: "What's New, 2 new updates",
    });

    expect(whatsNewLink).toHaveAttribute('href', '/dashboard/whats-new');
    expect(within(whatsNewLink).getByText('2')).toBeInTheDocument();
  });

  it("hides the what's new badge while the what's new page is open", async () => {
    const user = userEvent.setup();
    renderDashboard(dashboardUser, {
      initialEntries: ['/dashboard/whats-new'],
      newWhatsNewCount: 2,
    });

    await user.click(await screen.findByRole('button', { name: 'Open menu' }));

    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    const whatsNewLink = within(drawer).getByRole('link', {
      name: "What's New",
    });

    expect(within(whatsNewLink).queryByText('2')).not.toBeInTheDocument();
  });

  it("keeps the what's new badge cleared after visiting the page", async () => {
    const user = userEvent.setup();
    renderDashboard(dashboardUser, { newWhatsNewCount: 2 });

    await user.click(await screen.findByRole('button', { name: 'Open menu' }));

    let drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    await user.click(
      within(drawer).getByRole('link', {
        name: "What's New, 2 new updates",
      }),
    );

    expect(await screen.findByText("What's new content")).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(
      within(drawer).getByRole('link', { name: "What's New" }),
    ).toBeInTheDocument();
    await user.click(within(drawer).getByRole('link', { name: 'Overview' }));

    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    drawer = await screen.findByRole('dialog', { name: 'Navigation' });

    const whatsNewLink = within(drawer).getByRole('link', {
      name: "What's New",
    });

    expect(within(whatsNewLink).queryByText('2')).not.toBeInTheDocument();
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
