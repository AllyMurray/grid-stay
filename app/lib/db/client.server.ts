import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Resource } from 'sst';

export const client = new DynamoDBClient({});
export const tableName = Resource.Table.name;
