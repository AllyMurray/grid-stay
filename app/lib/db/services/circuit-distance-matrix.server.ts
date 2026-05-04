import { Resource } from 'sst';
import {
  CIRCUIT_LOCATIONS,
  type CircuitLocation,
} from '~/lib/circuits/locations';
import {
  CircuitDistanceMatrixEntity,
  type CircuitDistanceMatrixRecord,
} from '../entities/circuit-distance-matrix.server';

const MATRIX_ID = 'current';
const PROFILE = 'driving-car';
const PROVIDER = 'openrouteservice';
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export const CIRCUIT_DISTANCE_ATTRIBUTION =
  '© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors';

export interface CircuitDistanceLeg {
  miles: number;
  durationMinutes: number;
}

export interface CircuitDistanceMatrix {
  provider: typeof PROVIDER;
  profile: typeof PROFILE;
  updatedAt: string;
  circuitIds: string[];
  distances: Record<string, Record<string, CircuitDistanceLeg>>;
  attribution: string;
}

export type CircuitDistanceMatrixStatus =
  | 'ready'
  | 'stale'
  | 'missing'
  | 'unavailable';

export interface CircuitDistanceMatrixLoadResult {
  status: CircuitDistanceMatrixStatus;
  matrix: CircuitDistanceMatrix | null;
  error?: string;
}

export interface CircuitDistanceMatrixPersistence {
  get(): Promise<CircuitDistanceMatrixRecord | null>;
  put(record: CircuitDistanceMatrixRecord): Promise<void>;
}

interface OpenRouteServiceMatrixResponse {
  distances?: Array<Array<number | null>>;
  durations?: Array<Array<number | null>>;
}

export const circuitDistanceMatrixStore: CircuitDistanceMatrixPersistence = {
  async get() {
    const response = await CircuitDistanceMatrixEntity.get({
      matrixId: MATRIX_ID,
      profile: PROFILE,
    }).go();

    return response.data ?? null;
  },
  async put(record) {
    await CircuitDistanceMatrixEntity.put(record).go();
  },
};

function parseJson<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

function isStale(updatedAt: string, now = Date.now()) {
  const updatedTime = Date.parse(updatedAt);
  return !Number.isFinite(updatedTime) || now - updatedTime > STALE_AFTER_MS;
}

export function parseCircuitDistanceMatrixRecord(
  record: CircuitDistanceMatrixRecord,
): CircuitDistanceMatrix | null {
  const parsed = parseJson<
    Omit<CircuitDistanceMatrix, 'updatedAt' | 'provider' | 'profile'>
  >(record.payload);

  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    provider: PROVIDER,
    profile: PROFILE,
    updatedAt: record.updatedAt,
    attribution: parsed.attribution ?? CIRCUIT_DISTANCE_ATTRIBUTION,
  };
}

function serializeCircuitDistanceMatrix(matrix: CircuitDistanceMatrix) {
  return JSON.stringify({
    circuitIds: matrix.circuitIds,
    distances: matrix.distances,
    attribution: matrix.attribution,
  });
}

