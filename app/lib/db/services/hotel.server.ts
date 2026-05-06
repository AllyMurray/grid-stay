import { ulid } from 'ulid';
import type { User } from '~/lib/auth/schemas';
import { HotelEntity, type HotelRecord } from '~/lib/db/entities/hotel.server';
import {
  HotelAiSummaryEntity,
  type HotelAiSummaryRecord,
} from '~/lib/db/entities/hotel-ai-summary.server';
import { HotelReviewEntity, type HotelReviewRecord } from '~/lib/db/entities/hotel-review.server';
import { generateHotelSummaryWithBedrock } from '~/lib/hotels/bedrock.server';
import {
  getHotelReviewFingerprint,
  summariseHotelReviewsStructurally,
} from '~/lib/hotels/review-summary';
import type { HotelReviewInput, HotelSelectionInput } from '~/lib/schemas/hotel';

const HOTEL_SCOPE = 'hotel';
const REVIEW_SCOPE = 'hotel-review';
const SUMMARY_SCOPE = 'hotel-ai-summary';
const GEOAPIFY_ATTRIBUTION = 'Hotel data powered by Geoapify. © OpenStreetMap contributors.';

export interface HotelSuggestion {
  hotelId?: string;
  name: string;
  address?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  source: HotelRecord['source'];
  sourcePlaceId?: string;
  attribution?: string;
}

export interface HotelInsight {
  hotel: HotelRecord;
  reviewCount: number;
  averageRating?: number;
  summary: string;
  summarySource: 'bedrock' | 'structured';
  summaryGeneratedAt?: string;
  reviews: HotelReviewRecord[];
}

