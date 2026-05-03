import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { type CleanedWhere, createAdapterFactory } from 'better-auth/adapters';
import {
  hasGmailAliasSemantics,
  normalizeMemberAccessEmail,
} from './authorization';

/**
 * Key design for the dedicated auth DynamoDB table.
 *
 * | Model        | PK                  | SK             | GSI1PK                     | GSI1SK         | GSI2PK                      | GSI2SK          |
 * |-------------|---------------------|----------------|----------------------------|----------------|-----------------------------|-----------------|
 * | user         | USER#{id}           | USER           | USER_EMAIL                 | {email}        | —                           | —               |
 * | session      | SESSION#{id}        | SESSION        | SESSION_TOKEN              | {token}        | SESSION_USER#{userId}       | {createdAt}     |
 * | account      | ACCOUNT#{id}        | ACCOUNT        | ACCOUNT_USER#{userId}      | {providerId}   | ACCOUNT_PROVIDER#{providerId} | {accountId}   |
 * | verification | VERIFICATION#{id}   | VERIFICATION   | VERIFICATION_ID            | {identifier}   | —                           | —               |
 * | rateLimit    | RATELIMIT#{key}     | RATELIMIT      | —                          | —              | —                           | —               |
 */

type ModelName = 'user' | 'session' | 'account' | 'verification' | 'rateLimit';

function modelPrefix(model: string): string {
  const prefixes: Record<string, string> = {
    user: 'USER',
    session: 'SESSION',
    account: 'ACCOUNT',
    verification: 'VERIFICATION',
    rateLimit: 'RATELIMIT',
  };
  return prefixes[model] ?? model.toUpperCase();
}

function buildKeys(
  model: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const prefix = modelPrefix(model);
  const keys: Record<string, unknown> = {
    pk: `${prefix}#${data.id ?? data.key}`,
    sk: prefix,
  };

  switch (model as ModelName) {
    case 'user':
      if (data.email) {
        keys.gsi1pk = 'USER_EMAIL';
        keys.gsi1sk = data.email;
      }
      break;
    case 'session':
      if (data.token) {
        keys.gsi1pk = 'SESSION_TOKEN';
        keys.gsi1sk = data.token;
      }
      if (data.userId) {
        keys.gsi2pk = `SESSION_USER#${data.userId}`;
        keys.gsi2sk = data.createdAt ?? new Date().toISOString();
      }
      break;
    case 'account':
      if (data.userId) {
        keys.gsi1pk = `ACCOUNT_USER#${data.userId}`;
        keys.gsi1sk = data.providerId;
      }
      if (data.providerId) {
        keys.gsi2pk = `ACCOUNT_PROVIDER#${data.providerId}`;
        keys.gsi2sk = data.accountId;
      }
      break;
    case 'verification':
      if (data.identifier) {
        keys.gsi1pk = 'VERIFICATION_ID';
        keys.gsi1sk = data.identifier;
      }
      break;
  }

  return keys;
}

/**
 * Determine if a where clause can use GetItem or a GSI query,
 * or must fall back to Scan.
 */
