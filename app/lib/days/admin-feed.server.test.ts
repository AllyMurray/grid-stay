import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/feed-change.server', () => ({
  listRecentFeedChanges: vi.fn(async () => []),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

import { loadAdminFeedStatusReport } from './admin-feed.server';
import type { AvailableDay } from './types';

function createDay(
  overrides: Partial<AvailableDay> & Pick<AvailableDay, 'dayId' | 'date'>,
): AvailableDay {
  return {
    dayId: overrides.dayId,
    date: overrides.date,
    type: overrides.type ?? 'track_day',
    circuit: overrides.circuit ?? 'Snetterton',
    provider: overrides.provider ?? 'MSV Trackdays',
    description: overrides.description ?? 'Open pit lane',
    source: overrides.source ?? {
      sourceType: 'trackdays',
      sourceName: 'msv-trackday',
    },
  };
}

describe('loadAdminFeedStatusReport', () => {
  it('summarizes snapshot and manual-day source health', async () => {
    const report = await loadAdminFeedStatusReport(
      async () => ({
        refreshedAt: '2026-04-27T08:00:00.000Z',
        errors: [],
        days: [
          createDay({ dayId: 'track-1', date: '2026-05-10' }),
          createDay({
            dayId: 'race-1',
            date: '2026-05-12',
            source: {
              sourceType: 'caterham',
              sourceName: 'caterham',
            },
          }),
        ],
      }),
      async () => [
        createDay({
          dayId: 'manual-1',
          date: '2026-05-09',
          source: {
            sourceType: 'manual',
            sourceName: 'manual',
          },
        }),
      ],
      new Date('2026-04-27T12:00:00.000Z'),
    );

    expect(report).toMatchObject({
      refreshedAt: '2026-04-27T08:00:00.000Z',
      dayCount: 3,
      snapshotDayCount: 2,
      manualDayCount: 1,
      dateRange: {
        firstDate: '2026-05-09',
        lastDate: '2026-05-12',
      },
      health: {
        status: 'healthy',
      },
    });
    expect(report.sourceSummaries).toEqual([
      {
        key: 'caterham:caterham',
        label: 'caterham',
        sourceType: 'caterham',
        dayCount: 1,
      },
      {
        key: 'manual:manual',
        label: 'Manual days',
        sourceType: 'manual',
        dayCount: 1,
      },
      {
        key: 'trackdays:msv-trackday',
        label: 'msv-trackday',
        sourceType: 'trackdays',
        dayCount: 1,
      },
    ]);
    expect(report.recentChanges).toEqual([]);
  });

  it('marks old snapshots as stale', async () => {
    const report = await loadAdminFeedStatusReport(
      async () => ({
        refreshedAt: '2026-04-25T23:00:00.000Z',
        errors: [],
        days: [createDay({ dayId: 'track-1', date: '2026-05-10' })],
      }),
      async () => [],
      new Date('2026-04-27T12:00:00.000Z'),
    );

    expect(report.health).toEqual({
      status: 'stale',
      message: 'Last successful refresh is more than 36 hours old.',
    });
  });

  it('returns a missing snapshot error before the first refresh', async () => {
    const report = await loadAdminFeedStatusReport(
      async () => null,
      async () => [],
      new Date('2026-04-27T12:00:00.000Z'),
    );

    expect(report.health.status).toBe('empty');
    expect(report.sourceErrors).toEqual([
      {
        source: 'cache',
        message:
          'Available days have not been refreshed yet. Please try again after the next scheduled sync.',
      },
    ]);
  });
});
