import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const AvailableDayCatalogueEntity = new Entity(
  {
    model: {
      entity: 'availableDayCatalogue',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      catalogueScope: { type: 'string', required: true },
      dayId: { type: 'string', required: true },
      date: { type: 'string', required: true },
      sourceType: {
        type: ['caterham', 'testing', 'trackdays', 'manual'] as const,
        required: true,
      },
      sourceName: { type: 'string', required: true },
      payload: { type: 'string', required: true },
      firstSeenAt: { type: 'string', required: true },
      lastSeenAt: { type: 'string', required: true },
    },
    indexes: {
      catalogue: {
        pk: { field: 'pk', composite: ['dayId'] },
        sk: { field: 'sk', composite: ['catalogueScope'] },
      },
      byDate: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['catalogueScope'] },
        sk: { field: 'gsi1sk', composite: ['date', 'dayId'] },
      },
    },
  },
  { client, table: tableName },
);

export type AvailableDayCatalogueRecord = EntityItem<typeof AvailableDayCatalogueEntity>;