function resolveQuery(
  model: string,
  where: CleanedWhere[],
): {
  type: 'getItem' | 'gsi1Query' | 'gsi2Query' | 'scan';
  keyCondition?: Record<string, unknown>;
} {
  const fieldMap = Object.fromEntries(
    where.filter((w) => w.operator === 'eq').map((w) => [w.field, w.value]),
  );

  const prefix = modelPrefix(model);

  // Direct lookup by ID
  if (fieldMap.id) {
    return {
      type: 'getItem',
      keyCondition: { pk: `${prefix}#${fieldMap.id}`, sk: prefix },
    };
  }

  // rateLimit uses 'key' as its identifier
  if (model === 'rateLimit' && fieldMap.key) {
    return {
      type: 'getItem',
      keyCondition: { pk: `${prefix}#${fieldMap.key}`, sk: prefix },
    };
  }

  // GSI-based lookups
  switch (model as ModelName) {
    case 'user':
      if (fieldMap.email) {
        return {
          type: 'gsi1Query',
          keyCondition: { gsi1pk: 'USER_EMAIL', gsi1sk: fieldMap.email },
        };
      }
      break;
    case 'session':
      if (fieldMap.token) {
        return {
          type: 'gsi1Query',
          keyCondition: {
            gsi1pk: 'SESSION_TOKEN',
            gsi1sk: fieldMap.token,
          },
        };
      }
      if (fieldMap.userId) {
        return {
          type: 'gsi2Query',
          keyCondition: { gsi2pk: `SESSION_USER#${fieldMap.userId}` },
        };
      }
      break;
    case 'account':
      if (fieldMap.userId && fieldMap.providerId) {
        return {
          type: 'gsi1Query',
          keyCondition: {
            gsi1pk: `ACCOUNT_USER#${fieldMap.userId}`,
            gsi1sk: fieldMap.providerId,
          },
        };
      }
      if (fieldMap.userId) {
        return {
          type: 'gsi1Query',
          keyCondition: { gsi1pk: `ACCOUNT_USER#${fieldMap.userId}` },
        };
      }
      if (fieldMap.providerId && fieldMap.accountId) {
        return {
          type: 'gsi2Query',
          keyCondition: {
            gsi2pk: `ACCOUNT_PROVIDER#${fieldMap.providerId}`,
            gsi2sk: fieldMap.accountId,
          },
        };
      }
      break;
    case 'verification':
      if (fieldMap.identifier) {
        return {
          type: 'gsi1Query',
          keyCondition: {
            gsi1pk: 'VERIFICATION_ID',
            gsi1sk: fieldMap.identifier,
          },
        };
      }
      break;
  }

  return { type: 'scan' };
}

/** Strip DynamoDB key attributes from a record to return clean data */
function stripKeys(item: Record<string, unknown>): Record<string, unknown> {
  const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, ttl, ...data } = item;
  return data;
}

function getSingleUserEmailLookupValue(
  model: string,
  where: CleanedWhere[],
): string | null {
  if (model !== 'user' || where.length !== 1) {
    return null;
  }

  const [clause] = where;
  if (
    clause?.field !== 'email' ||
    (clause.operator && clause.operator !== 'eq') ||
    typeof clause.value !== 'string'
  ) {
    return null;
  }

  return clause.value;
}

function matchesUserEmailByMemberAccessAlias(
  item: Record<string, unknown>,
  email: string,
): boolean {
  return (
    typeof item.email === 'string' &&
    normalizeMemberAccessEmail(item.email) === normalizeMemberAccessEmail(email)
  );
}

/** Check if a single record matches a where clause */
function matchesWhere(
  item: Record<string, unknown>,
  where: CleanedWhere[],
): boolean {
  for (const clause of where) {
    const value = item[clause.field];
    let matches = false;

    switch (clause.operator) {
      case 'eq':
        matches = value === clause.value;
        break;
      case 'ne':
        matches = value !== clause.value;
        break;
      case 'gt':
        matches = (value as number) > (clause.value as number);
        break;
      case 'gte':
        matches = (value as number) >= (clause.value as number);
        break;
      case 'lt':
        matches = (value as number) < (clause.value as number);
        break;
      case 'lte':
        matches = (value as number) <= (clause.value as number);
        break;
      case 'in':
        matches =
          Array.isArray(clause.value) &&
          (clause.value as unknown[]).includes(value);
        break;
      case 'not_in':
        matches =
          Array.isArray(clause.value) &&
          !(clause.value as unknown[]).includes(value);
        break;
      case 'contains':
        matches =
          typeof value === 'string' &&
          typeof clause.value === 'string' &&
          value.includes(clause.value);
        break;
      case 'starts_with':
        matches =
          typeof value === 'string' &&
          typeof clause.value === 'string' &&
          value.startsWith(clause.value);
        break;
      case 'ends_with':
        matches =
          typeof value === 'string' &&
          typeof clause.value === 'string' &&
          value.endsWith(clause.value);
        break;
      default:
        matches = value === clause.value;
    }

    // For AND connector (or first clause), all must match
    // For OR connector, any match is sufficient
    if (clause.connector === 'OR') {
      if (matches) return true;
    } else {
      if (!matches) return false;
    }
  }
  return true;
}

