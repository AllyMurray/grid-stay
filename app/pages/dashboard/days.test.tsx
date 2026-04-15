import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { DaysIndexData } from '~/lib/days/dashboard-feed.server';
import type { DayAttendanceSummary } from '~/lib/days/types';
import { theme } from '~/theme';
import { AvailableDaysPage } from './days';

function renderWithProviders(
  ui: React.ReactElement,
  initialEntry = '/dashboard/days',
  attendanceByDay: Record<
    string,
    DayAttendanceSummary
  > = defaultAttendanceByDay,
) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/days',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
    {
      path: '/api/days/:dayId/attendees',
      loader({ params }) {
        return (
          attendanceByDay[params.dayId ?? ''] ?? {
            attendeeCount: 0,
            attendees: [],
            accommodationNames: [],
          }
        );
      },
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={[initialEntry]} />);
}

const defaultData: DaysIndexData = {
  filterKey: '',
  offset: 0,
  totalCount: 2,
  nextOffset: null,
  refreshedAt: '2026-04-15T10:30:00.000Z',
  errors: [],
  filters: {
    month: '',
    circuit: '',
    provider: '',
    type: '',
  },
  monthOptions: ['2026-05'],
  circuitOptions: ['Silverstone'],
  providerOptions: ['MSV'],
  myBookingsByDay: {},
  selectedDay: null,
  selectedDaySummary: null,
  selectedDayAttendance: null,
  attendanceSummaries: {
    'day-1': {
      attendeeCount: 2,
      accommodationNames: ['Trackside Hotel'],
    },
    'day-2': {
      attendeeCount: 1,
      accommodationNames: ['Brands Hatch Lodge'],
    },
  },
  days: [
    {
      dayId: 'day-1',
      date: '2026-05-03',
      type: 'race_day',
      circuit: 'Silverstone',
      provider: 'MSV',
      description: 'GT weekend',
    },
    {
      dayId: 'day-2',
      date: '2026-05-07',
      type: 'track_day',
      circuit: 'Brands Hatch',
      provider: 'Focus Trackdays',
      description: 'Open pit lane',
    },
  ],
};

const defaultAttendanceByDay: Record<string, DayAttendanceSummary> = {
  'day-1': {
    attendeeCount: 2,
    accommodationNames: ['Trackside Hotel'],
    attendees: [
      {
        bookingId: 'booking-1',
        userId: 'user-1',
        userName: 'Driver One',
        status: 'booked',
        accommodationName: 'Trackside Hotel',
      },
      {
        bookingId: 'booking-2',
        userId: 'user-2',
        userName: 'Driver Two',
        status: 'maybe',
      },
      {
        bookingId: 'booking-3',
        userId: 'user-3',
        userName: 'Driver Three',
        status: 'cancelled',
        accommodationName: 'Trackside Hotel',
      },
    ],
  },
  'day-2': {
    attendeeCount: 1,
    accommodationNames: ['Brands Hatch Lodge'],
    attendees: [
      {
        bookingId: 'booking-4',
        userId: 'user-4',
        userName: 'Driver Four',
        status: 'booked',
        accommodationName: 'Brands Hatch Lodge',
      },
    ],
  },
};

describe('AvailableDaysPage', () => {
  it('renders the live schedule from props', () => {
    renderWithProviders(<AvailableDaysPage data={defaultData} />);

    expect(
      screen.getByRole('heading', { name: 'Available Days' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 attending/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /add to my bookings/i }),
    ).not.toBeInTheDocument();
  });

  it('updates the selected detail when another day link is opened', async () => {
    renderWithProviders(<AvailableDaysPage data={defaultData} />);

    const brandsHatchLink = screen.getByRole('link', {
      name: /view details for brands hatch/i,
    });

    fireEvent.click(brandsHatchLink);
    expect(
      await screen.findAllByText('Thu, 7 May 2026 • Focus Trackdays'),
    ).not.toHaveLength(0);
    expect(screen.getByText('2 of 2 matching days')).toBeInTheDocument();
    expect(screen.getByText('My plan')).toBeInTheDocument();
    expect(screen.getByText('Group plan')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add to my bookings/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Attendee roster')).toBeInTheDocument();
    expect(screen.queryByText('Driver Four')).not.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('button', { name: /view booked attendees/i }),
    );
    expect((await screen.findAllByText('Driver Four')).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole('link', { name: /back to available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });

  it('moves between loaded matching days from the selected-day header', async () => {
    renderWithProviders(
      <AvailableDaysPage data={defaultData} />,
      '/dashboard/days?day=day-1',
    );

    expect(await screen.findByText('1 of 2 matching days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute(
      'href',
      '/dashboard/days?day=day-2',
    );

    fireEvent.click(screen.getByRole('link', { name: /next/i }));

    expect(await screen.findByText('2 of 2 matching days')).toBeInTheDocument();
    expect(screen.getAllByText('Brands Hatch').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/dashboard/days?day=day-1',
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('shows a compact roster first and expands one status group at a time', async () => {
    renderWithProviders(
      <AvailableDaysPage data={defaultData} />,
      '/dashboard/days?day=day-2',
    );

    await screen.findByText('Attendee roster');
    expect(screen.queryByText('Driver Four')).not.toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole('button', { name: /view booked attendees/i }),
    );

    expect((await screen.findAllByText('Driver Four')).length).toBeGreaterThan(
      0,
    );

    expect(screen.getAllByText('Brands Hatch Lodge').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /back to available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
    expect(screen.getAllByText('Brands Hatch').length).toBeGreaterThan(0);
  });

  it('shows the header action as open my booking when a trip already exists', async () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          myBookingsByDay: {
            'day-1': {
              bookingId: 'booking-1',
              status: 'booked',
              accommodationName: 'Trackside Hotel',
            },
          },
        }}
      />,
      '/dashboard/days?day=day-1',
    );

    expect(await screen.findByText('My plan')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /^open my booking$/i }),
    ).toHaveAttribute('href', '/dashboard/bookings');
    expect(screen.getByText('Trackside Hotel')).toBeInTheDocument();
    expect(screen.getByText('1 saved stay')).toBeInTheDocument();
  });

  it('offers saved shared stays as direct actions in the selected-day view', async () => {
    renderWithProviders(
      <AvailableDaysPage data={defaultData} />,
      '/dashboard/days?day=day-1',
    );

    expect(
      await screen.findByRole('button', { name: /join stay/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Your state').length).toBeGreaterThan(0);
    expect(screen.getByText('Not in your plan')).toBeInTheDocument();
    expect(screen.getAllByText('Trackside Hotel').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Wait for someone to name the stay.'),
    ).toBeInTheDocument();
  });

  it('renders the empty state when no rows match', () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          totalCount: 0,
          days: [],
          attendanceSummaries: {},
        }}
      />,
    );

    expect(
      screen.getByText(/no days match those filters/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /show the full feed/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });
});
