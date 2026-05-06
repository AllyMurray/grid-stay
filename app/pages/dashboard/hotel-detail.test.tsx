import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { HotelInsight } from '~/lib/db/services/hotel.server';
import { theme } from '~/theme';
import { HotelDetailPage } from './hotel-detail';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/']} />);
}

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

describe('HotelDetailPage', () => {
  it('renders the hotel summary and member feedback', () => {
    renderWithProviders(
      <HotelDetailPage insight={hotelInsight} currentUserId="user-1" />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Trackside Hotel' }),
    ).toBeInTheDocument();
    expect(screen.getByText('AI summary')).toBeInTheDocument();
    expect(screen.getByText('Driver One')).toBeInTheDocument();
    expect(
      screen.getByText('Plenty of room for trailers.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Easy drive to the circuit.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /edit my feedback/i }),
    ).toHaveAttribute('href', '/dashboard/hotels/hotel-1/feedback');
  });

  it('offers adding feedback when the current user has not reviewed the hotel', () => {
    renderWithProviders(
      <HotelDetailPage insight={hotelInsight} currentUserId="user-2" />,
    );

    expect(screen.getByRole('link', { name: /add feedback/i })).toHaveAttribute(
      'href',
      '/dashboard/hotels/hotel-1/feedback',
    );
  });
});
