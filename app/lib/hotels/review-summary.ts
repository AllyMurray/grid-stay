import type { HotelRecord } from '~/lib/db/entities/hotel.server';
import type { HotelReviewRecord } from '~/lib/db/entities/hotel-review.server';

export function getHotelReviewFingerprint(reviews: HotelReviewRecord[]) {
  return JSON.stringify(
    [...reviews]
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
  );
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
