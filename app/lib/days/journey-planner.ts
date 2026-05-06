import type {
  CircuitDistanceLeg,
  CircuitDistanceMatrix,
  CircuitDistanceMatrixStatus,
} from '~/lib/db/services/circuit-distance-matrix.server';

export const DEFAULT_JOURNEY_MAX_MILES = 180;

export interface JourneyPlannerDay {
  dayId: string;
  date: string;
  type: 'race_day' | 'test_day' | 'track_day' | 'road_drive';
  circuit: string;
  circuitId?: string;
  circuitName?: string;
  layout?: string;
  circuitKnown?: boolean;
  provider: string;
  description: string;
  bookingUrl?: string;
  availability?: string;
}

export interface JourneyPlannerOptions {
  start: string;
  end: string;
  maxMiles: number;
  selectedDayIds?: string[];
}

interface JourneyPlannerCandidate {
  day: JourneyPlannerDay;
  alternatives: JourneyPlannerDay[];
}

export interface JourneyPlannerStopOption {
  day: JourneyPlannerDay;
  selected: boolean;
  recommended: boolean;
  reason: string;
}

export interface JourneyPlannerStop extends JourneyPlannerCandidate {
  recommendationReason: string;
  options: JourneyPlannerStopOption[];
  selectedByUser?: boolean;
}

export interface JourneyPlannerLeg {
  fromDayId: string;
  toDayId: string;
  fromCircuit: string;
  toCircuit: string;
  miles: number;
  durationMinutes: number;
  exceedsMaxMiles?: boolean;
}

export interface JourneyPlannerResult {
  status: CircuitDistanceMatrixStatus | 'no_candidates';
  start: string;
  end: string;
  maxMiles: number;
  selectedDayIds?: string[];
  candidateCount: number;
  unknownDistanceDays: JourneyPlannerDay[];
  stops: JourneyPlannerStop[];
  legs: JourneyPlannerLeg[];
  totalMiles: number;
  totalDurationMinutes: number;
  attribution: string | null;
}

interface CandidateStop extends JourneyPlannerCandidate {
  day: JourneyPlannerDay & { circuitId: string };
  selectedByUser: boolean;
  recommendedDayId: string;
}

interface RouteState {
  stops: CandidateStop[];
  legs: JourneyPlannerLeg[];
  totalMiles: number;
  totalDurationMinutes: number;
}