/** Compute TTL epoch from expiresAt if present */
function computeTtl(
  model: string,
  data: Record<string, unknown>,
): number | undefined {
  if (model === 'session' || model === 'verification') {
    const expiresAt = data.expiresAt;
    if (typeof expiresAt === 'string') {
      return Math.floor(new Date(expiresAt).getTime() / 1000);
    }
    if (expiresAt instanceof Date) {
      return Math.floor(expiresAt.getTime() / 1000);
    }
  }
  return undefined;
}

/** Paginate a DynamoDB scan to collect all items beyond 1MB limit */
async function paginatedScan(
  client: DynamoDBDocumentClient,
  params: ConstructorParameters<typeof ScanCommand>[0],
): Promise<{ Items: Record<string, unknown>[]; Count: number }> {
  const items: Record<string, unknown>[] = [];
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({ ...params, ExclusiveStartKey: lastKey }),
    );
    if (params?.Select === 'COUNT') {
      count += result.Count ?? 0;
    } else {
      items.push(...((result.Items ?? []) as Record<string, unknown>[]));
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return {
    Items: items,
    Count: params?.Select === 'COUNT' ? count : items.length,
  };
}

async function findUserByMemberAccessEmail(
  client: DynamoDBDocumentClient,
  tableName: string,
  email: string,
): Promise<Record<string, unknown> | undefined> {
  if (!hasGmailAliasSemantics(email)) {
    return undefined;
  }

  const memberAccessEmail = normalizeMemberAccessEmail(email);
  const result = await paginatedScan(client, {
    TableName: tableName,
    FilterExpression: 'begins_with(pk, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'USER#' },
  });

  return result.Items.map(stripKeys)
    .filter(
      (item) =>
        typeof item.email === 'string' &&
        normalizeMemberAccessEmail(item.email) === memberAccessEmail,
    )
    .sort((left, right) => {
      const leftCreatedAt =
        typeof left.createdAt === 'string' ? left.createdAt : '';
      const rightCreatedAt =
        typeof right.createdAt === 'string' ? right.createdAt : '';

      if (leftCreatedAt !== rightCreatedAt) {
        return leftCreatedAt.localeCompare(rightCreatedAt);
      }

      return String(left.id ?? '').localeCompare(String(right.id ?? ''));
    })[0];
}

interface DynamoDBAdapterOptions {
  client: DynamoDBDocumentClient;
  tableName: string;
}

