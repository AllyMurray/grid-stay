import type { User } from '~/lib/auth/schemas';
import type { DayMergeRule } from '~/lib/days/day-merges';
import type { AvailableDay } from '~/lib/days/types';
import type { BookingRecord } from '../entities/booking.server';
import { DayMergeEntity, type DayMergeRecord } from '../entities/day-merge.server';
import type { DayPlanRecord } from '../entities/day-plan.server';
import {
  type BookingPersistence,
  bookingStore,
  syncDayAttendanceSummaries,
} from './booking.server';
import { type DayPlanPersistence, dayPlanStore, SHARED_DAY_PLAN_SCOPE } from './day-plan.server';
import {
  type GarageShareRequestPersistence,
  type GarageShareRequestRecord,
  garageShareRequestStore,
} from './garage-share-request.server';

export const DAY_MERGE_SCOPE = 'day-merge';

export interface DayMergeInput {
  sourceDayId: string;
  targetDayId: string;
  reason?: string;
}

export interface DayMergePersistence {
  put(item: DayMergeRecord): Promise<DayMergeRecord>;
  delete(sourceDayId: string): Promise<void>;
  get(sourceDayId: string): Promise<DayMergeRecord | null>;
  listAll(): Promise<DayMergeRecord[]>;
}

export interface DayMergeMigrationDependencies {
  bookingStore?: BookingPersistence;
  planStore?: DayPlanPersistence;
  garageShareRequestStore?: GarageShareRequestPersistence;
  syncSummaries?: typeof syncDayAttendanceSummaries;
}

export interface DayMergeMigrationResult {
  movedBookingCount: number;
  mergedBookingCount: number;
  movedPlan: boolean;
}

export const dayMergeStore: DayMergePersistence = {
  async put(item) {
    const record = {
      ...item,
      mergeScope: DAY_MERGE_SCOPE,
    };

    await DayMergeEntity.put(record).go();
    return record;
  },
  async delete(sourceDayId) {
    await DayMergeEntity.delete({
      sourceDayId,
      mergeScope: DAY_MERGE_SCOPE,
    }).go({ response: 'none' });
  },
  async get(sourceDayId) {
    const response = await DayMergeEntity.get({
      sourceDayId,
      mergeScope: DAY_MERGE_SCOPE,
    }).go();
    return response.data ?? null;
  },
  async listAll() {
    const response = await DayMergeEntity.query.byScope({ mergeScope: DAY_MERGE_SCOPE }).go();
    return response.data;
  },
};

