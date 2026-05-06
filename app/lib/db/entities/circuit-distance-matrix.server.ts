import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const CircuitDistanceMatrixEntity = new Entity(
  {
    model: {
      entity: 'circuitDistanceMatrix',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      matrixId: { type: 'string', required: true },
      profile: { type: 'string', required: true },
      provider: { type: 'string', required: true },
      payload: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      matrix: {
        pk: { field: 'pk', composite: ['matrixId'] },
        sk: { field: 'sk', composite: ['profile'] },
      },
    },
  },
  { client, table: tableName },
);

export type CircuitDistanceMatrixRecord = EntityItem<typeof CircuitDistanceMatrixEntity>;
