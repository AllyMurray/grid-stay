import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { searchHotelCatalogue } = vi.hoisted(() => ({
  searchHotelCatalogue: vi.fn(),
}));
const { searchGeoapifyHotels } = vi.hoisted(() => ({
  searchGeoapifyHotels: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/db/services/hotel.server', () => ({
  searchHotelCatalogue,
}));

vi.mock('~/lib/hotels/geoapify.server', () => ({
  searchGeoapifyHotels,
}));

import { loader } from './api.hotels.search';

describe('hotel search resource route', () => {
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
    searchHotelCatalogue.mockReset();
    searchGeoapifyHotels.mockReset();
  });

  it('returns saved hotel matches without querying Geoapify', async () => {
    searchHotelCatalogue.mockResolvedValue([
      {
        hotelId: 'hotel-1',
        name: 'Mercure Brands Hatch Hotel',
        address: 'Mercure Brands Hatch Hotel, Dartford, DA3 8PE, United Kingdom',
        postcode: 'DA3 8PE',
        source: 'geoapify',
        sourcePlaceId: 'mercure-brands-hatch',
      },
    ]);
    searchGeoapifyHotels.mockResolvedValue([
      {
        name: 'Mercure Brands Hatch Hotel',
        address: 'Mercure Brands Hatch Hotel, Dartford, DA3 8PE, United Kingdom',
        postcode: 'DA3 8PE',
        source: 'geoapify',
        sourcePlaceId: 'mercure-brands-hatch',
      },
    ]);

    const response = (await loader({
      request: new Request('https://gridstay.app/api/hotels/search?q=Mercure%20Brands%20Hatch'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual({
      suggestions: [
        {
          hotelId: 'hotel-1',
          name: 'Mercure Brands Hatch Hotel',
          address: 'Mercure Brands Hatch Hotel, Dartford, DA3 8PE, United Kingdom',
          postcode: 'DA3 8PE',
          source: 'geoapify',
          sourcePlaceId: 'mercure-brands-hatch',
        },
      ],
      providerAvailable: true,
      providerError: null,
    });
    expect(searchGeoapifyHotels).not.toHaveBeenCalled();
  });

  it('queries Geoapify when the local catalogue has no matches', async () => {
    searchHotelCatalogue.mockResolvedValue([]);
    searchGeoapifyHotels.mockResolvedValue([
      {
        name: 'Trackside Hotel',
        address: 'Trackside Hotel, Example Road',
        source: 'geoapify',
        sourcePlaceId: 'trackside-hotel',
      },
    ]);

    const response = (await loader({
      request: new Request('https://gridstay.app/api/hotels/search?q=Trackside%20Hotel'),
      params: {},
      context: {},
    } as never)) as Response;

    await expect(response.json()).resolves.toEqual({
      suggestions: [
        {
          name: 'Trackside Hotel',
          address: 'Trackside Hotel, Example Road',
          source: 'geoapify',
          sourcePlaceId: 'trackside-hotel',
        },
      ],
      providerAvailable: true,
      providerError: null,
    });
    expect(searchGeoapifyHotels).toHaveBeenCalledWith('Trackside Hotel', {
      limit: 8,
    });
  });
});
