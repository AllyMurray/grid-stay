import { ulid } from 'ulid';
import { isAdminUser } from '~/lib/auth/authorization';
import {
  type AdminMemberDirectoryEntry,
  listAdminSiteMembers,
} from '~/lib/auth/members.server';
import { filterAvailableDays } from '~/lib/days/aggregation.server';
import {
  getSavedDaysFilters,
  type SavedDaysFilters,
} from '~/lib/days/preferences.server';
import type { AvailableDay } from '~/lib/days/types';
import {
  ExternalNotificationEntity,
  type ExternalNotificationRecord,
} from '../entities/external-notification.server';
import type { AppEventInput } from './app-event.server';

export type { ExternalNotificationRecord };

export const EXTERNAL_NOTIFICATION_SCOPE = 'external';

export interface ExternalNotificationInput {
  channel: ExternalNotificationRecord['channel'];
  category: ExternalNotificationRecord['category'];
  recipientUserId?: string;
  recipientName: string;
  recipientAddress: string;
  subject: string;
  body: string;
  relatedType?: string;
  relatedId?: string;
  createdAt?: string;
}

export interface ExternalNotificationPersistence {
  putMany(items: ExternalNotificationRecord[]): Promise<void>;
  listAll(): Promise<ExternalNotificationRecord[]>;
}

export interface ExternalAlertDependencies {
  loadMembers?: () => Promise<AdminMemberDirectoryEntry[]>;
  loadSavedFilters?: (userId: string) => Promise<SavedDaysFilters | null>;
  store?: ExternalNotificationPersistence;
}

export const externalNotificationStore: ExternalNotificationPersistence = {
  async putMany(items) {
    await Promise.all(
      items.map((item) => ExternalNotificationEntity.put(item).go()),
    );
  },
  async listAll() {
    const response = await ExternalNotificationEntity.query
      .byScope({ notificationScope: EXTERNAL_NOTIFICATION_SCOPE })
      .go();
    return response.data;
  },
};

function sortNewestFirst(
  left: ExternalNotificationRecord,
  right: ExternalNotificationRecord,
) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return right.notificationId.localeCompare(left.notificationId);
}

function createRecord(
  input: ExternalNotificationInput,
): ExternalNotificationRecord {
  const now = input.createdAt ?? new Date().toISOString();

  return {
    notificationId: ulid(),
    notificationScope: EXTERNAL_NOTIFICATION_SCOPE,
    channel: input.channel,
    category: input.category,
    status: 'pending',
    recipientUserId: input.recipientUserId,
    recipientName: input.recipientName,
    recipientAddress: input.recipientAddress,
    subject: input.subject,
    body: input.body,
    relatedType: input.relatedType,
    relatedId: input.relatedId,
    createdAt: now,
    updatedAt: now,
  } as ExternalNotificationRecord;
}

export async function createExternalNotifications(
  inputs: ExternalNotificationInput[],
  store: ExternalNotificationPersistence = externalNotificationStore,
): Promise<ExternalNotificationRecord[]> {
  if (inputs.length === 0) {
    return [];
  }

  const records = inputs.map(createRecord);
  await store.putMany(records);
  return records;
}

export async function createExternalNotificationsSafely(
  inputs: ExternalNotificationInput[],
  store: ExternalNotificationPersistence = externalNotificationStore,
): Promise<ExternalNotificationRecord[]> {
  try {
    return await createExternalNotifications(inputs, store);
  } catch (error) {
    console.error('Failed to queue external notifications', { error });
    return [];
  }
}

export async function listRecentExternalNotifications(
  limit = 50,
  store: ExternalNotificationPersistence = externalNotificationStore,
): Promise<ExternalNotificationRecord[]> {
  const records = await store.listAll();
  return records.sort(sortNewestFirst).slice(0, limit);
}

function buildDayAlertBody(day: AvailableDay) {
  return [
    `${day.date} at ${day.circuit}`,
    `${day.provider}: ${day.description}`,
    day.bookingUrl ? `Booking: ${day.bookingUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function dayMatchesPreference(day: AvailableDay, filters: SavedDaysFilters) {
  return (
    filterAvailableDays([day], {
      month: filters.month || undefined,
      series: filters.series || undefined,
      circuits: filters.circuits,
      provider: filters.provider || undefined,
      type: filters.type || undefined,
    }).length > 0
  );
}

export async function queueExternalAlertsForNewDays(
  days: AvailableDay[],
  dependencies: ExternalAlertDependencies = {},
): Promise<ExternalNotificationRecord[]> {
  if (days.length === 0) {
    return [];
  }

  const members = await (dependencies.loadMembers ?? listAdminSiteMembers)();
  const inputs: ExternalNotificationInput[] = [];
  const loadSavedFilters = dependencies.loadSavedFilters ?? getSavedDaysFilters;

  for (const member of members) {
    const filters = await loadSavedFilters(member.id);
    if (!filters?.notifyOnNewMatches || !filters.externalChannel) {
      continue;
    }

    for (const day of days) {
      if (!dayMatchesPreference(day, filters)) {
        continue;
      }

      inputs.push({
        channel: filters.externalChannel,
        category: 'member_alert',
        recipientUserId: member.id,
        recipientName: member.name,
        recipientAddress: member.email,
        subject: `Grid Stay: new ${day.type.replace(/_/g, ' ')}`,
        body: buildDayAlertBody(day),
        relatedType: 'availableDay',
        relatedId: day.dayId,
      });
    }
  }

  return createExternalNotificationsSafely(inputs, dependencies.store);
}

export async function queueAdminExternalAlertSafely(
  event: AppEventInput,
  dependencies: Omit<ExternalAlertDependencies, 'loadSavedFilters'> = {},
): Promise<ExternalNotificationRecord[]> {
  if (event.category !== 'error') {
    return [];
  }

  try {
    const admins = (
      await (dependencies.loadMembers ?? listAdminSiteMembers)()
    ).filter((member) =>
      isAdminUser({ email: member.email, role: member.role }),
    );
    return createExternalNotificationsSafely(
      admins.map((admin) => ({
        channel: 'email',
        category: 'admin_alert',
        recipientUserId: admin.id,
        recipientName: admin.name,
        recipientAddress: admin.email,
        subject: `Grid Stay error: ${event.action}`,
        body: event.message,
        relatedType: event.subject?.type,
        relatedId: event.subject?.id,
      })),
      dependencies.store,
    );
  } catch (error) {
    console.error('Failed to queue admin external alert', { error });
    return [];
  }
}
