import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { HotelInsight } from '~/lib/db/services/hotel.server';
import { theme } from '~/theme';
import { HotelsPage } from './hotels';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/']} />);
}

const tracksideHotel: HotelInsight = {
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

const airportHotel: HotelInsight = {
  hotel: {
    hotelId: 'hotel-2',
    hotelScope: 'hotel',
    normalizedName: 'airport hotel',
    sourceKey: 'manual:airport hotel',
    name: 'Airport Hotel',
    address: 'East Midlands Airport',
    source: 'geoapify',
    attribution: 'Hotel data powered by Geoapify.',
    createdByUserId: 'user-2',
    updatedByUserId: 'user-2',
    createdAt: '2026-04-02T10:00:00.000Z',
    updatedAt: '2026-04-02T10:00:00.000Z',
  },
  reviewCount: 0,
  summary: 'No Grid Stay hotel feedback yet.',
  summarySource: 'structured',
  reviews: [],
};

describe('HotelsPage', () => {
  it('renders saved hotels with summaries and links to hotel records', () => {
    renderWithProviders(<HotelsPage hotels={[tracksideHotel, airportHotel]} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Saved hotels' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 hotels saved')).toBeInTheDocument();
    expect(screen.getByText('1 hotel has feedback')).toBeInTheDocument();
    expect(screen.getByText('Trackside Hotel')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Based on 1 Grid Stay review: 1 member says trailer parking is good.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Plenty of room for trailers.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Easy drive to the circuit.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /view hotel/i })[0],
    ).toHaveAttribute('href', '/dashboard/hotels/hotel-1');
  });

  it('filters hotels by summary text', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HotelsPage hotels={[tracksideHotel, airportHotel]} />);

    await user.type(
      screen.getByRole('textbox', { name: /search hotels/i }),
      ['trailer'].join(''),
    );

    expect(screen.getByText('Trackside Hotel')).toBeInTheDocument();
    expect(screen.queryByText('Airport Hotel')).not.toBeInTheDocument();
  });
});
