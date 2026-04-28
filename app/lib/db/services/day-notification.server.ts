import { normalizeCircuitName } from '~/lib/circuit-sources/shared.server';
import {
  getSavedDaysFilters,
  type SavedDaysFilters,
} from '~/lib/days/preferences.server';
import {
  getLinkedSeriesKey,
  getLinkedSeriesName,
} from '~/lib/days/series.server';
import type { AvailableDay } from '~/lib/days/types';
import {
  DayNotificationEntity,
  DayNotificationReadEntity,
  type DayNotificationReadRecord,
  type DayNotificationRecord,
} from '../entities/day-notification.server';
import type { FeedChangeRecord } from '../entities/feed-change.server';

const DAY_NOTIFICATION_SCOPE = 'available-days';

export interface UserDayNotification extends DayNotificationRecord {
  isRead: boolean;
  readAt?: string;
}

export interface DayNotificationPersistence {
  putMany(items: DayNotificationRecord[]): Promise<void>;
  listAll(): Promise<DayNotificationRecord[]>;
}

export interface DayNotificationReadPersistence {
  putMany(items: DayNotificationReadRecord[]): Promise<void>;
  listByUser(userId: string): Promise<DayNotificationReadRecord[]>;
}

export const dayNotificationStore: DayNotificationPersistence = {
  async putMany(items) {
    await Promise.all(
      items.map((item) => DayNotificationEntity.put(item).go()),
    );
  },
  async listAll() {
    const response = await DayNotificationEntity.query
      .notifications({
        scope: DAY_NOTIFICATION_SCOPE,
      })
      .go();
    return response.data;
  },
};

export const dayNotificationReadStore: DayNotificationReadPersistence = {
  async putMany(items) {
    await Promise.all(
      items.map((item) => DayNotificationReadEntity.put(item).go()),
    );
  },
  async listByUser(userId) {
    const response = await DayNotificationReadEntity.query
      .readState({ userId })
      .go();
    return response.data;
  },
};

function createNotificationId(dayId: string): string {
  return `new-day#${dayId}`;
}

function createChangedNotificationId(
  change: Pick<FeedChangeRecord, 'changeId'>,
): string {
  return `changed-day#${change.changeId}`;
}

function compareNotificationNewestFirst(
  left: DayNotificationRecord,
  right: DayNotificationRecord,
) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return right.notificationId.localeCompare(left.notificationId);
}

function toNotificationRecord(
  day: AvailableDay,
  createdAt: string,
): DayNotificationRecord {
  return {
    scope: DAY_NOTIFICATION_SCOPE,
    notificationId: createNotificationId(day.dayId),
    type: 'new_available_day',
    dayId: day.dayId,
    date: day.date,
    dayType: day.type,
    circuit: day.circuit,
    provider: day.provider,
    description: day.description,
    seriesKey: getLinkedSeriesKey(day) ?? undefined,
    seriesName: getLinkedSeriesName(day) ?? undefined,
    bookingUrl: day.bookingUrl,
    createdAt,
  } as DayNotificationRecord;
}

function toChangedNotificationRecord(
  change: FeedChangeRecord,
): DayNotificationRecord {
  return {
    scope: DAY_NOTIFICATION_SCOPE,
    notificationId: createChangedNotificationId(change),
    type: 'changed_available_day',
    dayId: change.dayId,
    date: change.date,
    dayType: change.dayType,
    circuit: change.circuit,
    provider: change.provider,
    description: `Updated fields: ${(change.changedFields ?? []).join(', ')}`,
    seriesKey: change.seriesKey,
    seriesName: change.seriesName,
    createdAt: change.createdAt,
  } as DayNotificationRecord;
}

function notificationMatchesSavedFilters(
  notification: DayNotificationRecord,
  filters: SavedDaysFilters,
) {
  if (filters.month && !notification.date.startsWith(filters.month)) {
    return false;
  }
  if (filters.series && notification.seriesKey !== filters.series) {
    return false;
  }
  if (
    filters.circuits.length > 0 &&
    !filters.circuits
      .map(normalizeCircuitName)
      .includes(normalizeCircuitName(notification.circuit))
  ) {
    return false;
  }
  if (filters.provider && notification.provider !== filters.provider) {
    return false;
  }
  if (filters.type && notification.dayType !== filters.type) {
    return false;
  }

  return true;
}

async function getUserNotificationFilter(
  userId: string,
  loadSavedFilters: (userId: string) => Promise<SavedDaysFilters | null>,
): Promise<SavedDaysFilters | null> {
  const filters = await loadSavedFilters(userId);
  return filters?.notifyOnNewMatches ? filters : null;
}

export function findNewAvailableDays(
  previousDays: AvailableDay[] | null,
  nextDays: AvailableDay[],
): AvailableDay[] {
  if (!previousDays) {
    return [];
  }

  const previousDayIds = new Set(previousDays.map((day) => day.dayId));
  return nextDays.filter((day) => !previousDayIds.has(day.dayId));
}

export async function createAvailableDayNotifications(
  days: AvailableDay[],
  store: DayNotificationPersistence = dayNotificationStore,
): Promise<DayNotificationRecord[]> {
  if (days.length === 0) {
    return [];
  }

  const createdAt = new Date().toISOString();
  const records = days.map((day) => toNotificationRecord(day, createdAt));
  await store.putMany(records);
  return records;
}

