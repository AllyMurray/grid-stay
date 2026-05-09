import { describe, expect, it, vi } from 'vite-plus/test';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { SeriesSubscriptionRecord } from '~/lib/db/entities/series-subscription.server';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/booking.server', () => ({
  listMyBookings: vi.fn(),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

vi.mock('~/lib/db/services/series-subscription.server', () => ({
  seriesSubscriptionStore: {
    listByUser: vi.fn(),
  },
}));

import { buildMemberRaceSeriesOverview } from './member-series.server';
import type { AvailableDay } from './types';

function seriesDay(
  dayId: string,
  date: string,
  series: string,
  circuit = 'Snetterton',
): AvailableDay {
  return {
    dayId,
    date,
    type: 'race_day',
    circuit,
    provider: 'Caterham Motorsport',
    description: 'Race round',
    source: {
      sourceType: 'caterham',
      sourceName: 'caterham',
      metadata: {
        series,
      },
    },
  };
}

function booking(dayId: string, status: BookingRecord['status']): BookingRecord {
  return {
    bookingId: dayId,
    userId: 'user-1',
    userName: 'Driver One',
    dayId,
    date: '2026-05-10',
    type: 'race_day',
    status,
    circuit: 'Snetterton',
    provider: 'Caterham Motorsport',
    description: 'Race round',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  };
}

describe('member race series overview', () => {
  it('summarizes subscribed series counts and current-year join options', () => {
    const subscriptions: SeriesSubscriptionRecord[] = [
      {
        userId: 'user-1',
        seriesKey: 'caterham-academy',
        seriesName: 'Caterham Academy',
        status: 'maybe',
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-02T10:00:00.000Z',
      } as SeriesSubscriptionRecord,
    ];

    const overview = buildMemberRaceSeriesOverview({
      subscriptions,
      bookings: [booking('academy-1', 'booked'), booking('academy-2', 'maybe')],
      days: [
        seriesDay('academy-1', '2026-05-10', 'Caterham Academy'),
        seriesDay('academy-2', '2026-06-10', 'Caterham Academy'),
        seriesDay('academy-3', '2026-07-10', 'Caterham Academy'),
        seriesDay('roadsport-1', '2026-08-10', 'Caterham Roadsport', 'Brands Hatch'),
        seriesDay('past-1', '2026-04-10', 'Past Series'),
        seriesDay('future-year-1', '2027-04-10', 'Future Series'),
      ],
      today: '2026-05-01',
    });

    expect(overview.subscriptions).toEqual([
      {
        seriesKey: 'caterham-academy',
        seriesName: 'Caterham Academy',
        status: 'maybe',
        updatedAt: '2026-04-02T10:00:00.000Z',
        linkedDayCount: 3,
        bookedCount: 1,
        maybeCount: 1,
        missingCount: 1,
        cancelledCount: 0,
      },
    ]);
    expect(overview.joinOptions).toEqual([
      {
        seriesKey: 'caterham-roadsport',
        seriesName: 'Caterham Roadsport',
        dayCount: 1,
      },
    ]);
  });
});
