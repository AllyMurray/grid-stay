#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const VALID_BOOKING_TYPES = new Set(['race_day', 'test_day', 'track_day']);
const AVAILABLE_DAYS_CACHE_KEY = 'available-days';
const AVAILABLE_DAYS_META_SCOPE = 'meta';
const AVAILABLE_DAYS_LEGACY_SCOPE = 'current';
const AVAILABLE_DAYS_DAY_SCOPE_PREFIX = 'day#';

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(
    prefix.length,
  );
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function toPositiveInteger(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isValidBookingType(value) {
  return VALID_BOOKING_TYPES.has(value);
}

function inferTypeFromDayId(dayId) {
  const dayIdType = String(dayId ?? '').split(':')[0];
  return isValidBookingType(dayIdType) ? dayIdType : null;
}

function addDayType(dayTypesById, day, source) {
  if (!day?.dayId || !isValidBookingType(day.type)) {
    return;
  }

  dayTypesById.set(day.dayId, {
    type: day.type,
    source,
  });
}

function buildDayTypeLookup(items) {
  const dayTypesById = new Map();
  const cacheRecords = items.filter(
    (item) =>
      item.__edb_e__ === 'availableDaysCache' &&
      item.cacheKey === AVAILABLE_DAYS_CACHE_KEY,
  );
  const metaRecord = cacheRecords.find(
    (record) => record.scope === AVAILABLE_DAYS_META_SCOPE,
  );
  const legacyRecord = cacheRecords.find(
    (record) => record.scope === AVAILABLE_DAYS_LEGACY_SCOPE,
  );

  if (metaRecord) {
    for (const record of cacheRecords) {
      if (
        record.scope?.startsWith(AVAILABLE_DAYS_DAY_SCOPE_PREFIX) &&
        record.refreshedAt === metaRecord.refreshedAt
      ) {
        addDayType(
          dayTypesById,
          parseJson(record.payload),
          'available-days-cache',
        );
      }
    }
  } else if (legacyRecord) {
    const snapshot = parseJson(legacyRecord.payload);
    for (const day of snapshot?.days ?? []) {
      addDayType(dayTypesById, day, 'available-days-cache');
    }
  }

  for (const item of items) {
    if (item.__edb_e__ === 'manualDay') {
      addDayType(dayTypesById, item, 'manual-days');
    }
  }

  return dayTypesById;
}

function inferBookingType(booking, dayTypesById) {
  const fromDayId = inferTypeFromDayId(booking.dayId);
  if (fromDayId) {
    return {
      type: fromDayId,
      source: 'day-id',
    };
  }

  const fromKnownDay = dayTypesById.get(booking.dayId);
  return fromKnownDay ?? null;
}

async function scanAllTableItems(docClient, tableName) {
  const items = [];
  let exclusiveStartKey;

  do {
    const response = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    items.push(...(response.Items ?? []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

async function updateBookingType(docClient, tableName, booking, type) {
  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: booking.pk,
        sk: booking.sk,
      },
      UpdateExpression: 'SET #type = :type',
      ConditionExpression:
        '#entity = :entity AND attribute_not_exists(#type)',
      ExpressionAttributeNames: {
        '#entity': '__edb_e__',
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':entity': 'booking',
        ':type': type,
      },
    }),
  );
}

function toChange(booking, inference) {
  return {
    bookingId: booking.bookingId,
    userId: booking.userId,
    dayId: booking.dayId,
    date: booking.date,
    circuit: booking.circuit,
    provider: booking.provider,
    inferredType: inference.type,
    inferenceSource: inference.source,
  };
}

function toAmbiguousBooking(booking) {
  return {
    bookingId: booking.bookingId,
    userId: booking.userId,
    dayId: booking.dayId,
    date: booking.date,
    circuit: booking.circuit,
    provider: booking.provider,
  };
}

function printHelp() {
  console.log(`Usage:
  AWS_PROFILE=personal npx sst shell --stage prod -- node scripts/backfill-booking-types.mjs
  AWS_PROFILE=personal npx sst shell --stage prod -- node scripts/backfill-booking-types.mjs --write

Options:
  --write               Update inferred booking types. Defaults to dry-run.
  --max-examples=N      Number of example changes/skips to print. Defaults to 50.
  --limit=N             Stop after N writes. Useful for cautious batches.
  --help                Show this help.

Inference order:
  1. dayId prefix: race_day:, test_day:, track_day:
  2. current available-day cache by dayId
  3. manual days by dayId

Ambiguous bookings are never updated.`);
}

if (hasFlag('help')) {
  printHelp();
  process.exit(0);
}

const write = hasFlag('write');
const maxExamples = toPositiveInteger(readArg('max-examples'), 50);
const writeLimit = toPositiveInteger(readArg('limit'), Number.POSITIVE_INFINITY);

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = requireResourceName('Table');
const items = await scanAllTableItems(docClient, tableName);
const dayTypesById = buildDayTypeLookup(items);
const bookingsMissingType = items
  .filter(
    (item) => item.__edb_e__ === 'booking' && !isValidBookingType(item.type),
  )
  .sort((left, right) =>
    left.date === right.date
      ? String(left.bookingId).localeCompare(String(right.bookingId))
      : String(left.date).localeCompare(String(right.date)),
  );

const summary = {
  mode: write ? 'write' : 'dry-run',
  tableName,
  scannedItems: items.length,
  knownDayTypes: dayTypesById.size,
  bookingsMissingType: bookingsMissingType.length,
  inferredFromDayId: 0,
  inferredFromAvailableDaysCache: 0,
  inferredFromManualDays: 0,
  ambiguous: 0,
  updated: 0,
  skippedByLimit: 0,
};
const changes = [];
const ambiguousBookings = [];

for (const booking of bookingsMissingType) {
  const inference = inferBookingType(booking, dayTypesById);

  if (!inference) {
    summary.ambiguous += 1;
    if (ambiguousBookings.length < maxExamples) {
      ambiguousBookings.push(toAmbiguousBooking(booking));
    }
    continue;
  }

  if (inference.source === 'day-id') {
    summary.inferredFromDayId += 1;
  } else if (inference.source === 'available-days-cache') {
    summary.inferredFromAvailableDaysCache += 1;
  } else if (inference.source === 'manual-days') {
    summary.inferredFromManualDays += 1;
  }

  if (changes.length < maxExamples) {
    changes.push(toChange(booking, inference));
  }

  if (write) {
    if (summary.updated >= writeLimit) {
      summary.skippedByLimit += 1;
      continue;
    }

    await updateBookingType(docClient, tableName, booking, inference.type);
    summary.updated += 1;
  }
}

console.log(JSON.stringify({ summary, changes, ambiguousBookings }, null, 2));

if (!write) {
  console.log('Dry run only. Re-run with --write to update inferred types.');
}

if (summary.ambiguous > 0) {
  process.exitCode = 2;
}
