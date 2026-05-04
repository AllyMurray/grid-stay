import { describe, expect, it } from 'vitest';
import type { CircuitDistanceMatrix } from '~/lib/db/services/circuit-distance-matrix.server';
import {
  buildJourneyPlannerResult,
  type JourneyPlannerDay,
} from './journey-planner';

const matrix: CircuitDistanceMatrix = {
  provider: 'openrouteservice',
  profile: 'driving-car',
  updatedAt: '2026-05-01T10:00:00.000Z',
  circuitIds: ['silverstone', 'donington-park', 'brands-hatch', 'croft'],
  attribution: 'ORS attribution',
  distances: {
    silverstone: {
      silverstone: { miles: 0, durationMinutes: 0 },
      'donington-park': { miles: 55, durationMinutes: 70 },
      'brands-hatch': { miles: 120, durationMinutes: 130 },
      croft: { miles: 210, durationMinutes: 230 },
    },
    'donington-park': {
      silverstone: { miles: 55, durationMinutes: 70 },
      'donington-park': { miles: 0, durationMinutes: 0 },
      'brands-hatch': { miles: 145, durationMinutes: 160 },
      croft: { miles: 140, durationMinutes: 160 },
    },
    'brands-hatch': {
      silverstone: { miles: 118, durationMinutes: 130 },
      'donington-park': { miles: 145, durationMinutes: 160 },
      'brands-hatch': { miles: 0, durationMinutes: 0 },
      croft: { miles: 270, durationMinutes: 290 },
    },
    croft: {
      silverstone: { miles: 210, durationMinutes: 230 },
      'donington-park': { miles: 140, durationMinutes: 160 },
      'brands-hatch': { miles: 270, durationMinutes: 290 },
      croft: { miles: 0, durationMinutes: 0 },
    },
  },
};

function day(
  dayId: string,
  date: string,
  circuit: string,
  circuitId?: string,
): JourneyPlannerDay {
  return {
    dayId,
    date,
    type: 'track_day',
    circuit,
    circuitId,
    circuitName: circuit,
    circuitKnown: Boolean(circuitId),
    provider: 'Provider',
    description: 'Open pit lane',
  };
}

describe('journey planner', () => {
  it('maximizes chronological stops within the max leg mileage', () => {
    const result = buildJourneyPlannerResult(
      [
        day('silverstone', '2026-06-08', 'Silverstone', 'silverstone'),
        day('donington', '2026-06-09', 'Donington Park', 'donington-park'),
        day('croft', '2026-06-10', 'Croft', 'croft'),
      ],
      { start: '2026-06-01', end: '2026-06-30', maxMiles: 180 },
      { status: 'ready', matrix },
    );

    expect(result.stops.map((stop) => stop.day.dayId)).toEqual([
      'silverstone',
      'donington',
      'croft',
    ]);
    expect(result.totalMiles).toBe(195);
  });

  it('rejects route legs above the max mileage', () => {
    const result = buildJourneyPlannerResult(
      [
        day('silverstone', '2026-06-08', 'Silverstone', 'silverstone'),
        day('croft', '2026-06-09', 'Croft', 'croft'),
      ],
      { start: '2026-06-01', end: '2026-06-30', maxMiles: 180 },
      { status: 'ready', matrix },
    );

    expect(result.stops).toHaveLength(1);
    expect(result.legs).toHaveLength(0);
  });

  it('collapses duplicate same-date same-circuit sessions into one stop', () => {
    const result = buildJourneyPlannerResult(
      [
        day('silverstone-am', '2026-06-08', 'Silverstone', 'silverstone'),
        day('silverstone-pm', '2026-06-08', 'Silverstone', 'silverstone'),
        day('donington', '2026-06-09', 'Donington Park', 'donington-park'),
      ],
      { start: '2026-06-01', end: '2026-06-30', maxMiles: 180 },
      { status: 'ready', matrix },
    );

    expect(result.stops.map((stop) => stop.day.dayId)).toEqual([
      'silverstone-am',
      'donington',
    ]);
    expect(result.stops[0]?.alternatives.map((day) => day.dayId)).toEqual([
      'silverstone-pm',
    ]);
  });

  it('reports unknown circuits without using them in the optimized route', () => {
    const result = buildJourneyPlannerResult(
      [
        day('unknown', '2026-06-08', 'Unknown Circuit'),
        day('silverstone', '2026-06-09', 'Silverstone', 'silverstone'),
      ],
      { start: '2026-06-01', end: '2026-06-30', maxMiles: 180 },
      { status: 'ready', matrix },
    );

    expect(result.unknownDistanceDays.map((item) => item.dayId)).toEqual([
      'unknown',
    ]);
    expect(result.stops.map((stop) => stop.day.dayId)).toEqual(['silverstone']);
  });

  it('returns distance-unavailable state when the matrix is missing', () => {
    const result = buildJourneyPlannerResult(
      [day('silverstone', '2026-06-08', 'Silverstone', 'silverstone')],
      { start: '2026-06-01', end: '2026-06-30', maxMiles: 180 },
      { status: 'unavailable', matrix: null },
    );

    expect(result.status).toBe('unavailable');
    expect(result.candidateCount).toBe(1);
    expect(result.stops).toEqual([]);
  });
});
