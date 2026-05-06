import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const CostGroupEntity = new Entity(
  {
    model: {
      entity: 'costGroup',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      groupScope: { type: 'string', required: true },
      groupId: { type: 'string', required: true },
      dayId: { type: 'string', required: true },
      name: { type: 'string', required: true },
      category: {
        type: ['track_day', 'hotel', 'garage', 'food', 'fuel', 'other'] as const,
        required: true,
      },
      participantUserIds: {
        type: 'list',
        items: { type: 'string' },
        required: true,
      },
      participantNamesJson: { type: 'string', required: true },
      createdByUserId: { type: 'string', required: true },
      createdByName: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      group: {
        pk: { field: 'pk', composite: ['groupScope'] },
        sk: { field: 'sk', composite: ['groupId'] },
      },
      byDay: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['dayId'] },
        sk: { field: 'gsi1sk', composite: ['createdAt', 'groupId'] },
      },
    },
  },
  { client, table: tableName },
);

export type CostGroupRecord = EntityItem<typeof CostGroupEntity>;
