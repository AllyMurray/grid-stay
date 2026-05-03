import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const CostExpenseEntity = new Entity(
  {
    model: {
      entity: 'costExpense',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      expenseScope: { type: 'string', required: true },
      expenseId: { type: 'string', required: true },
      groupId: { type: 'string', required: true },
      dayId: { type: 'string', required: true },
      title: { type: 'string', required: true },
      amountPence: { type: 'number', required: true },
      currency: { type: 'string', required: true },
      paidByUserId: { type: 'string', required: true },
      paidByName: { type: 'string', required: true },
      notes: { type: 'string' },
      createdByUserId: { type: 'string', required: true },
      createdByName: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      expense: {
        pk: { field: 'pk', composite: ['expenseScope'] },
        sk: { field: 'sk', composite: ['expenseId'] },
      },
      byDay: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['dayId'] },
        sk: {
          field: 'gsi1sk',
          composite: ['groupId', 'createdAt', 'expenseId'],
        },
      },
      byGroup: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['groupId'] },
        sk: { field: 'gsi2sk', composite: ['createdAt', 'expenseId'] },
      },
    },
  },
  { client, table: tableName },
);

export type CostExpenseRecord = EntityItem<typeof CostExpenseEntity>;
