import { describe, expect, it, vi } from 'vitest';

vi.mock('../entities/feed-change.server', () => ({
  FeedChangeEntity: {},
}));

import type { AvailableDay } from '~/lib/days/types';
import type { FeedChangeRecord } from '../entities/feed-change.server';
import {
  diffAvailableDays,
  type FeedChangePersistence,
  listRecentFeedChanges,
  recordFeedChanges,
} from './feed-change.server';

const baseDay: AvailableDay = {
  dayId: 'day-1',
  date: '2026-05-01',
  type: 'track_day',
  circuit: 'Silverstone',
  provider: 'MSV Trackdays',
  description: 'Open pit lane',
  source: {
    sourceType: 'trackdays',
    sourceName: 'msv-trackday',
  },
};

function createMemoryStore() {
  const items: FeedChangeRecord[] = [];
  const store: FeedChangePersistence = {
    async putMany(records) {
      items.push(...records);
    },
    async listAll() {
      return items;
    },
  };

  return { items, store };
}

describe('feed change service', () => {
  it('detects added, changed, and removed days', () => {
    const changes = diffAvailableDays(
      [
        baseDay,
        {
          ...baseDay,
          dayId: 'removed-day',
          date: '2026-05-02',
        },
      ],
      [
        {
          ...baseDay,
          date: '2026-05-03',
          description: 'Updated format',
        },
        {
          ...baseDay,
          dayId: 'added-day',
          date: '2026-05-04',
        },
      ],
      'refresh-1',
      '2026-04-28T10:00:00.000Z',
    );

    expect(
      changes.map((change) => ({
        dayId: change.dayId,
        changeType: change.changeType,
        changedFields: change.changedFields,
        severity: change.severity,
      })),
    ).toEqual([
      {
        dayId: 'removed-day',
        changeType: 'removed',
        changedFields: [],
        severity: 'warning',
      },
      {
        dayId: 'day-1',
        changeType: 'changed',
        changedFields: ['date', 'description'],
        severity: 'warning',
      },
      {
        dayId: 'added-day',
        changeType: 'added',
        changedFields: [],
        severity: 'info',
      },
    ]);
  });

  it('persists and lists recent changes newest first', async () => {
    const memory = createMemoryStore();
    const changes = diffAvailableDays(
      [baseDay],
      [{ ...baseDay, provider: 'Updated Provider' }],
      'refresh-1',
      '2026-04-28T10:00:00.000Z',
    );

    await recordFeedChanges(changes, memory.store);

    await expect(listRecentFeedChanges(1, memory.store)).resolves.toEqual(
      changes,
    );
  });
});
