import type { User } from '~/lib/auth/schemas';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  listAttendanceByDay,
  listMyBookings,
} from '~/lib/db/services/booking.server';
import {
  type DayAttendanceOverview,
  dayAttendanceSummaryStore,
} from '~/lib/db/services/day-attendance-summary.server';
import { listManualDaysForUser } from '~/lib/db/services/manual-day.server';
import {
  filterAvailableDays,
  listCircuitOptions,
  normalizeCircuitName,
} from './aggregation.server';
import { canCreateManualDays } from './manual-days.server';
import {
  buildRaceSeriesSummaryByDayId,
  type RaceSeriesSummary,
} from './series.server';
import type {
  AvailableDay,
  AvailableDayType,
  DayAttendanceSummary,
  DaySourceError,
} from './types';

export const DAYS_PAGE_SIZE = 30;

export interface DayBookingSnapshot {
  bookingId: string;
  status: 'booked' | 'maybe' | 'cancelled';
  accommodationName?: string;
}

export interface DayRow {
  dayId: string;
  date: string;
  type: 'race_day' | 'test_day' | 'track_day';
  circuit: string;
  provider: string;
  description: string;
  bookingUrl?: string;
}

export interface DaysFilters {
  month: string;
  circuit: string;
  provider: string;
  type: string;
}

export interface DaysFeedData {
  filterKey: string;
  offset: number;
  totalCount: number;
  nextOffset: number | null;
  days: DayRow[];
  attendanceSummaries: Record<string, DayAttendanceOverview>;
}

export interface DaysIndexData extends DaysFeedData {
  errors: DaySourceError[];
  filters: DaysFilters;
  refreshedAt: string;
  canCreateManualDays: boolean;
  monthOptions: string[];
  circuitOptions: string[];
  providerOptions: string[];
  raceSeriesByDayId: Record<string, RaceSeriesSummary>;
  myBookingsByDay: Record<string, DayBookingSnapshot>;
  selectedDay: DayRow | null;
  selectedDayPosition: number | null;
  selectedDayPrevious: DayRow | null;
  selectedDayNext: DayRow | null;
  selectedDaySummary: DayAttendanceOverview | null;
  selectedDayAttendance: DayAttendanceSummary | null;
}

const EMPTY_ERRORS: DaySourceError[] = [
  {
    source: 'cache',
    message:
      'Available days have not been refreshed yet. Please try again after the next scheduled sync.',
  },
];

function toDayRow(day: AvailableDay): DayRow {
  return {
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    circuit: day.circuit,
    provider: day.provider,
    description: day.description,
    bookingUrl: day.bookingUrl,
  };
}

function compareAvailableDays(left: AvailableDay, right: AvailableDay) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  if (left.circuit !== right.circuit) {
    return left.circuit.localeCompare(right.circuit);
  }

  if (left.provider !== right.provider) {
    return left.provider.localeCompare(right.provider);
  }

  return left.dayId.localeCompare(right.dayId);
}

function combineAttendanceOverviews(
  overviews: Array<DayAttendanceOverview | undefined>,
): DayAttendanceOverview {
  return {
    attendeeCount: overviews.reduce(
      (count, overview) => count + (overview?.attendeeCount ?? 0),
      0,
    ),
    accommodationNames: [
      ...new Set(
        overviews.flatMap((overview) => overview?.accommodationNames ?? []),
      ),
    ].sort(),
  };
}

function parseType(value: string): AvailableDayType | undefined {
  switch (value) {
    case 'race_day':
    case 'test_day':
    case 'track_day':
      return value;
    default:
      return undefined;
  }
}

