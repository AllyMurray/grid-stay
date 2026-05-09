import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { SeriesSubscriptionRecord } from '~/lib/db/entities/series-subscription.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import { seriesSubscriptionStore } from '~/lib/db/services/series-subscription.server';
import { normalizeAvailableDayCircuit } from './aggregation.server';
import { getLinkedSeriesKey, getLinkedSeriesName } from './series.server';
import type { AvailableDay } from './types';

export interface MemberRaceSeriesSubscription {
  seriesKey: string;
  seriesName: string;
  status: SeriesSubscriptionRecord['status'];
  updatedAt: string;
  linkedDayCount: number;
  bookedCount: number;
  maybeCount: number;
  missingCount: number;
  cancelledCount: number;
}

export interface MemberRaceSeriesOption {
  seriesKey: string;
  seriesName: string;
  dayCount: number;
}

export interface MemberRaceSeriesOverview {
  subscriptions: MemberRaceSeriesSubscription[];
  joinOptions: MemberRaceSeriesOption[];
}

export interface MemberRaceSeriesOverviewInput {
  subscriptions: SeriesSubscriptionRecord[];
  bookings: BookingRecord[];
  days: AvailableDay[];
  today?: string;
}

export interface LoadMemberRaceSeriesOverviewDependencies {
  loadSubscriptions?: (userId: string) => Promise<SeriesSubscriptionRecord[]>;
  loadBookings?: (userId: string) => Promise<BookingRecord[]>;
  loadSnapshot?: typeof getAvailableDaysSnapshot;
  loadManualDays?: typeof listManualDays;
  today?: string;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getYear(value: string) {
  return value.slice(0, 4);
}

function sortSubscriptions(
  left: MemberRaceSeriesSubscription,
  right: MemberRaceSeriesSubscription,
) {
  return left.seriesName.localeCompare(right.seriesName);
}

function sortOptions(left: MemberRaceSeriesOption, right: MemberRaceSeriesOption) {
  return left.seriesName.localeCompare(right.seriesName);
}

export function buildCurrentYearRaceSeriesOptions(
  days: AvailableDay[],
  today = getTodayDate(),
): MemberRaceSeriesOption[] {
  const currentYear = getYear(today);
  const optionsByKey = new Map<string, MemberRaceSeriesOption>();

  for (const day of days) {
    if (day.date < today || getYear(day.date) !== currentYear) {
      continue;
    }

    const seriesKey = getLinkedSeriesKey(day);
    const seriesName = getLinkedSeriesName(day);
    if (!seriesKey || !seriesName) {
      continue;
    }

    const current = optionsByKey.get(seriesKey);
    if (current) {
      current.dayCount += 1;
      continue;
    }

    optionsByKey.set(seriesKey, {
      seriesKey,
      seriesName,
      dayCount: 1,
    });
  }

  return [...optionsByKey.values()].toSorted(sortOptions);
}

export function buildMemberRaceSeriesOverview({
  subscriptions,
  bookings,
  days,
  today = getTodayDate(),
}: MemberRaceSeriesOverviewInput): MemberRaceSeriesOverview {
  const normalizedDays = days.map(normalizeAvailableDayCircuit);
  const daysBySeriesKey = new Map<string, AvailableDay[]>();

  for (const day of normalizedDays) {
    const seriesKey = getLinkedSeriesKey(day);
    if (!seriesKey) {
      continue;
    }

    const current = daysBySeriesKey.get(seriesKey);
    if (current) {
      current.push(day);
      continue;
    }

    daysBySeriesKey.set(seriesKey, [day]);
  }

  const bookingsByDayId = new Map(bookings.map((booking) => [booking.dayId, booking]));
  const subscribedSeriesKeys = new Set(subscriptions.map((subscription) => subscription.seriesKey));
  const joinOptions = buildCurrentYearRaceSeriesOptions(normalizedDays, today).filter(
    (option) => !subscribedSeriesKeys.has(option.seriesKey),
  );

  return {
    subscriptions: subscriptions
      .map((subscription) => {
        const linkedDays = daysBySeriesKey.get(subscription.seriesKey) ?? [];
        const linkedBookings = linkedDays.flatMap((day) => {
          const booking = bookingsByDayId.get(day.dayId);
          return booking ? [booking] : [];
        });

        return {
          seriesKey: subscription.seriesKey,
          seriesName:
            linkedDays.map(getLinkedSeriesName).find((name): name is string => Boolean(name)) ??
            subscription.seriesName,
          status: subscription.status,
          updatedAt: subscription.updatedAt,
          linkedDayCount: linkedDays.length,
          bookedCount: linkedBookings.filter((booking) => booking.status === 'booked').length,
          maybeCount: linkedBookings.filter((booking) => booking.status === 'maybe').length,
          missingCount: linkedDays.filter((day) => !bookingsByDayId.has(day.dayId)).length,
          cancelledCount: linkedBookings.filter((booking) => booking.status === 'cancelled').length,
        };
      })
      .toSorted(sortSubscriptions),
    joinOptions,
  };
}

export async function loadMemberRaceSeriesOverview(
  userId: string,
  dependencies: LoadMemberRaceSeriesOverviewDependencies = {},
): Promise<MemberRaceSeriesOverview> {
  const loadSubscriptions =
    dependencies.loadSubscriptions ??
    ((id: string) => seriesSubscriptionStore.listByUser(id));
  const loadBookings = dependencies.loadBookings ?? listMyBookings;
  const loadSnapshot = dependencies.loadSnapshot ?? getAvailableDaysSnapshot;
  const loadManual = dependencies.loadManualDays ?? listManualDays;
  const [subscriptions, bookings, snapshot, manualDays] = await Promise.all([
    loadSubscriptions(userId),
    loadBookings(userId),
    loadSnapshot(),
    loadManual(),
  ]);

  return buildMemberRaceSeriesOverview({
    subscriptions,
    bookings,
    days: [...(snapshot?.days ?? []), ...manualDays],
    today: dependencies.today,
  });
}
