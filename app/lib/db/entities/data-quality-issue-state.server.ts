import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const DataQualityIssueStateEntity = new Entity(
  {
    model: {
      entity: 'dataQualityIssueState',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      issueId: { type: 'string', required: true },
      issueScope: { type: 'string', required: true },
      status: {
        type: ['ignored', 'resolved'] as const,
        required: true,
      },
      note: { type: 'string' },
      updatedByUserId: { type: 'string', required: true },
      updatedByName: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      state: {
        pk: { field: 'pk', composite: ['issueId'] },
        sk: { field: 'sk', composite: ['issueScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['issueScope'] },
        sk: { field: 'gsi1sk', composite: ['status', 'updatedAt', 'issueId'] },
      },
    },
  },
  { client, table: tableName },
);

export type DataQualityIssueStateRecord = EntityItem<typeof DataQualityIssueStateEntity>;
