import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const GarageShareRequestEntity = new Entity(
  {
    model: {
      entity: 'garageShareRequest',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      requestScope: { type: 'string', required: true },
      requestId: { type: 'string', required: true },
      dayId: { type: 'string', required: true },
      date: { type: 'string', required: true },
      circuit: { type: 'string', required: true },
      provider: { type: 'string', required: true },
      description: { type: 'string', required: true },
      garageBookingId: { type: 'string', required: true },
      garageOwnerUserId: { type: 'string', required: true },
      garageOwnerName: { type: 'string', required: true },
      requesterUserId: { type: 'string', required: true },
      requesterName: { type: 'string', required: true },
      requesterBookingId: { type: 'string', required: true },
      status: {
        type: ['pending', 'approved', 'declined', 'cancelled'] as const,
        required: true,
      },
      message: { type: 'string' },
      garageCostSharePence: { type: 'number' },
      garageCostCurrency: { type: 'string' },
      decidedAt: { type: 'string' },
      decidedByUserId: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      request: {
        pk: { field: 'pk', composite: ['requestScope'] },
        sk: { field: 'sk', composite: ['requestId'] },
      },
      byDay: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['dayId'] },
        sk: {
          field: 'gsi1sk',
          composite: ['status', 'garageBookingId', 'requesterUserId'],
        },
      },
      byOwner: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['garageOwnerUserId'] },
        sk: {
          field: 'gsi2sk',
          composite: ['status', 'createdAt', 'requestId'],
        },
      },
    },
  },
  { client, table: tableName },
);

export type GarageShareRequestRecord = EntityItem<typeof GarageShareRequestEntity>;
