import { authTable } from './auth-database';
import { table } from './database';
import { appDomainConfig, appName } from './domain';
import { email } from './email';
import {
  betterAuthSecret,
  googleClientId,
  googleClientSecret,
} from './secrets';

export const site = new sst.aws.React('Site', {
  link: [
    table,
    authTable,
    email,
    betterAuthSecret,
    googleClientId,
    googleClientSecret,
  ],
  domain: appDomainConfig,
  environment: {
    BETTER_AUTH_URL: appDomainConfig
      ? `https://${appDomainConfig.name}`
      : 'http://localhost:5173',
    GRID_STAY_EMAIL_FROM: 'Grid Stay <noreply@gridstay.app>',
    GRID_STAY_BOOTSTRAP_MEMBER_EMAILS:
      process.env.GRID_STAY_BOOTSTRAP_MEMBER_EMAILS ?? '',
  },
  transform: {
    server(args) {
      args.name = `${appName}-server-${$app.stage}`;
    },
  },
});
