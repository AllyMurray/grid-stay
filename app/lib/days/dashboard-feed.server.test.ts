import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDays: vi.fn(),
}));

vi.mock('~/lib/db/services/booking.server', () => ({
  listAttendanceByDay: vi.fn(),
  listMyBookings: vi.fn(),
}));

vi.mock('~/lib/db/services/day-attendance-summary.server', () => ({
  dayAttendanceSummaryStore: {
    getByDayIds: vi.fn(),
  },
}));

vi.mock('~/lib/days/series.server', async () => {
  const actual =
    await vi.importActual<typeof import('./series.server')>('./series.server');

  return {
    ...actual,
    buildRaceSeriesSummaryByDayId: vi.fn(() => ({})),
  };
});

import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { dayAttendanceSummaryStore } from '~/lib/db/services/day-attendance-summary.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { loadDaysIndex } from './dashboard-feed.server';

describe('days dashboard feed', () => {
  beforeEach(() => {
    vi.mocked(getAvailableDaysSnapshot).mockReset();
    vi.mocked(listManualDays).mockReset();
    vi.mocked(listMyBookings).mockReset();
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockReset();
  });

  it('merges shared manual days into every member feed while keeping admin creation separate', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [
        {
          source: 'broken-testing',
          message: 'Timed out loading feed',
        },
      ],
      days: [
        {
          dayId: 'race:1',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Snetterton',
          provider: 'Caterham Motorsport',
          description: 'Round 1',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
          },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([
      {
        dayId: 'manual:1',
        date: '2026-05-12',
        type: 'track_day',
        circuit: 'Donington Park',
        provider: 'Caterham Motorsport',
        description: 'Pre-season track day',
        bookingUrl: 'https://example.com/pre-season',
        source: {
          sourceType: 'manual',
          sourceName: 'manual',
          externalId: 'manual-1',
        },
      },
    ]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(
      new Map(),
    );

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days'),
    );

    expect(data.canCreateManualDays).toBe(false);
    expect('errors' in data).toBe(false);
    expect(data.totalCount).toBe(2);
    expect(data.days.map((day) => day.dayId)).toEqual(['race:1', 'manual:1']);
    expect(data.circuitOptions).toEqual(['Donington Park', 'Snetterton']);
    expect(data.providerOptions).toEqual(['Caterham Motorsport']);
  });

  it('filters the member feed by multiple circuit query values', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'brands',
          date: '2026-05-10',
          type: 'track_day',
          circuit: 'Brands Hatch Indy',
          provider: 'MSV Trackdays',
          description: 'Evening session',
          source: {
            sourceType: 'trackdays',
            sourceName: 'msv-trackday',
          },
        },
        {
          dayId: 'snetterton',
          date: '2026-05-11',
          type: 'race_day',
          circuit: 'Snetterton',
          provider: 'Caterham Motorsport',
          description: 'Round 1',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
          },
        },
        {
          dayId: 'silverstone',
          date: '2026-05-12',
          type: 'test_day',
          circuit: 'Silverstone',
          provider: 'Silverstone',
          description: 'Test day',
          source: {
            sourceType: 'testing',
            sourceName: 'silverstone',
          },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(
      new Map(),
    );

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL(
        'https://gridstay.app/dashboard/days?circuit=Silverstone&circuit=Brands%20Hatch',
      ),
    );

    expect(data.filters.circuits).toEqual(['Brands Hatch', 'Silverstone']);
    expect(data.filterKey).toBe('circuit=Brands+Hatch&circuit=Silverstone');
    expect(data.totalCount).toBe(2);
    expect(data.days.map((day) => day.dayId)).toEqual([
      'brands',
      'silverstone',
    ]);
  });
});
