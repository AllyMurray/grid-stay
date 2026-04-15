import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import {
  type DayAttendanceOverview,
  dayAttendanceSummaryStore,
} from '~/lib/db/services/day-attendance-summary.server';
import { filterAvailableDays } from './aggregation.server';
import type { AvailableDay, AvailableDayType, DaySourceError } from './types';

export const DAYS_PAGE_SIZE = 30;

export interface DayBookingSnapshot {
  bookingId: string;
  status: 'booked' | 'maybe' | 'cancelled';
}

export interface DayRow {
  dayId: string;
  date: string;
  type: 'race_day' | 'test_day' | 'track_day';
  circuit: string;
  provider: string;
  description: string;
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
  monthOptions: string[];
  circuitOptions: string[];
  providerOptions: string[];
  myBookingsByDay: Record<string, DayBookingSnapshot>;
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

function getFilters(url: URL): DaysFilters {
  return {
    month: url.searchParams.get('month')?.trim() ?? '',
    circuit: url.searchParams.get('circuit')?.trim() ?? '',
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

async function loadFilteredDays(url: URL) {
  const snapshot = await getAvailableDaysSnapshot();
  const filters = getFilters(url);
  const raw = snapshot ?? {
    days: [],
    errors: EMPTY_ERRORS,
  };
  const filteredDays = filterAvailableDays(raw.days, {
    month: filters.month || undefined,
    circuit: filters.circuit || undefined,
    provider: filters.provider || undefined,
    type: parseType(filters.type),
  });

  return {
    filters,
    errors: raw.errors,
    refreshedAt: snapshot?.refreshedAt ?? '',
    filteredDays,
    monthOptions: [...new Set(raw.days.map((day) => day.date.slice(0, 7)))],
    circuitOptions: [...new Set(raw.days.map((day) => day.circuit))].sort(),
    providerOptions: [...new Set(raw.days.map((day) => day.provider))].sort(),
  };
}

async function loadDaysFeedPage(
  filteredDays: AvailableDay[],
  filters: DaysFilters,
  offset: number,
): Promise<DaysFeedData> {
  const pageDays = filteredDays.slice(offset, offset + DAYS_PAGE_SIZE);
  const summaries = await dayAttendanceSummaryStore.getByDayIds(
    pageDays.map((day) => day.dayId),
  );

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
      [...summaries.entries()].map(([dayId, summary]) => [
        dayId,
        {
          attendeeCount: summary.attendeeCount,
          accommodationNames: summary.accommodationNames,
        },
      ]),
    ),
  };
}

export async function loadDaysIndex(
  userId: string,
  url: URL,
): Promise<DaysIndexData> {
  const [
    {
      filters,
      errors,
      refreshedAt,
      filteredDays,
      monthOptions,
      circuitOptions,
      providerOptions,
    },
    myBookings,
  ] = await Promise.all([loadFilteredDays(url), listMyBookings(userId)]);
  const page = await loadDaysFeedPage(filteredDays, filters, 0);

  return {
    ...page,
    errors,
    filters,
    refreshedAt,
    monthOptions,
    circuitOptions,
    providerOptions,
    myBookingsByDay: Object.fromEntries(
      myBookings.map((booking) => [
        booking.dayId,
        {
          bookingId: booking.bookingId,
          status: booking.status,
        },
      ]),
    ),
  };
}

export async function loadDaysFeed(url: URL): Promise<DaysFeedData> {
  const { filters, filteredDays } = await loadFilteredDays(url);
  return loadDaysFeedPage(
    filteredDays,
    filters,
    getOffset(url.searchParams.get('offset')),
  );
}
