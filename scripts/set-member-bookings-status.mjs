#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { Entity } from 'electrodb';
import { Resource } from 'sst';
import { ulid } from 'ulid';

const BOOKING_STATUSES = new Set(['booked', 'maybe', 'cancelled']);
const APP_EVENT_SCOPE = 'app';

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(
    prefix.length,
  );
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function normalizeMemberAccessEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex <= 0) {
    return normalizedEmail;
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);
  const canonicalDomain = domain === 'googlemail.com' ? 'gmail.com' : domain;

  if (canonicalDomain !== 'gmail.com') {
    return normalizedEmail;
  }

  const canonicalLocalPart = localPart.split('+')[0]?.replaceAll('.', '');

  return `${canonicalLocalPart ?? localPart}@${canonicalDomain}`;
}

function requireResourceName(resourceName) {
  const name = Resource[resourceName]?.name;
  if (!name) {
    throw new Error(
      `Missing SST Resource.${resourceName}. Run this script with "sst shell".`,
    );
  }

  return name;
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

function createBookingEntity(docClient, tableName) {
  return new Entity(
    {
      model: {
        entity: 'booking',
        version: '1',
        service: 'gridstay',
      },
      attributes: {
        bookingId: { type: 'string', required: true },
        userId: { type: 'string', required: true },
        userName: { type: 'string', required: true },
        userImage: { type: 'string' },
        dayId: { type: 'string', required: true },
        date: { type: 'string', required: true },
        type: {
          type: ['race_day', 'test_day', 'track_day', 'road_drive'],
          required: true,
        },
        status: {
          type: ['booked', 'cancelled', 'maybe'],
          required: true,
        },
        circuit: { type: 'string', required: true },
        circuitId: { type: 'string' },
        circuitName: { type: 'string' },
        layout: { type: 'string' },
        circuitKnown: { type: 'boolean' },
        provider: { type: 'string', required: true },
        bookingReference: { type: 'string' },
        arrivalDateTime: { type: 'string' },
        arrivalTime: { type: 'string' },
        description: { type: 'string', required: true },
        hotelId: { type: 'string' },
        accommodationStatus: {
          type: [
            'unknown',
            'not_required',
            'staying_at_track',
            'looking',
            'booked',
          ],
        },
        accommodationName: { type: 'string' },
        accommodationReference: { type: 'string' },
        garageBooked: { type: 'boolean' },
        garageCapacity: { type: 'number' },
        garageLabel: { type: 'string' },
        garageCostTotalPence: { type: 'number' },
        garageCostCurrency: { type: 'string' },
        garageApprovedShareCount: { type: 'number' },
        notes: { type: 'string' },
        createdAt: { type: 'string', required: true },
        updatedAt: { type: 'string', required: true },
      },
      indexes: {
        booking: {
          pk: { field: 'pk', composite: ['userId'] },
          sk: { field: 'sk', composite: ['bookingId'] },
        },
        byDay: {
          index: 'gsi1',
          pk: { field: 'gsi1pk', composite: ['dayId'] },
          sk: { field: 'gsi1sk', composite: ['status', 'userName', 'bookingId'] },
        },
        byUserDay: {
          index: 'gsi2',
          pk: { field: 'gsi2pk', composite: ['userId'] },
          sk: { field: 'gsi2sk', composite: ['dayId'] },
        },
      },
    },
    { client: docClient, table: tableName },
  );
}

function createAppEventEntity(docClient, tableName) {
  return new Entity(
    {
      model: {
        entity: 'appEvent',
        version: '1',
        service: 'gridstay',
      },
      attributes: {
        eventId: { type: 'string', required: true },
        eventScope: { type: 'string', required: true },
        category: {
          type: ['audit', 'error', 'operational'],
          required: true,
        },
        severity: {
          type: ['info', 'warning', 'error'],
          required: true,
        },
        action: { type: 'string', required: true },
        message: { type: 'string', required: true },
        actorUserId: { type: 'string' },
        actorName: { type: 'string' },
        subjectType: { type: 'string' },
        subjectId: { type: 'string' },
        metadataJson: { type: 'string' },
        createdAt: { type: 'string', required: true },
      },
      indexes: {
        event: {
          pk: { field: 'pk', composite: ['eventId'] },
          sk: { field: 'sk', composite: ['eventScope'] },
        },
        byScope: {
          index: 'gsi1',
          pk: { field: 'gsi1pk', composite: ['eventScope'] },
          sk: { field: 'gsi1sk', composite: ['createdAt', 'eventId'] },
        },
      },
    },
    { client: docClient, table: tableName },
  );
}

function summarizeStatusCounts(bookings) {
  return bookings.reduce(
    (counts, booking) => ({
      ...counts,
      [booking.status]: (counts[booking.status] ?? 0) + 1,
    }),
    { booked: 0, maybe: 0, cancelled: 0 },
  );
}

function toPublicBookingSummary(booking, nextStatus) {
  return {
    bookingId: booking.bookingId,
    dayId: booking.dayId,
    date: booking.date,
    type: booking.type,
    circuit: booking.layout ? `${booking.circuit} ${booking.layout}` : booking.circuit,
    provider: booking.provider,
    description: booking.description,
    fromStatus: booking.status,
    toStatus: nextStatus,
  };
}

function printHelp() {
  console.log(`Usage:
  AWS_PROFILE=personal npx sst shell --stage prod -- node scripts/set-member-bookings-status.mjs --email=user@example.com
  AWS_PROFILE=personal npx sst shell --stage prod -- node scripts/set-member-bookings-status.mjs --email=user@example.com --from=maybe --to=booked --write

Options:
  --email=EMAIL          Required. Matches auth users by normalized member email.
  --from=STATUS          Source status to update. Defaults to maybe.
  --to=STATUS            Target status to set. Defaults to booked.
  --write                Apply the changes. Defaults to dry-run.
  --help                 Show this help.`);
}

if (hasFlag('help')) {
  printHelp();
  process.exit(0);
}

const email = readArg('email');
const fromStatus = readArg('from') ?? 'maybe';
const toStatus = readArg('to') ?? 'booked';
const write = hasFlag('write');

if (!email) {
  printHelp();
  throw new Error('Missing required --email option.');
}

if (!BOOKING_STATUSES.has(fromStatus)) {
  throw new Error(`Invalid --from status: ${fromStatus}`);
}

if (!BOOKING_STATUSES.has(toStatus)) {
  throw new Error(`Invalid --to status: ${toStatus}`);
}

if (fromStatus === toStatus) {
  throw new Error('--from and --to must be different statuses.');
}

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const authTableName = requireResourceName('AuthTable');
const appTableName = requireResourceName('Table');
const bookingEntity = createBookingEntity(docClient, appTableName);
const appEventEntity = createAppEventEntity(docClient, appTableName);
const requestedEmail = normalizeMemberAccessEmail(email);
const users = await scanAuthUsers(docClient, authTableName);
const matchingUsers = users.filter(
  (user) => normalizeMemberAccessEmail(user.email) === requestedEmail,
);

if (matchingUsers.length !== 1) {
  console.log(
    JSON.stringify(
      {
        summary: {
          mode: write ? 'write' : 'dry-run',
          requestedEmail,
          matchingUsers: matchingUsers.length,
        },
        matches: matchingUsers.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
        })),
      },
      null,
      2,
    ),
  );
  throw new Error(`Expected exactly one user match, found ${matchingUsers.length}.`);
}

