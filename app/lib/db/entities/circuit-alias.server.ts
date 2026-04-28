import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const CircuitAliasEntity = new Entity(
  {
    model: {
      entity: 'circuitAlias',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      aliasKey: { type: 'string', required: true },
      aliasScope: { type: 'string', required: true },
      rawCircuit: { type: 'string', required: true },
      rawLayout: { type: 'string' },
      canonicalCircuit: { type: 'string', required: true },
      canonicalLayout: { type: 'string' },
      note: { type: 'string' },
      createdByUserId: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      alias: {
        pk: { field: 'pk', composite: ['aliasKey'] },
        sk: { field: 'sk', composite: ['aliasScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['aliasScope'] },
        sk: {
          field: 'gsi1sk',
          composite: ['canonicalCircuit', 'rawCircuit'],
        },
      },
    },
  },
  { client, table: tableName },
);

export type CircuitAliasRecord = EntityItem<typeof CircuitAliasEntity>;
