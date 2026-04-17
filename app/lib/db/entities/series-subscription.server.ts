import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const SeriesSubscriptionEntity = new Entity(
  {
    model: {
      entity: 'seriesSubscription',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      userId: { type: 'string', required: true },
      seriesKey: { type: 'string', required: true },
      seriesName: { type: 'string', required: true },
      status: {
        type: ['booked', 'maybe'] as const,
        required: true,
      },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      subscription: {
        pk: { field: 'pk', composite: ['userId'] },
        sk: { field: 'sk', composite: ['seriesKey'] },
      },
      bySeries: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['seriesKey'] },
        sk: { field: 'gsi1sk', composite: ['userId'] },
      },
    },
  },
  { client, table: tableName },
);

export type SeriesSubscriptionRecord = EntityItem<
  typeof SeriesSubscriptionEntity
>;
