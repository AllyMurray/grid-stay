import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { theme } from '~/theme';
import { BookingSchedulePage } from './schedule';

const useMediaQueryMock = vi.fn(() => false);

vi.mock('@mantine/hooks', async () => {
  const actual =
    await vi.importActual<typeof import('@mantine/hooks')>('@mantine/hooks');

  return {
    ...actual,
    useMediaQuery: () => useMediaQueryMock(),
  };
});

vi.mock('@mantine/schedule', async () => {
  const actual =
    await vi.importActual<typeof import('@mantine/schedule')>(
      '@mantine/schedule',
    );

  return {
    ...actual,
    Schedule: ({
      events = [],
      onEventClick,
    }: {
      events?: Array<{ id: string; title: string; end: string }>;
      onEventClick?: (event: { id: string }, reactEvent: Event) => void;
    }) => (
      <div data-testid="schedule">
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            data-end={event.end}
            onClick={(reactEvent) =>
              onEventClick?.(event, reactEvent.nativeEvent)
            }
          >
            {event.title}
          </button>
        ))}
      </div>
    ),
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/']} />);
}

const bookingOne: BookingRecord = {
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

const bookingTwo: BookingRecord = {
  ...bookingOne,
  bookingId: 'booking-2',
  dayId: 'day-2',
  date: '2026-06-14',
  status: 'maybe',
  circuit: 'Donington Park',
  provider: 'Javelin',
  bookingReference: '',
  description: 'Track evening',
  accommodationName: '',
  accommodationReference: '',
  notes: '',
};

describe('BookingSchedulePage', () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    useMediaQueryMock.mockReturnValue(false);
  });

  it('renders the desktop schedule and selected booking summary', () => {
    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} />,
    );

    expect(
      screen.getByRole('heading', { name: 'Schedule' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('schedule')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Silverstone' })).toHaveAttribute(
      'data-end',
      '2026-05-03 23:59:59',
    );
    expect(
      screen.getByRole('heading', { name: 'Silverstone' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Trackside Hotel')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /manage in my bookings/i }),
    ).toHaveAttribute('href', '/dashboard/bookings');
  });

  it('updates the selected booking when a schedule event is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} />,
    );

    await user.click(screen.getByRole('button', { name: 'Donington Park' }));

    expect(
      screen.getByRole('heading', { name: 'Donington Park' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No shared stay added yet')).toBeInTheDocument();
    expect(screen.getByText('No booking reference saved')).toBeInTheDocument();
  });

  it('renders a mobile list instead of the calendar on narrow screens', () => {
    useMediaQueryMock.mockReturnValue(true);

    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} />,
    );

    expect(screen.queryByTestId('schedule')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Upcoming and planned trips' }),
    ).toBeInTheDocument();
    expect(screen.getByText('May 2026')).toBeInTheDocument();
    expect(screen.getByText('June 2026')).toBeInTheDocument();
    expect(screen.getByText('Track evening')).toBeInTheDocument();
  });

  it('renders the empty state when there are no bookings', () => {
    renderWithProviders(<BookingSchedulePage bookings={[]} />);

    expect(screen.getByText(/no trips to schedule yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /browse available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });
});
