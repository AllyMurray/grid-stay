import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type {
  AdminMemberProfile,
  AdminSeriesOption,
} from '~/lib/admin/member-management.server';
import { theme } from '~/theme';
import { AdminMemberDetailPage } from './admin-member-detail';

const profile: AdminMemberProfile = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  authName: 'driver one',
  displayName: 'Driver One',
  picture: 'https://example.com/driver.png',
  role: 'member',
  bookings: [
    {
      bookingId: 'booking-1',
      dayId: 'day-1',
      date: '2026-05-10',
      status: 'booked',
      circuit: 'Snetterton',
      provider: 'Caterham Motorsport',
      description: 'Round 1',
      accommodationName: 'Trackside Hotel',
      bookingReference: 'PRIVATE-REF',
      accommodationReference: 'PRIVATE-HOTEL',
      notes: 'Private notes',
    } as AdminMemberProfile['bookings'][number],
  ],
  subscriptions: [
    {
      userId: 'user-1',
      seriesKey: 'caterham-academy',
      seriesName: 'Caterham Academy',
      status: 'maybe',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    } as AdminMemberProfile['subscriptions'][number],
  ],
};

const seriesOptions: AdminSeriesOption[] = [
  {
    seriesKey: 'caterham-academy',
    seriesName: 'Caterham Academy',
    dayCount: 7,
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
    {
      path: '/dashboard/admin/members',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/']} />);
}

describe('AdminMemberDetailPage', () => {
  it('renders member bookings and series controls without private fields', () => {
    renderWithProviders(
      <AdminMemberDetailPage profile={profile} seriesOptions={seriesOptions} />,
    );

    expect(
      screen.getByRole('heading', { name: 'Driver One' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('driver@example.com').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Display name')).toHaveValue('Driver One');
    expect(screen.getByText(/Google name: driver one/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save display name' }),
    ).toBeVisible();
    expect(screen.getAllByLabelText('Role')[0]).toHaveDisplayValue('Member');
    expect(screen.getByRole('button', { name: 'Save role' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Upcoming bookings' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Snetterton')).toBeInTheDocument();
    expect(screen.getByText(/Trackside Hotel/)).toBeInTheDocument();
    expect(screen.getByText('Caterham Academy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add series' })).toBeVisible();
    expect(screen.queryByText('PRIVATE-REF')).not.toBeInTheDocument();
    expect(screen.queryByText('PRIVATE-HOTEL')).not.toBeInTheDocument();
    expect(screen.queryByText('Private notes')).not.toBeInTheDocument();
  });
});
