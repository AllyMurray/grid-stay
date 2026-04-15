import type { AvailableDaysResult } from '~/lib/days/types';
import {
  AvailableDaysCacheEntity,
  type AvailableDaysCacheRecord,
} from '../entities/available-days-cache.server';

const AVAILABLE_DAYS_CACHE_KEY = 'available-days';
const AVAILABLE_DAYS_CACHE_SCOPE = 'current';

export interface AvailableDaysSnapshot extends AvailableDaysResult {
  refreshedAt: string;
}

export interface AvailableDaysCachePersistence {
  get(): Promise<AvailableDaysCacheRecord | null>;
  put(item: AvailableDaysCacheRecord): Promise<void>;
}

export const availableDaysCacheStore: AvailableDaysCachePersistence = {
  async get() {
    const response = await AvailableDaysCacheEntity.get({
      cacheKey: AVAILABLE_DAYS_CACHE_KEY,
      scope: AVAILABLE_DAYS_CACHE_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async put(item) {
    await AvailableDaysCacheEntity.put(item).go();
  },
};

function serializeSnapshot(input: AvailableDaysResult): string {
  return JSON.stringify({
    days: input.days,
    errors: input.errors,
  });
}

function parseSnapshot(
  record: AvailableDaysCacheRecord,
): AvailableDaysSnapshot {
  const parsed = JSON.parse(record.payload) as AvailableDaysResult;

  return {
    days: parsed.days,
    errors: parsed.errors,
    refreshedAt: record.refreshedAt,
  };
}

export async function getAvailableDaysSnapshot(
  store: AvailableDaysCachePersistence = availableDaysCacheStore,
): Promise<AvailableDaysSnapshot | null> {
  const record = await store.get();
  if (!record) {
    return null;
  }

  return parseSnapshot(record);
}

export async function refreshAvailableDaysSnapshot(
  input: AvailableDaysResult,
  store: AvailableDaysCachePersistence = availableDaysCacheStore,
): Promise<AvailableDaysSnapshot> {
  const refreshedAt = new Date().toISOString();
  const record = {
    cacheKey: AVAILABLE_DAYS_CACHE_KEY,
    scope: AVAILABLE_DAYS_CACHE_SCOPE,
    payload: serializeSnapshot(input),
    refreshedAt,
  } as AvailableDaysCacheRecord;

  await store.put(record);

  return parseSnapshot(record);
}
