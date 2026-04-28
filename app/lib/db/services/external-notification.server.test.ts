import { describe, expect, it, vi } from 'vitest';
import type { AdminMemberDirectoryEntry } from '~/lib/auth/members.server';
import type { AvailableDay } from '~/lib/days/types';

vi.mock('../entities/external-notification.server', () => ({
  ExternalNotificationEntity: {},
}));

vi.mock('~/lib/auth/members.server', () => ({
  listAdminSiteMembers: vi.fn(),
}));

vi.mock('~/lib/days/preferences.server', () => ({
  getSavedDaysFilters: vi.fn(),
}));

import type { SavedDaysFilters } from '~/lib/days/preferences.server';
import type { ExternalNotificationRecord } from '../entities/external-notification.server';
import {
  createExternalNotifications,
  type ExternalNotificationPersistence,
  listRecentExternalNotifications,
  queueAdminExternalAlertSafely,
  queueExternalAlertsForNewDays,
} from './external-notification.server';

function createMemoryStore(): {
  records: ExternalNotificationRecord[];
  store: ExternalNotificationPersistence;
} {
  const records: ExternalNotificationRecord[] = [];

  return {
    records,
    store: {
      async putMany(items) {
        records.push(...items);
      },
      async listAll() {
        return [...records];
      },
    },
  };
}

const member: AdminMemberDirectoryEntry = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
  activeTripsCount: 0,
  sharedStayCount: 0,
  nextTrip: undefined,
};

const admin: AdminMemberDirectoryEntry = {
  ...member,
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin One',
  role: 'admin',
};

const snettertonDay: AvailableDay = {
  dayId: 'day-1',
  date: '2026-05-10',
  type: 'race_day',
  circuit: 'Snetterton',
  provider: 'Caterham Motorsport',
  description: 'Caterham Academy • Round 1',
  bookingUrl: 'https://example.com/book',
  source: {
    sourceType: 'caterham',
    sourceName: 'caterham',
    metadata: { series: 'Caterham Academy' },
  },
};

describe('external notification service', () => {
  it('creates and lists queued notifications newest first', async () => {
    const memory = createMemoryStore();

    await createExternalNotifications(
      [
        {
          channel: 'email',
          category: 'member_alert',
          recipientName: 'Driver One',
          recipientAddress: 'driver@example.com',
          subject: 'Older',
          body: 'Older alert',
          createdAt: '2026-04-27T10:00:00.000Z',
        },
        {
          channel: 'email',
          category: 'admin_alert',
          recipientName: 'Admin One',
          recipientAddress: 'admin@example.com',
          subject: 'Newer',
          body: 'Newer alert',
          createdAt: '2026-04-27T11:00:00.000Z',
        },
      ],
      memory.store,
    );

    await expect(
      listRecentExternalNotifications(1, memory.store),
    ).resolves.toMatchObject([
      {
        subject: 'Newer',
        status: 'pending',
      },
    ]);
  });

  it('queues member alerts only when a new day matches saved filters', async () => {
    const memory = createMemoryStore();
    const filtersByUser: Record<string, SavedDaysFilters | null> = {
      'user-1': {
        month: '2026-05',
        series: 'caterham-academy',
        circuits: ['Snetterton'],
        provider: '',
        type: '',
        notifyOnNewMatches: true,
        externalChannel: 'email',
      },
      'user-2': {
        month: '2026-06',
        series: '',
        circuits: [],
        provider: '',
        type: '',
        notifyOnNewMatches: true,
        externalChannel: 'email',
      },
    };

    const queued = await queueExternalAlertsForNewDays([snettertonDay], {
      loadMembers: async () => [
        member,
        {
          ...member,
          id: 'user-2',
          email: 'other@example.com',
          name: 'Other Driver',
        },
      ],
      loadSavedFilters: async (userId) => filtersByUser[userId] ?? null,
      store: memory.store,
    });

    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      category: 'member_alert',
      recipientAddress: 'driver@example.com',
      relatedId: 'day-1',
    });
  });

  it('queues admin error alerts for admin users', async () => {
    const memory = createMemoryStore();

    const queued = await queueAdminExternalAlertSafely(
      {
        category: 'error',
        action: 'availableDays.refresh.failed',
        message: 'Available days refresh failed.',
        subject: { type: 'availableDays', id: 'snapshot' },
      },
      {
        loadMembers: async () => [member, admin],
        store: memory.store,
      },
    );

    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      category: 'admin_alert',
      recipientAddress: 'admin@example.com',
      subject: 'Grid Stay error: availableDays.refresh.failed',
    });
  });
});