function getOffset(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function getSelectedDayId(url: URL): string | null {
  const selectedDayId = url.searchParams.get('day')?.trim() ?? '';
  return selectedDayId || null;
}

function getFilters(url: URL): DaysFilters {
  return {
    month: url.searchParams.get('month')?.trim() ?? '',
    circuit: normalizeCircuitName(
      url.searchParams.get('circuit')?.trim() ?? '',
    ),
    provider: url.searchParams.get('provider')?.trim() ?? '',
    type: url.searchParams.get('type')?.trim() ?? '',
  };
}

export function createDaysFilterKey(filters: DaysFilters): string {
  const params = new URLSearchParams();
  if (filters.month) {
    params.set('month', filters.month);
  }
  if (filters.circuit) {
    params.set('circuit', filters.circuit);
  }
  if (filters.provider) {
    params.set('provider', filters.provider);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }

  return params.toString();
}

async function loadFilteredDays(userId: string, url: URL) {
  const [snapshot, manualDays] = await Promise.all([
    getAvailableDaysSnapshot(),
    listManualDaysForUser(userId),
  ]);
  const filters = getFilters(url);
  const raw = snapshot ?? {
    days: [],
    errors: EMPTY_ERRORS,
  };
  const allDays = [...raw.days, ...manualDays].sort(compareAvailableDays);
  const filteredDays = filterAvailableDays(allDays, {
    month: filters.month || undefined,
    circuit: filters.circuit || undefined,
    provider: filters.provider || undefined,
    type: parseType(filters.type),
  }).sort(compareAvailableDays);

  return {
    allDays,
    filters,
    errors: raw.errors,
    refreshedAt: snapshot?.refreshedAt ?? '',
    filteredDays,
    monthOptions: [
      ...new Set(allDays.map((day) => day.date.slice(0, 7))),
    ].sort(),
    circuitOptions: listCircuitOptions(allDays),
    providerOptions: [...new Set(allDays.map((day) => day.provider))].sort(),
  };
}

async function loadDaysFeedPage(
  filteredDays: AvailableDay[],
  filters: DaysFilters,
  offset: number,
): Promise<DaysFeedData> {
  const pageDays = filteredDays.slice(offset, offset + DAYS_PAGE_SIZE);
  const summaryKeys = pageDays.map((day) => day.dayId);
  const summaries = await dayAttendanceSummaryStore.getByDayIds(summaryKeys);

  return {
    filterKey: createDaysFilterKey(filters),
    offset,
    totalCount: filteredDays.length,
    nextOffset:
      offset + DAYS_PAGE_SIZE < filteredDays.length
        ? offset + DAYS_PAGE_SIZE
        : null,
    days: pageDays.map(toDayRow),
    attendanceSummaries: Object.fromEntries(
      pageDays.map((day) => [
        day.dayId,
        combineAttendanceOverviews([summaries.get(day.dayId)]),
      ]),
    ),
  };
}

export async function loadDaysIndex(
  user: Pick<User, 'id' | 'email'>,
  url: URL,
): Promise<DaysIndexData> {
  const selectedDayId = getSelectedDayId(url);
  const [
    {
      allDays,
      filters,
      errors,
      refreshedAt,
      filteredDays,
      monthOptions,
      circuitOptions,
      providerOptions,
    },
    myBookings,
  ] = await Promise.all([
    loadFilteredDays(user.id, url),
    listMyBookings(user.id),
  ]);
  const raceSeriesByDayId = buildRaceSeriesSummaryByDayId(
    allDays,
    myBookings.map((booking) => booking.dayId),
  );
  const page = await loadDaysFeedPage(filteredDays, filters, 0);
  const visibleDayIds = new Set(filteredDays.map((day) => day.dayId));
  const selectedDayRecord = selectedDayId
    ? (filteredDays.find((day) => day.dayId === selectedDayId) ?? null)
    : null;
  const selectedDayIndex = selectedDayRecord
    ? filteredDays.findIndex((day) => day.dayId === selectedDayRecord.dayId)
    : -1;
  let selectedDaySummary: DayAttendanceOverview | null = null;
  let selectedDayAttendance: DayAttendanceSummary | null = null;

  if (selectedDayRecord) {
    selectedDayAttendance = await listAttendanceByDay(selectedDayRecord.dayId);
    selectedDaySummary = {
      attendeeCount: selectedDayAttendance.attendeeCount,
      accommodationNames: selectedDayAttendance.accommodationNames,
    };
  }

  return {
    ...page,
    errors,
    filters,
    refreshedAt,
    canCreateManualDays: canCreateManualDays(user),
    monthOptions,
    circuitOptions,
    providerOptions,
    raceSeriesByDayId,
    myBookingsByDay: Object.fromEntries(
      myBookings.flatMap((booking) => {
        if (!visibleDayIds.has(booking.dayId)) {
          return [];
        }

        return [
          [
            booking.dayId,
            {
              bookingId: booking.bookingId,
              status: booking.status,
              accommodationName: booking.accommodationName,
            },
          ],
        ];
      }),
    ),
    selectedDay: selectedDayRecord ? toDayRow(selectedDayRecord) : null,
    selectedDayPosition: selectedDayRecord ? selectedDayIndex + 1 : null,
    selectedDayPrevious:
      selectedDayIndex > 0
        ? toDayRow(filteredDays[selectedDayIndex - 1]!)
        : null,
    selectedDayNext:
      selectedDayIndex >= 0 && selectedDayIndex < filteredDays.length - 1
        ? toDayRow(filteredDays[selectedDayIndex + 1]!)
        : null,
    selectedDaySummary,
    selectedDayAttendance,
  };
}

export async function loadDaysFeed(
  user: Pick<User, 'id'>,
  url: URL,
): Promise<DaysFeedData> {
  const { filters, filteredDays } = await loadFilteredDays(user.id, url);
  return loadDaysFeedPage(
    filteredDays,
    filters,
    getOffset(url.searchParams.get('offset')),
  );
}
