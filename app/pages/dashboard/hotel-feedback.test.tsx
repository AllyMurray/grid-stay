import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ActionFunctionArgs, createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import type { HotelInsight } from '~/lib/db/services/hotel.server';
import { theme } from '~/theme';
import { HotelFeedbackPage } from './hotel-feedback';

function renderWithProviders(
  ui: React.ReactElement,
  action?: (args: ActionFunctionArgs) => Promise<unknown>,
) {
  const Stub = createRoutesStub([
    {
      path: '/',
      action: action ?? (async () => ({ ok: true })),
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/']} />);
}

const insight: HotelInsight = {
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
  summary: 'Based on 1 Grid Stay review: 1 member says trailer parking is good.',
  summarySource: 'bedrock',
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

describe('HotelFeedbackPage', () => {
  it('renders existing hotel review values and return navigation', () => {
    renderWithProviders(
      <HotelFeedbackPage
        insight={insight}
        currentUserId="user-1"
        returnTo="/dashboard/bookings?booking=booking-1"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Trackside Hotel' })).toBeInTheDocument();
    expect(screen.getByText('1 Circuit Road, Towcester')).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Plenty of room for trailers.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to booking/i })).toHaveAttribute(
      'href',
      '/dashboard/bookings?booking=booking-1',
    );
  });

  it('submits hotel feedback through the route action', async () => {
    const user = userEvent.setup();
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <HotelFeedbackPage
        insight={insight}
        currentUserId="user-1"
        returnTo="/dashboard/bookings?booking=booking-1"
      />,
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return { ok: true };
      },
    );

    await user.click(screen.getByRole('button', { name: /save hotel feedback/i }));

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({
          intent: 'saveHotelReview',
          hotelId: 'hotel-1',
          trailerParking: 'good',
          parkingNotes: 'Plenty of room for trailers.',
        }),
      ),
    );
  });
});
