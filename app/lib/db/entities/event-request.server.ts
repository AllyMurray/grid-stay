import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const EventRequestEntity = new Entity(
  {
    model: {
      entity: 'eventRequest',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      requestId: { type: 'string', required: true },
      requestScope: { type: 'string', required: true },
      status: {
        type: ['pending', 'approved', 'rejected'] as const,
        required: true,
      },
      date: { type: 'string', required: true },
      type: {
        type: ['race_day', 'test_day', 'track_day', 'road_drive'] as const,
        required: true,
      },
      title: { type: 'string', required: true },
      location: { type: 'string', required: true },
      provider: { type: 'string', required: true },
      description: { type: 'string', required: true },
      bookingUrl: { type: 'string' },
      submittedByUserId: { type: 'string', required: true },
      submittedByName: { type: 'string', required: true },
      submittedByEmail: { type: 'string', required: true },
      reviewedByUserId: { type: 'string' },
      reviewedByName: { type: 'string' },
      reviewedAt: { type: 'string' },
      approvedManualDayId: { type: 'string' },
      approvedDayId: { type: 'string' },
      rejectionReason: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      request: {
        pk: { field: 'pk', composite: ['requestId'] },
        sk: { field: 'sk', composite: ['requestScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['requestScope'] },
        sk: { field: 'gsi1sk', composite: ['createdAt', 'requestId'] },
      },
      byStatus: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['status'] },
        sk: { field: 'gsi2sk', composite: ['createdAt', 'requestId'] },
      },
    },
  },
  { client, table: tableName },
);

export type EventRequestRecord = EntityItem<typeof EventRequestEntity>;
