import type {
  CircuitDistanceLeg,
  CircuitDistanceMatrix,
  CircuitDistanceMatrixStatus,
} from '~/lib/db/services/circuit-distance-matrix.server';

export const DEFAULT_JOURNEY_MAX_MILES = 180;

export interface JourneyPlannerDay {
  dayId: string;
  date: string;
  type: 'race_day' | 'test_day' | 'track_day';
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
}

export interface JourneyPlannerStop {
  day: JourneyPlannerDay;
  alternatives: JourneyPlannerDay[];
}

export interface JourneyPlannerLeg {
  fromDayId: string;
  toDayId: string;
  fromCircuit: string;
  toCircuit: string;
  miles: number;
  durationMinutes: number;
}

export interface JourneyPlannerResult {
  status: CircuitDistanceMatrixStatus | 'no_candidates';
  start: string;
  end: string;
  maxMiles: number;
  candidateCount: number;
  unknownDistanceDays: JourneyPlannerDay[];
  stops: JourneyPlannerStop[];
  legs: JourneyPlannerLeg[];
  totalMiles: number;
  totalDurationMinutes: number;
  attribution: string | null;
}

interface CandidateStop extends JourneyPlannerStop {
  day: JourneyPlannerDay & { circuitId: string };
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

function groupCandidates(days: JourneyPlannerDay[]): JourneyPlannerStop[] {
  const groups = new Map<string, JourneyPlannerDay[]>();

  for (const day of [...days].sort(compareDays)) {
    const key = `${day.date}:${day.circuitId ?? day.circuit}`;
    const current = groups.get(key);
    if (current) {
      current.push(day);
      continue;
    }

    groups.set(key, [day]);
  }

  return [...groups.values()].map((items) => ({
    day: items[0]!,
    alternatives: items.slice(1),
  }));
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
): JourneyPlannerLeg {
  return {
    fromDayId: from.day.dayId,
    toDayId: to.day.dayId,
    fromCircuit: from.day.circuit,
    toCircuit: to.day.circuit,
    miles: distance.miles,
    durationMinutes: distance.durationMinutes,
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

      const distance = getDistanceLeg(
        matrix,
        previous.day.circuitId,
        candidate.day.circuitId,
      );
      if (!distance || distance.miles > maxMiles) {
        continue;
      }

      const previousRoute = bestByIndex[previousIndex]!;
      const nextRoute: RouteState = {
        stops: [...previousRoute.stops, candidate],
        legs: [...previousRoute.legs, buildLeg(previous, candidate, distance)],
        totalMiles: round(previousRoute.totalMiles + distance.miles),
        totalDurationMinutes:
          previousRoute.totalDurationMinutes + distance.durationMinutes,
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

export function buildJourneyPlannerResult(
  days: JourneyPlannerDay[],
  options: JourneyPlannerOptions,
  distanceResult: {
    status: CircuitDistanceMatrixStatus;
    matrix: CircuitDistanceMatrix | null;
  },
): JourneyPlannerResult {
  const candidateDays = days.filter((day) =>
    isWithinRange(day, options.start, options.end),
  );
  const groupedCandidates = groupCandidates(candidateDays);
  const knownCandidates = groupedCandidates.filter(
    (candidate): candidate is CandidateStop =>
      Boolean(candidate.day.circuitId) && candidate.day.circuitKnown !== false,
  );
  const unknownDistanceDays = groupedCandidates
    .filter(
      (candidate) =>
        !candidate.day.circuitId || candidate.day.circuitKnown === false,
    )
    .map((candidate) => candidate.day);

  if (groupedCandidates.length === 0) {
    return {
      status: 'no_candidates',
      start: options.start,
      end: options.end,
      maxMiles: options.maxMiles,
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
      candidateCount: groupedCandidates.length,
      unknownDistanceDays,
      stops: [],
      legs: [],
      totalMiles: 0,
      totalDurationMinutes: 0,
      attribution: null,
    };
  }

  const route = bestRoute(
    knownCandidates,
    distanceResult.matrix,
    options.maxMiles,
  );

  return {
    status: distanceResult.status,
    start: options.start,
    end: options.end,
    maxMiles: options.maxMiles,
    candidateCount: groupedCandidates.length,
    unknownDistanceDays,
    stops: route?.stops ?? [],
    legs: route?.legs ?? [],
    totalMiles: route?.totalMiles ?? 0,
    totalDurationMinutes: route?.totalDurationMinutes ?? 0,
    attribution: distanceResult.matrix.attribution,
  };
}