export function dynamoDBAdapter({ client, tableName }: DynamoDBAdapterOptions) {
  const adapterFactory = createAdapterFactory({
    config: {
      adapterId: 'dynamodb',
      adapterName: 'DynamoDB Adapter',
      usePlural: false,
      supportsJSON: false,
      supportsDates: false,
      supportsBooleans: true,
      supportsArrays: false,
      supportsNumericIds: false,
      supportsUUIDs: false,
      transaction: false,
    },
    adapter: () => ({
      create: async ({ model, data }) => {
        const keys = buildKeys(model, data);
        const ttl = computeTtl(model, data);

        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: { ...data, ...keys, ...(ttl !== undefined ? { ttl } : {}) },
          }),
        );

        return data as any;
      },

      findOne: async ({ model, where }) => {
        const query = resolveQuery(model, where);
        const userEmailLookup = getSingleUserEmailLookupValue(model, where);

        let item: Record<string, unknown> | undefined;

        if (query.type === 'getItem') {
          const result = await client.send(
            new GetCommand({
              TableName: tableName,
              Key: query.keyCondition,
            }),
          );
          item = result.Item as Record<string, unknown> | undefined;
        } else if (query.type === 'gsi1Query') {
          const kc = query.keyCondition!;
          const hasSort = kc.gsi1sk !== undefined;
          const result = await client.send(
            new QueryCommand({
              TableName: tableName,
              IndexName: 'gsi1',
              KeyConditionExpression: hasSort
                ? 'gsi1pk = :pk AND gsi1sk = :sk'
                : 'gsi1pk = :pk',
              ExpressionAttributeValues: hasSort
                ? { ':pk': kc.gsi1pk, ':sk': kc.gsi1sk }
                : { ':pk': kc.gsi1pk },
              ...(hasSort ? { Limit: 1 } : {}),
            }),
          );
          item = hasSort
            ? (result.Items?.[0] as Record<string, unknown> | undefined)
            : (result.Items?.find((i) =>
                matchesWhere(stripKeys(i as Record<string, unknown>), where),
              ) as Record<string, unknown> | undefined);

          if (!item && userEmailLookup) {
            item = await findUserByMemberAccessEmail(
              client,
              tableName,
              userEmailLookup,
            );
          }
        } else if (query.type === 'gsi2Query') {
          const kc = query.keyCondition!;
          const hasSort = kc.gsi2sk !== undefined;
          const result = await client.send(
            new QueryCommand({
              TableName: tableName,
              IndexName: 'gsi2',
              KeyConditionExpression: hasSort
                ? 'gsi2pk = :pk AND gsi2sk = :sk'
                : 'gsi2pk = :pk',
              ExpressionAttributeValues: hasSort
                ? { ':pk': kc.gsi2pk, ':sk': kc.gsi2sk }
                : { ':pk': kc.gsi2pk },
              ...(hasSort ? { Limit: 1 } : {}),
            }),
          );
          item = hasSort
            ? (result.Items?.[0] as Record<string, unknown> | undefined)
            : (result.Items?.find((i) =>
                matchesWhere(stripKeys(i as Record<string, unknown>), where),
              ) as Record<string, unknown> | undefined);
        } else {
          // Scan fallback
          const prefix = modelPrefix(model);
          const result = await paginatedScan(client, {
            TableName: tableName,
            FilterExpression: 'begins_with(pk, :prefix)',
            ExpressionAttributeValues: { ':prefix': `${prefix}#` },
          });
          item = result.Items.find((i) => matchesWhere(stripKeys(i), where));
        }

        if (!item) return null;

        // For GetItem / GSI query, still verify all where conditions
        const clean = stripKeys(item);
        if (query.type !== 'scan' && !matchesWhere(clean, where)) {
          if (
            !userEmailLookup ||
            !matchesUserEmailByMemberAccessAlias(clean, userEmailLookup)
          ) {
            return null;
          }
        }

        return clean as any;
      },

      findMany: async ({ model, where, limit, sortBy, offset }) => {
        let items: Record<string, unknown>[];

        if (where && where.length > 0) {
          const query = resolveQuery(model, where);

          if (query.type === 'getItem') {
            const result = await client.send(
              new GetCommand({
                TableName: tableName,
                Key: query.keyCondition,
              }),
            );
            items = result.Item ? [result.Item as Record<string, unknown>] : [];
          } else if (query.type === 'gsi1Query' || query.type === 'gsi2Query') {
            const indexName = query.type === 'gsi1Query' ? 'gsi1' : 'gsi2';
            const kc = query.keyCondition!;
            const pkKey = query.type === 'gsi1Query' ? 'gsi1pk' : 'gsi2pk';
            const skKey = query.type === 'gsi1Query' ? 'gsi1sk' : 'gsi2sk';
            const hasSort = kc[skKey] !== undefined;

            const result = await client.send(
              new QueryCommand({
                TableName: tableName,
                IndexName: indexName,
                KeyConditionExpression: hasSort
                  ? `${pkKey} = :pk AND ${skKey} = :sk`
                  : `${pkKey} = :pk`,
                ExpressionAttributeValues: hasSort
                  ? { ':pk': kc[pkKey], ':sk': kc[skKey] }
                  : { ':pk': kc[pkKey] },
              }),
            );
            items = (result.Items ?? []) as Record<string, unknown>[];
          } else {
            // Scan fallback
            const prefix = modelPrefix(model);
            const result = await paginatedScan(client, {
              TableName: tableName,
              FilterExpression: 'begins_with(pk, :prefix)',
              ExpressionAttributeValues: { ':prefix': `${prefix}#` },
            });
            items = result.Items;
          }

          // Filter results through where clauses
          items = items
            .map((i) => stripKeys(i))
            .filter((i) => matchesWhere(i, where));
        } else {
          // No where clause — scan for all items of this model
          const prefix = modelPrefix(model);
          const result = await paginatedScan(client, {
            TableName: tableName,
            FilterExpression: 'begins_with(pk, :prefix)',
            ExpressionAttributeValues: { ':prefix': `${prefix}#` },
          });
          items = result.Items.map(stripKeys);
        }

        // Sort
        if (sortBy) {
          items.sort((a, b) => {
            const aVal = a[sortBy.field];
            const bVal = b[sortBy.field];
            if (aVal === bVal) return 0;
            if (aVal === undefined || aVal === null) return 1;
            if (bVal === undefined || bVal === null) return -1;
            const cmp = aVal < bVal ? -1 : 1;
            return sortBy.direction === 'desc' ? -cmp : cmp;
          });
        }

        // Offset and limit
        if (offset) {
          items = items.slice(offset);
        }
        if (limit) {
          items = items.slice(0, limit);
        }

        return items as any[];
      },

      count: async ({ model, where }) => {
        const prefix = modelPrefix(model);

        if (!where || where.length === 0) {
          const result = await paginatedScan(client, {
            TableName: tableName,
            FilterExpression: 'begins_with(pk, :prefix)',
            ExpressionAttributeValues: { ':prefix': `${prefix}#` },
            Select: 'COUNT',
          });
          return result.Count;
        }

        // Need to filter in-memory for complex where clauses
        const fullResult = await paginatedScan(client, {
          TableName: tableName,
          FilterExpression: 'begins_with(pk, :prefix)',
          ExpressionAttributeValues: { ':prefix': `${prefix}#` },
        });

        return fullResult.Items.filter((i) => matchesWhere(stripKeys(i), where))
          .length;
      },

      update: async ({ model, where, update: updateData }) => {
        // First find the item
        const query = resolveQuery(model, where);
        let existingItem: Record<string, unknown> | undefined;

        if (query.type === 'getItem') {
          const result = await client.send(
            new GetCommand({
              TableName: tableName,
              Key: query.keyCondition,
            }),
          );
          existingItem = result.Item as Record<string, unknown> | undefined;
        } else {
          // Use findOne logic to locate the item
          const prefix = modelPrefix(model);
          let items: Record<string, unknown>[] = [];

          if (query.type === 'gsi1Query' || query.type === 'gsi2Query') {
            const indexName = query.type === 'gsi1Query' ? 'gsi1' : 'gsi2';
            const kc = query.keyCondition!;
            const pkKey = query.type === 'gsi1Query' ? 'gsi1pk' : 'gsi2pk';
            const skKey = query.type === 'gsi1Query' ? 'gsi1sk' : 'gsi2sk';
            const hasSort = kc[skKey] !== undefined;

            const result = await client.send(
              new QueryCommand({
                TableName: tableName,
                IndexName: indexName,
                KeyConditionExpression: hasSort
                  ? `${pkKey} = :pk AND ${skKey} = :sk`
                  : `${pkKey} = :pk`,
                ExpressionAttributeValues: hasSort
                  ? { ':pk': kc[pkKey], ':sk': kc[skKey] }
                  : { ':pk': kc[pkKey] },
                ...(hasSort ? { Limit: 1 } : {}),
              }),
            );
            items = (result.Items ?? []) as Record<string, unknown>[];
          } else {
            const result = await paginatedScan(client, {
              TableName: tableName,
              FilterExpression: 'begins_with(pk, :prefix)',
              ExpressionAttributeValues: { ':prefix': `${prefix}#` },
            });
            items = result.Items;
          }

          existingItem = items.find((i) => matchesWhere(stripKeys(i), where));
        }

        if (!existingItem) return null;

        // Merge update data
        const merged = { ...stripKeys(existingItem), ...updateData };
        const keys = buildKeys(model, merged);
        const ttl = computeTtl(model, merged);

        // Write back the full item (PutItem to update GSI keys)
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              ...merged,
              ...keys,
              ...(ttl !== undefined ? { ttl } : {}),
            },
          }),
        );

        return merged as any;
      },

      updateMany: async ({ model, where, update: updateData }) => {
        // Find all matching items
        const prefix = modelPrefix(model);
        const result = await paginatedScan(client, {
          TableName: tableName,
          FilterExpression: 'begins_with(pk, :prefix)',
          ExpressionAttributeValues: { ':prefix': `${prefix}#` },
        });

        const items = result.Items.filter((i) =>
          !where || where.length === 0
            ? true
            : matchesWhere(stripKeys(i), where),
        );

        let count = 0;
        for (const item of items) {
          const merged = {
            ...stripKeys(item as Record<string, unknown>),
            ...updateData,
          };
          const keys = buildKeys(model, merged);
          const ttl = computeTtl(model, merged);

          await client.send(
            new PutCommand({
              TableName: tableName,
              Item: {
                ...merged,
                ...keys,
                ...(ttl !== undefined ? { ttl } : {}),
              },
            }),
          );
          count++;
        }

        return count;
      },

      delete: async ({ model, where }) => {
        const query = resolveQuery(model, where);
        const prefix = modelPrefix(model);

        let pk: unknown;
        let sk: unknown;

        if (query.type === 'getItem') {
          pk = query.keyCondition!.pk;
          sk = query.keyCondition!.sk;
        } else {
          // Find the item first
          let items: Record<string, unknown>[] = [];

          if (query.type === 'gsi1Query' || query.type === 'gsi2Query') {
            const indexName = query.type === 'gsi1Query' ? 'gsi1' : 'gsi2';
            const kc = query.keyCondition!;
            const pkKey = query.type === 'gsi1Query' ? 'gsi1pk' : 'gsi2pk';
            const skKey = query.type === 'gsi1Query' ? 'gsi1sk' : 'gsi2sk';
            const hasSort = kc[skKey] !== undefined;

            const result = await client.send(
              new QueryCommand({
                TableName: tableName,
                IndexName: indexName,
                KeyConditionExpression: hasSort
                  ? `${pkKey} = :pk AND ${skKey} = :sk`
                  : `${pkKey} = :pk`,
                ExpressionAttributeValues: hasSort
                  ? { ':pk': kc[pkKey], ':sk': kc[skKey] }
                  : { ':pk': kc[pkKey] },
                ...(hasSort ? { Limit: 1 } : {}),
              }),
            );
            items = (result.Items ?? []) as Record<string, unknown>[];
          } else {
            const result = await paginatedScan(client, {
              TableName: tableName,
              FilterExpression: 'begins_with(pk, :prefix)',
              ExpressionAttributeValues: { ':prefix': `${prefix}#` },
            });
            items = result.Items;
          }

          const found = items.find((i) => matchesWhere(stripKeys(i), where));

          if (!found) return;

          pk = found.pk;
          sk = found.sk;
        }

        await client.send(
          new DeleteCommand({
            TableName: tableName,
            Key: { pk, sk },
          }),
        );
      },

      deleteMany: async ({ model, where }) => {
        const prefix = modelPrefix(model);
        const result = await paginatedScan(client, {
          TableName: tableName,
          FilterExpression: 'begins_with(pk, :prefix)',
          ExpressionAttributeValues: { ':prefix': `${prefix}#` },
        });

        const items = result.Items.filter((i) =>
          !where || where.length === 0
            ? true
            : matchesWhere(stripKeys(i), where),
        );

        for (const item of items) {
          await client.send(
            new DeleteCommand({
              TableName: tableName,
              Key: { pk: item.pk, sk: item.sk },
            }),
          );
        }

        return items.length;
      },
    }),
  });

  return adapterFactory;
}
