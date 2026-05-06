import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ActionFunctionArgs, createRoutesStub } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { HotelInsight } from '~/lib/db/services/hotel.server';
import { theme } from '~/theme';
import { MyBookingsPage } from './bookings';

const useMediaQueryMock = vi.fn(() => false);

vi.mock('@mantine/hooks', async () => {
  const actual =
    await vi.importActual<typeof import('@mantine/hooks')>('@mantine/hooks');

  return {
    ...actual,
    useMediaQuery: () => useMediaQueryMock(),
  };
});

function renderWithProviders(
  ui: React.ReactElement,
  action?: (args: ActionFunctionArgs) => Promise<unknown>,
  initialEntries: string[] | string = ['/?view=manage'],
) {
  const entries = Array.isArray(initialEntries)
    ? initialEntries
    : [initialEntries];
  const Stub = createRoutesStub([
    {
      path: '/',
      action: action ?? (async () => null),
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={entries} />);
}

const booking: BookingRecord = {
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
  arrivalDateTime: '2026-05-02 20:00:00',
  description: 'GT weekend',
  accommodationName: 'Trackside Hotel',
  accommodationReference: 'HOTEL-7',
  notes: 'Quiet room',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

const secondBooking: BookingRecord = {
  ...booking,
  bookingId: 'booking-2',
  dayId: 'day-2',
  status: 'maybe',
  circuit: 'Donington Park',
  bookingReference: 'REF-999',
  accommodationName: 'Paddock Lodge',
  accommodationReference: 'LODGE-9',
  notes: 'Arriving late',
};

const hotelInsight: HotelInsight = {
  hotel: {
    hotelId: 'hotel-1',
    hotelScope: 'hotel',
    normalizedName: 'trackside hotel',
    sourceKey: 'manual:trackside hotel',
    name: 'Trackside Hotel',
    address: '1 Circuit Road, Towcester',
    source: 'manual',
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  },
  reviewCount: 1,
  averageRating: 5,
  summary:
    'Based on 1 Grid Stay review: 1 member says trailer parking is good.',
  summarySource: 'bedrock',
  summaryGeneratedAt: '2026-04-01T10:05:00.000Z',
  reviews: [
    {
      hotelId: 'hotel-1',
      reviewId: 'user-1',
      reviewScope: 'hotel-review',
      userId: 'user-1',
      userName: 'Driver One',
      rating: 5,
      trailerParking: 'good',
      secureParking: 'yes',
      lateCheckIn: 'limited',
      parkingNotes: 'Plenty of room for trailers.',
      generalNotes: 'Easy drive to the circuit.',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  ],
};

describe('MyBookingsPage', () => {
  beforeEach(() => {
    useMediaQueryMock.mockReset();
    useMediaQueryMock.mockReturnValue(false);
    vi.restoreAllMocks();
  });

  it('renders the upcoming schedule view by default', () => {
    renderWithProviders(
      <MyBookingsPage bookings={[booking, secondBooking]} today="2026-05-01" />,
      undefined,
      ['/'],
    );

    expect(
      screen.getByRole('heading', { name: 'My Bookings' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 trips tracked')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Upcoming trips' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sync calendar/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /manage in my bookings/i }),
    ).toHaveAttribute('href', '/dashboard/bookings?view=manage');
  });

  it('renders booking editor tabs directly from page props', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyBookingsPage bookings={[booking, secondBooking]} />);

    expect(
      screen.getByRole('heading', { name: 'My Bookings' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 trips tracked')).toBeInTheDocument();
    expect(screen.getByText('1 confirmed')).toBeInTheDocument();
    expect(screen.getByText('1 maybe')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '1 confirmed, 1 maybe' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 with accommodation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trips' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /donington park/i }),
    ).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Trip' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Stay' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Garage' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Private' })).toBeInTheDocument();
    expect(screen.getByText('Trip plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save trip/i })).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Private' }));

    expect(screen.getByText('Private to you')).toBeInTheDocument();
    expect(screen.getAllByText(/visible only to you/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByDisplayValue('REF-123')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Stay' }));

    expect(screen.getByText('Sat 2 May 2026, 20:00')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /hotel or stay/i })).toHaveValue(
      'Trackside Hotel',
    );
    expect(screen.getByRole('button', { name: /save stay/i })).toBeVisible();
  });

  it('renders saved hotel insight with a dedicated feedback link', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MyBookingsPage
        bookings={[{ ...booking, hotelId: 'hotel-1' }]}
        hotelInsights={{ 'hotel-1': hotelInsight }}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Stay' }));

    expect(
      screen.getAllByText('1 Circuit Road, Towcester').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Based on 1 Grid Stay review: 1 member says trailer parking is good.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /hotel feedback/i }),
    ).toHaveAttribute(
      'href',
      '/dashboard/hotels/hotel-1/feedback?booking=booking-1',
    );
    expect(
      screen.queryByDisplayValue('Plenty of room for trailers.'),
    ).not.toBeInTheDocument();
  });

  it('opens hotel lookup from the stay section', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyBookingsPage bookings={[booking]} />);

    await user.click(screen.getByRole('tab', { name: 'Stay' }));
    await user.click(screen.getByRole('button', { name: /find hotel/i }));

    expect(
      await screen.findByRole('dialog', { name: /find hotel/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /hotel search/i })).toHaveValue(
      'Trackside Hotel',
    );
  });

  it('submits the shared arrival time when saving a booking', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <MyBookingsPage bookings={[booking]} />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return { ok: true };
      },
    );

    await user.click(screen.getByRole('tab', { name: 'Stay' }));
    await user.click(screen.getByRole('button', { name: /save stay/i }));

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({
          intent: 'updateBookingStay',
          bookingId: 'booking-1',
          accommodationStatus: 'booked',
          arrivalDateTime: '2026-05-02 20:00:00',
          accommodationName: 'Trackside Hotel',
        }),
      ),
    );
  });

  it('lets a user mark that no hotel is needed', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <MyBookingsPage bookings={[booking]} />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return { ok: true };
      },
    );

    await user.click(screen.getByRole('tab', { name: 'Stay' }));
    const accommodationPlan = screen.getByRole('combobox', {
      name: /accommodation plan/i,
    });
    expect(accommodationPlan).toHaveValue('Hotel booked');

    await user.click(accommodationPlan);
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{Enter}');

    expect(
      screen.queryByRole('textbox', { name: /hotel or stay/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save stay/i }));

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({
          intent: 'updateBookingStay',
          bookingId: 'booking-1',
          accommodationStatus: 'not_required',
        }),
      ),
    );
    expect(submitted).not.toHaveProperty('accommodationName');
  });

  it('lets a user mark that they are staying at the track', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <MyBookingsPage bookings={[booking]} />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return { ok: true };
      },
    );

    await user.click(screen.getByRole('tab', { name: 'Stay' }));
    const accommodationPlan = screen.getByRole('combobox', {
      name: /accommodation plan/i,
    });

    await user.click(accommodationPlan);
    await user.keyboard('{ArrowUp}{ArrowUp}{Enter}');

    expect(
      screen.queryByRole('textbox', { name: /hotel or stay/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/camping, campervan, tentbox/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save stay/i }));

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({
          intent: 'updateBookingStay',
          bookingId: 'booking-1',
          accommodationStatus: 'staying_at_track',
        }),
      ),
    );
    expect(submitted).not.toHaveProperty('accommodationName');
  });

  it('opens an empty arrival picker on the event month', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MyBookingsPage
        bookings={[
          {
            ...booking,
            date: '2026-09-12',
            arrivalDateTime: undefined,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Stay' }));
    await user.click(screen.getByRole('button', { name: /arrival/i }));

    await waitFor(() =>
      expect(document.querySelector('[data-dates-dropdown]')).toBeTruthy(),
    );
    const dropdown = document.querySelector(
      '[data-dates-dropdown]',
    ) as HTMLElement;
    expect(within(dropdown).getByText('September 2026')).toBeInTheDocument();
  });

  it('renders garage requests for the selected booking section', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MyBookingsPage
        bookings={[
          {
            ...booking,
            garageBooked: true,
            garageCapacity: 2,
            garageLabel: 'Garage 7',
          },
        ]}
        garageShareRequests={[
          {
            requestScope: 'garage-share-request',
            requestId: 'garage-request-1',
            dayId: booking.dayId,
            date: booking.date,
            circuit: booking.circuit,
            provider: booking.provider,
            description: booking.description,
            garageBookingId: booking.bookingId,
            garageOwnerUserId: booking.userId,
            garageOwnerName: booking.userName,
            requesterUserId: 'user-2',
            requesterName: 'Driver Two',
            requesterBookingId: booking.bookingId,
            status: 'pending',
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:00:00.000Z',
            isIncoming: true,
            isOutgoing: false,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Garage' }));

    expect(screen.getByDisplayValue('Garage 7')).toBeInTheDocument();
    expect(screen.getByText('Driver Two')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
  });

  it('shows garage request action errors inline', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MyBookingsPage
        bookings={[
          {
            ...booking,
            garageBooked: true,
            garageCapacity: 2,
          },
        ]}
        garageShareRequests={[
          {
            requestScope: 'garage-share-request',
            requestId: 'garage-request-1',
            dayId: booking.dayId,
            date: booking.date,
            circuit: booking.circuit,
            provider: booking.provider,
            description: booking.description,
            garageBookingId: booking.bookingId,
            garageOwnerUserId: booking.userId,
            garageOwnerName: booking.userName,
            requesterUserId: 'user-2',
            requesterName: 'Driver Two',
            requesterBookingId: booking.bookingId,
            status: 'pending',
            createdAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-02T10:00:00.000Z',
            isIncoming: true,
            isOutgoing: false,
          },
        ]}
      />,
      async () =>
        Response.json(
          {
            ok: false,
            formError: 'This garage no longer has a free space.',
            fieldErrors: {},
          },
          { status: 400 },
        ),
    );

    await user.click(screen.getByRole('tab', { name: 'Garage' }));
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(
      await screen.findByText('This garage no longer has a free space.'),
    ).toBeInTheDocument();
  });

  it('switches the editor when a condensed booking row is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyBookingsPage bookings={[booking, secondBooking]} />);

    await user.click(screen.getByRole('button', { name: /donington park/i }));

    expect(
      screen.getByRole('heading', { name: 'Donington Park' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Private' }));
    expect(screen.getByDisplayValue('REF-999')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Stay' }));
    expect(screen.getByRole('textbox', { name: /hotel or stay/i })).toHaveValue(
      'Paddock Lodge',
    );
    expect(screen.queryByDisplayValue('REF-123')).not.toBeInTheDocument();
  });

  it('filters the trip list and updates the editor selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyBookingsPage bookings={[booking, secondBooking]} />);

    await user.click(
      screen.getByRole('combobox', { name: /filter trips by status/i }),
    );
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(
      screen.queryByRole('button', { name: /silverstone/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Donington Park' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Private' }));
    expect(screen.getByDisplayValue('REF-999')).toBeInTheDocument();
  });

  it('opens the selected booking from the query parameter', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MyBookingsPage bookings={[booking, secondBooking]} />,
      undefined,
      '/?booking=booking-2',
    );

    expect(
      screen.getByRole('heading', { name: 'Donington Park' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Private' }));
    expect(screen.getByDisplayValue('REF-999')).toBeInTheDocument();
  });

  it('uses a focused mobile manage screen with a back control', async () => {
    const user = userEvent.setup();
    useMediaQueryMock.mockReturnValue(true);
    renderWithProviders(<MyBookingsPage bookings={[booking, secondBooking]} />);

    expect(screen.getByRole('heading', { name: 'Trips' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Silverstone' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /donington park/i }));

    expect(
      screen.getByRole('heading', { name: 'Donington Park' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /back to trips/i }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: /back to trips/i }));

    expect(screen.getByRole('heading', { name: 'Trips' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Donington Park' }),
    ).not.toBeInTheDocument();
  });

  it('confirms before leaving a dirty booking section', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithProviders(<MyBookingsPage bookings={[booking]} />);

    await user.click(screen.getByRole('tab', { name: 'Private' }));
    await user.type(
      screen.getByRole('textbox', { name: /private notes/i }),
      ' updated',
    );
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Stay' }));

    expect(confirm).toHaveBeenCalledWith(
      'Discard unsaved changes in this section?',
    );
    expect(screen.getByText('Private to you')).toBeInTheDocument();
  });

  it('searches the compact trip list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyBookingsPage bookings={[booking, secondBooking]} />);

    await user.type(screen.getByLabelText(/search trips/i), 'donington');

    expect(
      screen.queryByRole('button', { name: /silverstone/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /donington park/i }),
    ).toBeVisible();
  });

  it('submits a delete intent for the selected booking', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <MyBookingsPage bookings={[booking, secondBooking]} />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return null;
      },
    );

    await user.click(screen.getByRole('button', { name: /delete booking/i }));
    const modalCopy = await screen.findByText(
      /this removes silverstone from your trips and updates the shared attendance for that day/i,
    );
    expect(modalCopy).toBeInTheDocument();

    const deleteForm = modalCopy.closest('form');
    expect(deleteForm).not.toBeNull();

    await user.click(
      within(deleteForm as HTMLFormElement).getByRole('button', {
        name: /^delete booking$/i,
      }),
    );

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({
          bookingId: 'booking-1',
          intent: 'deleteBooking',
        }),
      ),
    );
  });

  it('renders the empty state without route loader data', () => {
    renderWithProviders(<MyBookingsPage bookings={[]} />);

    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /browse available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });
});
