import { Entity, type EntityItem } from 'electrodb';
import { client, tableName } from '~/lib/db/client.server';

export const HotelAiSummaryEntity = new Entity(
  {
    model: {
      entity: 'hotelAiSummary',
      version: '1',
      service: 'gridstay',
    },
    attributes: {
      hotelId: { type: 'string', required: true },
      summaryScope: { type: 'string', required: true },
      provider: {
        type: ['bedrock'] as const,
        required: true,
      },
      modelId: { type: 'string', required: true },
      summary: { type: 'string', required: true },
      reviewFingerprint: { type: 'string', required: true },
      reviewCount: { type: 'number', required: true },
      generatedAt: { type: 'string', required: true },
      createdAt: { type: 'string', required: true },
      updatedAt: { type: 'string', required: true },
    },
    indexes: {
      summary: {
        pk: { field: 'pk', composite: ['hotelId'] },
        sk: { field: 'sk', composite: ['summaryScope'] },
      },
    },
  },
  { client, table: tableName },
);

export type HotelAiSummaryRecord = EntityItem<typeof HotelAiSummaryEntity>;
