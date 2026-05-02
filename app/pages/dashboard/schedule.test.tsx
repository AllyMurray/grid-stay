import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ActionFunctionArgs, createRoutesStub } from 'react-router';
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

function renderWithProviders(
  ui: React.ReactElement,
  action?: (args: ActionFunctionArgs) => Promise<unknown>,
) {
  const Stub = createRoutesStub([
    {
      path: '/',
      action: action ?? (async () => null),
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
  type: 'race_day',
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
    expect(screen.getByText('2 trips tracked')).toBeInTheDocument();
    expect(screen.getByText('1 confirmed')).toBeInTheDocument();
    expect(screen.getByText('1 maybe')).toBeInTheDocument();
    expect(screen.getByText('1 shared stay')).toBeInTheDocument();
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

  it('opens the calendar sync modal with subscription links', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BookingSchedulePage
        bookings={[bookingOne, bookingTwo]}
        calendarFeedUrl="https://gridstay.app/calendar/private-token.ics"
      />,
    );

    await user.click(screen.getByRole('button', { name: /sync calendar/i }));

    expect(
      await screen.findByDisplayValue(
        'https://gridstay.app/calendar/private-token.ics',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /subscribe on this device/i }),
    ).toHaveAttribute(
      'href',
      'webcal://gridstay.app/calendar/private-token.ics',
    );
    expect(
      screen.getByRole('link', { name: /add to google calendar/i }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('https%3A%2F%2Fgridstay.app'),
    );
    expect(
      screen.getByRole('checkbox', { name: /include trips marked maybe/i }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /include shared stay names/i }),
    ).toBeChecked();
  });

  it('creates the calendar feed through the schedule route action', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return {
          ok: true,
          feedExists: true,
          feedUrl: 'https://gridstay.app/calendar/new-token.ics',
          tokenHint: 'new-token',
          options: {
            includeMaybe: true,
            includeStay: true,
          },
        };
      },
    );

    await user.click(screen.getByRole('button', { name: /sync calendar/i }));
    await screen.findByText(/create a private calendar link first/i);
    await user.click(screen.getByRole('button', { name: /create link/i }));

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({ intent: 'createCalendarFeed' }),
      ),
    );
    expect(
      await screen.findByDisplayValue(
        'https://gridstay.app/calendar/new-token.ics',
      ),
    ).toBeInTheDocument();
  });

  it('saves calendar feed content options without regenerating the link', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <BookingSchedulePage
        bookings={[bookingOne, bookingTwo]}
        calendarFeedUrl="https://gridstay.app/calendar/private-token.ics"
        calendarFeedOptions={{
          includeMaybe: true,
          includeStay: true,
        }}
      />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return {
          ok: true,
          feedExists: true,
          feedUrl: 'https://gridstay.app/calendar/private-token.ics',
          tokenHint: 'te-token',
          options: {
            includeMaybe: false,
            includeStay: false,
          },
        };
      },
    );

    await user.click(screen.getByRole('button', { name: /sync calendar/i }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: /include trips marked maybe/i,
      }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: /include shared stay names/i }),
    );
    await user.click(screen.getByRole('button', { name: /save options/i }));

    await waitFor(() =>
      expect(submitted).toEqual({
        intent: 'saveCalendarFeedOptions',
        includeMaybe: 'false',
        includeStay: 'false',
      }),
    );
  });

  it('regenerates an active calendar feed when the stored token is not available', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <BookingSchedulePage
        bookings={[bookingOne, bookingTwo]}
        calendarFeedExists
        calendarFeedTokenHint="abc12345"
      />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return {
          ok: true,
          feedExists: true,
          feedUrl: 'https://gridstay.app/calendar/regenerated-token.ics',
          tokenHint: 'ed-token',
          options: {
            includeMaybe: true,
            includeStay: true,
          },
        };
      },
    );

    await user.click(screen.getByRole('button', { name: /sync calendar/i }));
    await screen.findByText(/ending abc12345/i);
    await user.click(screen.getByRole('button', { name: /regenerate link/i }));

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({ intent: 'regenerateCalendarFeed' }),
      ),
    );
    expect(
      await screen.findByDisplayValue(
        'https://gridstay.app/calendar/regenerated-token.ics',
      ),
    ).toBeInTheDocument();
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
