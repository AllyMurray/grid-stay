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

import { loader } from './api.dashboard.hotel-insight';

describe('dashboard hotel insight resource route', () => {
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
    listHotelInsights.mockResolvedValue(new Map([['hotel-1', { hotel: { hotelId: 'hotel-1' } }]]));
  });

  it('loads a single hotel insight by id', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/api/dashboard/hotel-insight?hotelId=hotel-1'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual({
      hotelInsight: {
        hotel: {
          hotelId: 'hotel-1',
        },
      },
    });
    expect(listHotelInsights).toHaveBeenCalledWith(['hotel-1']);
  });

  it('returns null without loading insights when no hotel id is supplied', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/api/dashboard/hotel-insight'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual({
      hotelInsight: null,
    });
    expect(listHotelInsights).not.toHaveBeenCalled();
  });
});
