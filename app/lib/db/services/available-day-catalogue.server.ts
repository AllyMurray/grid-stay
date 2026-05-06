import { resolveCanonicalCircuit } from '~/lib/circuits/canonical.server';
import type { AvailableDay } from '~/lib/days/types';
import { BookingEntity, type BookingRecord } from '../entities/booking.server';
import {
  AvailableDayCatalogueEntity,
  type AvailableDayCatalogueRecord,
} from '../entities/available-day-catalogue.server';

const CATALOGUE_SCOPE = 'event';

export type { AvailableDayCatalogueRecord };

export interface AvailableDayCataloguePersistence {
  listByDate(): Promise<AvailableDayCatalogueRecord[]>;
  getMany(dayIds: string[]): Promise<Map<string, AvailableDayCatalogueRecord>>;
  putMany(items: AvailableDayCatalogueRecord[]): Promise<void>;
}

export interface UpsertAvailableDayCatalogueOptions {
  now?: string;
}

export const availableDayCatalogueStore: AvailableDayCataloguePersistence = {
  async listByDate() {
    const response = await AvailableDayCatalogueEntity.query
      .byDate({
        catalogueScope: CATALOGUE_SCOPE,
      })
      .go();

    return response.data ?? [];
  },
  async getMany(dayIds) {
    const uniqueDayIds = [...new Set(dayIds)];
    const results = await Promise.all(
      uniqueDayIds.map((dayId) =>
        AvailableDayCatalogueEntity.get({
          catalogueScope: CATALOGUE_SCOPE,
          dayId,
        }).go(),
      ),
    );

    return new Map(
      results
        .map((result) => result.data)
        .filter((record): record is AvailableDayCatalogueRecord => Boolean(record))
        .map((record) => [record.dayId, record]),
    );
  },
  async putMany(items) {
    await Promise.all(
      items.map((item) =>
        AvailableDayCatalogueEntity.put(item).go({
          response: 'none',
        }),
      ),
    );
  },
};

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

function isAvailableDay(value: unknown): value is AvailableDay {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dayId' in value &&
    typeof value.dayId === 'string' &&
    'date' in value &&
    typeof value.date === 'string' &&
    'type' in value &&
    typeof value.type === 'string' &&
    'circuit' in value &&
    typeof value.circuit === 'string' &&
    'provider' in value &&
    typeof value.provider === 'string' &&
    'description' in value &&
    typeof value.description === 'string' &&
    'source' in value &&
    typeof value.source === 'object' &&
    value.source !== null
  );
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

function toCatalogueRecord(
  day: AvailableDay,
  existing: AvailableDayCatalogueRecord | undefined,
  now: string,
): AvailableDayCatalogueRecord {
  return {
    catalogueScope: CATALOGUE_SCOPE,
    dayId: day.dayId,
    date: day.date,
    sourceType: day.source.sourceType,
    sourceName: day.source.sourceName,
    payload: serializeJson(day),
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
  } as AvailableDayCatalogueRecord;
}

export async function upsertAvailableDayCatalogue(
  days: AvailableDay[],
  store: AvailableDayCataloguePersistence = availableDayCatalogueStore,
  options: UpsertAvailableDayCatalogueOptions = {},
): Promise<AvailableDayCatalogueRecord[]> {
  const uniqueDaysById = new Map<string, AvailableDay>();
  for (const day of days) {
    uniqueDaysById.set(day.dayId, day);
  }

  const uniqueDays = [...uniqueDaysById.values()];
  if (uniqueDays.length === 0) {
    return [];
  }

  const now = options.now ?? new Date().toISOString();
  const existingById = await store.getMany(uniqueDays.map((day) => day.dayId));
  const records = uniqueDays.map((day) => toCatalogueRecord(day, existingById.get(day.dayId), now));

  await store.putMany(records);

  return records;
}

export async function listAvailableDayCatalogue(
  store: AvailableDayCataloguePersistence = availableDayCatalogueStore,
): Promise<AvailableDay[]> {
  const records = await store.listByDate();

  return records
    .map((record) => parseJson<AvailableDay>(record.payload))
    .filter((day): day is AvailableDay => isAvailableDay(day))
    .toSorted(compareAvailableDays);
}

export async function loadAvailableDayCatalogueSafely(): Promise<AvailableDay[]> {
  try {
    return await listAvailableDayCatalogue();
  } catch (error) {
    console.error('Failed to load available day catalogue', { error });
    return [];
  }
}

export function toAvailableDayFromBooking(booking: BookingRecord): AvailableDay {
  const canonicalCircuit = resolveCanonicalCircuit(
    booking.circuitName ?? booking.circuit,
    booking.layout,
  );

  return {
    dayId: booking.dayId,
    date: booking.date,
    type: booking.type,
    circuit: canonicalCircuit.circuitName,
    circuitId: booking.circuitId ?? canonicalCircuit.circuitId,
    circuitName: booking.circuitName ?? canonicalCircuit.circuitName,
    layout: booking.layout ?? canonicalCircuit.layout,
    circuitKnown: booking.circuitKnown ?? canonicalCircuit.known,
    provider: booking.provider,
    description: booking.description,
    source: {
      sourceType: 'manual',
      sourceName: 'booking',
      externalId: booking.bookingId,
      metadata: {
        bookingStatus: booking.status,
      },
    },
  };
}

export async function listBookedAvailableDays(): Promise<AvailableDay[]> {
  const response = await BookingEntity.scan.go();
  const bookings = response.data ?? [];
  const daysById = new Map<string, AvailableDay>();

  for (const booking of bookings) {
    daysById.set(booking.dayId, toAvailableDayFromBooking(booking));
  }

  return [...daysById.values()].toSorted(compareAvailableDays);
}
