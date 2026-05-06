import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const MemberJoinLinkEntity = new Entity(
  {
    model: {
      entity: 'memberJoinLink',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      tokenHash: { type: 'string', required: true },
      linkScope: { type: 'string', required: true },
      tokenHint: { type: 'string', required: true },
      mode: {
        type: ['reusable', 'single_use', 'usage_limit'] as const,
        required: true,
      },
      maxUses: { type: 'number' },
      acceptedUserIds: {
        type: 'list',
        items: { type: 'string' },
        required: true,
      },
      acceptedCount: { type: 'number', required: true },
      status: {
        type: ['active', 'revoked'] as const,
        required: true,
      },
      createdByUserId: { type: 'string', required: true },
      createdByName: { type: 'string', required: true },
      expiresAt: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
      revokedAt: { type: 'string' },
    },
    indexes: {
      link: {
        pk: { field: 'pk', composite: ['tokenHash'] },
        sk: { field: 'sk', composite: ['linkScope'] },
      },
      allLinks: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['linkScope'] },
        sk: { field: 'gsi1sk', composite: ['status', 'createdAt'] },
      },
    },
  },
  { client, table: tableName },
);

export type MemberJoinLinkRecord = EntityItem<typeof MemberJoinLinkEntity>;
