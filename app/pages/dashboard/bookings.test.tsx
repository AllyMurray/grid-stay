import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ActionFunctionArgs, createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { theme } from '~/theme';
import { MyBookingsPage } from './bookings';

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

const booking: BookingRecord = {
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

describe('MyBookingsPage', () => {
  it('renders booking editors directly from page props', () => {
    renderWithProviders(<MyBookingsPage bookings={[booking, secondBooking]} />);

    expect(
      screen.getByRole('heading', { name: 'My Bookings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trips' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /donington park/i }),
    ).toBeVisible();
    expect(screen.getByText('Shared with the group')).toBeInTheDocument();
    expect(screen.getByText('Private to you')).toBeInTheDocument();
    expect(screen.getAllByText(/visible only to you/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByDisplayValue('REF-123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Trackside Hotel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeVisible();
  });

  it('switches the editor when a condensed booking row is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyBookingsPage bookings={[booking, secondBooking]} />);

    await user.click(screen.getByRole('button', { name: /donington park/i }));

    expect(screen.getByDisplayValue('REF-999')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Paddock Lodge')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('REF-123')).not.toBeInTheDocument();
  });

  it('filters the trip list and updates the editor selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyBookingsPage bookings={[booking, secondBooking]} />);

    await user.click(
      screen.getByRole('textbox', { name: /filter trips by status/i }),
    );
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(
      screen.queryByRole('button', { name: /silverstone/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('REF-999')).toBeInTheDocument();
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
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <MyBookingsPage bookings={[booking, secondBooking]} />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return null;
      },
    );

    await user.click(screen.getByRole('button', { name: /delete booking/i }));

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({
          bookingId: 'booking-1',
          intent: 'deleteBooking',
        }),
      ),
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete this booking? This will remove it from your trips.',
    );

    confirmSpy.mockRestore();
  });

  it('renders the empty state without route loader data', () => {
    renderWithProviders(<MyBookingsPage bookings={[]} />);

    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /browse available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });
});
