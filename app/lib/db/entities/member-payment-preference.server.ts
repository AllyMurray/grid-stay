import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const MemberPaymentPreferenceEntity = new Entity(
  {
    model: {
      entity: 'memberPaymentPreference',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      userId: { type: 'string', required: true },
      preferenceScope: { type: 'string', required: true },
      label: { type: 'string', required: true },
      url: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      preference: {
        pk: { field: 'pk', composite: ['userId'] },
        sk: { field: 'sk', composite: ['preferenceScope'] },
      },
    },
  },
  { client, table: tableName },
);

export type MemberPaymentPreferenceRecord = EntityItem<
  typeof MemberPaymentPreferenceEntity
>;