function sanitizeOptional(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compareMerges(left: DayMergeRecord, right: DayMergeRecord) {
  if (left.targetDayId !== right.targetDayId) {
    return left.targetDayId.localeCompare(right.targetDayId);
  }

  return left.sourceDayId.localeCompare(right.sourceDayId);
}

function toMergeRule(record: DayMergeRecord): DayMergeRule {
  return {
    sourceDayId: record.sourceDayId,
    targetDayId: record.targetDayId,
  };
}

function bookingKey(userId: string, bookingId: string) {
  return `${userId}:${bookingId}`;
}

function isOpenGarageShareRequest(request: GarageShareRequestRecord) {
  return request.status === 'pending' || request.status === 'approved';
}

function copyBookingToTarget(
  source: BookingRecord,
  targetDay: AvailableDay,
  now: string,
): BookingRecord {
  return {
    ...source,
    bookingId: targetDay.dayId,
    dayId: targetDay.dayId,
    date: targetDay.date,
    type: targetDay.type,
    circuit: targetDay.circuit,
    circuitId: targetDay.circuitId,
    circuitName: targetDay.circuitName,
    layout: targetDay.layout,
    circuitKnown: targetDay.circuitKnown,
    provider: targetDay.provider,
    description: targetDay.description,
    updatedAt: now,
  } as BookingRecord;
}

function mergeGarageShareCount(target: BookingRecord, source: BookingRecord) {
  const count = (target.garageApprovedShareCount ?? 0) + (source.garageApprovedShareCount ?? 0);
  return count > 0 ? count : undefined;
}

function mergePrivateBookingFields(
  target: BookingRecord,
  source: BookingRecord,
  targetDay: AvailableDay,
  now: string,
): Partial<BookingRecord> {
  return {
    date: targetDay.date,
    type: targetDay.type,
    circuit: targetDay.circuit,
    circuitId: targetDay.circuitId,
    circuitName: targetDay.circuitName,
    layout: targetDay.layout,
    circuitKnown: targetDay.circuitKnown,
    provider: targetDay.provider,
    description: targetDay.description,
    status: target.status === 'cancelled' ? source.status : target.status,
    bookingReference: target.bookingReference ?? source.bookingReference,
    arrivalDateTime: target.arrivalDateTime ?? source.arrivalDateTime,
    arrivalTime: target.arrivalTime ?? source.arrivalTime,
    accommodationStatus: target.accommodationStatus ?? source.accommodationStatus,
    accommodationName: target.accommodationName ?? source.accommodationName,
    accommodationReference: target.accommodationReference ?? source.accommodationReference,
    garageBooked: target.garageBooked || source.garageBooked,
    garageCapacity:
      target.garageCapacity ?? (source.garageBooked ? source.garageCapacity : undefined),
    garageLabel: target.garageLabel ?? (source.garageBooked ? source.garageLabel : undefined),
    garageCostTotalPence:
      target.garageCostTotalPence ??
      (source.garageBooked ? source.garageCostTotalPence : undefined),
    garageCostCurrency:
      target.garageCostCurrency ?? (source.garageBooked ? source.garageCostCurrency : undefined),
    garageApprovedShareCount: mergeGarageShareCount(target, source),
    notes: target.notes ?? source.notes,
    updatedAt: now,
  };
}

function getGarageShareMigrationChanges(
  request: GarageShareRequestRecord,
  movedBookings: Map<string, BookingRecord>,
  targetDay: AvailableDay,
  now: string,
): Partial<GarageShareRequestRecord> | null {
  const ownerBooking = movedBookings.get(
    bookingKey(request.garageOwnerUserId, request.garageBookingId),
  );
  const requesterBooking = movedBookings.get(
    bookingKey(request.requesterUserId, request.requesterBookingId),
  );

  if (!ownerBooking?.garageBooked || !requesterBooking) {
    return isOpenGarageShareRequest(request)
      ? {
          status: 'cancelled',
          updatedAt: now,
        }
      : null;
  }

  return {
    dayId: targetDay.dayId,
    date: targetDay.date,
    circuit: targetDay.circuit,
    provider: targetDay.provider,
    description: targetDay.description,
    garageBookingId: ownerBooking.bookingId,
    requesterBookingId: requesterBooking.bookingId,
    updatedAt: now,
  };
}

export async function listDayMerges(
  store: DayMergePersistence = dayMergeStore,
): Promise<DayMergeRecord[]> {
  const records = await store.listAll();
  return records.toSorted(compareMerges);
}

export async function listDayMergeRules(
  store: DayMergePersistence = dayMergeStore,
): Promise<DayMergeRule[]> {
  return (await listDayMerges(store)).map(toMergeRule);
}

export async function upsertDayMerge(
  input: DayMergeInput,
  user: Pick<User, 'id'>,
  store: DayMergePersistence = dayMergeStore,
): Promise<DayMergeRecord> {
  const sourceDayId = input.sourceDayId.trim();
  const targetDayId = input.targetDayId.trim();
  const existing = await store.get(sourceDayId);
  const now = new Date().toISOString();

  return store.put({
    sourceDayId,
    mergeScope: DAY_MERGE_SCOPE,
    targetDayId,
    reason: sanitizeOptional(input.reason),
    createdByUserId: existing?.createdByUserId ?? user.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } as DayMergeRecord);
}

export async function deleteDayMerge(
  sourceDayId: string,
  store: DayMergePersistence = dayMergeStore,
): Promise<void> {
  await store.delete(sourceDayId);
}

export async function migrateMergedDayData(
  sourceDayId: string,
  targetDay: AvailableDay,
  dependencies: DayMergeMigrationDependencies = {},
): Promise<DayMergeMigrationResult> {
  const bookings = dependencies.bookingStore ?? bookingStore;
  const plans = dependencies.planStore ?? dayPlanStore;
  const garageRequests = dependencies.garageShareRequestStore ?? garageShareRequestStore;
  const syncSummaries = dependencies.syncSummaries ?? syncDayAttendanceSummaries;
  const sourceBookings = await bookings.listByDay(sourceDayId);
  const sourceGarageRequests = await garageRequests.listByDay(sourceDayId);
  const now = new Date().toISOString();
  const movedBookings = new Map<string, BookingRecord>();
  let movedBookingCount = 0;
  let mergedBookingCount = 0;

  for (const sourceBooking of sourceBookings) {
    const existingTarget = await bookings.findByUserAndDay(sourceBooking.userId, targetDay.dayId);

    if (existingTarget) {
      const changes = mergePrivateBookingFields(existingTarget, sourceBooking, targetDay, now);
      const updatedTarget = await bookings.update(
        existingTarget.userId,
        existingTarget.bookingId,
        changes,
      );
      movedBookings.set(bookingKey(sourceBooking.userId, sourceBooking.bookingId), updatedTarget);
      mergedBookingCount += 1;
    } else {
      const targetBooking = copyBookingToTarget(sourceBooking, targetDay, now);
      await bookings.create(targetBooking);
      movedBookings.set(bookingKey(sourceBooking.userId, sourceBooking.bookingId), targetBooking);
      movedBookingCount += 1;
    }

    await bookings.delete(sourceBooking.userId, sourceBooking.bookingId);
  }

  await Promise.all(
    sourceGarageRequests
      .map((request) => ({
        request,
        changes: getGarageShareMigrationChanges(request, movedBookings, targetDay, now),
      }))
      .filter(
        (
          item,
        ): item is {
          request: GarageShareRequestRecord;
          changes: Partial<GarageShareRequestRecord>;
        } => item.changes !== null,
      )
      .map(({ request, changes }) => garageRequests.update(request.requestId, changes)),
  );

  const [sourcePlan, targetPlan] = await Promise.all([
    plans.get(sourceDayId),
    plans.get(targetDay.dayId),
  ]);
  let movedPlan = false;

  if (sourcePlan && !targetPlan) {
    await plans.create({
      ...sourcePlan,
      dayId: targetDay.dayId,
      planScope: SHARED_DAY_PLAN_SCOPE,
      createdAt: sourcePlan.createdAt,
      updatedAt: now,
    } as DayPlanRecord);
    movedPlan = true;
  }

  if (sourcePlan) {
    await plans.delete(sourceDayId);
  }

  await syncSummaries([sourceDayId, targetDay.dayId]);

  return {
    movedBookingCount,
    mergedBookingCount,
    movedPlan,
  };
}
