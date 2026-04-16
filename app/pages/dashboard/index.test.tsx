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
        maybeBookingsCount={1}
        tripsMissingStayCount={1}
        tripsWithSharedStayCount={2}
        privateRefsOpenCount={0}
        nextDays={[nextDay]}
        upcomingBookings={[upcomingBooking]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Welcome back, Ally' }),
    ).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Next trip')).toBeInTheDocument();
    expect(screen.getByText('Trip details')).toBeInTheDocument();
    expect(screen.getAllByText('Race day reference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('REF-123').length).toBeGreaterThan(0);
    expect(screen.getByText('Hotel reference')).toBeInTheDocument();
    expect(screen.getAllByText('HOTEL-7').length).toBeGreaterThan(0);
    expect(screen.getByText('What needs attention')).toBeInTheDocument();
    expect(screen.getByText('Upcoming trips')).toBeInTheDocument();
    expect(screen.getByText('Live calendar')).toBeInTheDocument();
    expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trackside Hotel').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/everything for this trip is already in place/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /review my bookings/i }),
    ).toHaveAttribute('href', '/dashboard/bookings');
  });

  it('renders empty guidance when there are no upcoming bookings', () => {
    renderWithProviders(
      <DashboardIndexPage
        firstName="Ally"
        availableDaysCount={0}
        daysThisMonth={0}
        activeBookingsCount={0}
        sharedStayCount={0}
        maybeBookingsCount={0}
        tripsMissingStayCount={0}
        tripsWithSharedStayCount={0}
        privateRefsOpenCount={0}
        nextDays={[]}
        upcomingBookings={[]}
      />,
    );

    expect(screen.getByText(/nothing is lined up yet/i)).toBeInTheDocument();
    const openAvailableDaysLinks = screen.getAllByRole('link', {
      name: /open available days/i,
    });

    expect(
      openAvailableDaysLinks.every(
        (link) => link.getAttribute('href') === '/dashboard/days',
      ),
    ).toBe(true);
  });
});
