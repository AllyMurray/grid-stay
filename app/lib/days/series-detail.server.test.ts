import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

vi.mock('~/lib/db/services/booking.server', () => ({
  listMyBookings: vi.fn(),
}));

import { loadRaceSeriesDetail } from './series-detail.server';
import type { AvailableDay } from './types';

function createSeriesDay(
  overrides: Partial<AvailableDay> & Pick<AvailableDay, 'dayId' | 'date'>,
): AvailableDay {
  return {
    dayId: overrides.dayId,
    date: overrides.date,
    type: overrides.type ?? 'race_day',
    circuit: overrides.circuit ?? 'Snetterton 300',
    provider: overrides.provider ?? 'Caterham Motorsport',
    description: overrides.description ?? 'Caterham Academy Round',
    source: overrides.source ?? {
      sourceType: 'caterham',
      sourceName: 'caterham',
      metadata: {
        series: 'Caterham Academy',
      },
    },
  };
}

describe('loadRaceSeriesDetail', () => {
  it('returns normalized series rounds with member booking state', async () => {
    const detail = await loadRaceSeriesDetail(
      { id: 'user-1' },
      'caterham-academy',
      async () => ({
        refreshedAt: '2026-04-27T10:00:00.000Z',
        errors: [],
        days: [
          createSeriesDay({
            dayId: 'race-2',
            date: '2026-06-10',
            circuit: 'Brands Hatch Indy',
          }),
          createSeriesDay({
            dayId: 'other-series',
            date: '2026-05-01',
            source: {
              sourceType: 'caterham',
              sourceName: 'caterham',
              metadata: {
                series: 'Caterham Roadsport',
              },
            },
          }),
        ],
      }),
      async () => [
        createSeriesDay({
          dayId: 'manual-test',
          date: '2026-05-10',
          type: 'test_day',
          circuit: 'Sntterton 300',
          source: {
            sourceType: 'manual',
            sourceName: 'manual',
            metadata: {
              series: 'Caterham Academy',
            },
          },
        }),
      ],
      async () => [
        {
          bookingId: 'booking-1',
          userId: 'user-1',
          userName: 'Driver One',
          dayId: 'manual-test',
          date: '2026-05-10',
          type: 'test_day',
          status: 'booked',
          circuit: 'Snetterton',
          provider: 'Caterham Motorsport',
          description: 'Official test',
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        },
      ],
    );

    expect(detail).toMatchObject({
      seriesKey: 'caterham-academy',
      seriesName: 'Caterham Academy',
      roundCount: 2,
      bookedCount: 1,
      maybeCount: 0,
      manualRoundCount: 1,
    });
    expect(detail?.rounds.map((round) => round.dayId)).toEqual(['manual-test', 'race-2']);
    expect(detail?.rounds[0]).toMatchObject({
      circuit: 'Snetterton',
      layout: '300',
      myBookingStatus: 'booked',
      isManual: true,
    });
  });

  it('returns null when the series key is unknown', async () => {
    await expect(
      loadRaceSeriesDetail(
        { id: 'user-1' },
        'unknown-series',
        async () => ({
          refreshedAt: '2026-04-27T10:00:00.000Z',
          errors: [],
          days: [],
        }),
        async () => [],
        async () => [],
      ),
    ).resolves.toBeNull();
  });
});
