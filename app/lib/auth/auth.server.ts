import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { betterAuth } from 'better-auth';
import { Resource } from 'sst';
import { dynamoDBAdapter } from './dynamodb-adapter.server';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Type assertion for SST resources not yet generated (created in infra/auth-database.ts and infra/secrets.ts)
const SSTResource = Resource as unknown as {
  AuthTable: { name: string };
  BetterAuthSecret: { value: string };
  GoogleClientId: { value: string };
  GoogleClientSecret: { value: string };
};

export const auth = betterAuth({
  basePath: '/api/auth',
  database: dynamoDBAdapter({
    client: docClient,
    tableName: SSTResource.AuthTable.name,
  }),
  secret: SSTResource.BetterAuthSecret.value,
  socialProviders: {
    google: {
      clientId: SSTResource.GoogleClientId.value,
      clientSecret: SSTResource.GoogleClientSecret.value,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'member',
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    cookieCache: { enabled: true, maxAge: 5 * 60 }, // 5 min cache
  },
  onAPIError: {
    errorURL: '/',
  },
});
