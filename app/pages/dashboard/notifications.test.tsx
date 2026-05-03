import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { NotificationsPage } from './notifications';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/notifications',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
    {
      path: '/dashboard/days',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/notifications']} />);
}

describe('NotificationsPage', () => {
  it('renders newly available day notifications with links back to the day', () => {
    renderWithProviders(
      <NotificationsPage
        garageShareRequests={[]}
        notifications={[
          {
            scope: 'available-days',
            notificationId: 'new-day#day-1',
            type: 'new_available_day',
            dayId: 'day-1',
            date: '2026-05-10',
            dayType: 'test_day',
            circuit: 'Brands Hatch',
            provider: 'MSV Testing',
            description: 'Indy • Open pit lane',
            createdAt: '2026-04-20T09:00:00.000Z',
            isRead: false,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'New available days' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Brands Hatch')).toBeInTheDocument();
    expect(screen.getByText('1 unread day.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open day' })).toHaveAttribute(
      'href',
      '/dashboard/days?day=day-1',
    );
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeEnabled();
  });

  it('shows an empty state before any notifications exist', () => {
    renderWithProviders(
      <NotificationsPage notifications={[]} garageShareRequests={[]} />,
    );

    expect(screen.getByText('No day notifications yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open available days' }),
    ).toHaveAttribute('href', '/dashboard/days');
  });

  it('renders pending garage share requests with owner actions', () => {
    renderWithProviders(
      <NotificationsPage
        notifications={[]}
        garageShareRequests={[
          {
            requestScope: 'garage-share-request',
            requestId: 'garage-request-1',
            dayId: 'day-1',
            date: '2026-05-10',
            circuit: 'Brands Hatch',
            provider: 'MSV',
            description: 'Open pit lane',
            garageBookingId: 'day-1',
            garageOwnerUserId: 'owner-1',
            garageOwnerName: 'Driver One',
            requesterUserId: 'requester-1',
            requesterName: 'Driver Two',
            requesterBookingId: 'day-1',
            status: 'pending',
            createdAt: '2026-04-20T09:00:00.000Z',
            updatedAt: '2026-04-20T09:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('Garage request')).toBeInTheDocument();
    expect(screen.getByText('Driver Two')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeEnabled();
  });
});
