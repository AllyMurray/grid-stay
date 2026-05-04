import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const HotelReviewEntity = new Entity(
  {
    model: {
      entity: 'hotelReview',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      hotelId: { type: 'string', required: true },
      reviewId: { type: 'string', required: true },
      reviewScope: { type: 'string', required: true },
      userId: { type: 'string', required: true },
      userName: { type: 'string', required: true },
      rating: { type: 'number' },
      trailerParking: {
        type: ['unknown', 'good', 'limited', 'none'] as const,
        required: true,
      },
      secureParking: {
        type: ['unknown', 'yes', 'mixed', 'no'] as const,
        required: true,
      },
      lateCheckIn: {
        type: ['unknown', 'yes', 'limited', 'no'] as const,
        required: true,
      },
      parkingNotes: { type: 'string' },
      generalNotes: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      review: {
        pk: { field: 'pk', composite: ['hotelId'] },
        sk: { field: 'sk', composite: ['reviewId'] },
      },
      byUser: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['userId'] },
        sk: { field: 'gsi1sk', composite: ['hotelId'] },
      },
      byHotel: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['hotelId'] },
        sk: { field: 'gsi2sk', composite: ['updatedAt', 'reviewId'] },
      },
    },
  },
  { client, table: tableName },
);

export type HotelReviewRecord = EntityItem<typeof HotelReviewEntity>;
