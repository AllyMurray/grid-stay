import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const MemberInviteEntity = new Entity(
  {
    model: {
      entity: 'memberInvite',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      inviteEmail: { type: 'string', required: true },
      inviteScope: { type: 'string', required: true },
      invitedByUserId: { type: 'string', required: true },
      invitedByName: { type: 'string', required: true },
      status: {
        type: ['pending', 'accepted'] as const,
        required: true,
      },
      acceptedByUserId: { type: 'string' },
      acceptedAt: { type: 'string' },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      invite: {
        pk: { field: 'pk', composite: ['inviteEmail'] },
        sk: { field: 'sk', composite: ['inviteScope'] },
      },
      allInvites: {
        index: 'gsi1',
        pk: { field: 'gsi1pk', composite: ['inviteScope'] },
        sk: { field: 'gsi1sk', composite: ['status', 'inviteEmail'] },
      },
    },
  },
  { client, table: tableName },
);

export type MemberInviteRecord = EntityItem<typeof MemberInviteEntity>;
