import type { SQSEvent } from 'aws-lambda';
import { recordAppEventSafely } from '../app/lib/db/services/app-event.server';
import { refreshHotelAiSummary } from '../app/lib/db/services/hotel.server';

interface HotelSummaryMessage {
  type: 'hotel.summary.refresh';
  hotelId: string;
}

function parseMessage(body: string): HotelSummaryMessage | null {
  try {
    const parsed = JSON.parse(body) as Partial<HotelSummaryMessage>;
    if (
      parsed.type !== 'hotel.summary.refresh' ||
      typeof parsed.hotelId !== 'string' ||
      parsed.hotelId.trim().length === 0
    ) {
      return null;
    }

    return {
      type: parsed.type,
      hotelId: parsed.hotelId,
    };
  } catch {
    return null;
  }
}

export async function handler(event: SQSEvent) {
  for (const record of event.Records) {
    const message = parseMessage(record.body);
    if (!message) {
      console.warn('Skipping invalid hotel summary message');
      continue;
    }

    try {
      const summary = await refreshHotelAiSummary(message.hotelId);
      await recordAppEventSafely({
        category: 'operational',
        action: summary ? 'hotelSummary.generated' : 'hotelSummary.skipped',
        message: summary ? 'Hotel AI summary generated.' : 'Hotel AI summary skipped.',
        subject: {
          type: 'hotel',
          id: message.hotelId,
        },
        metadata: {
          modelId: summary?.modelId,
          reviewCount: summary?.reviewCount,
        },
      });
    } catch (error) {
      await recordAppEventSafely({
        category: 'error',
        action: 'hotelSummary.failed',
        message: 'Hotel AI summary generation failed.',
        subject: {
          type: 'hotel',
          id: message.hotelId,
        },
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
