#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Entity } from 'electrodb';
import { Resource } from 'sst';

const MEMBER_INVITE_SCOPE = 'member';
const DEFAULT_CUTOFF = '2026-04-27T19:10:00.000Z';

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function toTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function scanAuthUsers(docClient, authTableName) {
  const users = [];
  let exclusiveStartKey;

  do {
    const response = await docClient.send(
      new ScanCommand({
        TableName: authTableName,
        ExclusiveStartKey: exclusiveStartKey,
        FilterExpression: '#sk = :userSk AND begins_with(#pk, :userPrefix)',
        ExpressionAttributeNames: {
          '#pk': 'pk',
          '#sk': 'sk',
        },
        ExpressionAttributeValues: {
          ':userSk': 'USER',
          ':userPrefix': 'USER#',
        },
      }),
    );

    users.push(...(response.Items ?? []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return users;
}

function createMemberInviteEntity(docClient, tableName) {
  return new Entity(
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
          type: ['pending', 'accepted'],
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
    { client: docClient, table: tableName },
  );
}

function requireResourceName(resourceName) {
  const name = Resource[resourceName]?.name;
  if (!name) {
    throw new Error(`Missing SST Resource.${resourceName}. Run this script with "sst shell".`);
  }

  return name;
}

const write = hasFlag('write');
const includeMissingCreatedAt = hasFlag('include-missing-created-at');
const cutoff = readArg('cutoff') ?? DEFAULT_CUTOFF;
const cutoffTimestamp = toTimestamp(cutoff);
const invitedByUserId =
  readArg('invited-by-user-id') ??
  process.env.GRID_STAY_BACKFILL_INVITED_BY_USER_ID ??
  'system:invite-backfill';
const invitedByName =
  readArg('invited-by-name') ?? process.env.GRID_STAY_BACKFILL_INVITED_BY_NAME ?? 'Invite backfill';

if (cutoffTimestamp === null) {
  throw new Error(`Invalid cutoff: ${cutoff}`);
}

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const authTableName = requireResourceName('AuthTable');
const appTableName = requireResourceName('Table');
const memberInviteEntity = createMemberInviteEntity(docClient, appTableName);
const now = new Date().toISOString();
const users = await scanAuthUsers(docClient, authTableName);

const summary = {
  mode: write ? 'write' : 'dry-run',
  cutoff,
  scannedUsers: users.length,
  eligibleUsers: 0,
  createdAcceptedInvites: 0,
  updatedPendingInvites: 0,
  skippedAcceptedInvites: 0,
  skippedAfterCutoff: 0,
  skippedInvalidEmail: 0,
  skippedMissingCreatedAt: 0,
  skippedInvalidCreatedAt: 0,
};

const changes = [];

for (const user of users) {
  const inviteEmail = normalizeEmail(user.email);
  if (!inviteEmail) {
    summary.skippedInvalidEmail += 1;
    continue;
  }

  const createdAtTimestamp = toTimestamp(user.createdAt);
  if (createdAtTimestamp === null) {
    if (!includeMissingCreatedAt) {
      summary.skippedMissingCreatedAt += 1;
      continue;
    }

    if (user.createdAt) {
      summary.skippedInvalidCreatedAt += 1;
      continue;
    }
  } else if (createdAtTimestamp > cutoffTimestamp) {
    summary.skippedAfterCutoff += 1;
    continue;
  }

  summary.eligibleUsers += 1;

  const existing = await memberInviteEntity
    .get({
      inviteEmail,
      inviteScope: MEMBER_INVITE_SCOPE,
    })
    .go();

  if (existing.data?.status === 'accepted') {
    summary.skippedAcceptedInvites += 1;
    continue;
  }

  const record = {
    inviteEmail,
    inviteScope: MEMBER_INVITE_SCOPE,
    invitedByUserId,
    invitedByName,
    status: 'accepted',
    acceptedByUserId: String(user.id),
    acceptedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  if (existing.data) {
    summary.updatedPendingInvites += 1;
    changes.push({ action: 'update-pending', inviteEmail, userId: user.id });

    if (write) {
      await memberInviteEntity
        .patch({
          inviteEmail,
          inviteScope: MEMBER_INVITE_SCOPE,
        })
        .set({
          status: 'accepted',
          acceptedByUserId: String(user.id),
          acceptedAt: now,
          updatedAt: now,
        })
        .go({ response: 'none' });
    }
  } else {
    summary.createdAcceptedInvites += 1;
    changes.push({ action: 'create-accepted', inviteEmail, userId: user.id });

    if (write) {
      await memberInviteEntity.create(record).go({ response: 'none' });
    }
  }
}

console.log(JSON.stringify({ summary, changes }, null, 2));

if (!write) {
  console.log('Dry run only. Re-run with --write to create or update accepted invites.');
}
