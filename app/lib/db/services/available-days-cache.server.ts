import type { AvailableDay, AvailableDaysResult } from '~/lib/days/types';
import {
  AvailableDaysCacheEntity,
  type AvailableDaysCacheRecord,
} from '../entities/available-days-cache.server';

const AVAILABLE_DAYS_CACHE_KEY = 'available-days';
const AVAILABLE_DAYS_META_SCOPE = 'meta';
const AVAILABLE_DAYS_LEGACY_SCOPE = 'current';
const AVAILABLE_DAYS_DAY_SCOPE_PREFIX = 'day#';

export interface AvailableDaysSnapshot extends AvailableDaysResult {
  refreshedAt: string;
}

export interface AvailableDaysCachePersistence {
  list(): Promise<AvailableDaysCacheRecord[]>;
  putMany(items: AvailableDaysCacheRecord[]): Promise<void>;
  deleteScopes(scopes: string[]): Promise<void>;
}

export const availableDaysCacheStore: AvailableDaysCachePersistence = {
  async list() {
    const response = await AvailableDaysCacheEntity.query
      .cache({
        cacheKey: AVAILABLE_DAYS_CACHE_KEY,
      })
      .go();

    return response.data ?? [];
  },
  async putMany(items) {
    await Promise.all(items.map((item) => AvailableDaysCacheEntity.put(item).go()));
  },
  async deleteScopes(scopes) {
    await Promise.all(
      scopes.map((scope) =>
        AvailableDaysCacheEntity.delete({
          cacheKey: AVAILABLE_DAYS_CACHE_KEY,
          scope,
        }).go(),
      ),
    );
  },
};

function createDayScope(dayId: string): string {
  return `${AVAILABLE_DAYS_DAY_SCOPE_PREFIX}${dayId}`;
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

function isDayRecord(record: AvailableDaysCacheRecord): boolean {
  return record.scope.startsWith(AVAILABLE_DAYS_DAY_SCOPE_PREFIX);
}

function parseLegacySnapshot(record: AvailableDaysCacheRecord): AvailableDaysSnapshot | null {
  const parsed = parseJson<AvailableDaysResult>(record.payload);
  if (!parsed) {
    return null;
  }

  return {
    days: parsed.days,
    errors: parsed.errors,
    refreshedAt: record.refreshedAt,
  };
}

function parseShardedSnapshot(records: AvailableDaysCacheRecord[]): AvailableDaysSnapshot | null {
  const metaRecord = records.find((record) => record.scope === AVAILABLE_DAYS_META_SCOPE);
  if (!metaRecord) {
    return null;
  }

  const meta = parseJson<Pick<AvailableDaysSnapshot, 'errors'>>(metaRecord.payload);
  if (!meta) {
    return null;
  }

  const days = records
    .filter(isDayRecord)
    .filter((record) => record.refreshedAt === metaRecord.refreshedAt)
    .map((record) => parseJson<AvailableDay>(record.payload))
    .filter((day): day is AvailableDay => Boolean(day))
    .toSorted((left, right) =>
      left.date === right.date
        ? left.circuit.localeCompare(right.circuit)
        : left.date.localeCompare(right.date),
    );

  return {
    days,
    errors: meta.errors,
    refreshedAt: metaRecord.refreshedAt,
  };
}

function buildSnapshotRecords(
  input: AvailableDaysResult,
  refreshedAt: string,
): AvailableDaysCacheRecord[] {
  return [
    {
      cacheKey: AVAILABLE_DAYS_CACHE_KEY,
      scope: AVAILABLE_DAYS_META_SCOPE,
      payload: serializeJson({ errors: input.errors }),
      refreshedAt,
    } as AvailableDaysCacheRecord,
    ...input.days.map(
      (day) =>
        ({
          cacheKey: AVAILABLE_DAYS_CACHE_KEY,
          scope: createDayScope(day.dayId),
          payload: serializeJson(day),
          refreshedAt,
        }) as AvailableDaysCacheRecord,
    ),
  ];
}

export async function getAvailableDaysSnapshot(
  store: AvailableDaysCachePersistence = availableDaysCacheStore,
): Promise<AvailableDaysSnapshot | null> {
  const records = await store.list();
  if (records.length === 0) {
    return null;
  }

  const shardedSnapshot = parseShardedSnapshot(records);
  if (shardedSnapshot) {
    return shardedSnapshot;
  }

  const legacyRecord = records.find((record) => record.scope === AVAILABLE_DAYS_LEGACY_SCOPE);
  return legacyRecord ? parseLegacySnapshot(legacyRecord) : null;
}

export async function refreshAvailableDaysSnapshot(
  input: AvailableDaysResult,
  store: AvailableDaysCachePersistence = availableDaysCacheStore,
): Promise<AvailableDaysSnapshot> {
  const refreshedAt = new Date().toISOString();
  const existing = await store.list();
  const nextRecords = buildSnapshotRecords(input, refreshedAt);
  const metaRecord = nextRecords.find((record) => record.scope === AVAILABLE_DAYS_META_SCOPE);
  const dayRecords = nextRecords.filter(isDayRecord);
  const nextScopes = new Set(nextRecords.map((record) => record.scope));
  const staleScopes = existing
    .map((record) => record.scope)
    .filter((scope) => !nextScopes.has(scope));

  await store.putMany(dayRecords);
  if (metaRecord) {
    await store.putMany([metaRecord]);
  }
  if (staleScopes.length > 0) {
    await store.deleteScopes(staleScopes);
  }

  return {
    days: input.days,
    errors: input.errors,
    refreshedAt,
  };
}
