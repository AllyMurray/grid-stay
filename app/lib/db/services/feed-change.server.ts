import { ulid } from 'ulid';
import { getLinkedSeriesKey, getLinkedSeriesName } from '~/lib/days/series.server';
import type { AvailableDay } from '~/lib/days/types';
import { FeedChangeEntity, type FeedChangeRecord } from '../entities/feed-change.server';

export const FEED_CHANGE_SCOPE = 'available-days';

const trackedFields = ['date', 'type', 'circuit', 'provider', 'description', 'bookingUrl'] as const;

type TrackedField = (typeof trackedFields)[number];

export interface FeedChangePersistence {
  putMany(items: FeedChangeRecord[]): Promise<void>;
  listAll(): Promise<FeedChangeRecord[]>;
}

export const feedChangeStore: FeedChangePersistence = {
  async putMany(items) {
    await Promise.all(items.map((item) => FeedChangeEntity.put(item).go()));
  },
  async listAll() {
    const response = await FeedChangeEntity.query.byScope({ changeScope: FEED_CHANGE_SCOPE }).go();
    return response.data;
  },
};

function sortNewestFirst(left: FeedChangeRecord, right: FeedChangeRecord) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return right.changeId.localeCompare(left.changeId);
}

function toSnapshot(day: AvailableDay) {
  return {
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    circuit: day.circuit,
    provider: day.provider,
    description: day.description,
    bookingUrl: day.bookingUrl,
  };
}

function getChangedFields(previous: AvailableDay, next: AvailableDay): TrackedField[] {
  return trackedFields.filter((field) => previous[field] !== next[field]);
}

function changeSeverity(
  changeType: FeedChangeRecord['changeType'],
  changedFields: string[],
): FeedChangeRecord['severity'] {
  if (
    changeType === 'removed' ||
    changedFields.some((field) => field === 'date' || field === 'circuit')
  ) {
    return 'warning';
  }

  return 'info';
}

function createChangeRecord(input: {
  refreshId: string;
  changeType: FeedChangeRecord['changeType'];
  day: AvailableDay;
  changedFields: string[];
  previous?: AvailableDay;
  next?: AvailableDay;
  createdAt: string;
}): FeedChangeRecord {
  return {
    changeId: ulid(),
    changeScope: FEED_CHANGE_SCOPE,
    refreshId: input.refreshId,
    changeType: input.changeType,
    severity: changeSeverity(input.changeType, input.changedFields),
    dayId: input.day.dayId,
    date: input.day.date,
    dayType: input.day.type,
    circuit: input.day.circuit,
    provider: input.day.provider,
    description: input.day.description,
    seriesKey: getLinkedSeriesKey(input.day) ?? undefined,
    seriesName: getLinkedSeriesName(input.day) ?? undefined,
    changedFields: input.changedFields,
    previousJson: input.previous ? JSON.stringify(toSnapshot(input.previous)) : undefined,
    nextJson: input.next ? JSON.stringify(toSnapshot(input.next)) : undefined,
    createdAt: input.createdAt,
  } as FeedChangeRecord;
}

export function diffAvailableDays(
  previousDays: AvailableDay[] | null,
  nextDays: AvailableDay[],
  refreshId: string,
  createdAt = new Date().toISOString(),
): FeedChangeRecord[] {
  if (!previousDays) {
    return [];
  }

  const previousById = new Map(previousDays.map((day) => [day.dayId, day]));
  const nextById = new Map(nextDays.map((day) => [day.dayId, day]));
  const changes: FeedChangeRecord[] = [];

  for (const next of nextDays) {
    const previous = previousById.get(next.dayId);
    if (!previous) {
      changes.push(
        createChangeRecord({
          refreshId,
          changeType: 'added',
          day: next,
          changedFields: [],
          next,
          createdAt,
        }),
      );
      continue;
    }

    const changedFields = getChangedFields(previous, next);
    if (changedFields.length > 0) {
      changes.push(
        createChangeRecord({
          refreshId,
          changeType: 'changed',
          day: next,
          changedFields,
          previous,
          next,
          createdAt,
        }),
      );
    }
  }

  for (const previous of previousDays) {
    if (nextById.has(previous.dayId)) {
      continue;
    }

    changes.push(
      createChangeRecord({
        refreshId,
        changeType: 'removed',
        day: previous,
        changedFields: [],
        previous,
        createdAt,
      }),
    );
  }

  return changes.toSorted((left, right) =>
    left.date === right.date
      ? left.dayId.localeCompare(right.dayId)
      : left.date.localeCompare(right.date),
  );
}

export async function recordFeedChanges(
  changes: FeedChangeRecord[],
  store: FeedChangePersistence = feedChangeStore,
): Promise<FeedChangeRecord[]> {
  if (changes.length === 0) {
    return [];
  }

  await store.putMany(changes);
  return changes;
}

export async function recordFeedChangesSafely(
  changes: FeedChangeRecord[],
  store: FeedChangePersistence = feedChangeStore,
): Promise<FeedChangeRecord[]> {
  try {
    return await recordFeedChanges(changes, store);
  } catch (error) {
    console.error('Failed to record feed changes', { error });
    return [];
  }
}

export async function listRecentFeedChanges(
  limit = 25,
  store: FeedChangePersistence = feedChangeStore,
): Promise<FeedChangeRecord[]> {
  const records = await store.listAll();
  return records.toSorted(sortNewestFirst).slice(0, limit);
}
