import { ulid } from 'ulid';
import type { User } from '~/lib/auth/schemas';
import type { AvailableDay } from '~/lib/days/types';
import type { CreateManualDayInput } from '~/lib/schemas/manual-day';
import {
  ManualDayEntity,
  type ManualDayRecord,
} from '../entities/manual-day.server';

export interface ManualDayPersistence {
  create(item: ManualDayRecord): Promise<ManualDayRecord>;
  listByOwner(ownerUserId: string): Promise<ManualDayRecord[]>;
}

export const manualDayStore: ManualDayPersistence = {
  async create(item) {
    await ManualDayEntity.create(item).go({
      response: 'none',
    });
    return item;
  },
  async listByOwner(ownerUserId) {
    const response = await ManualDayEntity.query.ownerDay({ ownerUserId }).go();
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
  return {
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    circuit: day.circuit,
    provider: day.provider,
    description: day.description,
    bookingUrl: day.bookingUrl,
    source: {
      sourceType: 'manual',
      sourceName: 'manual',
      externalId: day.manualDayId,
      metadata: {
        ownerUserId: day.ownerUserId,
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
    manualDayId,
    dayId: `manual:${manualDayId}`,
    date: input.date,
    type: input.type,
    circuit: input.circuit.trim(),
    provider: input.provider.trim(),
    description: input.description.trim(),
    bookingUrl: sanitizeOptional(input.bookingUrl),
    createdAt: now,
    updatedAt: now,
  } as ManualDayRecord);
}

export async function listManualDaysForUser(
  userId: string,
  store: ManualDayPersistence = manualDayStore,
): Promise<AvailableDay[]> {
  const manualDays = await store.listByOwner(userId);

  return manualDays.sort(compareManualDays).map(toAvailableManualDay);
}
