import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const ExternalNotificationEntity = new Entity(
  {
    model: {
      entity: 'externalNotification',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      notificationId: { type: 'string', required: true },
      notificationScope: { type: 'string', required: true },
      channel: {
        type: ['email', 'whatsapp'] as const,
        required: true,
      },
      category: {
        type: ['member_alert', 'admin_alert'] as const,
        required: true,
      },
      status: {
        type: ['pending', 'sent', 'cancelled'] as const,
        required: true,
      },
      recipientUserId: { type: 'string' },
      recipientName: { type: 'string', required: true },
      recipientAddress: { type: 'string', required: true },
      subject: { type: 'string', required: true },
      body: { type: 'string', required: true },
      relatedType: { type: 'string' },
      relatedId: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      notification: {
        pk: { field: 'pk', composite: ['notificationId'] },
        sk: { field: 'sk', composite: ['notificationScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['notificationScope'] },
        sk: { field: 'gsi1sk', composite: ['status', 'createdAt'] },
      },
    },
  },
  { client, table: tableName },
);

export type ExternalNotificationRecord = EntityItem<typeof ExternalNotificationEntity>;