const user = matchingUsers[0];
const bookingsResponse = await bookingEntity.query
  .booking({ userId: String(user.id) })
  .go();
const bookings = bookingsResponse.data.toSorted((left, right) =>
  left.date === right.date
    ? String(left.bookingId).localeCompare(String(right.bookingId))
    : String(left.date).localeCompare(String(right.date)),
);
const targetBookings = bookings.filter((booking) => booking.status === fromStatus);
const now = new Date().toISOString();
const changes = targetBookings.map((booking) =>
  toPublicBookingSummary(booking, toStatus),
);

if (write) {
  for (const booking of targetBookings) {
    await bookingEntity
      .patch({
        userId: booking.userId,
        bookingId: booking.bookingId,
      })
      .set({
        status: toStatus,
        userName: booking.userName,
        updatedAt: now,
      })
      .where(({ status }, { eq }) => eq(status, fromStatus))
      .go({ response: 'none' });
  }

  await appEventEntity
    .create({
      eventId: ulid(),
      eventScope: APP_EVENT_SCOPE,
      category: 'audit',
      severity: 'info',
      action: 'admin.memberBookingsStatusUpdated',
      message: `Updated ${targetBookings.length} booking statuses for ${user.email}.`,
      actorUserId: 'system:script',
      actorName: 'set-member-bookings-status',
      subjectType: 'member',
      subjectId: String(user.id),
      metadataJson: JSON.stringify({
        requestedEmail,
        userEmail: user.email,
        fromStatus,
        toStatus,
        updatedCount: targetBookings.length,
        bookingIds: targetBookings.map((booking) => booking.bookingId),
      }),
      createdAt: now,
    })
    .go({ response: 'none' });
}

const afterBookings = write
  ? (
      await bookingEntity.query.booking({ userId: String(user.id) }).go()
    ).data.toSorted((left, right) =>
      left.date === right.date
        ? String(left.bookingId).localeCompare(String(right.bookingId))
        : String(left.date).localeCompare(String(right.date)),
    )
  : bookings;

console.log(
  JSON.stringify(
    {
      summary: {
        mode: write ? 'write' : 'dry-run',
        authTableName,
        appTableName,
        requestedEmail,
        matchedUser: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        fromStatus,
        toStatus,
        totalBookings: bookings.length,
        beforeStatusCounts: summarizeStatusCounts(bookings),
        matchingBookings: targetBookings.length,
        updatedBookings: write ? targetBookings.length : 0,
        afterStatusCounts: summarizeStatusCounts(afterBookings),
      },
      changes,
    },
    null,
    2,
  ),
);

if (!write) {
  console.log('Dry run only. Re-run with --write to update matching bookings.');
}
