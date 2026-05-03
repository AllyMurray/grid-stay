import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const DayAttendanceSummaryEntity = new Entity(
  {
    model: {
      entity: 'dayAttendanceSummary',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      dayId: { type: 'string', required: true },
      scope: { type: 'string', required: true },
      attendeeCount: { type: 'number', required: true },
      accommodationNames: {
        type: 'list',
        items: {
          type: 'string',
        },
        required: true,
      },
      garageOwnerCount: { type: 'number' },
      garageOpenSpaceCount: { type: 'number' },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      summary: {
        pk: { field: 'pk', composite: ['dayId'] },
        sk: { field: 'sk', composite: ['scope'] },
      },
    },
  },
  { client, table: tableName },
);

export type DayAttendanceSummaryRecord = EntityItem<
  typeof DayAttendanceSummaryEntity
>;
