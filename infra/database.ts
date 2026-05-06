import { appName } from './domain';

export const table = new sst.aws.Dynamo('Table', {
  fields: {
    pk: 'string',
    sk: 'string',
    gsi1pk: 'string',
    gsi1sk: 'string',
    gsi2pk: 'string',
    gsi2sk: 'string',
  },
  primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
  globalIndexes: {
    gsi1: { hashKey: 'gsi1pk', rangeKey: 'gsi1sk' },
    gsi2: { hashKey: 'gsi2pk', rangeKey: 'gsi2sk' },
  },
  ttl: 'ttl',
  transform: {
    table(args) {
      args.name = `${appName}-${$app.stage}`;
    },
  },
});
