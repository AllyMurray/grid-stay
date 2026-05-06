import type { BookingRecord } from '~/lib/db/entities/booking.server';
import {
  type BookingPersistence,
  type BookingSummaryPersistence,
  bookingStore,
  syncDayAttendanceSummaries,
} from '~/lib/db/services/booking.server';
import { dayAttendanceSummaryStore } from '~/lib/db/services/day-attendance-summary.server';
import {
  type SeriesSubscriptionPersistence,
  seriesSubscriptionStore,
  upsertSeriesSubscription,
} from '~/lib/db/services/series-subscription.server';
import { getLinkedSeriesKey, getLinkedSeriesName } from './series.server';
import type { AvailableDay } from './types';

function getSubscriptionQualifierDays(days: AvailableDay[]) {
  const raceDays = days.filter((day) => day.type === 'race_day');
  return raceDays.length > 0 ? raceDays : days;
}

function getDerivedSubscriptionStatus(bookings: BookingRecord[]) {
  return bookings.every((booking) => booking.status === 'booked') ? 'booked' : 'maybe';
}

async function ensureLinkedSeriesBookingsForUser(
  user: {
    id: string;
    name: string;
    picture?: string;
  },
  days: AvailableDay[],
  status: 'booked' | 'maybe',
  existingDayIds: Set<string>,
  store: BookingPersistence,
  summaryStore: BookingSummaryPersistence,
) {
  const now = new Date().toISOString();
  const createdDayIds: string[] = [];

  for (const day of days) {
    if (existingDayIds.has(day.dayId)) {
      continue;
    }

    await store.create({
      bookingId: day.dayId,
      userId: user.id,
      userName: user.name,
      userImage: user.picture,
      dayId: day.dayId,
      date: day.date,
      type: day.type,
      status,
      circuit: day.circuit,
      circuitId: day.circuitId,
      circuitName: day.circuitName,
      layout: day.layout,
      circuitKnown: day.circuitKnown,
      provider: day.provider,
      description: day.description,
      createdAt: now,
      updatedAt: now,
      bookingReference: undefined,
      accommodationName: undefined,
      accommodationReference: undefined,
      notes: undefined,
    } as BookingRecord);
    createdDayIds.push(day.dayId);
  }

  if (createdDayIds.length > 0) {
    await syncDayAttendanceSummaries(createdDayIds, store, summaryStore);
  }

  return createdDayIds.length;
}

export async function reconcileSeriesSubscriptionsForDays(
  days: AvailableDay[],
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
  subscriptionStore: SeriesSubscriptionPersistence = seriesSubscriptionStore,
) {
  if (days.length === 0) {
    return {
      seriesKey: null,
      seriesName: null,
      subscriptionCount: 0,
      bookingCount: 0,
    };
  }

  const seriesKey = getLinkedSeriesKey(days[0]!);
  const seriesName = getLinkedSeriesName(days[0]!);
  if (!seriesKey || !seriesName) {
    return {
      seriesKey: null,
      seriesName: null,
      subscriptionCount: 0,
      bookingCount: 0,
    };
  }

  const qualifierDays = getSubscriptionQualifierDays(days);
  const qualifierDayIds = new Set(qualifierDays.map((day) => day.dayId));
  const bookingsByDay = await Promise.all(days.map((day) => store.listByDay(day.dayId)));
  const members = new Map<
    string,
    {
      userId: string;
      userName: string;
      userImage?: string;
      existingDayIds: Set<string>;
      qualifyingBookings: BookingRecord[];
    }
  >();

  for (const bookings of bookingsByDay) {
    for (const booking of bookings) {
      const current = members.get(booking.userId);
      if (current) {
        current.existingDayIds.add(booking.dayId);
        if (qualifierDayIds.has(booking.dayId) && booking.status !== 'cancelled') {
          current.qualifyingBookings.push(booking);
        }
        continue;
      }

      members.set(booking.userId, {
        userId: booking.userId,
        userName: booking.userName,
        userImage: booking.userImage,
        existingDayIds: new Set([booking.dayId]),
        qualifyingBookings:
          qualifierDayIds.has(booking.dayId) && booking.status !== 'cancelled' ? [booking] : [],
      });
    }
  }

  let subscriptionCount = 0;
  let bookingCount = 0;

  for (const member of members.values()) {
    const qualifyingDayIdsForUser = new Set(
      member.qualifyingBookings.map((booking) => booking.dayId),
    );
    const isSubscribed = qualifierDays.every((day) => qualifyingDayIdsForUser.has(day.dayId));

    if (!isSubscribed) {
      continue;
    }

    const status = getDerivedSubscriptionStatus(member.qualifyingBookings);
    await upsertSeriesSubscription(
      {
        userId: member.userId,
        seriesKey,
        seriesName,
        status,
      },
      subscriptionStore,
    );
    subscriptionCount += 1;
    bookingCount += await ensureLinkedSeriesBookingsForUser(
      {
        id: member.userId,
        name: member.userName,
        picture: member.userImage,
      },
      days,
      status,
      member.existingDayIds,
      store,
      summaryStore,
    );
  }

  return {
    seriesKey,
    seriesName,
    subscriptionCount,
    bookingCount,
  };
}

export async function reconcileAllSeriesSubscriptions(
  days: AvailableDay[],
  store: BookingPersistence = bookingStore,
  summaryStore: BookingSummaryPersistence = dayAttendanceSummaryStore,
  subscriptionStore: SeriesSubscriptionPersistence = seriesSubscriptionStore,
) {
  const groups = new Map<string, AvailableDay[]>();

  for (const day of days) {
    const seriesKey = getLinkedSeriesKey(day);
    if (!seriesKey) {
      continue;
    }

    const current = groups.get(seriesKey);
    if (current) {
      current.push(day);
      continue;
    }

    groups.set(seriesKey, [day]);
  }

  const results = [];
  for (const seriesDays of groups.values()) {
    results.push(
      await reconcileSeriesSubscriptionsForDays(seriesDays, store, summaryStore, subscriptionStore),
    );
  }

  return results;
}
