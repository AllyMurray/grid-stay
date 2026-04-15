import { caterhamAdapter } from '~/lib/discovery/adapters/caterham.server';
import type { DiscoveryResult } from '~/lib/discovery/types';
import { knockhillAdapter } from '~/lib/testing/adapters/knockhill.server';
import { msvAdapter } from '~/lib/testing/adapters/msv.server';
import { silverstoneAdapter } from '~/lib/testing/adapters/silverstone.server';
import type { TestingAdapter, TestingDay } from '~/lib/testing/types';
import { knockhillTrackDayAdapter } from '~/lib/trackdays/adapters/knockhill.server';
import { msvTrackDayAdapter } from '~/lib/trackdays/adapters/msv.server';
import { silverstoneTrackDayAdapter } from '~/lib/trackdays/adapters/silverstone.server';
import type { TrackDay, TrackDayAdapter } from '~/lib/trackdays/types';
import type {
  AvailableDay,
  AvailableDaysResult,
  AvailableDayType,
  DaySourceError,
} from './types';

export interface DaySourceDependencies {
  fetchRaceDays?: () => Promise<AvailableDay[]>;
  testingAdapters?: TestingAdapter[];
  trackDayAdapters?: TrackDayAdapter[];
  today?: string;
}

const DEFAULT_TESTING_ADAPTERS = [
  silverstoneAdapter,
  knockhillAdapter,
  msvAdapter,
];

const DEFAULT_TRACKDAY_ADAPTERS = [
  silverstoneTrackDayAdapter,
  knockhillTrackDayAdapter,
  msvTrackDayAdapter,
];

function createDayId(
  type: AvailableDayType,
  sourceName: string,
  externalId: string,
  date: string,
): string {
  return `${type}:${sourceName}:${date}:${externalId.replace(/[^a-zA-Z0-9:_-]/g, '-')}`;
}

function compactDescription(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' • ');
}

function providerLabel(source: string): string {
  switch (source) {
    case 'msv':
      return 'MSV Testing';
    case 'msv-trackday':
      return 'MSV Trackdays';
    case 'silverstone':
    case 'silverstone-trackday':
      return 'Silverstone';
    default:
      return 'Knockhill';
  }
}

function normalizeTestingDay(day: TestingDay): AvailableDay {
  return {
    dayId: createDayId(
      'test_day',
      day.source,
      day.externalId ?? `${day.circuitId}-${day.date}`,
      day.date,
    ),
    date: day.date,
    type: 'test_day',
    circuit: day.circuitName,
    provider: providerLabel(day.source),
    description: compactDescription([day.layout, day.format, day.group]),
    source: {
      sourceType: 'testing',
      sourceName: day.source,
      externalId: day.externalId,
      metadata: {
        circuitId: day.circuitId,
        availability: day.availability,
      },
    },
  };
}

function normalizeTrackDay(day: TrackDay): AvailableDay {
  return {
    dayId: createDayId(
      'track_day',
      day.source,
      day.externalId ?? `${day.circuitId}-${day.date}`,
      day.date,
    ),
    date: day.date,
    type: 'track_day',
    circuit: day.circuitName,
    provider: day.organizer || providerLabel(day.source),
    description: compactDescription([day.layout, day.format, day.duration]),
    source: {
      sourceType: 'trackdays',
      sourceName: day.source,
      externalId: day.externalId,
      metadata: {
        circuitId: day.circuitId,
        availability: day.availability,
      },
    },
  };
}

function normalizeRaceResults(results: DiscoveryResult[]): AvailableDay[] {
  return results.flatMap((result) =>
    (result.seasons ?? []).flatMap((season) =>
      (season.rounds ?? [])
        .filter((round) => round.startDate)
        .map((round) => ({
          dayId: createDayId(
            'race_day',
            'caterham',
            round.externalId ??
              `${result.externalId ?? result.name}-${round.roundNumber}`,
            round.startDate!,
          ),
          date: round.startDate!,
          type: 'race_day',
          circuit: round.circuit ?? result.name,
          provider: result.organiser ?? 'Caterham Motorsport',
          description: compactDescription([result.name, round.name]),
          source: {
            sourceType: 'caterham',
            sourceName: 'caterham',
            externalId:
              round.externalId ??
              `${result.externalId ?? result.name}-${round.roundNumber}`,
            metadata: {
              series: result.name,
              endDate: round.endDate,
            },
          },
        })),
    ),
  );
}

export async function fetchRaceDaysFromCaterham(): Promise<AvailableDay[]> {
  const results = await caterhamAdapter.search('caterham');
  return normalizeRaceResults(results);
}

async function fetchFromTestingAdapters(
  adapters: TestingAdapter[],
): Promise<AvailableDay[]> {
  const result = await Promise.all(
    adapters.map((adapter) => adapter.fetchSchedule(adapter.circuitIds)),
  );
  return result.flatMap((days) => days.map(normalizeTestingDay));
}

async function fetchFromTrackDayAdapters(
  adapters: TrackDayAdapter[],
): Promise<AvailableDay[]> {
  const result = await Promise.all(
    adapters.map((adapter) => adapter.fetchSchedule(adapter.circuitIds)),
  );
  return result.flatMap((days) => days.map(normalizeTrackDay));
}

function toError(source: string, error: unknown): DaySourceError {
  return {
    source,
    message: error instanceof Error ? error.message : 'Unknown loading error',
  };
}

export async function listAvailableDays(
  dependencies: DaySourceDependencies = {},
): Promise<AvailableDaysResult> {
  const today = dependencies.today ?? new Date().toISOString().slice(0, 10);
  const raceLoader = dependencies.fetchRaceDays ?? fetchRaceDaysFromCaterham;
  const results = await Promise.allSettled([
    raceLoader(),
    fetchFromTestingAdapters(
      dependencies.testingAdapters ?? DEFAULT_TESTING_ADAPTERS,
    ),
    fetchFromTrackDayAdapters(
      dependencies.trackDayAdapters ?? DEFAULT_TRACKDAY_ADAPTERS,
    ),
  ]);

  const sources = ['caterham', 'testing', 'trackdays'] as const;
  const days: AvailableDay[] = [];
  const errors: DaySourceError[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      days.push(...result.value);
      return;
    }

    errors.push(toError(sources[index], result.reason));
  });

  const deduped = new Map<string, AvailableDay>();
  for (const day of days) {
    if (day.date < today) {
      continue;
    }
    deduped.set(day.dayId, day);
  }

  return {
    days: [...deduped.values()].sort((left, right) =>
      left.date === right.date
        ? left.circuit.localeCompare(right.circuit)
        : left.date.localeCompare(right.date),
    ),
    errors,
  };
}

export interface AvailableDayFilters {
  month?: string;
  circuit?: string;
  provider?: string;
  type?: AvailableDayType;
}

export function filterAvailableDays(
  days: AvailableDay[],
  filters: AvailableDayFilters,
): AvailableDay[] {
  return days.filter((day) => {
    if (filters.month && !day.date.startsWith(filters.month)) {
      return false;
    }
    if (filters.circuit && day.circuit !== filters.circuit) {
      return false;
    }
    if (filters.provider && day.provider !== filters.provider) {
      return false;
    }
    if (filters.type && day.type !== filters.type) {
      return false;
    }
    return true;
  });
}
