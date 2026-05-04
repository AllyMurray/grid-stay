import { describe, expect, it, vi } from 'vitest';
import type { CircuitDistanceMatrixRecord } from '../entities/circuit-distance-matrix.server';
import {
  getCircuitDistanceLeg,
  parseCircuitDistanceMatrixRecord,
} from './circuit-distance-matrix.server';

vi.mock('../entities/circuit-distance-matrix.server', () => ({
  CircuitDistanceMatrixEntity: {},
}));

describe('circuit distance matrix service', () => {
  it('parses a stored matrix payload and returns directed legs', () => {
    const matrix = parseCircuitDistanceMatrixRecord({
      matrixId: 'current',
      profile: 'driving-car',
      provider: 'openrouteservice',
      updatedAt: '2026-05-01T10:00:00.000Z',
      payload: JSON.stringify({
        circuitIds: ['silverstone', 'brands-hatch'],
        attribution: 'ORS attribution',
        distances: {
          silverstone: {
            'brands-hatch': { miles: 118.4, durationMinutes: 130 },
          },
          'brands-hatch': {
            silverstone: { miles: 121.2, durationMinutes: 136 },
          },
        },
      }),
    } as CircuitDistanceMatrixRecord);

    expect(matrix?.circuitIds).toEqual(['silverstone', 'brands-hatch']);
    expect(
      getCircuitDistanceLeg(matrix, 'silverstone', 'brands-hatch'),
    ).toEqual({
      miles: 118.4,
      durationMinutes: 130,
    });
    expect(
      getCircuitDistanceLeg(matrix, 'brands-hatch', 'silverstone'),
    ).toEqual({
      miles: 121.2,
      durationMinutes: 136,
    });
  });

  it('returns a zero-mile leg for the same circuit', () => {
    expect(getCircuitDistanceLeg(null, 'silverstone', 'silverstone')).toEqual({
      miles: 0,
      durationMinutes: 0,
    });
  });

  it('returns null for malformed cache payloads', () => {
    expect(
      parseCircuitDistanceMatrixRecord({
        matrixId: 'current',
        profile: 'driving-car',
        provider: 'openrouteservice',
        updatedAt: '2026-05-01T10:00:00.000Z',
        payload: '{bad json',
      } as CircuitDistanceMatrixRecord),
    ).toBeNull();
  });
});
