import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const BookingEntity = new Entity(
  {
    model: {
      entity: 'booking',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      bookingId: { type: 'string', required: true },
      userId: { type: 'string', required: true },
      userName: { type: 'string', required: true },
      userImage: { type: 'string' },
      dayId: { type: 'string', required: true },
      date: { type: 'string', required: true },
      status: {
        type: ['booked', 'cancelled', 'maybe'] as const,
        required: true,
      },
      circuit: { type: 'string', required: true },
      provider: { type: 'string', required: true },
      bookingReference: { type: 'string' },
      description: { type: 'string', required: true },
      accommodationName: { type: 'string' },
      accommodationReference: { type: 'string' },
      notes: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      booking: {
        pk: { field: 'pk', composite: ['userId'] },
        sk: { field: 'sk', composite: ['bookingId'] },
      },
      byDay: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['dayId'] },
        sk: { field: 'gsi1sk', composite: ['status', 'userName', 'bookingId'] },
      },
      byUserDay: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['userId'] },
        sk: { field: 'gsi2sk', composite: ['dayId'] },
      },
    },
  },
  { client, table: tableName },
);

export type BookingRecord = EntityItem<typeof BookingEntity>;
