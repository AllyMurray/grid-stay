import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Resource } from 'sst';

const sqsClient = new SQSClient({});

function getHotelSummaryQueueUrl() {
  if (process.env.HOTEL_SUMMARY_QUEUE_URL) {
    return process.env.HOTEL_SUMMARY_QUEUE_URL;
  }

  try {
    const resources = Resource as unknown as {
      HotelSummaryQueue?: { url?: string };
    };
    return resources.HotelSummaryQueue?.url ?? '';
  } catch {
    return '';
  }
}

export async function queueHotelSummaryRefresh(hotelId: string) {
  const queueUrl = getHotelSummaryQueueUrl();

  if (!queueUrl) {
    return { queued: false, reason: 'missing-queue' as const };
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        type: 'hotel.summary.refresh',
        hotelId,
      }),
    }),
  );

  return { queued: true as const };
}

export async function queueHotelSummaryRefreshSafely(hotelId: string) {
  try {
    return await queueHotelSummaryRefresh(hotelId);
  } catch (error) {
    console.warn(
      `Hotel summary refresh could not be queued: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { queued: false, reason: 'enqueue-failed' as const };
  }
}
