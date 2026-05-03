import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const WhatsNewViewEntity = new Entity(
  {
    model: {
      entity: 'whatsNewView',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      userId: { type: 'string', required: true },
      viewScope: { type: 'string', required: true },
      lastViewedAt: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      view: {
        pk: { field: 'pk', composite: ['userId'] },
        sk: { field: 'sk', composite: ['viewScope'] },
      },
    },
  },
  { client, table: tableName },
);

export type WhatsNewViewRecord = EntityItem<typeof WhatsNewViewEntity>;
