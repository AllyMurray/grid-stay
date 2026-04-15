import { authTable } from './auth-database';
import { table } from './database';
import { appDomainConfig, appName } from './domain';
import {
  betterAuthSecret,
  googleClientId,
  googleClientSecret,
} from './secrets';

export const site = new sst.aws.React('Site', {
  link: [table, authTable, betterAuthSecret, googleClientId, googleClientSecret],
  domain: appDomainConfig,
  environment: {
    BETTER_AUTH_URL: appDomainConfig
      ? `https://${appDomainConfig.name}`
      : 'http://localhost:5173',
  },
  transform: {
    server(args) {
      args.name = `${appName}-server-${$app.stage}`;
    },
  },
});