function getOpenRouteServiceApiKey() {
  if (process.env.OPENROUTESERVICE_API_KEY) {
    return process.env.OPENROUTESERVICE_API_KEY;
  }

  try {
    const resources = Resource as unknown as {
      OpenRouteServiceApiKey?: { value?: string };
    };
    return resources.OpenRouteServiceApiKey?.value ?? '';
  } catch {
    return '';
  }
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildMatrixFromResponse(
  locations: CircuitLocation[],
  response: OpenRouteServiceMatrixResponse,
  updatedAt: string,
): CircuitDistanceMatrix {
  const distances: CircuitDistanceMatrix['distances'] = {};

  locations.forEach((origin, originIndex) => {
    distances[origin.circuitId] = {};

    locations.forEach((destination, destinationIndex) => {
      const miles = response.distances?.[originIndex]?.[destinationIndex];
      const durationSeconds =
        response.durations?.[originIndex]?.[destinationIndex];

      if (!Number.isFinite(miles)) {
        return;
      }

      distances[origin.circuitId]![destination.circuitId] = {
        miles: round(Number(miles)),
        durationMinutes: Number.isFinite(durationSeconds)
          ? Math.max(0, Math.round(Number(durationSeconds) / 60))
          : 0,
      };
    });
  });

  return {
    provider: PROVIDER,
    profile: PROFILE,
    updatedAt,
    circuitIds: locations.map((location) => location.circuitId),
    distances,
    attribution: CIRCUIT_DISTANCE_ATTRIBUTION,
  };
}

export async function fetchCircuitDistanceMatrix(
  apiKey: string,
  locations: CircuitLocation[] = CIRCUIT_LOCATIONS,
  fetchImpl: typeof fetch = fetch,
): Promise<CircuitDistanceMatrix> {
  const response = await fetchImpl(
    `https://api.openrouteservice.org/v2/matrix/${PROFILE}`,
    {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        locations: locations.map((location) => [
          location.longitude,
          location.latitude,
        ]),
        metrics: ['distance', 'duration'],
        units: 'mi',
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`openrouteservice returned ${response.status}`);
  }

  return buildMatrixFromResponse(
    locations,
    (await response.json()) as OpenRouteServiceMatrixResponse,
    new Date().toISOString(),
  );
}

export async function refreshCircuitDistanceMatrix(
  dependencies: {
    apiKey?: string;
    store?: CircuitDistanceMatrixPersistence;
    fetchImpl?: typeof fetch;
    locations?: CircuitLocation[];
  } = {},
): Promise<CircuitDistanceMatrix> {
  const apiKey = dependencies.apiKey ?? getOpenRouteServiceApiKey();
  if (!apiKey) {
    throw new Error('OpenRouteServiceApiKey is not configured.');
  }

  const matrix = await fetchCircuitDistanceMatrix(
    apiKey,
    dependencies.locations ?? CIRCUIT_LOCATIONS,
    dependencies.fetchImpl ?? fetch,
  );
  await (dependencies.store ?? circuitDistanceMatrixStore).put({
    matrixId: MATRIX_ID,
    profile: PROFILE,
    provider: PROVIDER,
    payload: serializeCircuitDistanceMatrix(matrix),
    updatedAt: matrix.updatedAt,
  } as CircuitDistanceMatrixRecord);

  return matrix;
}

export async function loadCircuitDistanceMatrix(
  dependencies: {
    store?: CircuitDistanceMatrixPersistence;
    refreshIfMissing?: boolean;
    apiKey?: string;
    fetchImpl?: typeof fetch;
    now?: number;
  } = {},
): Promise<CircuitDistanceMatrixLoadResult> {
  const store = dependencies.store ?? circuitDistanceMatrixStore;
  const record = await store.get();
  const parsed = record ? parseCircuitDistanceMatrixRecord(record) : null;

  if (parsed) {
    return {
      status: isStale(parsed.updatedAt, dependencies.now) ? 'stale' : 'ready',
      matrix: parsed,
    };
  }

  if (dependencies.refreshIfMissing === false) {
    return { status: 'missing', matrix: null };
  }

  try {
    return {
      status: 'ready',
      matrix: await refreshCircuitDistanceMatrix({
        apiKey: dependencies.apiKey,
        store,
        fetchImpl: dependencies.fetchImpl,
      }),
    };
  } catch (error) {
    return {
      status: record ? 'stale' : 'unavailable',
      matrix: parsed,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getCircuitDistanceLeg(
  matrix: CircuitDistanceMatrix | null,
  fromCircuitId?: string,
  toCircuitId?: string,
): CircuitDistanceLeg | null {
  if (!fromCircuitId || !toCircuitId) {
    return null;
  }

  if (fromCircuitId === toCircuitId) {
    return { miles: 0, durationMinutes: 0 };
  }

  return matrix?.distances[fromCircuitId]?.[toCircuitId] ?? null;
}
