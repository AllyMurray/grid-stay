import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const AppEventEntity = new Entity(
  {
    model: {
      entity: 'appEvent',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      eventId: { type: 'string', required: true },
      eventScope: { type: 'string', required: true },
      category: {
        type: ['audit', 'error', 'operational'] as const,
        required: true,
      },
      severity: {
        type: ['info', 'warning', 'error'] as const,
        required: true,
      },
      action: { type: 'string', required: true },
      message: { type: 'string', required: true },
      actorUserId: { type: 'string' },
      actorName: { type: 'string' },
      subjectType: { type: 'string' },
      subjectId: { type: 'string' },
      metadataJson: { type: 'string' },
      createdAt: { type: 'string', required: true },
    },
    indexes: {
      event: {
        pk: { field: 'pk', composite: ['eventId'] },
        sk: { field: 'sk', composite: ['eventScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['eventScope'] },
        sk: { field: 'gsi1sk', composite: ['createdAt', 'eventId'] },
      },
    },
  },
  { client, table: tableName },
);

export type AppEventRecord = EntityItem<typeof AppEventEntity>;
