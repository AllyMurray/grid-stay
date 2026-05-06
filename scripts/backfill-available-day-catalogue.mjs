import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Entity } from 'electrodb';

const CATALOGUE_SCOPE = 'event';
const DEFAULT_TABLE = 'grid-stay-prod';
const SOURCE_PRIORITIES = {
  booking: 10,
  restoredCatalogue: 20,
  manualDay: 30,
  availableDaysCache: 40,
};

function parseArgs(argv) {
  const args = {
    apply: false,
    beforeDate: '',
    region: process.env.AWS_REGION ?? 'eu-west-1',
    targetTable: process.env.GRID_STAY_PROD_TABLE ?? DEFAULT_TABLE,
    sourceTables: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--apply':
        args.apply = true;
        break;
      case '--before-date':
        args.beforeDate = argv[++index] ?? '';
        break;
      case '--region':
        args.region = argv[++index] ?? args.region;
        break;
      case '--target-table':
        args.targetTable = argv[++index] ?? args.targetTable;
        break;
      case '--source-table':
      case '--restored-table': {
        const tableName = argv[++index]?.trim();
        if (tableName) {
          args.sourceTables.push(tableName);
        }
        break;
      }
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.sourceTables.length === 0) {
    args.sourceTables.push(args.targetTable);
  }
  if (args.beforeDate && !isIsoDate(args.beforeDate)) {
    throw new Error('--before-date must be in YYYY-MM-DD format');
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  AWS_PROFILE=personal node scripts/backfill-available-day-catalogue.mjs
  AWS_PROFILE=personal node scripts/backfill-available-day-catalogue.mjs --apply
  AWS_PROFILE=personal node scripts/backfill-available-day-catalogue.mjs --source-table restored-grid-stay-prod-20260420 --apply

Options:
  --apply                  Write missing catalogue records. Omit for dry-run.
  --target-table <name>    Live table to write to. Defaults to grid-stay-prod.
  --source-table <name>    Source table to scan. Can be passed more than once.
  --restored-table <name>  Alias for --source-table, intended for PITR restores.
  --before-date <date>     Only backfill days before this YYYY-MM-DD date.
  --region <region>        AWS region. Defaults to eu-west-1.

Safety:
  - This script never deletes records.
  - It writes only missing availableDayCatalogue records.
  - It can read from a restored PITR table without replacing production.`);
}

function createCatalogueEntity(client, tableName) {
  return new Entity(
    {
      model: {
        entity: 'availableDayCatalogue',
        version: '1',
        service: 'gridstay',
      },
      attributes: {
        catalogueScope: { type: 'string', required: true },
        dayId: { type: 'string', required: true },
        date: { type: 'string', required: true },
        sourceType: {
          type: ['caterham', 'testing', 'trackdays', 'manual'],
          required: true,
        },
        sourceName: { type: 'string', required: true },
        payload: { type: 'string', required: true },
        firstSeenAt: { type: 'string', required: true },
        lastSeenAt: { type: 'string', required: true },
      },
      indexes: {
        catalogue: {
          pk: { field: 'pk', composite: ['dayId'] },
          sk: { field: 'sk', composite: ['catalogueScope'] },
        },
        byDate: {
          index: 'gsi1',
          pk: { field: 'gsi1pk', composite: ['catalogueScope'] },
          sk: { field: 'gsi1sk', composite: ['date', 'dayId'] },
        },
      },
    },
    { client, table: tableName },
  );
}

function safeParseJson(payload) {
  if (typeof payload !== 'string') {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isAvailableDay(day) {
  return (
    day &&
    typeof day === 'object' &&
    typeof day.dayId === 'string' &&
    isIsoDate(day.date) &&
    ['race_day', 'test_day', 'track_day', 'road_drive'].includes(day.type) &&
    typeof day.circuit === 'string' &&
    typeof day.provider === 'string' &&
    typeof day.description === 'string' &&
    day.source &&
    typeof day.source === 'object' &&
    ['caterham', 'testing', 'trackdays', 'manual'].includes(day.source.sourceType) &&
    typeof day.source.sourceName === 'string'
  );
}

function toAvailableDayFromManualDay(record) {
  return {
    dayId: record.dayId,
    date: record.date,
    type: record.type,
    circuit: record.circuit,
    provider: record.provider,
    description: record.description,
    bookingUrl: record.bookingUrl,
    source: {
      sourceType: 'manual',
      sourceName: 'manual',
      externalId: record.manualDayId,
      metadata: {
        createdByUserId: record.ownerUserId,
        series: record.series,
      },
    },
  };
}

function toAvailableDayFromBooking(record) {
  return {
    dayId: record.dayId,
    date: record.date,
    type: record.type,
    circuit: record.circuitName ?? record.circuit,
    circuitId: record.circuitId,
    circuitName: record.circuitName,
    layout: record.layout,
    circuitKnown: record.circuitKnown,
    provider: record.provider,
    description: record.description,
    source: {
      sourceType: 'manual',
      sourceName: 'booking',
      externalId: record.bookingId,
      metadata: {
        bookingStatus: record.status,
      },
    },
  };
}

function addCandidate(candidates, day, details, stats) {
  if (!isAvailableDay(day)) {
    stats.invalidCandidateCount += 1;
    return;
  }

  const existing = candidates.get(day.dayId);
  if (existing && existing.priority > details.priority) {
    return;
  }

  candidates.set(day.dayId, {
    day,
    priority: details.priority,
    sourceTable: details.sourceTable,
    sourceEntity: details.sourceEntity,
    firstSeenAt: details.firstSeenAt,
    lastSeenAt: details.lastSeenAt,
  });
}

async function scanByEntity(docClient, tableName, entityName) {
  const items = [];
  let ExclusiveStartKey;

  do {
    const response = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: '#entity = :entity',
        ExpressionAttributeNames: {
          '#entity': '__edb_e__',
        },
        ExpressionAttributeValues: {
          ':entity': entityName,
        },
        ExclusiveStartKey,
      }),
    );

    items.push(...(response.Items ?? []));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

function collectFromAvailableDaysCache(records, sourceTable, candidates, stats) {
  const meta = records.find((record) => record.scope === 'meta');
  const legacy = records.find((record) => record.scope === 'current');
  const activeRefreshedAt = meta?.refreshedAt;
  const dayRecords = activeRefreshedAt
    ? records.filter(
        (record) =>
          typeof record.scope === 'string' &&
          record.scope.startsWith('day#') &&
          record.refreshedAt === activeRefreshedAt,
      )
    : [];

  for (const record of dayRecords) {
    const day = safeParseJson(record.payload);
    addCandidate(
      candidates,
      day,
      {
        priority: SOURCE_PRIORITIES.availableDaysCache,
        sourceTable,
        sourceEntity: 'availableDaysCache',
        firstSeenAt: record.refreshedAt,
        lastSeenAt: record.refreshedAt,
      },
      stats,
    );
  }

  const legacySnapshot = safeParseJson(legacy?.payload);
  if (legacySnapshot && Array.isArray(legacySnapshot.days)) {
    for (const day of legacySnapshot.days) {
      addCandidate(
        candidates,
        day,
        {
          priority: SOURCE_PRIORITIES.availableDaysCache,
          sourceTable,
          sourceEntity: 'availableDaysCache',
          firstSeenAt: legacy.refreshedAt,
          lastSeenAt: legacy.refreshedAt,
        },
        stats,
      );
    }
  }

  return {
    activeRefreshedAt: activeRefreshedAt ?? legacy?.refreshedAt ?? null,
    dayRecordCount: dayRecords.length + (legacySnapshot?.days?.length ?? 0),
  };
}

function collectFromManualDays(records, sourceTable, candidates, stats) {
  for (const record of records) {
    addCandidate(
      candidates,
      toAvailableDayFromManualDay(record),
      {
        priority: SOURCE_PRIORITIES.manualDay,
        sourceTable,
        sourceEntity: 'manualDay',
        firstSeenAt: record.createdAt,
        lastSeenAt: record.updatedAt ?? record.createdAt,
      },
      stats,
    );
  }
}

function collectFromBookings(records, sourceTable, candidates, stats) {
  const bookingsByDayId = new Map();
  for (const record of records) {
    const existing = bookingsByDayId.get(record.dayId);
    if (!existing || String(record.updatedAt ?? '').localeCompare(String(existing.updatedAt ?? '')) > 0) {
      bookingsByDayId.set(record.dayId, record);
    }
  }

  for (const record of bookingsByDayId.values()) {
    addCandidate(
      candidates,
      toAvailableDayFromBooking(record),
      {
        priority: SOURCE_PRIORITIES.booking,
        sourceTable,
        sourceEntity: 'booking',
        firstSeenAt: record.createdAt,
        lastSeenAt: record.updatedAt ?? record.createdAt,
      },
      stats,
    );
  }
}

function collectFromExistingCatalogue(records, sourceTable, candidates, stats) {
  for (const record of records) {
    const day = safeParseJson(record.payload);
    addCandidate(
      candidates,
      day,
      {
        priority: SOURCE_PRIORITIES.restoredCatalogue,
        sourceTable,
        sourceEntity: 'availableDayCatalogue',
        firstSeenAt: record.firstSeenAt,
        lastSeenAt: record.lastSeenAt,
      },
      stats,
    );
  }
}

function buildCatalogueRecord(candidate, recoveredAt) {
  const { day } = candidate;

  return {
    catalogueScope: CATALOGUE_SCOPE,
    dayId: day.dayId,
    date: day.date,
    sourceType: day.source.sourceType,
    sourceName: day.source.sourceName,
    payload: JSON.stringify(day),
    firstSeenAt: candidate.firstSeenAt ?? recoveredAt,
    lastSeenAt: candidate.lastSeenAt ?? recoveredAt,
  };
}

function getDateRange(days) {
  const dates = days.map((day) => day.date).filter(isIsoDate).toSorted();
  return {
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
  };
}

function isConditionalCheckFailed(error) {
  return (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ConditionalCheckFailedException'
  );
}

async function createMissingRecords(entity, records) {
  let appliedCount = 0;
  let skippedRaceCount = 0;

  for (const record of records) {
    try {
      await entity.create(record).go({ response: 'none' });
      appliedCount += 1;
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        skippedRaceCount += 1;
        continue;
      }

      throw error;
    }
  }

  return { appliedCount, skippedRaceCount };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawClient = new DynamoDBClient({ region: args.region });
  const docClient = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
  const catalogueEntity = createCatalogueEntity(rawClient, args.targetTable);
  const recoveredAt = new Date().toISOString();
  const candidates = new Map();
  const stats = {
    invalidCandidateCount: 0,
    sourceTables: [],
  };

  const existingCatalogue = await scanByEntity(
    docClient,
    args.targetTable,
    'availableDayCatalogue',
  );
  const existingDayIds = new Set(existingCatalogue.map((record) => record.dayId));

  for (const sourceTable of args.sourceTables) {
    const [cacheRecords, manualDayRecords, bookingRecords, catalogueRecords] = await Promise.all([
      scanByEntity(docClient, sourceTable, 'availableDaysCache'),
      scanByEntity(docClient, sourceTable, 'manualDay'),
      scanByEntity(docClient, sourceTable, 'booking'),
      scanByEntity(docClient, sourceTable, 'availableDayCatalogue'),
    ]);
    const cacheSummary = collectFromAvailableDaysCache(
      cacheRecords,
      sourceTable,
      candidates,
      stats,
    );

    collectFromManualDays(manualDayRecords, sourceTable, candidates, stats);
    collectFromBookings(bookingRecords, sourceTable, candidates, stats);
    collectFromExistingCatalogue(catalogueRecords, sourceTable, candidates, stats);

    stats.sourceTables.push({
      tableName: sourceTable,
      availableDaysCacheRecords: cacheRecords.length,
      activeAvailableDaysCacheRefreshedAt: cacheSummary.activeRefreshedAt,
      activeAvailableDaysCacheDayCount: cacheSummary.dayRecordCount,
      manualDayRecords: manualDayRecords.length,
      bookingRecords: bookingRecords.length,
      availableDayCatalogueRecords: catalogueRecords.length,
    });
  }

  const missingCandidates = [...candidates.values()].filter(
    (candidate) =>
      !existingDayIds.has(candidate.day.dayId) &&
      (!args.beforeDate || candidate.day.date < args.beforeDate),
  );
  const dateFilteredCandidateCount =
    candidates.size -
    [...candidates.values()].filter(
      (candidate) => !args.beforeDate || candidate.day.date < args.beforeDate,
    ).length;
  const recordsToCreate = missingCandidates.map((candidate) =>
    buildCatalogueRecord(candidate, recoveredAt),
  );
  const dateRange = getDateRange([...candidates.values()].map((candidate) => candidate.day));
  const missingDateRange = getDateRange(missingCandidates.map((candidate) => candidate.day));
  let writeResult = {
    appliedCount: 0,
    skippedRaceCount: 0,
  };

  if (args.apply && recordsToCreate.length > 0) {
    writeResult = await createMissingRecords(catalogueEntity, recordsToCreate);
  }

  console.log(
    JSON.stringify(
      {
        mode: args.apply ? 'apply' : 'dry-run',
        region: args.region,
        targetTable: args.targetTable,
        sourceTables: args.sourceTables,
        beforeDate: args.beforeDate || null,
        existingCatalogueCount: existingDayIds.size,
        candidateCount: candidates.size,
        dateFilteredCandidateCount,
        missingCandidateCount: missingCandidates.length,
        wouldCreateCount: args.apply ? 0 : recordsToCreate.length,
        appliedCount: writeResult.appliedCount,
        skippedRaceCount: writeResult.skippedRaceCount,
        invalidCandidateCount: stats.invalidCandidateCount,
        dateRange,
        missingDateRange,
        sourceTableStats: stats.sourceTables,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
