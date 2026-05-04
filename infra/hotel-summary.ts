import { table } from './database';
import { appName } from './domain';

export const hotelSummaryQueue = new sst.aws.Queue('HotelSummaryQueue', {
  visibilityTimeout: '2 minutes',
  transform: {
    queue(args) {
      args.name = `${appName}-hotel-summary-${$app.stage}`;
    },
  },
});

hotelSummaryQueue.subscribe(
  {
    handler: 'functions/generate-hotel-summary.handler',
    link: [table],
    timeout: '1 minute',
    permissions: [
      {
        actions: ['bedrock:Converse', 'bedrock:InvokeModel'],
        resources: ['*'],
      },
    ],
    transform: {
      function(args) {
        args.name = `${appName}-generate-hotel-summary-${$app.stage}`;
      },
    },
  },
  {
    batch: {
      size: 1,
    },
  },
);
