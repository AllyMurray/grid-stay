import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ActionFunctionArgs, createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vite-plus/test';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { theme } from '~/theme';
import { BookingSchedulePage } from './schedule';

vi.mock('@mantine/schedule', async () => {
  const actual = await vi.importActual<typeof import('@mantine/schedule')>('@mantine/schedule');

  return {
    ...actual,
    Schedule: ({
      events = [],
      onEventClick,
      view = 'month',
      onViewChange,
      weekViewProps,
      monthViewProps,
      yearViewProps,
    }: {
      events?: Array<{
        id: string;
        title: string;
        end: string;
        payload?: { bookingId?: string };
      }>;
      onEventClick?: (event: { id: string }, reactEvent: Event) => void;
      view?: 'day' | 'week' | 'month' | 'year';
      onViewChange?: (view: 'day' | 'week' | 'month' | 'year') => void;
      weekViewProps?: {
        viewSelectProps?: { views?: Array<'day' | 'week' | 'month' | 'year'> };
      };
      monthViewProps?: {
        viewSelectProps?: { views?: Array<'day' | 'week' | 'month' | 'year'> };
      };
      yearViewProps?: {
        viewSelectProps?: { views?: Array<'day' | 'week' | 'month' | 'year'> };
      };
    }) => {
      const viewSelectProps =
        view === 'week'
          ? weekViewProps?.viewSelectProps
          : view === 'year'
            ? yearViewProps?.viewSelectProps
            : monthViewProps?.viewSelectProps;
      const views = viewSelectProps?.views ?? ['day', 'week', 'month', 'year'];

      return (
        <div data-testid="schedule" data-view={view}>
          <div role="tablist" aria-label="Calendar views">
            {views.map((viewOption) => (
              <button
                key={viewOption}
                type="button"
                role="tab"
                aria-selected={viewOption === view}
                onClick={() => onViewChange?.(viewOption)}
              >
                {viewOption}
              </button>
            ))}
          </div>
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              data-end={event.end}
              onClick={(reactEvent) => onEventClick?.(event, reactEvent.nativeEvent)}
            >
              {event.title}
            </button>
          ))}
        </div>
      );
    },
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
  accommodationStatus: 'booked',
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
  accommodationStatus: 'not_required',
  accommodationName: '',
  accommodationReference: '',
  notes: '',
};

