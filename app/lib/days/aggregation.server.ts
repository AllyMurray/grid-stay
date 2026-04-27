import {
  normalizeCircuitName,
  normalizeCircuitText,
} from '~/lib/circuit-sources/shared.server';
import { caterhamAdapter } from '~/lib/discovery/adapters/caterham.server';
import type { DiscoveryResult } from '~/lib/discovery/types';
import {
  angleseyTestingAdapter,
  croftTestingAdapter,
  malloryTestingAdapter,
  thruxtonTestingAdapter,
} from '~/lib/testing/adapters/independent-venues.server';
import { knockhillAdapter } from '~/lib/testing/adapters/knockhill.server';
import { msvAdapter } from '~/lib/testing/adapters/msv.server';
import { silverstoneAdapter } from '~/lib/testing/adapters/silverstone.server';
import type { TestingAdapter, TestingDay } from '~/lib/testing/types';
import {
  angleseyTrackDayAdapter,
  castleCombeTrackDayAdapter,
  croftTrackDayAdapter,
  lyddenTrackDayAdapter,
  malloryTrackDayAdapter,
  thruxtonTrackDayAdapter,
} from '~/lib/trackdays/adapters/independent-venues.server';
import { knockhillTrackDayAdapter } from '~/lib/trackdays/adapters/knockhill.server';
import { msvTrackDayAdapter } from '~/lib/trackdays/adapters/msv.server';
import { silverstoneTrackDayAdapter } from '~/lib/trackdays/adapters/silverstone.server';
import type { TrackDay, TrackDayAdapter } from '~/lib/trackdays/types';
import { createDayIdentity } from './identity.server';
import type {
  AvailableDay,
  AvailableDaysResult,
  AvailableDayType,
  DaySourceError,
} from './types';

export { normalizeCircuitName } from '~/lib/circuit-sources/shared.server';

export interface DaySourceDependencies {
  fetchRaceDays?: () => Promise<AvailableDay[]>;
  testingAdapters?: TestingAdapter[];
  trackDayAdapters?: TrackDayAdapter[];
  today?: string;
}

interface AdapterFetchResult {
  days: AvailableDay[];
  errors: DaySourceError[];
}

const DEFAULT_TESTING_ADAPTERS = [
  silverstoneAdapter,
  knockhillAdapter,
  msvAdapter,
  angleseyTestingAdapter,
  croftTestingAdapter,
  malloryTestingAdapter,
  thruxtonTestingAdapter,
];

const DEFAULT_TRACKDAY_ADAPTERS = [
  silverstoneTrackDayAdapter,
  knockhillTrackDayAdapter,
  msvTrackDayAdapter,
  angleseyTrackDayAdapter,
  castleCombeTrackDayAdapter,
  croftTrackDayAdapter,
  lyddenTrackDayAdapter,
  malloryTrackDayAdapter,
  thruxtonTrackDayAdapter,
];

function createTestingDayIdentity(
  day: TestingDay,
): Pick<AvailableDay, 'dayId'> {
  return {
    dayId: createDayIdentity({
      type: 'test_day',
      sourceName: day.source,
      date: day.date,
      stableKey: day.externalId,
      fallbackKey: [
        day.circuitId,
        day.layout ?? '',
        day.format ?? '',
        day.group ?? '',
      ].join('|'),
    }),
  };
}

function createTrackDayIdentity(day: TrackDay): Pick<AvailableDay, 'dayId'> {
  return {
    dayId: createDayIdentity({
      type: 'track_day',
      sourceName: day.source,
      date: day.date,
      stableKey: day.externalId,
      fallbackKey: [
        day.circuitId,
        day.layout ?? '',
        day.organizer ?? '',
        day.format ?? '',
        day.duration ?? '',
        day.bookingUrl ?? '',
      ].join('|'),
    }),
  };
}

function createRaceDayIdentity(
  result: DiscoveryResult,
  round: {
    startDate?: string;
    externalId?: string;
    roundNumber?: number | string;
    circuit?: string;
    name?: string;
    endDate?: string;
  },
): Pick<AvailableDay, 'dayId'> {
  const stableKey =
    round.externalId ??
    `${result.externalId ?? result.name}-${round.roundNumber}`;

  return {
    dayId: createDayIdentity({
      type: 'race_day',
      sourceName: 'caterham',
      date: round.startDate!,
      stableKey,
      fallbackKey: [
        result.externalId ?? result.name,
        round.roundNumber ?? '',
        round.circuit ?? '',
        round.name ?? '',
      ].join('|'),
    }),
  };
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
    case 'anglesey-testing':
      return 'Anglesey Circuit';
    case 'croft-testing':
      return 'Croft Circuit';
    case 'mallory-testing':
      return 'Mallory Park Circuit';
    case 'silverstone':
    case 'silverstone-trackday':
      return 'Silverstone';
    case 'thruxton-testing':
      return 'Thruxton';
    default:
      return 'Knockhill';
  }
}

