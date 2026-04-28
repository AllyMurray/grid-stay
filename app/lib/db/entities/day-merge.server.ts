import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const DayMergeEntity = new Entity(
  {
    model: {
      entity: 'dayMerge',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      sourceDayId: { type: 'string', required: true },
      mergeScope: { type: 'string', required: true },
      targetDayId: { type: 'string', required: true },
      reason: { type: 'string' },
      createdByUserId: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      merge: {
        pk: { field: 'pk', composite: ['sourceDayId'] },
        sk: { field: 'sk', composite: ['mergeScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['mergeScope'] },
        sk: { field: 'gsi1sk', composite: ['targetDayId', 'sourceDayId'] },
      },
    },
  },
  { client, table: tableName },
);

export type DayMergeRecord = EntityItem<typeof DayMergeEntity>;
