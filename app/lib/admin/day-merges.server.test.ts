import { describe, expect, it, vi } from 'vitest';
import type { AvailableDay } from '~/lib/days/types';
import type { DayMergeRecord } from '~/lib/db/entities/day-merge.server';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/day-merge.server', () => ({
  deleteDayMerge: vi.fn(),
  listDayMerges: vi.fn(),
  migrateMergedDayData: vi.fn(),
  upsertDayMerge: vi.fn(),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

import {
  loadAdminDayMergesReport,
  submitAdminDayMergeAction,
} from './day-merges.server';

const sourceDay: AvailableDay = {
  dayId: 'source-day',
  date: '2026-05-10',
  type: 'race_day',
  circuit: 'Snetterton',
  provider: 'Caterham Motorsport',
  description: 'Duplicate',
  source: { sourceType: 'caterham', sourceName: 'caterham' },
};

const targetDay: AvailableDay = {
  ...sourceDay,
  dayId: 'target-day',
  description: 'Canonical',
};

describe('admin day merge helpers', () => {
  it('loads merge options with labels', async () => {
    const report = await loadAdminDayMergesReport(
      async () => ({
        days: [sourceDay, targetDay],
        errors: [],
        refreshedAt: '2026-04-27T10:00:00.000Z',
      }),
      async () => [],
      async () => [
        {
          sourceDayId: 'source-day',
          targetDayId: 'target-day',
          mergeScope: 'day-merge',
          createdByUserId: 'admin-1',
          createdAt: '2026-04-27T10:00:00.000Z',
          updatedAt: '2026-04-27T10:00:00.000Z',
        } as DayMergeRecord,
      ],
    );

    expect(report.days).toHaveLength(2);
    expect(report.merges[0]).toMatchObject({
      sourceLabel: expect.stringContaining('Duplicate'),
      targetLabel: expect.stringContaining('Canonical'),
    });
  });

  it('saves a merge and migrates existing data', async () => {
    const formData = new FormData();
    formData.set('intent', 'saveMerge');
    formData.set('sourceDayId', 'source-day');
    formData.set('targetDayId', 'target-day');

    const saveMerge = vi.fn(async () => ({}));
    const migrate = vi.fn(async () => ({
      movedBookingCount: 1,
      mergedBookingCount: 0,
      movedPlan: true,
    }));

    const result = await submitAdminDayMergeAction(
      formData,
      { id: 'admin-1' },
      {
        loadSnapshot: async () => ({
          days: [sourceDay, targetDay],
          errors: [],
          refreshedAt: '2026-04-27T10:00:00.000Z',
        }),
        loadManualDays: async () => [],
        saveMerge: saveMerge as never,
        migrate: migrate as never,
      },
    );

    expect(result).toEqual({
      ok: true,
      message: 'Day merge saved and existing plans migrated.',
      movedBookingCount: 1,
      mergedBookingCount: 0,
      movedPlan: true,
    });
    expect(saveMerge).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDayId: 'source-day',
        targetDayId: 'target-day',
      }),
      { id: 'admin-1' },
    );
    expect(migrate).toHaveBeenCalledWith(
      'source-day',
      expect.objectContaining({
        dayId: 'target-day',
        circuit: 'Snetterton',
      }),
    );
  });

  it('rejects merges to the same day', async () => {
    const formData = new FormData();
    formData.set('intent', 'saveMerge');
    formData.set('sourceDayId', 'source-day');
    formData.set('targetDayId', 'source-day');

    const result = await submitAdminDayMergeAction(formData, { id: 'admin-1' });

    expect(result).toMatchObject({
      ok: false,
      formError: 'Choose two different days.',
    });
  });
});