describe('BookingSchedulePage', () => {
  it('renders the list view by default and selected booking summary', () => {
    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} today="2026-05-03" />,
    );

    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByText('2 trips tracked')).toBeInTheDocument();
    expect(screen.getByText('1 confirmed')).toBeInTheDocument();
    expect(screen.getByText('1 maybe')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 confirmed, 1 maybe' })).toBeInTheDocument();
    expect(screen.getByText('1 with accommodation')).toBeInTheDocument();
    expect(screen.queryByTestId('schedule')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming trips' })).toBeInTheDocument();
    expect(screen.getByText(/showing 2 of 2 upcoming trips/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /select silverstone on sun, 3 may 2026/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /select donington park on sun, 14 june 2026/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('All upcoming trips loaded.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Silverstone' })).toBeInTheDocument();
    expect(screen.getAllByText('Trackside Hotel').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /manage in my bookings/i })).toHaveAttribute(
      'href',
      '/dashboard/bookings?view=manage',
    );
    expect(screen.getByRole('link', { name: /view all bookings/i })).toHaveAttribute(
      'href',
      '/dashboard/bookings?view=manage',
    );
  });

  it('renders the calendar without the day view when selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} today="2026-05-03" />,
    );

    await user.click(screen.getByText('Calendar'));

    expect(screen.getByTestId('schedule')).toHaveAttribute('data-view', 'month');
    expect(screen.queryByRole('tab', { name: 'day' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'week' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'month' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'year' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Silverstone' })).toHaveAttribute(
      'data-end',
      '2026-05-03 23:59:59',
    );
  });

  it('updates the selected booking when a calendar event is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} today="2026-05-03" />,
    );

    await user.click(screen.getByText('Calendar'));
    await user.click(screen.getByRole('button', { name: 'Donington Park' }));

    expect(screen.getByRole('heading', { name: 'Donington Park' })).toBeInTheDocument();
    expect(screen.getAllByText('No hotel needed').length).toBeGreaterThan(0);
    expect(screen.getByText('No booking reference saved')).toBeInTheDocument();
  });

  it('loads upcoming trips in batches from the list view', async () => {
    const user = userEvent.setup();
    const bookings = Array.from({ length: 8 }, (_, index) => ({
      ...bookingOne,
      bookingId: `booking-${index + 1}`,
      dayId: `day-${index + 1}`,
      date: `2026-05-${String(index + 3).padStart(2, '0')}`,
      circuit: `Circuit ${index + 1}`,
      description: `Trip ${index + 1}`,
    }));

    renderWithProviders(<BookingSchedulePage bookings={bookings} today="2026-05-03" />);

    expect(screen.getByText(/showing 7 of 8 upcoming trips/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select circuit 7/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /select circuit 8/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load next 7 trips/i }));

    expect(screen.getByText(/showing 8 of 8 upcoming trips/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select circuit 8/i })).toBeInTheDocument();
  });

  it('gives unset accommodation enough context in the trip list', () => {
    renderWithProviders(
      <BookingSchedulePage
        bookings={[
          {
            ...bookingOne,
            accommodationStatus: 'unknown',
            accommodationName: '',
            accommodationReference: '',
          },
        ]}
        today="2026-05-03"
      />,
    );

    expect(screen.getAllByText('Accommodation not set').length).toBeGreaterThan(0);
    expect(screen.queryByText('Not set')).not.toBeInTheDocument();
  });

  it('shows only upcoming active bookings on the schedule', () => {
    const pastBooking: BookingRecord = {
      ...bookingOne,
      bookingId: 'past-booking',
      dayId: 'past-day',
      date: '2026-05-03',
      circuit: 'Past Circuit',
    };
    const cancelledFutureBooking: BookingRecord = {
      ...bookingOne,
      bookingId: 'cancelled-booking',
      dayId: 'cancelled-day',
      date: '2026-06-20',
      status: 'cancelled',
      circuit: 'Cancelled Circuit',
    };

    renderWithProviders(
      <BookingSchedulePage
        bookings={[pastBooking, bookingTwo, cancelledFutureBooking]}
        today="2026-06-01"
      />,
    );

    expect(screen.getByText('1 trip tracked')).toBeInTheDocument();
    expect(screen.getByText('0 confirmed')).toBeInTheDocument();
    expect(screen.getByText('1 maybe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select donington park/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /select past circuit/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /select cancelled circuit/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Donington Park' })).toBeInTheDocument();
  });

  it('opens the calendar sync modal with subscription links', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BookingSchedulePage
        bookings={[bookingOne, bookingTwo]}
        today="2026-05-03"
        calendarFeedUrl="https://gridstay.app/calendar/private-token.ics"
      />,
    );

    await user.click(screen.getByRole('button', { name: /sync calendar/i }));

    expect(
      await screen.findByDisplayValue('https://gridstay.app/calendar/private-token.ics'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /subscribe on this device/i })).toHaveAttribute(
      'href',
      'webcal://gridstay.app/calendar/private-token.ics',
    );
    expect(screen.getByRole('link', { name: /add to google calendar/i })).toHaveAttribute(
      'href',
      expect.stringContaining('https%3A%2F%2Fgridstay.app'),
    );
    expect(screen.getByRole('checkbox', { name: /include trips marked maybe/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /include accommodation details/i })).toBeChecked();
  });

  it('creates the calendar feed through the schedule route action', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} today="2026-05-03" />,
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
      expect(submitted).toEqual(expect.objectContaining({ intent: 'createCalendarFeed' })),
    );
    expect(
      await screen.findByDisplayValue('https://gridstay.app/calendar/new-token.ics'),
    ).toBeInTheDocument();
  });

  it('saves calendar feed content options without regenerating the link', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <BookingSchedulePage
        bookings={[bookingOne, bookingTwo]}
        today="2026-05-03"
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
    await user.click(screen.getByRole('checkbox', { name: /include accommodation details/i }));
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
        today="2026-05-03"
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
      expect(submitted).toEqual(expect.objectContaining({ intent: 'regenerateCalendarFeed' })),
    );
    expect(
      await screen.findByDisplayValue('https://gridstay.app/calendar/regenerated-token.ics'),
    ).toBeInTheDocument();
  });

  it('updates the selected booking when a list item is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BookingSchedulePage bookings={[bookingOne, bookingTwo]} today="2026-05-03" />,
    );

    await user.click(screen.getByRole('button', { name: /select donington park/i }));

    expect(screen.getByRole('heading', { name: 'Donington Park' })).toBeInTheDocument();
    expect(screen.getAllByText('No hotel needed').length).toBeGreaterThan(0);
    expect(screen.getByText('No booking reference saved')).toBeInTheDocument();
  });

  it('renders the empty state when there are no bookings', () => {
    renderWithProviders(<BookingSchedulePage bookings={[]} />);

    expect(screen.getByText(/no trips to schedule yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse available days/i })).toHaveAttribute(
      'href',
      '/dashboard/days',
    );
  });

  it('keeps past bookings accessible through My Bookings when schedule is empty', () => {
    renderWithProviders(<BookingSchedulePage bookings={[bookingOne]} today="2026-06-01" />);

    expect(screen.getByText(/no upcoming trips/i)).toBeInTheDocument();
    expect(screen.getByText(/past and cancelled trips are still available/i)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: /view all bookings/i })
        .every((link) => link.getAttribute('href') === '/dashboard/bookings?view=manage'),
    ).toBe(true);
  });
});