function compareDays(left: JourneyPlannerDay, right: JourneyPlannerDay) {
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

function isWithinRange(day: JourneyPlannerDay, start: string, end: string) {
  return day.date >= start && day.date <= end;
}

function groupCandidates(
  days: JourneyPlannerDay[],
  selectedDayIds: Set<string>,
): JourneyPlannerCandidate[] {
  const groups = new Map<string, JourneyPlannerDay[]>();

  for (const day of [...days].toSorted(compareDays)) {
    const key = `${day.date}:${day.circuitId ?? day.circuit}`;
    const current = groups.get(key);
    if (current) {
      current.push(day);
      continue;
    }

    groups.set(key, [day]);
  }

  return [...groups.values()].map((items) => {
    const selected = items.find((day) => selectedDayIds.has(day.dayId));
    const primary = selected ?? items[0]!;

    return {
      day: primary,
      alternatives: items.filter((day) => day.dayId !== primary.dayId),
    };
  });
}

function getSelectedDayIdsByDate(days: JourneyPlannerDay[], selectedDayIds: string[] | undefined) {
  const daysById = new Map(days.map((day) => [day.dayId, day]));
  const selectedByDate = new Map<string, string>();

  for (const dayId of selectedDayIds ?? []) {
    const day = daysById.get(dayId);
    if (!day) {
      continue;
    }

    selectedByDate.set(day.date, day.dayId);
  }

  return selectedByDate;
}

function getOptionReason(option: JourneyPlannerDay, selected: JourneyPlannerDay) {
  if (!option.circuitId || option.circuitKnown === false) {
    return 'Distance unavailable';
  }

  if (option.circuitId === selected.circuitId) {
    return 'Same circuit option';
  }

  return 'Alternative circuit on this date';
}

function getRecommendationReason(
  route: RouteState,
  index: number,
  optionCount: number,
  selectedByUser: boolean,
) {
  if (selectedByUser) {
    return 'Selected by you. Other stops stay fixed while route miles update around this option.';
  }

  if (optionCount > 1) {
    return 'Recommended to maximise route stops, then minimise road miles.';
  }

  if (route.stops.length === 1) {
    return 'Best connected stop in this date range.';
  }

  if (index === 0) {
    return 'Recommended route start.';
  }

  return 'Keeps the route within the max miles per leg.';
}

function buildStopOptions(
  candidateDays: JourneyPlannerDay[],
  selected: JourneyPlannerDay,
  recommendedDayId: string,
): JourneyPlannerStopOption[] {
  return candidateDays
    .filter((day) => day.date === selected.date)
    .toSorted(compareDays)
    .map((day) => ({
      day,
      selected: day.dayId === selected.dayId,
      recommended: day.dayId === recommendedDayId,
      reason: getOptionReason(day, selected),
    }));
}

function buildRecommendedStops(
  route: RouteState | null,
  candidateDays: JourneyPlannerDay[],
): JourneyPlannerStop[] {
  if (!route) {
    return [];
  }

  return route.stops.map((stop, index) => {
    const options = buildStopOptions(candidateDays, stop.day, stop.recommendedDayId);

    return {
      ...stop,
      recommendationReason: getRecommendationReason(
        route,
        index,
        options.length,
        stop.selectedByUser,
      ),
      options,
      selectedByUser: stop.selectedByUser,
    };
  });
}

function compareRouteStates(left: RouteState, right: RouteState | null) {
  if (!right) {
    return -1;
  }

  if (left.stops.length !== right.stops.length) {
    return right.stops.length - left.stops.length;
  }

  if (left.totalMiles !== right.totalMiles) {
    return left.totalMiles - right.totalMiles;
  }

  const leftDates = left.stops.map((stop) => stop.day.date).join('|');
  const rightDates = right.stops.map((stop) => stop.day.date).join('|');

  return leftDates.localeCompare(rightDates);
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildLeg(
  from: CandidateStop,
  to: CandidateStop,
  distance: CircuitDistanceLeg,
  maxMiles?: number,
): JourneyPlannerLeg {
  return {
    fromDayId: from.day.dayId,
    toDayId: to.day.dayId,
    fromCircuit: from.day.circuit,
    toCircuit: to.day.circuit,
    miles: distance.miles,
    durationMinutes: distance.durationMinutes,
    ...(maxMiles && distance.miles > maxMiles ? { exceedsMaxMiles: true } : {}),
  };
}

function getDistanceLeg(
  matrix: CircuitDistanceMatrix,
  fromCircuitId: string,
  toCircuitId: string,
): CircuitDistanceLeg | null {
  if (fromCircuitId === toCircuitId) {
    return { miles: 0, durationMinutes: 0 };
  }

  return matrix.distances[fromCircuitId]?.[toCircuitId] ?? null;
}

function bestRoute(
  candidates: CandidateStop[],
  matrix: CircuitDistanceMatrix,
  maxMiles: number,
): RouteState | null {
  const bestByIndex: RouteState[] = [];
  let best: RouteState | null = null;

  candidates.forEach((candidate, index) => {
    let candidateBest: RouteState = {
      stops: [candidate],
      legs: [],
      totalMiles: 0,
      totalDurationMinutes: 0,
    };

    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previous = candidates[previousIndex]!;
      if (previous.day.date >= candidate.day.date) {
        continue;
      }

      const distance = getDistanceLeg(matrix, previous.day.circuitId, candidate.day.circuitId);
      if (!distance || distance.miles > maxMiles) {
        continue;
      }

      const previousRoute = bestByIndex[previousIndex]!;
      const nextRoute: RouteState = {
        stops: [...previousRoute.stops, candidate],
        legs: [...previousRoute.legs, buildLeg(previous, candidate, distance)],
        totalMiles: round(previousRoute.totalMiles + distance.miles),
        totalDurationMinutes: previousRoute.totalDurationMinutes + distance.durationMinutes,
      };

      if (compareRouteStates(nextRoute, candidateBest) < 0) {
        candidateBest = nextRoute;
      }
    }

    bestByIndex[index] = candidateBest;
    if (compareRouteStates(candidateBest, best) < 0) {
      best = candidateBest;
    }
  });

  return best;
}

function buildKnownCandidates(
  candidates: JourneyPlannerCandidate[],
  selectedDayIds: Set<string>,
): CandidateStop[] {
  return candidates
    .filter(
      (
        candidate,
      ): candidate is JourneyPlannerCandidate & {
        day: JourneyPlannerDay & { circuitId: string };
      } => Boolean(candidate.day.circuitId) && candidate.day.circuitKnown !== false,
    )
    .map((candidate) => ({
      ...candidate,
      selectedByUser: selectedDayIds.has(candidate.day.dayId),
      recommendedDayId: candidate.day.dayId,
    }));
}

function buildCandidateMap(candidates: JourneyPlannerCandidate[], selectedDayIds: Set<string>) {
  const map = new Map<string, CandidateStop>();

  for (const candidate of candidates) {
    const days = [candidate.day, ...candidate.alternatives];

    for (const day of days) {
      if (!day.circuitId || day.circuitKnown === false) {
        continue;
      }

      map.set(day.dayId, {
        day: { ...day, circuitId: day.circuitId },
        alternatives: days.filter((option) => option.dayId !== day.dayId),
        selectedByUser: selectedDayIds.has(day.dayId),
        recommendedDayId: day.dayId,
      });
    }
  }

  return map;
}

function buildFixedRoute(
  recommendedRoute: RouteState | null,
  candidateByDayId: Map<string, CandidateStop>,
  selectedByDate: Map<string, string>,
  matrix: CircuitDistanceMatrix,
  maxMiles: number,
): RouteState | null {
  if (!recommendedRoute) {
    return null;
  }

  const stops = recommendedRoute.stops.map((recommendedStop) => {
    const selectedDayId = selectedByDate.get(recommendedStop.day.date);
    const selectedStop = selectedDayId ? candidateByDayId.get(selectedDayId) : null;
    const nextStop = selectedStop ?? recommendedStop;

    return {
      ...nextStop,
      selectedByUser: nextStop.day.dayId !== recommendedStop.day.dayId,
      recommendedDayId: recommendedStop.day.dayId,
    };
  });
  const legs: JourneyPlannerLeg[] = [];
  let totalMiles = 0;
  let totalDurationMinutes = 0;

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]!;
    const next = stops[index]!;
    const distance = getDistanceLeg(matrix, previous.day.circuitId, next.day.circuitId);

    if (!distance) {
      continue;
    }

    legs.push(buildLeg(previous, next, distance, maxMiles));
    totalMiles = round(totalMiles + distance.miles);
    totalDurationMinutes += distance.durationMinutes;
  }

  return {
    stops,
    legs,
    totalMiles,
    totalDurationMinutes,
  };
}

