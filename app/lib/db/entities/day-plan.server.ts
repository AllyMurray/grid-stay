import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const DayPlanEntity = new Entity(
  {
    model: {
      entity: 'dayPlan',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      dayId: { type: 'string', required: true },
      planScope: { type: 'string', required: true },
      notes: { type: 'string', required: true },
      dinnerVenue: { type: 'string' },
      dinnerTime: { type: 'string' },
      dinnerHeadcount: { type: 'string' },
      dinnerNotes: { type: 'string' },
      dinnerPlan: { type: 'string' },
      updatedByUserId: { type: 'string', required: true },
      updatedByName: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      plan: {
        pk: { field: 'pk', composite: ['dayId'] },
        sk: { field: 'sk', composite: ['planScope'] },
      },
    },
  },
  { client, table: tableName },
);

export type DayPlanRecord = EntityItem<typeof DayPlanEntity>;
