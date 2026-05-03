import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const MemberDaysPreferenceEntity = new Entity(
  {
    model: {
      entity: 'memberDaysPreference',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      userId: { type: 'string', required: true },
      preferenceScope: { type: 'string', required: true },
      month: { type: 'string' },
      series: { type: 'string' },
      circuits: {
        type: 'list',
        items: {
          type: 'string',
        },
      },
      provider: { type: 'string' },
      dayType: {
        type: ['race_day', 'test_day', 'track_day', 'road_drive'] as const,
      },
      notifyOnNewMatches: { type: 'boolean' },
      externalChannel: {
        type: ['email', 'whatsapp'] as const,
      },
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

export type MemberDaysPreferenceRecord = EntityItem<
  typeof MemberDaysPreferenceEntity
>;
