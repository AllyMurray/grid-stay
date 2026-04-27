import type { AvailableDay } from '~/lib/days/types';
import {
  DayNotificationEntity,
  DayNotificationReadEntity,
  type DayNotificationReadRecord,
  type DayNotificationRecord,
} from '../entities/day-notification.server';

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
    bookingUrl: day.bookingUrl,
    createdAt,
  } as DayNotificationRecord;
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

export async function listUserDayNotifications(
  userId: string,
  dependencies: {
    notificationStore?: DayNotificationPersistence;
    readStore?: DayNotificationReadPersistence;
    limit?: number;
  } = {},
): Promise<UserDayNotification[]> {
  const notificationStore =
    dependencies.notificationStore ?? dayNotificationStore;
  const readStore = dependencies.readStore ?? dayNotificationReadStore;
  const [notifications, readRecords] = await Promise.all([
    notificationStore.listAll(),
    readStore.listByUser(userId),
  ]);
  const readByNotificationId = new Map(
    readRecords.map((record) => [record.notificationId, record.readAt]),
  );
  const sorted = [...notifications].sort(compareNotificationNewestFirst);
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
  } = {},
): Promise<void> {
  const notificationStore =
    dependencies.notificationStore ?? dayNotificationStore;
  const readStore = dependencies.readStore ?? dayNotificationReadStore;
  const notifications = await notificationStore.listAll();

  await markDayNotificationsRead(
    userId,
    notifications.map((notification) => notification.notificationId),
    readStore,
  );
}
