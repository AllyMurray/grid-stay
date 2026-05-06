import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { listHotelInsights } = vi.hoisted(() => ({
  listHotelInsights: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/db/services/hotel.server', () => ({
  listHotelInsights,
}));

import { loader } from './hotels.$hotelId';

const insight = {
  hotel: {
    hotelId: 'hotel-1',
    name: 'Trackside Hotel',
  },
  reviewCount: 0,
  summary: 'No reviews yet.',
  summarySource: 'structured',
  reviews: [],
};

describe('hotel detail route', () => {
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
    listHotelInsights.mockReset();
    listHotelInsights.mockResolvedValue(new Map([['hotel-1', insight]]));
  });

  it('loads a single hotel insight for the record page', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/hotels/hotel-1'),
      params: { hotelId: 'hotel-1' },
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({
      insight,
      currentUserId: 'user-1',
    });
    expect(listHotelInsights).toHaveBeenCalledWith(['hotel-1']);
  });

  it('throws a not found response when the hotel does not exist', async () => {
    listHotelInsights.mockResolvedValue(new Map());

    await expect(
      loader({
        request: new Request('https://gridstay.app/dashboard/hotels/missing'),
        params: { hotelId: 'missing' },
        context: {},
      } as never),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});
