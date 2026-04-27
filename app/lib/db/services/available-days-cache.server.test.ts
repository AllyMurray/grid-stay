import { describe, expect, it, vi } from 'vitest';

vi.mock('../entities/available-days-cache.server', () => ({
  AvailableDaysCacheEntity: {
    query: {
      cache: () => ({
        go: async () => ({ data: [] }),
      }),
    },
    put: () => ({
      go: async () => undefined,
    }),
    delete: () => ({
      go: async () => undefined,
    }),
  },
}));

import {
  type AvailableDaysCachePersistence,
  getAvailableDaysSnapshot,
  refreshAvailableDaysSnapshot,
} from './available-days-cache.server';

type AvailableDaysCacheRecord = {
  cacheKey: string;
  scope: string;
  refreshedAt: string;
  payload: string;
};

function createMemoryStore(initial: AvailableDaysCacheRecord[] = []): {
  records: AvailableDaysCacheRecord[];
  store: AvailableDaysCachePersistence;
} {
  const records = [...initial];

  return {
    records,
    store: {
      async list() {
        return [...records];
      },
      async putMany(items) {
        for (const item of items) {
          const index = records.findIndex(
            (record) =>
              record.cacheKey === item.cacheKey && record.scope === item.scope,
          );
          if (index >= 0) {
            records[index] = item;
            continue;
          }

          records.push(item);
        }
      },
      async deleteScopes(scopes) {
        for (const scope of scopes) {
          const index = records.findIndex((record) => record.scope === scope);
          if (index >= 0) {
            records.splice(index, 1);
          }
        }
      },
    },
  };
}

describe('available days cache service', () => {
  it('stores a snapshot as sharded records and reconstructs it on read', async () => {
    const memory = createMemoryStore();

    const snapshot = await refreshAvailableDaysSnapshot(
      {
        days: [
          {
            dayId: 'day-1',
            date: '2026-04-20',
            type: 'track_day',
            circuit: 'Donington Park',
            provider: 'MSV Car Trackdays',
            description: 'National • Evening',
            source: {
              sourceType: 'trackdays',
              sourceName: 'msv-trackday',
            },
          },
          {
            dayId: 'day-2',
            date: '2026-04-21',
            type: 'test_day',
            circuit: 'Silverstone',
            provider: 'Silverstone',
            description: 'Open pit lane',
            source: {
              sourceType: 'testing',
              sourceName: 'silverstone',
              externalId: 'silverstone-1',
            },
          },
        ],
        errors: [{ source: 'testing', message: 'Delayed feed' }],
      },
      memory.store,
    );

    expect(snapshot.days).toHaveLength(2);
    expect(memory.records.map((record) => record.scope).sort()).toEqual([
      'day#day-1',
      'day#day-2',
      'meta',
    ]);

    const reloaded = await getAvailableDaysSnapshot(memory.store);
    expect(reloaded).toEqual(snapshot);
  });

  it('can still read the legacy single-record snapshot format', async () => {
    const memory = createMemoryStore([
      {
        cacheKey: 'available-days',
        scope: 'current',
        refreshedAt: '2026-04-15T20:00:00.000Z',
        payload: JSON.stringify({
          days: [
            {
              dayId: 'legacy-day',
              date: '2026-05-10',
              type: 'race_day',
              circuit: 'Snetterton',
              provider: 'Caterham Motorsport',
              description: 'Academy',
              source: {
                sourceType: 'caterham',
                sourceName: 'caterham',
              },
            },
          ],
          errors: [],
        }),
      } as AvailableDaysCacheRecord,
    ]);

    const snapshot = await getAvailableDaysSnapshot(memory.store);

    expect(snapshot).toEqual({
      days: [
        {
          dayId: 'legacy-day',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Snetterton',
          provider: 'Caterham Motorsport',
          description: 'Academy',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
          },
        },
      ],
      errors: [],
      refreshedAt: '2026-04-15T20:00:00.000Z',
    });
  });

  it('ignores day shards from older refresh generations', async () => {
    const memory = createMemoryStore([
      {
        cacheKey: 'available-days',
        scope: 'meta',
        refreshedAt: '2026-04-20T20:00:00.000Z',
        payload: JSON.stringify({ errors: [] }),
      } as AvailableDaysCacheRecord,
      {
        cacheKey: 'available-days',
        scope: 'day#current-day',
        refreshedAt: '2026-04-20T20:00:00.000Z',
        payload: JSON.stringify({
          dayId: 'current-day',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Snetterton',
          provider: 'Caterham Motorsport',
          description: 'Academy',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
          },
        }),
      } as AvailableDaysCacheRecord,
      {
        cacheKey: 'available-days',
        scope: 'day#stale-day',
        refreshedAt: '2026-04-19T20:00:00.000Z',
        payload: JSON.stringify({
          dayId: 'stale-day',
          date: '2026-05-09',
          type: 'track_day',
          circuit: 'Brands Hatch',
          provider: 'MSV Trackdays',
          description: 'Stale event',
          source: {
            sourceType: 'trackdays',
            sourceName: 'msv',
          },
        }),
      } as AvailableDaysCacheRecord,
    ]);

    const snapshot = await getAvailableDaysSnapshot(memory.store);

    expect(snapshot?.days.map((day) => day.dayId)).toEqual(['current-day']);
  });
});
