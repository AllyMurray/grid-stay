import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const DayNotificationEntity = new Entity(
  {
    model: {
      entity: 'dayNotification',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      scope: { type: 'string', required: true },
      notificationId: { type: 'string', required: true },
      type: {
        type: ['new_available_day', 'changed_available_day'] as const,
        required: true,
      },
      dayId: { type: 'string', required: true },
      date: { type: 'string', required: true },
      dayType: {
        type: ['race_day', 'test_day', 'track_day'] as const,
        required: true,
      },
      circuit: { type: 'string', required: true },
      provider: { type: 'string', required: true },
      description: { type: 'string', required: true },
      seriesKey: { type: 'string' },
      seriesName: { type: 'string' },
      bookingUrl: { type: 'string' },
      createdAt: { type: 'string', required: true },
    },
    indexes: {
      notifications: {
        pk: { field: 'pk', composite: ['scope'] },
        sk: { field: 'sk', composite: ['createdAt', 'notificationId'] },
      },
    },
  },
  { client, table: tableName },
);

export const DayNotificationReadEntity = new Entity(
  {
    model: {
      entity: 'dayNotificationRead',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      userId: { type: 'string', required: true },
      notificationId: { type: 'string', required: true },
      readAt: { type: 'string', required: true },
    },
    indexes: {
      readState: {
        pk: { field: 'pk', composite: ['userId'] },
        sk: { field: 'sk', composite: ['notificationId'] },
      },
    },
  },
  { client, table: tableName },
);

export type DayNotificationRecord = EntityItem<typeof DayNotificationEntity>;
export type DayNotificationReadRecord = EntityItem<
  typeof DayNotificationReadEntity
>;