export function buildJourneyPlannerResult(
  days: JourneyPlannerDay[],
  options: JourneyPlannerOptions,
  distanceResult: {
    status: CircuitDistanceMatrixStatus;
    matrix: CircuitDistanceMatrix | null;
  },
): JourneyPlannerResult {
  const candidateDays = days.filter((day) => isWithinRange(day, options.start, options.end));
  const selectedByDate = getSelectedDayIdsByDate(candidateDays, options.selectedDayIds);
  const selectedDayIds = new Set(selectedByDate.values());
  const groupedCandidates = groupCandidates(candidateDays, new Set());
  const selectedGroupedCandidates = groupCandidates(candidateDays, selectedDayIds);
  const knownCandidates = buildKnownCandidates(groupedCandidates, new Set());
  const candidateByDayId = buildCandidateMap(selectedGroupedCandidates, selectedDayIds);
  const unknownDistanceDays = groupedCandidates
    .filter((candidate) => !candidate.day.circuitId || candidate.day.circuitKnown === false)
    .map((candidate) => candidate.day);

  if (groupedCandidates.length === 0) {
    return {
      status: 'no_candidates',
      start: options.start,
      end: options.end,
      maxMiles: options.maxMiles,
      selectedDayIds: [...selectedDayIds],
      candidateCount: 0,
      unknownDistanceDays: [],
      stops: [],
      legs: [],
      totalMiles: 0,
      totalDurationMinutes: 0,
      attribution: distanceResult.matrix?.attribution ?? null,
    };
  }

  if (!distanceResult.matrix) {
    return {
      status: distanceResult.status,
      start: options.start,
      end: options.end,
      maxMiles: options.maxMiles,
      selectedDayIds: [...selectedDayIds],
      candidateCount: groupedCandidates.length,
      unknownDistanceDays,
      stops: [],
      legs: [],
      totalMiles: 0,
      totalDurationMinutes: 0,
      attribution: null,
    };
  }

  const recommendedRoute = bestRoute(knownCandidates, distanceResult.matrix, options.maxMiles);
  const route =
    selectedDayIds.size > 0
      ? buildFixedRoute(
          recommendedRoute,
          candidateByDayId,
          selectedByDate,
          distanceResult.matrix,
          options.maxMiles,
        )
      : recommendedRoute;
  const effectiveSelectedDayIds =
    route?.stops.filter((stop) => stop.selectedByUser).map((stop) => stop.day.dayId) ?? [];

  return {
    status: distanceResult.status,
    start: options.start,
    end: options.end,
    maxMiles: options.maxMiles,
    selectedDayIds: effectiveSelectedDayIds,
    candidateCount: groupedCandidates.length,
    unknownDistanceDays,
    stops: buildRecommendedStops(route, candidateDays),
    legs: route?.legs ?? [],
    totalMiles: route?.totalMiles ?? 0,
    totalDurationMinutes: route?.totalDurationMinutes ?? 0,
    attribution: distanceResult.matrix.attribution,
  };
}
