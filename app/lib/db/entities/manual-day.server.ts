import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const ManualDayEntity = new Entity(
  {
    model: {
      entity: 'manualDay',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      ownerUserId: { type: 'string', required: true },
      visibilityScope: { type: 'string', required: true },
      manualDayId: { type: 'string', required: true },
      dayId: { type: 'string', required: true },
      date: { type: 'string', required: true },
      type: {
        type: ['race_day', 'test_day', 'track_day', 'road_drive'] as const,
        required: true,
      },
      circuit: { type: 'string', required: true },
      provider: { type: 'string', required: true },
      series: { type: 'string' },
      description: { type: 'string', required: true },
      bookingUrl: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      ownerDay: {
        pk: { field: 'pk', composite: ['ownerUserId'] },
        sk: { field: 'sk', composite: ['date', 'manualDayId'] },
      },
      visibilityDay: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['visibilityScope'] },
        sk: { field: 'gsi1sk', composite: ['date', 'manualDayId'] },
      },
    },
  },
  { client, table: tableName },
);

export type ManualDayRecord = EntityItem<typeof ManualDayEntity>;
