import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { AvailableDay } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { theme } from '~/theme';
import { DashboardIndexPage } from './index';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>{ui}</MantineProvider>
    </MemoryRouter>,
  );
}

const nextDay: AvailableDay = {
  dayId: 'day-1',
  date: '2026-05-03',
  type: 'race_day',
  circuit: 'Silverstone',
  provider: 'MSV',
  description: 'GT weekend',
  source: {
    sourceType: 'trackdays',
    sourceName: 'MSV',
  },
};

const upcomingBooking: BookingRecord = {
  bookingId: 'booking-1',
  userId: 'user-1',
  userName: 'Driver One',
  userImage: '',
  dayId: 'day-1',
  date: '2026-05-03',
  status: 'booked',
  circuit: 'Silverstone',
  provider: 'MSV',
  bookingReference: 'REF-123',
  description: 'GT weekend',
  accommodationName: 'Trackside Hotel',
  accommodationReference: 'HOTEL-7',
  notes: 'Quiet room',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

describe('DashboardIndexPage', () => {
  it('renders metrics and linked summary panels from props', () => {
    renderWithProviders(
      <DashboardIndexPage
        firstName="Ally"
        availableDaysCount={42}
        daysThisMonth={8}
        activeBookingsCount={3}
        sharedStayCount={2}
        nextDays={[nextDay]}
        upcomingBookings={[upcomingBooking]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Welcome back, Ally' }),
    ).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getAllByText('Silverstone')).toHaveLength(2);
    expect(screen.getByText('Trackside Hotel')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });

  it('renders empty guidance when there are no upcoming bookings', () => {
    renderWithProviders(
      <DashboardIndexPage
        firstName="Ally"
        availableDaysCount={0}
        daysThisMonth={0}
        activeBookingsCount={0}
        sharedStayCount={0}
        nextDays={[]}
        upcomingBookings={[]}
      />,
    );

    expect(
      screen.getByText(/the live feed is waiting for its next refresh/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /browse available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });
});
