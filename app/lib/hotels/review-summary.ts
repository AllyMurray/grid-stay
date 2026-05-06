import type { HotelRecord } from '~/lib/db/entities/hotel.server';
import type { HotelReviewRecord } from '~/lib/db/entities/hotel-review.server';

export const HOTEL_SUMMARY_PROMPT_VERSION =
  'hotel-summary-v2-parking-logistics';

export function getHotelReviewFingerprint(reviews: HotelReviewRecord[]) {
  return JSON.stringify({
    promptVersion: HOTEL_SUMMARY_PROMPT_VERSION,
    reviews: [...reviews]
      .toSorted((left, right) => left.reviewId.localeCompare(right.reviewId))
      .map((review) => ({
        reviewId: review.reviewId,
        rating: review.rating,
        trailerParking: review.trailerParking,
        secureParking: review.secureParking,
        lateCheckIn: review.lateCheckIn,
        parkingNotes: review.parkingNotes ?? '',
        generalNotes: review.generalNotes ?? '',
        updatedAt: review.updatedAt,
      })),
  });
}

function cleanSentence(value: string) {
  return value.trim().replace(/[.!?]+$/g, '');
}

function splitIntoSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map(cleanSentence)
    .filter(Boolean);
}

function findParkingLogisticsNote(reviews: HotelReviewRecord[]) {
  const logisticsPattern =
    /\b(parking|car\s*park|trailer|validate|validation|reception|pay|paid|free|book direct|barrier|entrance|access)\b/i;
  const notes = reviews.flatMap((review) => [
    review.parkingNotes ?? '',
    review.generalNotes ?? '',
  ]);

  for (const note of notes) {
    const matchingSentences = splitIntoSentences(note).filter((sentence) =>
      logisticsPattern.test(sentence),
    );
    const actionableSentence =
      matchingSentences.find((sentence) =>
        /\b(validate|validation|reception|pay|paid|free|book direct(?:ly)?)\b/i.test(
          sentence,
        ),
      ) ??
      matchingSentences.find((sentence) =>
        /\b(barrier|entrance|access)\b/i.test(sentence),
      ) ??
      matchingSentences[0];

    if (actionableSentence) {
      return actionableSentence.slice(0, 260);
    }
  }

  return null;
}

export function summariseHotelReviewsStructurally(reviews: HotelReviewRecord[]) {
  if (reviews.length === 0) {
    return 'No Grid Stay hotel feedback yet.';
  }

  const trailerGood = reviews.filter((review) => review.trailerParking === 'good').length;
  const trailerLimited = reviews.filter((review) => review.trailerParking === 'limited').length;
  const secureYes = reviews.filter((review) => review.secureParking === 'yes').length;
  const lateYes = reviews.filter((review) => review.lateCheckIn === 'yes').length;
  const notes = reviews
    .flatMap((review) => [review.parkingNotes, review.generalNotes])
    .map((note) => note?.trim())
    .filter((note): note is string => Boolean(note));
  const signals: string[] = [];

  if (trailerGood > 0) {
    signals.push(
      `${trailerGood} ${trailerGood === 1 ? 'member says' : 'members say'} trailer parking is good`,
    );
  } else if (trailerLimited > 0) {
    signals.push('trailer parking has been described as limited');
  }

  if (secureYes > 0) {
    signals.push('secure parking has been reported');
  }

  if (lateYes > 0) {
    signals.push('late check-in looks possible');
  }

  const parkingLogisticsNote = findParkingLogisticsNote(reviews);
  if (parkingLogisticsNote) {
    signals.push(`parking note: ${parkingLogisticsNote}`);
  }

  if (signals.length === 0 && notes.length === 0) {
    return `Based on ${reviews.length} Grid Stay ${reviews.length === 1 ? 'review' : 'reviews'}, no strong hotel pattern has emerged yet.`;
  }

  const summary = signals.length > 0 ? signals.join('; ') : notes[0];
  return `Based on ${reviews.length} Grid Stay ${reviews.length === 1 ? 'review' : 'reviews'}: ${summary}.`;
}

export function buildHotelSummaryPrompt(
  hotel: Pick<HotelRecord, 'name' | 'address' | 'postcode'>,
  reviews: HotelReviewRecord[],
) {
  const reviewDetails = reviews.map((review) => ({
    rating: review.rating,
    trailerParking: review.trailerParking,
    secureParking: review.secureParking,
    lateCheckIn: review.lateCheckIn,
    parkingNotes: review.parkingNotes ?? '',
    generalNotes: review.generalNotes ?? '',
  }));

  return [
    `Hotel: ${hotel.name}`,
    hotel.address ? `Address: ${hotel.address}` : null,
    hotel.postcode ? `Postcode: ${hotel.postcode}` : null,
    '',
    'Grid Stay member reviews:',
    JSON.stringify(reviewDetails, null, 2),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
