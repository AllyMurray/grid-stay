import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const MemberProfileEntity = new Entity(
  {
    model: {
      entity: 'memberProfile',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      userId: { type: 'string', required: true },
      profileScope: { type: 'string', required: true },
      displayName: { type: 'string', required: true },
      updatedByUserId: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      profile: {
        pk: { field: 'pk', composite: ['userId'] },
        sk: { field: 'sk', composite: ['profileScope'] },
      },
      allProfiles: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['profileScope'] },
        sk: { field: 'gsi1sk', composite: ['userId'] },
      },
    },
  },
  { client, table: tableName },
);

export type MemberProfileRecord = EntityItem<typeof MemberProfileEntity>;
