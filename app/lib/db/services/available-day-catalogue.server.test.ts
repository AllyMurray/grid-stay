import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../entities/available-day-catalogue.server', () => ({
  AvailableDayCatalogueEntity: {
    query: {
      byDate: () => ({
        go: async () => ({ data: [] }),
      }),
    },
    get: () => ({
      go: async () => ({ data: null }),
    }),
    put: () => ({
      go: async () => undefined,
    }),
  },
}));

vi.mock('../entities/booking.server', () => ({
  BookingEntity: {
    scan: {
      go: async () => ({ data: [] }),
    },
  },
}));

import type { AvailableDay } from '~/lib/days/types';
import type { BookingRecord } from '../entities/booking.server';
import {
  type AvailableDayCataloguePersistence,
  type AvailableDayCatalogueRecord,
  listAvailableDayCatalogue,
  toAvailableDayFromBooking,
  upsertAvailableDayCatalogue,
} from './available-day-catalogue.server';

function createMemoryStore(initial: AvailableDayCatalogueRecord[] = []): {
  records: AvailableDayCatalogueRecord[];
  store: AvailableDayCataloguePersistence;
} {
  const records = [...initial];

  return {
    records,
    store: {
      async listByDate() {
        return [...records].toSorted((left, right) =>
          left.date === right.date
            ? left.dayId.localeCompare(right.dayId)
            : left.date.localeCompare(right.date),
        );
      },
      async getMany(dayIds) {
        return new Map(
          records
            .filter((record) => dayIds.includes(record.dayId))
            .map((record) => [record.dayId, record]),
        );
      },
      async putMany(items) {
        for (const item of items) {
          const index = records.findIndex((record) => record.dayId === item.dayId);
          if (index >= 0) {
            records[index] = item;
            continue;
          }

          records.push(item);
        }
      },
    },
  };
}

const trackDay: AvailableDay = {
  dayId: 'track-day-1',
  date: '2026-04-20',
  type: 'track_day',
  circuit: 'Donington Park',
  provider: 'MSV Car Trackdays',
  description: 'National • Evening',
  bookingUrl: 'https://example.com/day',
  source: {
    sourceType: 'trackdays',
    sourceName: 'msv-trackday',
    externalId: 'msv-1',
    metadata: {
      availability: 'Available',
    },
  },
};

describe('available day catalogue service', () => {
  it('upserts days without overwriting the first seen timestamp', async () => {
    const memory = createMemoryStore();

    await upsertAvailableDayCatalogue([trackDay], memory.store, {
      now: '2026-04-18T10:00:00.000Z',
    });
    await upsertAvailableDayCatalogue(
      [
        {
          ...trackDay,
          description: 'National • Full Day',
        },
      ],
      memory.store,
      {
        now: '2026-04-19T10:00:00.000Z',
      },
    );

    expect(memory.records).toHaveLength(1);
    expect(memory.records[0]).toMatchObject({
      catalogueScope: 'event',
      dayId: 'track-day-1',
      date: '2026-04-20',
      sourceType: 'trackdays',
      sourceName: 'msv-trackday',
      firstSeenAt: '2026-04-18T10:00:00.000Z',
      lastSeenAt: '2026-04-19T10:00:00.000Z',
    });
    expect(JSON.parse(memory.records[0]!.payload).description).toBe('National • Full Day');
  });

  it('lists retained catalogue days sorted by date', async () => {
    const memory = createMemoryStore([
      {
        catalogueScope: 'event',
        dayId: 'day-2',
        date: '2026-04-21',
        sourceType: 'trackdays',
        sourceName: 'source-two',
        payload: JSON.stringify({ ...trackDay, dayId: 'day-2', date: '2026-04-21' }),
        firstSeenAt: '2026-04-18T10:00:00.000Z',
        lastSeenAt: '2026-04-18T10:00:00.000Z',
      } as AvailableDayCatalogueRecord,
      {
        catalogueScope: 'event',
        dayId: 'day-1',
        date: '2026-04-20',
        sourceType: 'trackdays',
        sourceName: 'source-one',
        payload: JSON.stringify({ ...trackDay, dayId: 'day-1', date: '2026-04-20' }),
        firstSeenAt: '2026-04-18T10:00:00.000Z',
        lastSeenAt: '2026-04-18T10:00:00.000Z',
      } as AvailableDayCatalogueRecord,
    ]);

    const days = await listAvailableDayCatalogue(memory.store);

    expect(days.map((day) => day.dayId)).toEqual(['day-1', 'day-2']);
  });

  it('can rebuild an available day from a durable booking record', () => {
    const day = toAvailableDayFromBooking({
      bookingId: 'booking-1',
      userId: 'user-1',
      userName: 'Driver One',
      dayId: 'booking-day-1',
      date: '2026-04-20',
      type: 'race_day',
      status: 'booked',
      circuit: 'Snetterton 300',
      provider: 'Caterham Motorsport',
      description: 'Academy race weekend',
      createdAt: '2026-04-01T09:00:00.000Z',
      updatedAt: '2026-04-02T09:00:00.000Z',
    } as BookingRecord);

    expect(day).toMatchObject({
      dayId: 'booking-day-1',
      date: '2026-04-20',
      type: 'race_day',
      circuit: 'Snetterton',
      circuitId: 'snetterton',
      circuitName: 'Snetterton',
      circuitKnown: true,
      provider: 'Caterham Motorsport',
      source: {
        sourceType: 'manual',
        sourceName: 'booking',
        externalId: 'booking-1',
        metadata: {
          bookingStatus: 'booked',
        },
      },
    });
  });
});
