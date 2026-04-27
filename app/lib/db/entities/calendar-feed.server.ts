import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const CalendarFeedEntity = new Entity(
  {
    model: {
      entity: 'calendarFeed',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      tokenHash: { type: 'string', required: true },
      feedScope: { type: 'string', required: true },
      token: { type: 'string', required: true },
      userId: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
      revokedAt: { type: 'string' },
    },
    indexes: {
      feed: {
        pk: { field: 'pk', composite: ['tokenHash'] },
        sk: { field: 'sk', composite: ['feedScope'] },
      },
      byUser: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['userId'] },
        sk: { field: 'gsi1sk', composite: ['createdAt', 'tokenHash'] },
      },
    },
  },
  { client, table: tableName },
);

export type CalendarFeedRecord = EntityItem<typeof CalendarFeedEntity>;
