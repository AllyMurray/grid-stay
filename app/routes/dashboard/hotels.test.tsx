import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { listHotels, listHotelInsights } = vi.hoisted(() => ({
  listHotels: vi.fn(),
  listHotelInsights: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/db/services/hotel.server', () => ({
  listHotels,
  listHotelInsights,
}));

import { loader } from './hotels';

const tracksideHotel = {
  hotelId: 'hotel-1',
  name: 'Trackside Hotel',
};

const airportHotel = {
  hotelId: 'hotel-2',
  name: 'Airport Hotel',
};

const tracksideInsight = {
  hotel: tracksideHotel,
  reviewCount: 1,
  summary: 'Good trailer parking.',
  summarySource: 'structured',
  reviews: [],
};

const airportInsight = {
  hotel: airportHotel,
  reviewCount: 0,
  summary: 'No feedback yet.',
  summarySource: 'structured',
  reviews: [],
};

describe('hotels route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'driver@example.com',
        name: 'Driver One',
        role: 'member',
      },
      headers: new Headers(),
    });
    listHotels.mockReset();
    listHotels.mockResolvedValue([tracksideHotel, airportHotel]);
    listHotelInsights.mockReset();
    listHotelInsights.mockResolvedValue(
      new Map([
        ['hotel-1', tracksideInsight],
        ['hotel-2', airportInsight],
      ]),
    );
  });

  it('loads all saved hotel insights sorted by hotel name', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/hotels'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({
      hotels: [airportInsight, tracksideInsight],
    });
    expect(listHotelInsights).toHaveBeenCalledWith(['hotel-1', 'hotel-2']);
  });
});