function normalizeTestingDay(day: TestingDay): AvailableDay {
  return {
    ...createTestingDayIdentity(day),
    date: day.date,
    type: 'test_day',
    circuit: day.circuitName,
    provider: providerLabel(day.source),
    description: compactDescription([day.layout, day.format, day.group]),
    bookingUrl: day.bookingUrl,
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
    ...createTrackDayIdentity(day),
    date: day.date,
    type: 'track_day',
    circuit: day.circuitName,
    provider: day.organizer || providerLabel(day.source),
    description: compactDescription([day.layout, day.format, day.duration]),
    bookingUrl: day.bookingUrl,
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
          ...createRaceDayIdentity(result, round),
          date: round.startDate!,
          type: 'race_day',
          circuit: normalizeCircuitName(round.circuit ?? result.name),
          provider: result.organiser ?? 'Caterham Motorsport',
          description: normalizeCircuitText(
            compactDescription([result.name, round.name]),
          ),
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
): Promise<AdapterFetchResult> {
  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.fetchSchedule(adapter.circuitIds)),
  );

  const days: AvailableDay[] = [];
  const errors: DaySourceError[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      days.push(...result.value.map(normalizeTestingDay));
      return;
    }

    errors.push(toError(adapters[index]?.name ?? 'testing', result.reason));
  });

  return { days, errors };
}

async function fetchFromTrackDayAdapters(
  adapters: TrackDayAdapter[],
): Promise<AdapterFetchResult> {
  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.fetchSchedule(adapter.circuitIds)),
  );

  const days: AvailableDay[] = [];
  const errors: DaySourceError[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      days.push(...result.value.map(normalizeTrackDay));
      return;
    }

    errors.push(toError(adapters[index]?.name ?? 'trackdays', result.reason));
  });

  return { days, errors };
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
  const [raceResult, testingResult, trackDayResult] = await Promise.allSettled([
    raceLoader(),
    fetchFromTestingAdapters(
      dependencies.testingAdapters ?? DEFAULT_TESTING_ADAPTERS,
    ),
    fetchFromTrackDayAdapters(
      dependencies.trackDayAdapters ?? DEFAULT_TRACKDAY_ADAPTERS,
    ),
  ]);

  const days: AvailableDay[] = [];
  const errors: DaySourceError[] = [];

  if (raceResult.status === 'fulfilled') {
    days.push(...raceResult.value);
  } else {
    errors.push(toError('caterham', raceResult.reason));
  }

  if (testingResult.status === 'fulfilled') {
    days.push(...testingResult.value.days);
    errors.push(...testingResult.value.errors);
  } else {
    errors.push(toError('testing', testingResult.reason));
  }

  if (trackDayResult.status === 'fulfilled') {
    days.push(...trackDayResult.value.days);
    errors.push(...trackDayResult.value.errors);
  } else {
    errors.push(toError('trackdays', trackDayResult.reason));
  }

  const deduped = new Map<string, AvailableDay>();
  for (const day of days) {
    const normalizedDay = normalizeAvailableDayCircuit(day);

    if (normalizedDay.date < today) {
      continue;
    }
    deduped.set(normalizedDay.dayId, normalizedDay);
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
  circuits?: string[];
  provider?: string;
  type?: AvailableDayType;
}

export function normalizeAvailableDayCircuit(day: AvailableDay): AvailableDay {
  const circuit = normalizeCircuitName(day.circuit);
  const description = normalizeCircuitText(day.description);

  if (circuit === day.circuit && description === day.description) {
    return day;
  }

  return {
    ...day,
    circuit,
    description,
  };
}

export function listCircuitOptions(
  days: Array<Pick<AvailableDay, 'circuit'>>,
): string[] {
  return [
    ...new Set(
      days.map((day) => normalizeCircuitName(day.circuit)).filter(Boolean),
    ),
  ].sort();
}

export function filterAvailableDays(
  days: AvailableDay[],
  filters: AvailableDayFilters,
): AvailableDay[] {
  const circuitFilters =
    filters.circuits && filters.circuits.length > 0
      ? filters.circuits.map(normalizeCircuitName)
      : filters.circuit
        ? [normalizeCircuitName(filters.circuit)]
        : [];

  return days.filter((day) => {
    if (filters.month && !day.date.startsWith(filters.month)) {
      return false;
    }
    if (
      circuitFilters.length > 0 &&
      !circuitFilters.includes(normalizeCircuitName(day.circuit))
    ) {
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
