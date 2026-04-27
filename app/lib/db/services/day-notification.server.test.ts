import { describe, expect, it, vi } from 'vitest';
import type { AvailableDay } from '~/lib/days/types';

vi.mock('../entities/day-notification.server', () => ({
  DayNotificationEntity: {
    put: () => ({ go: async () => undefined }),
    query: {
      notifications: () => ({ go: async () => ({ data: [] }) }),
    },
  },
  DayNotificationReadEntity: {
    put: () => ({ go: async () => undefined }),
    query: {
      readState: () => ({ go: async () => ({ data: [] }) }),
    },
  },
}));

import {
  createAvailableDayNotifications,
  findNewAvailableDays,
  listUserDayNotifications,
  markAllDayNotificationsRead,
} from './day-notification.server';

const existingDay: AvailableDay = {
  dayId: 'day-1',
  date: '2026-05-10',
  type: 'race_day',
  circuit: 'Snetterton',
  provider: 'Caterham Motorsport',
  description: 'Round 1',
  source: {
    sourceType: 'caterham',
    sourceName: 'caterham',
  },
};

const newDay: AvailableDay = {
  dayId: 'day-2',
  date: '2026-05-24',
  type: 'test_day',
  circuit: 'Brands Hatch',
  provider: 'MSV Testing',
  description: 'Indy • Open pit lane',
  bookingUrl: 'https://example.com/book',
  source: {
    sourceType: 'testing',
    sourceName: 'msv',
  },
};

describe('day notification service', () => {
  it('detects newly available days after the first cached refresh', () => {
    expect(findNewAvailableDays(null, [existingDay])).toEqual([]);
    expect(findNewAvailableDays([], [existingDay])).toEqual([existingDay]);
    expect(findNewAvailableDays([existingDay], [existingDay, newDay])).toEqual([
      newDay,
    ]);
  });

  it('creates stable notification records for available days', async () => {
    const putMany = vi.fn(async () => undefined);

    const records = await createAvailableDayNotifications([newDay], {
      putMany,
      listAll: vi.fn(),
    });

    expect(putMany).toHaveBeenCalledWith([
      expect.objectContaining({
        scope: 'available-days',
        notificationId: 'new-day#day-2',
        type: 'new_available_day',
        dayId: 'day-2',
        dayType: 'test_day',
        circuit: 'Brands Hatch',
        bookingUrl: 'https://example.com/book',
      }),
    ]);
    expect(records).toHaveLength(1);
  });

  it('joins notifications with user read state newest first', async () => {
    const notifications = await listUserDayNotifications('user-1', {
      notificationStore: {
        putMany: vi.fn(),
        listAll: vi.fn(async () => [
          {
            scope: 'available-days',
            notificationId: 'new-day#old',
            type: 'new_available_day',
            dayId: 'old',
            date: '2026-04-01',
            dayType: 'track_day',
            circuit: 'Donington Park',
            provider: 'MSV Trackdays',
            description: 'National',
            createdAt: '2026-02-01T09:00:00.000Z',
          },
          {
            scope: 'available-days',
            notificationId: 'new-day#new',
            type: 'new_available_day',
            dayId: 'new',
            date: '2026-05-01',
            dayType: 'race_day',
            circuit: 'Silverstone',
            provider: 'Caterham Motorsport',
            description: 'Round 2',
            createdAt: '2026-03-01T09:00:00.000Z',
          },
        ]),
      } as never,
      readStore: {
        putMany: vi.fn(),
        listByUser: vi.fn(async () => [
          {
            userId: 'user-1',
            notificationId: 'new-day#old',
            readAt: '2026-02-02T09:00:00.000Z',
          },
        ]),
      } as never,
    });

    expect(
      notifications.map((notification) => notification.notificationId),
    ).toEqual(['new-day#new', 'new-day#old']);
    expect(notifications[0]?.isRead).toBe(false);
    expect(notifications[1]).toMatchObject({
      isRead: true,
      readAt: '2026-02-02T09:00:00.000Z',
    });
  });

  it('marks every notification read for a user', async () => {
    const readStore = {
      putMany: vi.fn(async () => undefined),
      listByUser: vi.fn(),
    };

    await markAllDayNotificationsRead('user-1', {
      notificationStore: {
        putMany: vi.fn(),
        listAll: vi.fn(async () => [
          {
            notificationId: 'new-day#day-1',
          },
          {
            notificationId: 'new-day#day-2',
          },
        ]),
      } as never,
      readStore: readStore as never,
    });

    expect(readStore.putMany).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'user-1',
        notificationId: 'new-day#day-1',
        readAt: expect.any(String),
      }),
      expect.objectContaining({
        userId: 'user-1',
        notificationId: 'new-day#day-2',
        readAt: expect.any(String),
      }),
    ]);
  });
});
