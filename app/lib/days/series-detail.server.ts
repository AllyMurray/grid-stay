import type { User } from '~/lib/auth/schemas';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { seriesSubscriptionStore } from '~/lib/db/services/series-subscription.server';
import { normalizeAvailableDayCircuit } from './aggregation.server';
import { getLinkedSeriesKey, getLinkedSeriesName } from './series.server';
import type { AvailableDay } from './types';

export interface RaceSeriesRound {
  dayId: string;
  date: string;
  type: AvailableDay['type'];
  circuit: string;
  layout?: string;
  provider: string;
  description: string;
  bookingUrl?: string;
  myBookingStatus?: 'booked' | 'maybe' | 'cancelled';
  isManual: boolean;
}

export interface RaceSeriesDetail {
  seriesKey: string;
  seriesName: string;
  roundCount: number;
  bookedCount: number;
  maybeCount: number;
  missingCount: number;
  cancelledCount: number;
  manualRoundCount: number;
  subscriptionStatus?: 'booked' | 'maybe';
  subscriptionUpdatedAt?: string;
  rounds: RaceSeriesRound[];
}

function compareAvailableDays(left: AvailableDay, right: AvailableDay) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  if (left.circuit !== right.circuit) {
    return left.circuit.localeCompare(right.circuit);
  }

  return left.dayId.localeCompare(right.dayId);
}

function toRound(
  day: AvailableDay,
  bookingStatus: RaceSeriesRound['myBookingStatus'],
): RaceSeriesRound {
  return {
    dayId: day.dayId,
    date: day.date,
    type: day.type,
    circuit: day.circuit,
    layout: day.layout,
    provider: day.provider,
    description: day.description,
    bookingUrl: day.bookingUrl,
    myBookingStatus: bookingStatus,
    isManual: day.source.sourceType === 'manual',
  };
}

export async function loadRaceSeriesDetail(
  user: Pick<User, 'id'>,
  seriesKey: string,
  loadSnapshot: typeof getAvailableDaysSnapshot = getAvailableDaysSnapshot,
  loadManualDays: typeof listManualDays = listManualDays,
  loadBookings: typeof listMyBookings = listMyBookings,
  loadSubscription: typeof seriesSubscriptionStore.getByUserAndSeries =
    seriesSubscriptionStore.getByUserAndSeries,
): Promise<RaceSeriesDetail | null> {
  const normalizedSeriesKey = seriesKey.trim();
  if (!normalizedSeriesKey) {
    return null;
  }

  const [snapshot, manualDays, bookings, subscription] = await Promise.all([
    loadSnapshot(),
    loadManualDays(),
    loadBookings(user.id),
    loadSubscription(user.id, normalizedSeriesKey),
  ]);
  const bookingStatusByDayId = new Map(bookings.map((booking) => [booking.dayId, booking.status]));
  const seriesDays = [...(snapshot?.days ?? []), ...manualDays]
    .map(normalizeAvailableDayCircuit)
    .filter((day) => getLinkedSeriesKey(day) === normalizedSeriesKey)
    .toSorted(compareAvailableDays);

  if (seriesDays.length === 0) {
    return null;
  }

  const seriesName =
    seriesDays.map(getLinkedSeriesName).find((name): name is string => Boolean(name)) ??
    normalizedSeriesKey;
  const rounds = seriesDays.map((day) => toRound(day, bookingStatusByDayId.get(day.dayId)));

  return {
    seriesKey: normalizedSeriesKey,
    seriesName,
    roundCount: rounds.length,
    bookedCount: rounds.filter((round) => round.myBookingStatus === 'booked').length,
    maybeCount: rounds.filter((round) => round.myBookingStatus === 'maybe').length,
    missingCount: rounds.filter((round) => !round.myBookingStatus).length,
    cancelledCount: rounds.filter((round) => round.myBookingStatus === 'cancelled').length,
    manualRoundCount: rounds.filter((round) => round.isManual).length,
    subscriptionStatus: subscription?.status,
    subscriptionUpdatedAt: subscription?.updatedAt,
    rounds,
  };
}
