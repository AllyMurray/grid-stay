import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const MemberBetaFeatureEntity = new Entity(
  {
    model: {
      entity: 'memberBetaFeature',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      userId: { type: 'string', required: true },
      preferenceScope: { type: 'string', required: true },
      featureKey: { type: 'string', required: true },
      enabled: { type: 'boolean', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      feature: {
        pk: { field: 'pk', composite: ['userId'] },
        sk: { field: 'sk', composite: ['preferenceScope', 'featureKey'] },
      },
    },
  },
  { client, table: tableName },
);

export type MemberBetaFeatureRecord = EntityItem<typeof MemberBetaFeatureEntity>;
