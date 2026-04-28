import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const FeedChangeEntity = new Entity(
  {
    model: {
      entity: 'feedChange',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      changeId: { type: 'string', required: true },
      changeScope: { type: 'string', required: true },
      refreshId: { type: 'string', required: true },
      changeType: {
        type: ['added', 'changed', 'removed'] as const,
        required: true,
      },
      severity: {
        type: ['info', 'warning'] as const,
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
      changedFields: {
        type: 'list',
        items: { type: 'string' },
      },
      previousJson: { type: 'string' },
      nextJson: { type: 'string' },
      createdAt: { type: 'string', required: true },
    },
    indexes: {
      change: {
        pk: { field: 'pk', composite: ['changeId'] },
        sk: { field: 'sk', composite: ['changeScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['changeScope'] },
        sk: { field: 'gsi1sk', composite: ['createdAt', 'changeId'] },
      },
      byRefresh: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['refreshId'] },
        sk: { field: 'gsi2sk', composite: ['changeType', 'dayId'] },
      },
    },
  },
  { client, table: tableName },
);

export type FeedChangeRecord = EntityItem<typeof FeedChangeEntity>;
