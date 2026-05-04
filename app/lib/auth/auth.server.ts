import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { betterAuth } from 'better-auth';
import { Resource } from 'sst';
import { dynamoDBAdapter } from './dynamodb-adapter.server';
import { canCreateMemberAccountForEmail } from './member-invites.server';
import { readMemberJoinLinkTokenFromRequest } from './member-join-links.server';
import { sendPasswordResetEmail } from './password-reset-email.server';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Type assertion for SST resources not yet generated (created in infra/auth-database.ts and infra/secrets.ts)
const SSTResource = Resource as unknown as {
  AuthTable: { name: string };
  BetterAuthSecret: { value: string };
  GoogleClientId: { value: string };
  GoogleClientSecret: { value: string };
};

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, token }, request) {
      await sendPasswordResetEmail({
        request,
        to: user.email,
        token,
      });
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
  databaseHooks: {
    user: {
      create: {
        async before(user, ctx) {
          const joinToken = readMemberJoinLinkTokenFromRequest({
            request: {
              headers: ctx?.request?.headers ?? ctx?.headers ?? new Headers(),
            },
          });
          const allowed = await canCreateMemberAccountForEmail({
            email: String(user.email),
            joinToken,
          });

          if (!allowed) {
            console.warn('Auth user creation rejected by member invite gate');
          }

          return allowed;
        },
      },
    },
  },
});