export async function createAvailableDayNotificationsSafely(
  days: AvailableDay[],
  store: DayNotificationPersistence = dayNotificationStore,
): Promise<DayNotificationRecord[]> {
  try {
    return await createAvailableDayNotifications(days, store);
  } catch (error) {
    console.error('Failed to create available day notifications', {
      dayIds: days.map((day) => day.dayId),
      error,
    });
    const { recordAppEventSafely } = await import(
      '~/lib/db/services/app-event.server'
    );
    await recordAppEventSafely({
      category: 'error',
      action: 'availableDays.notifications.failed',
      message: 'Failed to create available day notifications.',
      subject: {
        type: 'availableDays',
        id: 'notifications',
      },
      metadata: {
        dayIds: days.map((day) => day.dayId),
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return [];
  }
}

export async function createChangedDayNotificationsSafely(
  changes: FeedChangeRecord[],
  store: DayNotificationPersistence = dayNotificationStore,
): Promise<DayNotificationRecord[]> {
  const actionableChanges = changes.filter(
    (change) =>
      change.changeType === 'changed' &&
      (change.changedFields ?? []).some(
        (field) => field === 'date' || field === 'circuit',
      ),
  );

  if (actionableChanges.length === 0) {
    return [];
  }

  try {
    const records = actionableChanges.map(toChangedNotificationRecord);
    await store.putMany(records);
    return records;
  } catch (error) {
    console.error('Failed to create changed day notifications', {
      changeIds: actionableChanges.map((change) => change.changeId),
      error,
    });
    const { recordAppEventSafely } = await import(
      '~/lib/db/services/app-event.server'
    );
    await recordAppEventSafely({
      category: 'error',
      action: 'availableDays.changeNotifications.failed',
      message: 'Failed to create changed day notifications.',
      subject: {
        type: 'availableDays',
        id: 'change-notifications',
      },
      metadata: {
        changeIds: actionableChanges.map((change) => change.changeId),
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return [];
  }
}

export async function listUserDayNotifications(
  userId: string,
  dependencies: {
    notificationStore?: DayNotificationPersistence;
    readStore?: DayNotificationReadPersistence;
    loadSavedFilters?: (userId: string) => Promise<SavedDaysFilters | null>;
    limit?: number;
  } = {},
): Promise<UserDayNotification[]> {
  const notificationStore =
    dependencies.notificationStore ?? dayNotificationStore;
  const readStore = dependencies.readStore ?? dayNotificationReadStore;
  const loadSavedFilters = dependencies.loadSavedFilters ?? getSavedDaysFilters;
  const [notifications, readRecords, filters] = await Promise.all([
    notificationStore.listAll(),
    readStore.listByUser(userId),
    getUserNotificationFilter(userId, loadSavedFilters),
  ]);
  const readByNotificationId = new Map(
    readRecords.map((record) => [record.notificationId, record.readAt]),
  );
  const visibleNotifications = filters
    ? notifications.filter((notification) =>
        notificationMatchesSavedFilters(notification, filters),
      )
    : notifications;
  const sorted = [...visibleNotifications].sort(compareNotificationNewestFirst);
  const limited =
    dependencies.limit && dependencies.limit > 0
      ? sorted.slice(0, dependencies.limit)
      : sorted;

  return limited.map((notification) => {
    const readAt = readByNotificationId.get(notification.notificationId);

    return {
      ...notification,
      isRead: Boolean(readAt),
      readAt,
    };
  });
}

export async function countUnreadDayNotifications(
  userId: string,
  dependencies: {
    notificationStore?: DayNotificationPersistence;
    readStore?: DayNotificationReadPersistence;
    loadSavedFilters?: (userId: string) => Promise<SavedDaysFilters | null>;
  } = {},
): Promise<number> {
  const notifications = await listUserDayNotifications(userId, dependencies);
  return notifications.filter((notification) => !notification.isRead).length;
}

export async function markDayNotificationsRead(
  userId: string,
  notificationIds: string[],
  readStore: DayNotificationReadPersistence = dayNotificationReadStore,
): Promise<void> {
  const uniqueNotificationIds = [...new Set(notificationIds)];
  if (uniqueNotificationIds.length === 0) {
    return;
  }

  const readAt = new Date().toISOString();
  await readStore.putMany(
    uniqueNotificationIds.map(
      (notificationId) =>
        ({
          userId,
          notificationId,
          readAt,
        }) as DayNotificationReadRecord,
    ),
  );
}

export async function markAllDayNotificationsRead(
  userId: string,
  dependencies: {
    notificationStore?: DayNotificationPersistence;
    readStore?: DayNotificationReadPersistence;
    loadSavedFilters?: (userId: string) => Promise<SavedDaysFilters | null>;
  } = {},
): Promise<void> {
  const notificationStore =
    dependencies.notificationStore ?? dayNotificationStore;
  const readStore = dependencies.readStore ?? dayNotificationReadStore;
  const notifications = await listUserDayNotifications(userId, {
    notificationStore,
    readStore,
    loadSavedFilters: dependencies.loadSavedFilters,
  });

  await markDayNotificationsRead(
    userId,
    notifications.map((notification) => notification.notificationId),
    readStore,
  );
}
