import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const CostSettlementEntity = new Entity(
  {
    model: {
      entity: 'costSettlement',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      settlementScope: { type: 'string', required: true },
      settlementId: { type: 'string', required: true },
      dayId: { type: 'string', required: true },
      debtorUserId: { type: 'string', required: true },
      creditorUserId: { type: 'string', required: true },
      amountPence: { type: 'number', required: true },
      currency: { type: 'string', required: true },
      breakdownHash: { type: 'string', required: true },
      status: { type: ['sent', 'received'] as const, required: true },
      updatedByUserId: { type: 'string', required: true },
      updatedByName: { type: 'string', required: true },
      sentAt: { type: 'string' },
      receivedAt: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      settlement: {
        pk: { field: 'pk', composite: ['settlementScope'] },
        sk: { field: 'sk', composite: ['settlementId'] },
      },
      byDay: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['dayId'] },
        sk: {
          field: 'gsi1sk',
          composite: ['debtorUserId', 'creditorUserId', 'currency'],
        },
      },
    },
  },
  { client, table: tableName },
);

export type CostSettlementRecord = EntityItem<typeof CostSettlementEntity>;
