import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/db/services/available-days-cache.server', () => ({
  getAvailableDaysSnapshot: vi.fn(),
}));

vi.mock('~/lib/db/services/manual-day.server', () => ({
  listManualDaysForUser: vi.fn(),
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
import { listManualDaysForUser } from '~/lib/db/services/manual-day.server';
import { loadDaysIndex } from './dashboard-feed.server';

describe('days dashboard feed', () => {
  beforeEach(() => {
    vi.mocked(getAvailableDaysSnapshot).mockReset();
    vi.mocked(listManualDaysForUser).mockReset();
    vi.mocked(listMyBookings).mockReset();
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockReset();
  });

  it('merges private manual days into the owner feed without using the scrape cache for them', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
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
    vi.mocked(listManualDaysForUser).mockResolvedValue([
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
        email: 'allymurray88@gmail.com',
      },
      new URL('https://gridstay.app/dashboard/days'),
    );

    expect(data.canCreateManualDays).toBe(true);
    expect(data.totalCount).toBe(2);
    expect(data.days.map((day) => day.dayId)).toEqual(['race:1', 'manual:1']);
    expect(data.circuitOptions).toEqual(['Donington Park', 'Snetterton']);
    expect(data.providerOptions).toEqual(['Caterham Motorsport']);
  });
});
