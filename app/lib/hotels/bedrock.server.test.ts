import type { ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import { describe, expect, it, vi } from 'vite-plus/test';
import { generateHotelSummaryWithBedrock } from './bedrock.server';

const hotel = {
  name: 'Trackside Hotel',
  address: '1 Circuit Road',
  postcode: 'AA1 1AA',
};

const review = {
  hotelId: 'hotel-1',
  reviewId: 'user-1',
  reviewScope: 'hotel-review',
  userId: 'user-1',
  userName: 'Driver One',
  rating: 5,
  trailerParking: 'good',
  secureParking: 'yes',
  lateCheckIn: 'limited',
  parkingNotes: 'Plenty of room in the car park for trailers.',
  generalNotes: 'Easy late arrival.',
  createdAt: '2026-05-04T10:00:00.000Z',
  updatedAt: '2026-05-04T10:00:00.000Z',
} as const;

describe('Bedrock hotel summaries', () => {
  it('asks Bedrock to summarise Grid Stay hotel feedback', async () => {
    const output = {
      output: {
        message: {
          role: 'assistant',
          content: [
            {
              text: 'Members report good trailer parking and limited late check-in.',
            },
          ],
        },
      },
      stopReason: 'end_turn',
      usage: {
        inputTokens: 120,
        outputTokens: 20,
        totalTokens: 140,
      },
      metrics: {
        latencyMs: 250,
      },
      $metadata: {},
    } as ConverseCommandOutput;
    const send = vi.fn(async () => output);

    const summary = await generateHotelSummaryWithBedrock(hotel, [review], {
      send,
      modelId: 'eu.amazon.nova-micro-v1:0',
    });

    expect(summary).toBe('Members report good trailer parking and limited late check-in.');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'eu.amazon.nova-micro-v1:0',
        messages: [
          expect.objectContaining({
            role: 'user',
          }),
        ],
      }),
    );
  });

  it('skips Bedrock when there are no reviews', async () => {
    const send = vi.fn();

    await expect(generateHotelSummaryWithBedrock(hotel, [], { send })).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
