import { table } from './database';
import { appName } from './domain';
import { openRouteServiceApiKey } from './secrets';

export const refreshCircuitDistanceMatrix = new sst.aws.Function(
  'RefreshCircuitDistanceMatrix',
  {
    handler: 'functions/refresh-circuit-distances.handler',
    link: [table, openRouteServiceApiKey],
    timeout: '1 minute',
    transform: {
      function(args) {
        args.name = `${appName}-refresh-circuit-distances-${$app.stage}`;
      },
    },
  },
);

export const refreshCircuitDistanceMatrixCron = new sst.aws.Cron(
  'RefreshCircuitDistanceMatrixCron',
  {
    function: refreshCircuitDistanceMatrix.arn,
    schedule: 'rate(7 days)',
  },
);
