import { describe, expect, it, vi } from 'vite-plus/test';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { AvailableDay } from './types';

const { syncDayAttendanceSummariesMock, upsertSeriesSubscriptionMock } = vi.hoisted(() => ({
  syncDayAttendanceSummariesMock: vi.fn(async () => {}),
  upsertSeriesSubscriptionMock: vi.fn(async () => ({})),
}));

vi.mock('~/lib/db/services/booking.server', () => ({
  bookingStore: {},
  syncDayAttendanceSummaries: syncDayAttendanceSummariesMock,
}));

vi.mock('~/lib/db/services/day-attendance-summary.server', () => ({
  dayAttendanceSummaryStore: {},
}));

vi.mock('~/lib/db/services/series-subscription.server', () => ({
  seriesSubscriptionStore: {},
  upsertSeriesSubscription: upsertSeriesSubscriptionMock,
}));

import { reconcileSeriesSubscriptionsForDays } from './series-subscriptions.server';

function createMemoryStore(items: BookingRecord[]) {
  return {
    items,
    store: {
      async create(item: BookingRecord) {
        items.push(item);
        return item;
      },
      async update() {
        throw new Error('Not used in this test');
      },
      async delete() {
        throw new Error('Not used in this test');
      },
      async listByUser(userId: string) {
        return items.filter((item) => item.userId === userId);
      },
      async findByUserAndDay() {
        throw new Error('Not used in this test');
      },
      async getByUser() {
        throw new Error('Not used in this test');
      },
      async listByDay(dayId: string) {
        return items.filter((item) => item.dayId === dayId);
      },
    },
    summaryStore: {},
  };
}

describe('series subscription reconciliation', () => {
  it('backfills subscriptions and adds missing linked extras for fully booked series members', async () => {
    const linkedDays: AvailableDay[] = [
      {
        dayId: 'race:1',
        date: '2026-04-10',
        type: 'race_day',
        circuit: 'Snetterton',
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        source: {
          sourceType: 'caterham',
          sourceName: 'caterham',
          metadata: {
            series: 'Caterham Academy',
          },
        },
      },
      {
        dayId: 'race:2',
        date: '2026-05-10',
        type: 'race_day',
        circuit: 'Brands Hatch',
        provider: 'Caterham Motorsport',
        description: 'Round 2',
        source: {
          sourceType: 'caterham',
          sourceName: 'caterham',
          metadata: {
            series: 'Caterham Academy',
          },
        },
      },
      {
        dayId: 'manual:drift',
        date: '2026-04-22',
        type: 'track_day',
        circuit: 'Brands Hatch',
        provider: 'Caterham Motorsport',
        description: 'Drift Day',
        source: {
          sourceType: 'manual',
          sourceName: 'manual',
          metadata: {
            series: 'Caterham Academy',
          },
        },
      },
    ];

    const memory = createMemoryStore([
      {
        bookingId: 'race:1',
        userId: 'user-1',
        userName: 'Driver One',
        userImage: 'https://example.com/one.png',
        dayId: 'race:1',
        date: '2026-04-10',
        status: 'booked',
        circuit: 'Snetterton',
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as BookingRecord,
      {
        bookingId: 'race:2',
        userId: 'user-1',
        userName: 'Driver One',
        userImage: 'https://example.com/one.png',
        dayId: 'race:2',
        date: '2026-05-10',
        status: 'booked',
        circuit: 'Brands Hatch',
        provider: 'Caterham Motorsport',
        description: 'Round 2',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as BookingRecord,
      {
        bookingId: 'race:1',
        userId: 'user-2',
        userName: 'Driver Two',
        dayId: 'race:1',
        date: '2026-04-10',
        status: 'booked',
        circuit: 'Snetterton',
        provider: 'Caterham Motorsport',
        description: 'Round 1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as BookingRecord,
    ]);

    const result = await reconcileSeriesSubscriptionsForDays(
      linkedDays,
      memory.store as never,
      memory.summaryStore as never,
      {} as never,
    );

    expect(result).toEqual({
      seriesKey: 'caterham-academy',
      seriesName: 'Caterham Academy',
      subscriptionCount: 1,
      bookingCount: 1,
    });
    expect(upsertSeriesSubscriptionMock).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        seriesKey: 'caterham-academy',
        seriesName: 'Caterham Academy',
        status: 'booked',
      },
      {},
    );
    expect(memory.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'user-1',
          dayId: 'manual:drift',
          type: 'track_day',
          status: 'booked',
        }),
      ]),
    );
    expect(syncDayAttendanceSummariesMock).toHaveBeenCalledWith(
      ['manual:drift'],
      memory.store,
      memory.summaryStore,
    );
  });
});
