import type { SQSEvent } from 'aws-lambda';
import { describe, expect, it, vi } from 'vite-plus/test';
import { recordAppEventSafely } from '../app/lib/db/services/app-event.server';
import { refreshHotelAiSummary } from '../app/lib/db/services/hotel.server';
import { handler } from './generate-hotel-summary';

vi.mock('../app/lib/db/services/app-event.server', () => ({
  recordAppEventSafely: vi.fn(async () => undefined),
}));

vi.mock('../app/lib/db/services/hotel.server', () => ({
  refreshHotelAiSummary: vi.fn(),
}));

function eventFor(body: unknown): SQSEvent {
  return {
    Records: [
      {
        body: JSON.stringify(body),
      },
    ],
  } as SQSEvent;
}

describe('hotel summary worker', () => {
  it('generates and records an AI hotel summary', async () => {
    vi.mocked(refreshHotelAiSummary).mockResolvedValue({
      hotelId: 'hotel-1',
      summaryScope: 'hotel-ai-summary',
      provider: 'bedrock',
      modelId: 'eu.amazon.nova-micro-v1:0',
      summary: 'Trailer parking is good.',
      reviewFingerprint: 'reviews',
      reviewCount: 2,
      generatedAt: '2026-05-04T10:00:00.000Z',
      createdAt: '2026-05-04T10:00:00.000Z',
      updatedAt: '2026-05-04T10:00:00.000Z',
    });

    await handler(
      eventFor({
        type: 'hotel.summary.refresh',
        hotelId: 'hotel-1',
      }),
    );

    expect(refreshHotelAiSummary).toHaveBeenCalledWith('hotel-1');
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'operational',
        action: 'hotelSummary.generated',
      }),
    );
  });

  it('records Bedrock failures without retrying the non-critical job', async () => {
    vi.mocked(refreshHotelAiSummary).mockRejectedValue(new Error('model access denied'));

    await expect(
      handler(
        eventFor({
          type: 'hotel.summary.refresh',
          hotelId: 'hotel-1',
        }),
      ),
    ).resolves.toBeUndefined();

    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'error',
        action: 'hotelSummary.failed',
        metadata: {
          error: 'model access denied',
        },
      }),
    );
  });
});
