import { ulid } from 'ulid';
import type { User } from '~/lib/auth/schemas';
import { resolveCanonicalCircuit } from '~/lib/circuits/canonical.server';
import type { AvailableDay } from '~/lib/days/types';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';
import {
  ManualDayEntity,
  type ManualDayRecord,
} from '../entities/manual-day.server';

const GLOBAL_MANUAL_DAY_SCOPE = 'global';

export interface ManualDayPersistence {
  create(item: ManualDayRecord): Promise<ManualDayRecord>;
  listAll(): Promise<ManualDayRecord[]>;
}

export const manualDayStore: ManualDayPersistence = {
  async create(item) {
    await ManualDayEntity.create(item).go({
      response: 'none',
    });
    return item;
  },
  async listAll() {
    const response = await ManualDayEntity.query
      .visibilityDay({
        visibilityScope: GLOBAL_MANUAL_DAY_SCOPE,
      })
      .go();
    return response.data;
  },
};

function sanitizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compareManualDays(left: ManualDayRecord, right: ManualDayRecord) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  if (left.circuit !== right.circuit) {
    return left.circuit.localeCompare(right.circuit);
  }

  return left.manualDayId.localeCompare(right.manualDayId);
}

export function toAvailableManualDay(day: ManualDayRecord): AvailableDay {
  const canonicalCircuit = resolveCanonicalCircuit(day.circuit);

  return {
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    circuit: canonicalCircuit.circuitName,
    circuitId: canonicalCircuit.circuitId,
    circuitName: canonicalCircuit.circuitName,
    layout: canonicalCircuit.layout,
    circuitKnown: canonicalCircuit.known,
    provider: day.provider,
    description: day.description,
    bookingUrl: day.bookingUrl,
    source: {
      sourceType: 'manual',
      sourceName: 'manual',
      externalId: day.manualDayId,
      metadata: {
        createdByUserId: day.ownerUserId,
        series: day.series,
      },
    },
  };
}

export async function createManualDay(
  input: CreateManualDayInput,
  user: User,
  store: ManualDayPersistence = manualDayStore,
): Promise<ManualDayRecord> {
  const manualDayId = ulid();
  const now = new Date().toISOString();

  return store.create({
    ownerUserId: user.id,
    visibilityScope: GLOBAL_MANUAL_DAY_SCOPE,
    manualDayId,
    dayId: `manual:${manualDayId}`,
    date: input.date,
    type: input.type,
    circuit: input.circuit.trim(),
    provider: input.provider.trim(),
    series: sanitizeOptional(input.series),
    description: input.description.trim(),
    bookingUrl: sanitizeOptional(input.bookingUrl),
    createdAt: now,
    updatedAt: now,
  } as ManualDayRecord);
}

export async function listManualDays(
  store: ManualDayPersistence = manualDayStore,
): Promise<AvailableDay[]> {
  const manualDays = await listManagedManualDays(store);

  return manualDays.map(toAvailableManualDay);
}

export async function listManagedManualDays(
  store: ManualDayPersistence = manualDayStore,
): Promise<ManualDayRecord[]> {
  const manualDays = await store.listAll();

  return manualDays.sort(compareManualDays);
}
