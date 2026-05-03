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
import { listManualDays } from '~/lib/db/services/manual-day.server';
import {
  filterAvailableDays,
  listCircuitOptions,
  normalizeAvailableDayCircuit,
  normalizeCircuitName,
} from './aggregation.server';
import { applyDayMerges, type DayMergeRule } from './day-merges';
import { canCreateManualDays } from './manual-days.server';
import {
  getSavedDaysFilters,
  type SavedDaysFilters,
} from './preferences.server';
import {
  buildRaceSeriesSummaryByDayId,
  getLinkedSeriesKey,
  getLinkedSeriesName,
  type RaceSeriesSummary,
} from './series.server';
import { getSharedDayPlan, type SharedDayPlan } from './shared-plan.server';
import type {
  AvailableDay,
  AvailableDayType,
  DayAttendanceSummary,
  DaySourceError,
} from './types';

export const DAYS_PAGE_SIZE = 30;

export interface DayBookingSnapshot {
  bookingId: string;
  userId: string;
  status: 'booked' | 'maybe' | 'cancelled';
  accommodationName?: string;
  garageBooked?: boolean;
  garageCapacity?: number;
  garageLabel?: string;
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
  series: string;
  circuits: string[];
  provider: string;
  type: '' | AvailableDayType;
}

export interface RaceSeriesFilterOption {
  value: string;
  label: string;
  circuitOptions: string[];
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
  filters: DaysFilters;
  refreshedAt: string;
  canCreateManualDays: boolean;
  monthOptions: string[];
  seriesOptions: RaceSeriesFilterOption[];
  circuitOptions: string[];
  providerOptions: string[];
  savedFilters: SavedDaysFilters | null;
  raceSeriesByDayId: Record<string, RaceSeriesSummary>;
  myBookingsByDay: Record<string, DayBookingSnapshot>;
  selectedDay: DayRow | null;
  selectedDayPosition: number | null;
  selectedDayPrevious: DayRow | null;
  selectedDayNext: DayRow | null;
  selectedDaySummary: DayAttendanceOverview | null;
  selectedDayAttendance: DayAttendanceSummary | null;
  selectedDayPlan: SharedDayPlan | null;
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
    garageOwnerCount: overviews.reduce(
      (count, overview) => count + (overview?.garageOwnerCount ?? 0),
      0,
    ),
    garageOpenSpaceCount: overviews.reduce(
      (count, overview) => count + (overview?.garageOpenSpaceCount ?? 0),
      0,
    ),
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

function getCircuitFilters(url: URL): string[] {
  const circuits = url.searchParams
    .getAll('circuit')
    .map((value) => normalizeCircuitName(value.trim()))
    .filter(Boolean);

  return [...new Set(circuits)].sort();
}

function getFilters(url: URL): DaysFilters {
  return {
    month: url.searchParams.get('month')?.trim() ?? '',
    series: url.searchParams.get('series')?.trim() ?? '',
    circuits: getCircuitFilters(url),
    provider: url.searchParams.get('provider')?.trim() ?? '',
    type: parseType(url.searchParams.get('type')?.trim() ?? '') ?? '',
  };
}

export function createDaysFilterKey(filters: DaysFilters): string {
  const params = new URLSearchParams();
  if (filters.month) {
    params.set('month', filters.month);
  }
  if (filters.series) {
    params.set('series', filters.series);
  }
  for (const circuit of filters.circuits) {
    params.append('circuit', circuit);
  }
  if (filters.provider) {
    params.set('provider', filters.provider);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }

  return params.toString();
}

function getCurrentSeriesYear(days: AvailableDay[]): string {
  return days.map((day) => day.date.slice(0, 4)).sort()[0] ?? '';
}

function listRaceSeriesOptions(days: AvailableDay[]): RaceSeriesFilterOption[] {
  const currentYear = getCurrentSeriesYear(days);
  const optionsByKey = new Map<
    string,
    { label: string; circuitOptions: Set<string> }
  >();

  for (const day of days) {
    if (currentYear && day.date.slice(0, 4) !== currentYear) {
      continue;
    }

    const seriesKey = getLinkedSeriesKey(day);
    const seriesName = getLinkedSeriesName(day);
    if (!seriesKey || !seriesName) {
      continue;
    }

    const current = optionsByKey.get(seriesKey);
    const circuit = normalizeCircuitName(day.circuit);
    if (current) {
      if (circuit) {
        current.circuitOptions.add(circuit);
      }
      continue;
    }

    optionsByKey.set(seriesKey, {
      label: seriesName,
      circuitOptions: circuit ? new Set([circuit]) : new Set(),
    });
  }

  return [...optionsByKey.entries()]
    .map(([value, option]) => ({
      value,
      label: option.label,
      circuitOptions: [...option.circuitOptions].sort(),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

async function loadFilteredDays(url: URL) {
  const [snapshot, manualDays, dayMerges] = await Promise.all([
    getAvailableDaysSnapshot(),
    listManualDays(),
    loadDayMergesSafely(),
  ]);
  const filters = getFilters(url);
  const raw = snapshot ?? {
    days: [],
    errors: EMPTY_ERRORS,
  };
  const allDays = applyDayMerges([...raw.days, ...manualDays], dayMerges)
    .map(normalizeAvailableDayCircuit)
    .sort(compareAvailableDays);
  const filteredDays = filterAvailableDays(allDays, {
    month: filters.month || undefined,
    series: filters.series || undefined,
    circuits: filters.circuits,
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
    seriesOptions: listRaceSeriesOptions(allDays),
    circuitOptions: listCircuitOptions(allDays),
    providerOptions: [...new Set(allDays.map((day) => day.provider))].sort(),
  };
}

async function loadDayMergesSafely(): Promise<DayMergeRule[]> {
  try {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return [];
    }

    const { listDayMergeRules } = await import(
      '~/lib/db/services/day-merge.server'
    );
    return listDayMergeRules();
  } catch (error) {
    console.error('Failed to load day merge rules', { error });
    return [];
  }
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
  user: Pick<User, 'id' | 'email' | 'role'>,
  url: URL,
): Promise<DaysIndexData> {
  const selectedDayId = getSelectedDayId(url);
  const [
    {
      allDays,
      filters,
      refreshedAt,
      filteredDays,
      monthOptions,
      seriesOptions,
      circuitOptions,
      providerOptions,
    },
    myBookings,
    savedFilters,
  ] = await Promise.all([
    loadFilteredDays(url),
    listMyBookings(user.id),
    getSavedDaysFilters(user.id),
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
  let selectedDayPlan: SharedDayPlan | null = null;

  if (selectedDayRecord) {
    [selectedDayAttendance, selectedDayPlan] = await Promise.all([
      listAttendanceByDay(
        selectedDayRecord.dayId,
        undefined,
        undefined,
        user.id,
      ),
      getSharedDayPlan(selectedDayRecord.dayId),
    ]);
    selectedDaySummary = {
      attendeeCount: selectedDayAttendance.attendeeCount,
      accommodationNames: selectedDayAttendance.accommodationNames,
      garageOwnerCount: selectedDayAttendance.garageOwnerCount ?? 0,
      garageOpenSpaceCount: selectedDayAttendance.garageOpenSpaceCount ?? 0,
    };
  }

  return {
    ...page,
    filters,
    refreshedAt,
    canCreateManualDays: canCreateManualDays(user),
    monthOptions,
    seriesOptions,
    circuitOptions,
    providerOptions,
    savedFilters,
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
              userId: booking.userId,
              status: booking.status,
              accommodationName: booking.accommodationName,
              garageBooked: booking.garageBooked,
              garageCapacity: booking.garageCapacity,
              garageLabel: booking.garageLabel,
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
    selectedDayPlan,
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
