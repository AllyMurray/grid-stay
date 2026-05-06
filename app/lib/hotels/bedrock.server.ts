import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type { HotelRecord } from '~/lib/db/entities/hotel.server';
import type { HotelReviewRecord } from '~/lib/db/entities/hotel-review.server';
import { buildHotelSummaryPrompt } from './review-summary';

export const HOTEL_SUMMARY_MODEL_ID =
  process.env.BEDROCK_HOTEL_SUMMARY_MODEL_ID ?? 'eu.amazon.nova-micro-v1:0';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? 'eu-west-1',
});

function extractText(output: ConverseCommandOutput) {
  const content = output.output?.message?.content ?? [];
  return content
    .map((block) => ('text' in block ? block.text : undefined))
    .filter((text): text is string => Boolean(text))
    .join('\n')
    .trim();
}

function cleanSummary(value: string) {
  return value
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);
}

export async function generateHotelSummaryWithBedrock(
  hotel: Pick<HotelRecord, 'name' | 'address' | 'postcode'>,
  reviews: HotelReviewRecord[],
  options: {
    send?: (input: ConverseCommandInput) => Promise<ConverseCommandOutput>;
    modelId?: string;
  } = {},
) {
  if (reviews.length === 0) {
    return null;
  }

  const input: ConverseCommandInput = {
    modelId: options.modelId ?? HOTEL_SUMMARY_MODEL_ID,
    system: [
      {
        text: [
          'You summarise Grid Stay member hotel feedback for track day planning.',
          'Use only the supplied member reviews.',
          'Write 1-3 concise sentences.',
          'Mention trailer parking, secure parking, and late check-in when the reviews provide useful signal.',
          'Preserve actionable parking logistics such as payment, parking validation at reception, barriers, entrance or access constraints, and where trailers fit when the reviews mention them.',
          'Do not invent facts, prices, ratings, policies, or external review details.',
          'Do not use markdown.',
        ].join(' '),
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            text: buildHotelSummaryPrompt(hotel, reviews),
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 180,
      temperature: 0.2,
    },
  };

  const output = await (options.send
    ? options.send(input)
    : bedrockClient.send(new ConverseCommand(input)));
  const text = extractText(output);

  return text ? cleanSummary(text) : null;
}
