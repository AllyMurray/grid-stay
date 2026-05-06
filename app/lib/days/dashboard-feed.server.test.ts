import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

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

vi.mock('~/lib/db/services/cost-splitting.server', () => ({
  loadEventCostSummary: vi.fn(async (dayId: string) => ({
    dayId,
    currency: 'GBP',
    availableParticipants: [],
    groups: [],
    netSettlements: [],
    totalPence: 0,
  })),
}));

vi.mock('~/lib/db/services/circuit-distance-matrix.server', () => ({
  loadCircuitDistanceMatrix: vi.fn(),
}));

vi.mock('~/lib/days/series.server', async () => {
  const actual = await vi.importActual<typeof import('./series.server')>('./series.server');

  return {
    ...actual,
    buildRaceSeriesSummaryByDayId: vi.fn(() => ({})),
  };
});

vi.mock('~/lib/days/preferences.server', () => ({
  getSavedDaysFilters: vi.fn(),
}));

vi.mock('~/lib/days/shared-plan.server', () => ({
  getSharedDayPlan: vi.fn(),
}));

import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listAttendanceByDay, listMyBookings } from '~/lib/db/services/booking.server';
import { loadCircuitDistanceMatrix } from '~/lib/db/services/circuit-distance-matrix.server';
import { dayAttendanceSummaryStore } from '~/lib/db/services/day-attendance-summary.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { loadDaysIndex, loadUpcomingAvailableDaysOverview } from './dashboard-feed.server';
import { getSavedDaysFilters } from './preferences.server';
import { getSharedDayPlan } from './shared-plan.server';

