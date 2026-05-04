import { describe, expect, it, vi } from 'vitest';
import { searchGeoapifyHotels } from './geoapify.server';

describe('Geoapify hotel lookup', () => {
  it('returns accommodation suggestions with attribution', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        results: [
          {
            place_id: 'hotel-geoapify-1',
            name: 'Radisson Blu Hotel',
            formatted: 'Herald Way, Derby, DE74 2TZ, United Kingdom',
            postcode: 'DE74 2TZ',
            country: 'United Kingdom',
            lat: 52.8242,
            lon: -1.3281,
            categories: ['accommodation.hotel'],
          },
          {
            place_id: 'restaurant-1',
            name: 'Airport Restaurant',
            formatted: 'Derby',
            categories: ['catering.restaurant'],
          },
        ],
      }),
    );

    const results = await searchGeoapifyHotels('radisson east midlands', {
      apiKey: 'geoapify-key',
      fetcher: fetcher as never,
    });

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.any(URLSearchParams),
      }),
    );
    expect(results).toEqual([
      expect.objectContaining({
        name: 'Radisson Blu Hotel',
        postcode: 'DE74 2TZ',
        source: 'geoapify',
        sourcePlaceId: 'hotel-geoapify-1',
        attribution:
          'Hotel data powered by Geoapify. © OpenStreetMap contributors.',
      }),
    ]);
  });

  it('gracefully returns no results without an API key', async () => {
    const fetcher = vi.fn();

    await expect(
      searchGeoapifyHotels('radisson', {
        apiKey: '',
        fetcher: fetcher as never,
      }),
    ).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses a place fallback for hotel name and location searches', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          results: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          results: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          results: [
            {
              place_id: 'east-midlands-airport',
              name: 'East Midlands Airport',
              formatted: 'East Midlands Airport, DE74 2TN, United Kingdom',
              result_type: 'amenity',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          features: [
            {
              properties: {
                place_id: 'radisson-east-midlands',
                name: 'Radisson Blu',
                formatted:
                  'Radisson Blu, Herald Way, Derby, DE74 2TZ, United Kingdom',
                postcode: 'DE74 2TZ',
                country: 'United Kingdom',
                lat: 52.8242,
                lon: -1.3281,
                categories: ['accommodation', 'accommodation.hotel'],
              },
            },
          ],
        }),
      );

    await expect(
      searchGeoapifyHotels('Radisson Blu Hotel, East Midlands Airport', {
        apiKey: 'geoapify-key',
        fetcher: fetcher as never,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        name: 'Radisson Blu',
        address: 'Radisson Blu, Herald Way, Derby, DE74 2TZ, United Kingdom',
        postcode: 'DE74 2TZ',
        source: 'geoapify',
        sourcePlaceId: 'radisson-east-midlands',
      }),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[1][0].searchParams.get('type')).toBeNull();
    expect(fetcher.mock.calls[2][0].searchParams.get('text')).toBe(
      'East Midlands Airport',
    );
    expect(fetcher.mock.calls[3][0].searchParams.get('filter')).toBe(
      'place:east-midlands-airport',
    );
    expect(fetcher.mock.calls[3][0].searchParams.get('name')).toBe(
      'Radisson Blu',
    );
  });

  it('uses place fallback candidates for hotel searches without a comma', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          results: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          results: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          results: [
            {
              place_id: 'brands-hatch',
              name: 'Brands Hatch',
              formatted: 'Brands Hatch, Longfield, DA3 8NG, United Kingdom',
              result_type: 'amenity',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          features: [
            {
              properties: {
                place_id: 'mercure-brands-hatch',
                name: 'Mercure Dartford Brands Hatch Hotel & Spa',
                formatted:
                  'Mercure Dartford Brands Hatch Hotel & Spa, Brands Hatch, DA3 8PE, United Kingdom',
                postcode: 'DA3 8PE',
                country: 'United Kingdom',
                lat: 51.3566,
                lon: 0.2612,
                categories: ['accommodation', 'accommodation.hotel'],
              },
            },
          ],
        }),
      );

    await expect(
      searchGeoapifyHotels('Mercure Dartford Brands Hatch Hotel & Spa', {
        apiKey: 'geoapify-key',
        fetcher: fetcher as never,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        name: 'Mercure Dartford Brands Hatch Hotel & Spa',
        postcode: 'DA3 8PE',
        source: 'geoapify',
        sourcePlaceId: 'mercure-brands-hatch',
      }),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[0][0].searchParams.get('type')).toBe('amenity');
    expect(fetcher.mock.calls[1][0].searchParams.get('type')).toBeNull();
    expect(fetcher.mock.calls[2][0].searchParams.get('text')).toBe(
      'Brands Hatch',
    );
    expect(fetcher.mock.calls[3][0].searchParams.get('filter')).toBe(
      'place:brands-hatch',
    );
    expect(fetcher.mock.calls[3][0].searchParams.get('name')).toBe('Mercure');
  });
});
