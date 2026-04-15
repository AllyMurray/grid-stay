import { table } from './database';
import { appName } from './domain';

export const refreshAvailableDaysCache = new sst.aws.Function(
  'RefreshAvailableDaysCache',
  {
    handler: 'functions/refresh-available-days.handler',
    link: [table],
    timeout: '5 minutes',
    transform: {
      function(args) {
        args.name = `${appName}-refresh-available-days-${$app.stage}`;
      },
    },
  },
);

export const refreshAvailableDaysCacheCron = new sst.aws.Cron(
  'RefreshAvailableDaysCacheCron',
  {
    function: refreshAvailableDaysCache.arn,
    schedule: 'rate(1 day)',
  },
);
