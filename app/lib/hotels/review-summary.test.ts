import { describe, expect, it } from 'vite-plus/test';
import type { HotelReviewRecord } from '~/lib/db/entities/hotel-review.server';
import {
  getHotelReviewFingerprint,
  HOTEL_SUMMARY_PROMPT_VERSION,
  summariseHotelReviewsStructurally,
} from './review-summary';

const reviewWithParkingPaymentAdvice = {
  hotelId: 'hotel-1',
  reviewId: 'user-1',
  reviewScope: 'hotel-review',
  userId: 'user-1',
  userName: 'Driver One',
  rating: 3,
  trailerParking: 'limited',
  secureParking: 'no',
  lateCheckIn: 'unknown',
  parkingNotes:
    'The entrance is quite tight but you can get a trailer in. Book directly and do not pay for parking at the door, they validate the parking at reception for guests that book direct.',
  generalNotes:
    'The rooms are basic but it is close to the circuit and has a motorsport themed bar.',
  createdAt: '2026-05-06T10:00:00.000Z',
  updatedAt: '2026-05-06T10:00:00.000Z',
} satisfies HotelReviewRecord;

describe('hotel review summaries', () => {
  it('keeps actionable parking payment and validation notes in the structured fallback', () => {
    const summary = summariseHotelReviewsStructurally([
      reviewWithParkingPaymentAdvice,
    ]);

    expect(summary).toContain('trailer parking has been described as limited');
    expect(summary).toContain('do not pay for parking at the door');
    expect(summary).toContain('validate the parking at reception');
  });

  it('includes the prompt version in the review fingerprint', () => {
    const fingerprint = getHotelReviewFingerprint([
      reviewWithParkingPaymentAdvice,
    ]);

    expect(fingerprint).toContain(HOTEL_SUMMARY_PROMPT_VERSION);
  });
});
