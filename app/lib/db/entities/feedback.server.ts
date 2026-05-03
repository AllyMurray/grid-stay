import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const FeedbackEntity = new Entity(
  {
    model: {
      entity: 'feedback',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      feedbackId: { type: 'string', required: true },
      feedbackScope: { type: 'string', required: true },
      userId: { type: 'string', required: true },
      userName: { type: 'string', required: true },
      userEmail: { type: 'string', required: true },
      type: {
        type: ['feature_request', 'feedback', 'bug_report'] as const,
        required: true,
      },
      status: {
        type: ['new', 'reviewed', 'planned', 'closed'] as const,
        required: true,
      },
      title: { type: 'string', required: true },
      message: { type: 'string', required: true },
      context: { type: 'string' },
      adminUpdatesJson: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      feedback: {
        pk: { field: 'pk', composite: ['feedbackId'] },
        sk: { field: 'sk', composite: ['feedbackScope'] },
      },
      byScope: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['feedbackScope'] },
        sk: { field: 'gsi1sk', composite: ['createdAt', 'feedbackId'] },
      },
      byUser: {
        index: 'gsi2',
        pk: { field: 'gsi2pk', composite: ['userId'] },
        sk: { field: 'gsi2sk', composite: ['createdAt', 'feedbackId'] },
      },
    },
  },
  { client, table: tableName },
);

export type FeedbackRecord = EntityItem<typeof FeedbackEntity>;
