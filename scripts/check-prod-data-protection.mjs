import {
  DescribeContinuousBackupsCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';

const region = process.env.AWS_REGION ?? 'eu-west-1';
const expectedRecoveryDays = 35;
const tableNames = [
  process.env.GRID_STAY_PROD_TABLE ?? 'grid-stay-prod',
  process.env.GRID_STAY_AUTH_TABLE ?? 'grid-stay-auth-prod',
];

if (process.argv.includes('--help')) {
  console.log(`Usage: AWS_PROFILE=personal node scripts/check-prod-data-protection.mjs

Checks prod DynamoDB tables for:
- point-in-time recovery enabled
- 35 day recovery period
- deletion protection enabled

Environment overrides:
- AWS_REGION
- GRID_STAY_PROD_TABLE
- GRID_STAY_AUTH_TABLE`);
  process.exit(0);
}

const client = new DynamoDBClient({ region });

async function checkTable(tableName) {
  const [table, backups] = await Promise.all([
    client.send(new DescribeTableCommand({ TableName: tableName })),
    client.send(new DescribeContinuousBackupsCommand({ TableName: tableName })),
  ]);
  const pitr = backups.ContinuousBackupsDescription?.PointInTimeRecoveryDescription;
  const failures = [];

  if (table.Table?.DeletionProtectionEnabled !== true) {
    failures.push('deletion protection is not enabled');
  }

  if (pitr?.PointInTimeRecoveryStatus !== 'ENABLED') {
    failures.push('PITR is not enabled');
  }

  if (pitr?.RecoveryPeriodInDays !== expectedRecoveryDays) {
    failures.push(`PITR recovery period is ${pitr?.RecoveryPeriodInDays ?? 'unknown'} days`);
  }

  return {
    tableName,
    deletionProtection: table.Table?.DeletionProtectionEnabled === true,
    pointInTimeRecovery: pitr?.PointInTimeRecoveryStatus ?? 'UNKNOWN',
    recoveryPeriodInDays: pitr?.RecoveryPeriodInDays ?? null,
    earliestRestorableDateTime: pitr?.EarliestRestorableDateTime?.toISOString(),
    latestRestorableDateTime: pitr?.LatestRestorableDateTime?.toISOString(),
    failures,
  };
}

const results = await Promise.all(tableNames.map(checkTable));

console.log(JSON.stringify({ region, tables: results }, null, 2));

const failures = results.flatMap((result) =>
  result.failures.map((failure) => `${result.tableName}: ${failure}`),
);

if (failures.length > 0) {
  console.error(`Data protection check failed:\n${failures.join('\n')}`);
  process.exit(1);
}