describe('days dashboard feed', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T12:00:00.000Z'));
    vi.mocked(getAvailableDaysSnapshot).mockReset();
    vi.mocked(listManualDays).mockReset();
    vi.mocked(listAttendanceByDay).mockReset();
    vi.mocked(listAttendanceByDay).mockResolvedValue({
      attendeeCount: 0,
      accommodationNames: [],
      attendees: [],
    });
    vi.mocked(listMyBookings).mockReset();
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockReset();
    vi.mocked(loadCircuitDistanceMatrix).mockReset();
    vi.mocked(loadCircuitDistanceMatrix).mockResolvedValue({
      status: 'missing',
      matrix: null,
    });
    vi.mocked(getSavedDaysFilters).mockReset();
    vi.mocked(getSavedDaysFilters).mockResolvedValue(null);
    vi.mocked(getSharedDayPlan).mockReset();
    vi.mocked(getSharedDayPlan).mockResolvedValue(null);
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
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());

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
    expect(data.days[1]).toMatchObject({
      circuitId: 'donington-park',
      circuitName: 'Donington Park',
      circuitKnown: true,
    });
    expect(data.circuitOptions).toEqual(['Donington Park', 'Snetterton']);
    expect(data.providerOptions).toEqual(['Caterham Motorsport']);
  });

  it('loads overview available days from the same future merged source', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'past:1',
          date: '2026-05-01',
          type: 'track_day',
          circuit: 'Past Circuit',
          provider: 'MSV',
          description: 'Past day',
          source: {
            sourceType: 'trackdays',
            sourceName: 'MSV',
          },
        },
        {
          dayId: 'future:1',
          date: '2026-05-10',
          type: 'track_day',
          circuit: 'Sntterton 300',
          provider: 'MSV',
          description: 'Future day',
          source: {
            sourceType: 'trackdays',
            sourceName: 'MSV',
          },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([
      {
        dayId: 'manual:1',
        date: '2026-05-05',
        type: 'road_drive',
        circuit: 'North Coast',
        provider: 'Grid Stay',
        description: 'Group drive',
        source: {
          sourceType: 'manual',
          sourceName: 'manual',
        },
      },
    ]);

    const overview = await loadUpcomingAvailableDaysOverview();

    expect(overview.days.map((day) => day.dayId)).toEqual(['manual:1', 'future:1']);
    expect(overview.days.map((day) => day.circuit)).toEqual(['North Coast', 'Snetterton']);
  });

  it('returns saved available-days filters for the signed-in member', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
      days: [],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());
    vi.mocked(getSavedDaysFilters).mockResolvedValue({
      month: '2026-05',
      series: 'caterham-academy',
      circuits: ['Snetterton'],
      provider: 'Caterham Motorsport',
      type: 'race_day',
      notifyOnNewMatches: true,
      externalChannel: '',
    });

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days'),
    );

    expect(getSavedDaysFilters).toHaveBeenCalledWith('user-1');
    expect(data.savedFilters).toEqual({
      month: '2026-05',
      series: 'caterham-academy',
      circuits: ['Snetterton'],
      provider: 'Caterham Motorsport',
      type: 'race_day',
      notifyOnNewMatches: true,
      externalChannel: '',
    });
  });

  it('hides past days by default and restores them with the show-past flag', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'past-day',
          date: '2026-04-10',
          type: 'track_day',
          circuit: 'Brands Hatch',
          provider: 'Past Provider',
          description: 'Already happened',
          source: {
            sourceType: 'trackdays',
            sourceName: 'past-source',
          },
        },
        {
          dayId: 'future-day',
          date: '2026-06-08',
          type: 'track_day',
          circuit: 'Silverstone',
          provider: 'Future Provider',
          description: 'Open pit lane',
          source: {
            sourceType: 'trackdays',
            sourceName: 'future-source',
          },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());

    const defaultData = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days'),
    );
    const showPastData = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days?showPast=true'),
    );

    expect(defaultData.days.map((day) => day.dayId)).toEqual(['future-day']);
    expect(defaultData.totalCount).toBe(1);
    expect(defaultData.monthOptions).toEqual(['2026-06']);
    expect(showPastData.days.map((day) => day.dayId)).toEqual(['past-day', 'future-day']);
    expect(showPastData.totalCount).toBe(2);
    expect(showPastData.filters.showPast).toBe(true);
    expect(showPastData.monthOptions).toEqual(['2026-04', '2026-06']);
  });

  it('loads planner rows and journey state for the planner view', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'day-1',
          date: '2026-06-08',
          type: 'track_day',
          circuit: 'Silverstone',
          provider: 'Provider One',
          description: 'Open pit lane',
          source: {
            sourceType: 'trackdays',
            sourceName: 'source-one',
          },
        },
        {
          dayId: 'day-2',
          date: '2026-06-09',
          type: 'track_day',
          circuit: 'Donington Park',
          provider: 'Provider Two',
          description: 'Open pit lane',
          source: {
            sourceType: 'trackdays',
            sourceName: 'source-two',
          },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());
    vi.mocked(loadCircuitDistanceMatrix).mockResolvedValue({
      status: 'ready',
      matrix: {
        provider: 'openrouteservice',
        profile: 'driving-car',
        updatedAt: '2026-05-01T10:00:00.000Z',
        circuitIds: ['silverstone', 'donington-park'],
        attribution: 'ORS attribution',
        distances: {
          silverstone: {
            'donington-park': { miles: 55, durationMinutes: 70 },
          },
          'donington-park': {
            silverstone: { miles: 55, durationMinutes: 70 },
          },
        },
      },
    });

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL(
        'https://gridstay.app/dashboard/days?view=planner&start=2026-06-01&end=2026-06-30&maxMiles=100&plannerDay=day-1',
      ),
    );

    expect(data.view).toBe('planner');
    expect(data.calendarDays.map((day) => day.dayId)).toEqual(['day-1', 'day-2']);
    expect(data.planner.stops.map((stop) => stop.day.dayId)).toEqual(['day-1', 'day-2']);
    expect(data.planner.selectedDayIds).toEqual([]);
    expect(data.planner.stops[0]?.selectedByUser).toBe(false);
    expect(data.planner.totalMiles).toBe(55);
    expect(loadCircuitDistanceMatrix).toHaveBeenCalledOnce();
  });

  it('defaults the planner range to a three-day window from the next matching day', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'past-day',
          date: '2026-04-10',
          type: 'track_day',
          circuit: 'Brands Hatch',
          provider: 'Past Provider',
          description: 'Already happened',
          source: {
            sourceType: 'trackdays',
            sourceName: 'past-source',
          },
        },
        {
          dayId: 'future-day-1',
          date: '2026-06-08',
          type: 'track_day',
          circuit: 'Silverstone',
          provider: 'Provider One',
          description: 'Open pit lane',
          source: {
            sourceType: 'trackdays',
            sourceName: 'source-one',
          },
        },
        {
          dayId: 'future-day-2',
          date: '2026-06-09',
          type: 'track_day',
          circuit: 'Donington Park',
          provider: 'Provider Two',
          description: 'Open pit lane',
          source: {
            sourceType: 'trackdays',
            sourceName: 'source-two',
          },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days?view=planner'),
    );

    expect(data.planner.start).toBe('2026-06-08');
    expect(data.planner.end).toBe('2026-06-11');
    expect(data.planner.candidateCount).toBe(2);
  });

  it('loads the selected day shared planning note', async () => {
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
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());
    vi.mocked(getSharedDayPlan).mockResolvedValue({
      dayId: 'race:1',
      notes: 'Meet in paddock bay 12.',
      dinnerVenue: '',
      dinnerTime: '',
      dinnerHeadcount: '',
      dinnerNotes: '',
      updatedByName: 'Driver One',
      updatedAt: '2026-04-27T10:00:00.000Z',
    });

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days?day=race%3A1'),
    );

    expect(getSharedDayPlan).toHaveBeenCalledWith('race:1');
    expect(data.selectedDayPlan).toEqual({
      dayId: 'race:1',
      notes: 'Meet in paddock bay 12.',
      dinnerVenue: '',
      dinnerTime: '',
      dinnerHeadcount: '',
      dinnerNotes: '',
      updatedByName: 'Driver One',
      updatedAt: '2026-04-27T10:00:00.000Z',
    });
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
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days?circuit=Silverstone&circuit=Brands%20Hatch'),
    );

    expect(data.filters.circuits).toEqual(['Brands Hatch', 'Silverstone']);
    expect(data.filterKey).toBe('circuit=Brands+Hatch&circuit=Silverstone');
    expect(data.totalCount).toBe(2);
    expect(data.days.map((day) => day.dayId)).toEqual(['brands', 'silverstone']);
  });

  it('builds current-year circuit options for the selected race series', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'academy-snetterton',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Snetterton',
          provider: 'Caterham Motorsport',
          description: 'Caterham Academy • Round 1',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
            metadata: { series: 'Caterham Academy' },
          },
        },
        {
          dayId: 'academy-brands',
          date: '2026-06-14',
          type: 'race_day',
          circuit: 'Brands Hatch Indy',
          provider: 'Caterham Motorsport',
          description: 'Caterham Academy • Round 2',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
            metadata: { series: 'Caterham Academy' },
          },
        },
        {
          dayId: 'roadsport-silverstone',
          date: '2026-05-24',
          type: 'race_day',
          circuit: 'Silverstone',
          provider: 'Caterham Motorsport',
          description: 'Caterham Roadsport • Round 1',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
            metadata: { series: 'Caterham Roadsport' },
          },
        },
        {
          dayId: 'academy-next-year',
          date: '2027-05-10',
          type: 'race_day',
          circuit: 'Oulton Park',
          provider: 'Caterham Motorsport',
          description: 'Caterham Academy • Round 1',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
            metadata: { series: 'Caterham Academy' },
          },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days?series=caterham-academy'),
    );

    expect(data.filters.series).toBe('caterham-academy');
    expect(data.filterKey).toBe('series=caterham-academy');
    expect(data.seriesOptions).toEqual([
      {
        value: 'caterham-academy',
        label: 'Caterham Academy',
        circuitOptions: ['Brands Hatch', 'Snetterton'],
      },
      {
        value: 'caterham-roadsport',
        label: 'Caterham Roadsport',
        circuitOptions: ['Silverstone'],
      },
    ]);
    expect(data.days.map((day) => day.dayId)).toEqual([
      'academy-snetterton',
      'academy-brands',
      'academy-next-year',
    ]);
  });

  it('consolidates cached Snetterton layout variants in options and rows', async () => {
    vi.mocked(getAvailableDaysSnapshot).mockResolvedValue({
      refreshedAt: '2026-04-17T09:30:00.000Z',
      errors: [],
      days: [
        {
          dayId: 'snetterton-layout',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Sntterton 300',
          provider: 'Caterham Motorsport',
          description: 'Caterham Academy • Round 1 - Sntterton 300',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
          },
        },
        {
          dayId: 'snetterton-base',
          date: '2026-05-11',
          type: 'race_day',
          circuit: 'Snetterton',
          provider: 'Caterham Motorsport',
          description: 'Caterham Academy • Round 2 - Snetterton',
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
          },
        },
      ],
    });
    vi.mocked(listManualDays).mockResolvedValue([]);
    vi.mocked(listMyBookings).mockResolvedValue([]);
    vi.mocked(dayAttendanceSummaryStore.getByDayIds).mockResolvedValue(new Map());

    const data = await loadDaysIndex(
      {
        id: 'user-1',
        email: 'driver@example.com',
        role: 'member',
      },
      new URL('https://gridstay.app/dashboard/days?circuit=Snetterton'),
    );

    expect(data.circuitOptions).toEqual(['Snetterton']);
    expect(data.totalCount).toBe(2);
    expect(data.days.map((day) => day.circuit)).toEqual(['Snetterton', 'Snetterton']);
    expect(data.days[0]?.description).toBe('Caterham Academy • Round 1 - Snetterton 300');
  });
});
