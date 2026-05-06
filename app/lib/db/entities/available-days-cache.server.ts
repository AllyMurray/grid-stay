import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const AvailableDaysCacheEntity = new Entity(
  {
    model: {
      entity: 'availableDaysCache',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      cacheKey: { type: 'string', required: true },
      scope: { type: 'string', required: true },
      payload: { type: 'string', required: true },
      refreshedAt: { type: 'string', required: true },
    },
    indexes: {
      cache: {
        pk: { field: 'pk', composite: ['cacheKey'] },
        sk: { field: 'sk', composite: ['scope'] },
      },
    },
  },
  { client, table: tableName },
);

export type AvailableDaysCacheRecord = EntityItem<typeof AvailableDaysCacheEntity>;
