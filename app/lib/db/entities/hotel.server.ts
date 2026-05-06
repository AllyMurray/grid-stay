import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const HotelEntity = new Entity(
  {
    model: {
      entity: 'hotel',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      hotelId: { type: 'string', required: true },
      hotelScope: { type: 'string', required: true },
      normalizedName: { type: 'string', required: true },
      sourceKey: { type: 'string', required: true },
      name: { type: 'string', required: true },
      address: { type: 'string' },
      postcode: { type: 'string' },
      country: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      source: {
        type: ['manual', 'geoapify'] as const,
        required: true,
      },
      sourcePlaceId: { type: 'string' },
      attribution: { type: 'string' },
      createdByUserId: { type: 'string', required: true },
      updatedByUserId: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      hotel: {
        pk: { field: 'pk', composite: ['hotelId'] },
        sk: { field: 'sk', composite: ['hotelScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['hotelScope'] },
        sk: { field: 'gsi1sk', composite: ['normalizedName', 'hotelId'] },
      },
      bySource: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['hotelScope'] },
        sk: { field: 'gsi2sk', composite: ['sourceKey'] },
      },
    },
  },
  { client, table: tableName },
);

export type HotelRecord = EntityItem<typeof HotelEntity>;