export function normalizeHotelName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeOptional(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeCoordinate(value?: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

function sourceKeyFor(input: {
  source: HotelRecord['source'];
  sourcePlaceId?: string;
  normalizedName: string;
}) {
  return input.sourcePlaceId
    ? `${input.source}:${input.sourcePlaceId}`
    : `${input.source}:${input.normalizedName}`;
}

function toHotelItem(input: {
  hotelId?: string;
  name: string;
  address?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  source: HotelRecord['source'];
  sourcePlaceId?: string;
  attribution?: string;
  userId: string;
  now: string;
}): HotelRecord {
  const normalizedName = normalizeHotelName(input.name);
  const sourcePlaceId = sanitizeOptional(input.sourcePlaceId);

  return {
    hotelId: input.hotelId ?? ulid(),
    hotelScope: HOTEL_SCOPE,
    normalizedName,
    sourceKey: sourceKeyFor({
      source: input.source,
      sourcePlaceId,
      normalizedName,
    }),
    name: input.name.trim(),
    address: sanitizeOptional(input.address),
    postcode: sanitizeOptional(input.postcode),
    country: sanitizeOptional(input.country),
    latitude: sanitizeCoordinate(input.latitude),
    longitude: sanitizeCoordinate(input.longitude),
    source: input.source,
    sourcePlaceId,
    attribution: sanitizeOptional(input.attribution),
    createdByUserId: input.userId,
    updatedByUserId: input.userId,
    createdAt: input.now,
    updatedAt: input.now,
  } as HotelRecord;
}

function rankHotelMatch(hotel: HotelRecord, normalizedQuery: string) {
  if (!normalizedQuery) {
    return 0;
  }

  const normalizedName = hotel.normalizedName;
  const normalizedAddress = normalizeHotelName(hotel.address ?? '');

  if (normalizedName === normalizedQuery) {
    return 0;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 1;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 2;
  }

  if (normalizedAddress.includes(normalizedQuery)) {
    return 3;
  }

  return 99;
}

function toSuggestion(hotel: HotelRecord): HotelSuggestion {
  return {
    hotelId: hotel.hotelId,
    name: hotel.name,
    address: hotel.address,
    postcode: hotel.postcode,
    country: hotel.country,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    source: hotel.source,
    sourcePlaceId: hotel.sourcePlaceId,
    attribution: hotel.attribution,
  };
}

export async function listHotels(): Promise<HotelRecord[]> {
  const response = await HotelEntity.query
    .byScope({
      hotelScope: HOTEL_SCOPE,
    })
    .go();
  return response.data;
}

export async function getHotelById(hotelId?: string | null): Promise<HotelRecord | null> {
  if (!hotelId) {
    return null;
  }

  const response = await HotelEntity.get({
    hotelId,
    hotelScope: HOTEL_SCOPE,
  }).go();
  return response.data ?? null;
}

export async function listHotelsByIds(hotelIds: string[]): Promise<Map<string, HotelRecord>> {
  const uniqueIds = [...new Set(hotelIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const response = await HotelEntity.get(
    uniqueIds.map((hotelId) => ({
      hotelId,
      hotelScope: HOTEL_SCOPE,
    })),
  ).go();

  return new Map(
    (response.data ?? [])
      .filter((hotel): hotel is HotelRecord => Boolean(hotel))
      .map((hotel) => [hotel.hotelId, hotel]),
  );
}

export async function searchHotelCatalogue(query: string, limit = 8): Promise<HotelSuggestion[]> {
  const normalizedQuery = normalizeHotelName(query);
  const hotels = await listHotels();

  return hotels
    .map((hotel) => ({
      hotel,
      rank: rankHotelMatch(hotel, normalizedQuery),
    }))
    .filter((entry) => entry.rank < 99)
    .toSorted((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.hotel.name.localeCompare(right.hotel.name);
    })
    .slice(0, limit)
    .map((entry) => toSuggestion(entry.hotel));
}

export async function createOrUpdateHotelFromSelection(
  input: HotelSelectionInput,
  userId: string,
): Promise<HotelRecord | null> {
  if (input.hotelId) {
    return getHotelById(input.hotelId);
  }

  const name = input.hotelName?.trim() ?? '';
  if (!name) {
    return null;
  }

  const now = new Date().toISOString();
  const candidate = toHotelItem({
    name,
    address: input.hotelAddress,
    postcode: input.hotelPostcode,
    country: input.hotelCountry,
    latitude: input.hotelLatitude,
    longitude: input.hotelLongitude,
    source: input.hotelSource ?? 'manual',
    sourcePlaceId: input.hotelSourcePlaceId,
    attribution:
      input.hotelSource === 'geoapify'
        ? input.hotelAttribution || GEOAPIFY_ATTRIBUTION
        : input.hotelAttribution,
    userId,
    now,
  });
  const existing = (await listHotels()).find(
    (hotel) =>
      hotel.sourceKey === candidate.sourceKey ||
      (hotel.normalizedName === candidate.normalizedName &&
        (hotel.postcode ?? '') === (candidate.postcode ?? '')),
  );

  if (existing) {
    const updated = await HotelEntity.patch({
      hotelId: existing.hotelId,
      hotelScope: HOTEL_SCOPE,
    })
      .set({
        name: candidate.name,
        address: candidate.address,
        postcode: candidate.postcode,
        country: candidate.country,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        source: candidate.source,
        sourcePlaceId: candidate.sourcePlaceId,
        sourceKey: candidate.sourceKey,
        attribution: candidate.attribution,
        updatedByUserId: userId,
        updatedAt: now,
      })
      .go({ response: 'all_new' });
    return updated.data;
  }

  await HotelEntity.create(candidate).go({ response: 'none' });
  return candidate;
}

export async function upsertHotelReview(
  input: HotelReviewInput,
  user: Pick<User, 'id' | 'name'>,
): Promise<HotelReviewRecord> {
  const existing = await HotelReviewEntity.get({
    hotelId: input.hotelId,
    reviewId: user.id,
  }).go();
  const now = new Date().toISOString();
  const changes = {
    reviewScope: REVIEW_SCOPE,
    userId: user.id,
    userName: user.name,
    rating: input.rating,
    trailerParking: input.trailerParking,
    secureParking: input.secureParking,
    lateCheckIn: input.lateCheckIn,
    parkingNotes: sanitizeOptional(input.parkingNotes),
    generalNotes: sanitizeOptional(input.generalNotes),
    updatedAt: now,
  };

  if (existing.data) {
    const updated = await HotelReviewEntity.patch({
      hotelId: input.hotelId,
      reviewId: user.id,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  }

  const created = {
    hotelId: input.hotelId,
    reviewId: user.id,
    ...changes,
    createdAt: now,
  } as HotelReviewRecord;
  await HotelReviewEntity.create(created).go({ response: 'none' });
  return created;
}

export async function listHotelReviews(hotelId: string): Promise<HotelReviewRecord[]> {
  const response = await HotelReviewEntity.query.review({ hotelId }).go();
  return response.data.toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getHotelAiSummary(hotelId: string): Promise<HotelAiSummaryRecord | null> {
  const response = await HotelAiSummaryEntity.get({
    hotelId,
    summaryScope: SUMMARY_SCOPE,
  }).go();
  return response.data ?? null;
}

async function listHotelAiSummariesByIds(
  hotelIds: string[],
): Promise<Map<string, HotelAiSummaryRecord>> {
  const uniqueIds = [...new Set(hotelIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const response = await HotelAiSummaryEntity.get(
    uniqueIds.map((hotelId) => ({
      hotelId,
      summaryScope: SUMMARY_SCOPE,
    })),
  ).go();

  return new Map(
    (response.data ?? [])
      .filter((summary): summary is HotelAiSummaryRecord => Boolean(summary))
      .map((summary) => [summary.hotelId, summary]),
  );
}

export async function upsertHotelAiSummary(input: {
  hotelId: string;
  provider: HotelAiSummaryRecord['provider'];
  modelId: string;
  summary: string;
  reviewFingerprint: string;
  reviewCount: number;
  generatedAt: string;
}): Promise<HotelAiSummaryRecord> {
  const existing = await getHotelAiSummary(input.hotelId);
  const now = new Date().toISOString();

  if (existing) {
    const updated = await HotelAiSummaryEntity.patch({
      hotelId: input.hotelId,
      summaryScope: SUMMARY_SCOPE,
    })
      .set({
        provider: input.provider,
        modelId: input.modelId,
        summary: input.summary,
        reviewFingerprint: input.reviewFingerprint,
        reviewCount: input.reviewCount,
        generatedAt: input.generatedAt,
        updatedAt: now,
      })
      .go({ response: 'all_new' });
    return updated.data;
  }

  const created = {
    hotelId: input.hotelId,
    summaryScope: SUMMARY_SCOPE,
    provider: input.provider,
    modelId: input.modelId,
    summary: input.summary,
    reviewFingerprint: input.reviewFingerprint,
    reviewCount: input.reviewCount,
    generatedAt: input.generatedAt,
    createdAt: now,
    updatedAt: now,
  } as HotelAiSummaryRecord;
  await HotelAiSummaryEntity.create(created).go({ response: 'none' });
  return created;
}

export async function refreshHotelAiSummary(
  hotelId: string,
  summarizer: typeof generateHotelSummaryWithBedrock = generateHotelSummaryWithBedrock,
): Promise<HotelAiSummaryRecord | null> {
  const hotel = await getHotelById(hotelId);
  if (!hotel) {
    return null;
  }

  const reviews = await listHotelReviews(hotelId);
  if (reviews.length === 0) {
    return null;
  }

  const summary = await summarizer(hotel, reviews);
  if (!summary) {
    return null;
  }

  return upsertHotelAiSummary({
    hotelId,
    provider: 'bedrock',
    modelId: process.env.BEDROCK_HOTEL_SUMMARY_MODEL_ID ?? 'eu.amazon.nova-micro-v1:0',
    summary,
    reviewFingerprint: getHotelReviewFingerprint(reviews),
    reviewCount: reviews.length,
    generatedAt: new Date().toISOString(),
  });
}

export async function listHotelInsights(hotelIds: string[]): Promise<Map<string, HotelInsight>> {
  const hotels = await listHotelsByIds(hotelIds);
  const cachedSummaries = await listHotelAiSummariesByIds([...hotels.keys()]);
  const entries = await Promise.all(
    [...hotels.values()].map(async (hotel) => {
      const reviews = await listHotelReviews(hotel.hotelId);
      const reviewFingerprint = getHotelReviewFingerprint(reviews);
      const cachedSummary = cachedSummaries.get(hotel.hotelId);
      const currentCachedSummary =
        cachedSummary?.reviewFingerprint === reviewFingerprint ? cachedSummary : null;
      const ratings = reviews
        .map((review) => review.rating)
        .filter((rating): rating is number => Number.isFinite(rating));
      const averageRating =
        ratings.length > 0
          ? Math.round(
              (ratings.reduce((total, rating) => total + rating, 0) / ratings.length) * 10,
            ) / 10
          : undefined;

      return [
        hotel.hotelId,
        {
          hotel,
          reviewCount: reviews.length,
          averageRating,
          summary: currentCachedSummary?.summary ?? summariseHotelReviewsStructurally(reviews),
          summarySource: currentCachedSummary ? 'bedrock' : 'structured',
          summaryGeneratedAt: currentCachedSummary?.generatedAt,
          reviews,
        },
      ] as const;
    }),
  );

  return new Map(entries);
}
