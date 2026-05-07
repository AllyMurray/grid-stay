import type { User } from '~/lib/auth/schemas';
import { resolveAccommodationStatus } from '~/lib/bookings/accommodation';
import { resolveArrivalDateTime } from '~/lib/dates/arrival';
import type { SharedDayPlan } from '~/lib/days/shared-plan.server';
import { getSharedDayPlan } from '~/lib/days/shared-plan.server';
import type { AvailableDay, DayAttendanceSummary } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { bookingStore, listAttendanceByDay } from '~/lib/db/services/booking.server';
import {
  type EventCostSummary,
  loadEventCostSummary,
} from '~/lib/db/services/cost-splitting.server';
import {
  listDayNotificationsForDay,
  type UserDayNotification,
} from '~/lib/db/services/day-notification.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';

export interface EventBriefingDay {
  dayId: string;
  date: string;
  type: BookingRecord['type'];
  circuit: string;
  circuitId?: string;
  circuitName?: string;
  layout?: string;
  circuitKnown?: boolean;
  provider: string;
  description: string;
  bookingUrl?: string;
  availability?: string;
}

export interface EventBriefingUpdate {
  notificationId: string;
  type: UserDayNotification['type'];
  description: string;
  provider: string;
  date: string;
  circuit: string;
  createdAt: string;
  isRead: boolean;
}

export interface EventBriefingPrompt {
  id: string;
  severity: 'needs_attention' | 'optional';
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export interface EventBriefingData {
  booking: BookingRecord;
  day: EventBriefingDay;
  attendance: DayAttendanceSummary;
  sharedPlan: SharedDayPlan | null;
  costSummary: EventCostSummary;
  latestUpdates: EventBriefingUpdate[];
  readinessPrompts: EventBriefingPrompt[];
}

function createBookingHref(bookingId: string) {
  const params = new URLSearchParams({ booking: bookingId });
  return `/dashboard/bookings?${params.toString()}`;
}

function createDayHref(dayId: string) {
  const params = new URLSearchParams({ day: dayId });
  return `/dashboard/days?${params.toString()}`;
}

function toEventBriefingDay(booking: BookingRecord, availableDay: AvailableDay | null) {
  return {
    dayId: booking.dayId,
    date: booking.date,
    type: booking.type,
    circuit: booking.circuit,
    ...(booking.circuitId ? { circuitId: booking.circuitId } : {}),
    ...(booking.circuitName ? { circuitName: booking.circuitName } : {}),
    ...(booking.layout ? { layout: booking.layout } : {}),
    ...(booking.circuitKnown !== undefined ? { circuitKnown: booking.circuitKnown } : {}),
    provider: booking.provider,
    description: booking.description,
    ...(availableDay?.bookingUrl ? { bookingUrl: availableDay.bookingUrl } : {}),
    ...(availableDay?.source.metadata?.availability
      ? { availability: availableDay.source.metadata.availability }
      : {}),
  };
}

function toLatestUpdate(notification: UserDayNotification): EventBriefingUpdate {
  return {
    notificationId: notification.notificationId,
    type: notification.type,
    description: notification.description,
    provider: notification.provider,
    date: notification.date,
    circuit: notification.circuit,
    createdAt: notification.createdAt,
    isRead: notification.isRead,
  };
}

function hasSharedPlanNotes(sharedPlan: SharedDayPlan | null) {
  return Boolean(sharedPlan?.notes.trim());
}

function hasDinnerPlan(sharedPlan: SharedDayPlan | null) {
  return Boolean(
    sharedPlan?.dinnerVenue.trim() ||
    sharedPlan?.dinnerTime.trim() ||
    sharedPlan?.dinnerHeadcount.trim() ||
    sharedPlan?.dinnerNotes.trim(),
  );
}

function hasGaragePlan(booking: BookingRecord, attendance: DayAttendanceSummary) {
  if (booking.garageBooked) {
    return true;
  }

  return Boolean(
    attendance.garageShareOptions?.some(
      (option) =>
        option.myRequestStatus === 'approved' ||
        option.myRequestStatus === 'pending' ||
        option.ownerUserId === booking.userId,
    ),
  );
}

function buildReadinessPrompts({
  booking,
  attendance,
  sharedPlan,
  costSummary,
}: {
  booking: BookingRecord;
  attendance: DayAttendanceSummary;
  sharedPlan: SharedDayPlan | null;
  costSummary: EventCostSummary;
}): EventBriefingPrompt[] {
  const bookingHref = createBookingHref(booking.bookingId);
  const dayHref = createDayHref(booking.dayId);
  const prompts: EventBriefingPrompt[] = [];
  const accommodationStatus = resolveAccommodationStatus(booking);

  if (booking.status === 'maybe') {
    prompts.push({
      id: 'confirm-attendance',
      severity: 'needs_attention',
      title: 'Confirm your attendance',
      description: 'You are marked as maybe for this event.',
      href: bookingHref,
      actionLabel: 'Update trip',
    });
  }

  if (!resolveArrivalDateTime(booking)) {
    prompts.push({
      id: 'arrival-time',
      severity: 'needs_attention',
      title: 'Add arrival time',
      description: 'Add when you expect to arrive so the group can coordinate paddock plans.',
      href: bookingHref,
      actionLabel: 'Update stay',
    });
  }

  if (accommodationStatus === 'unknown' || accommodationStatus === 'looking') {
    prompts.push({
      id: 'accommodation-plan',
      severity: 'needs_attention',
      title: 'Set accommodation plan',
      description: 'Tell the group whether you have a hotel, are looking, or do not need one.',
      href: bookingHref,
      actionLabel: 'Update stay',
    });
  }

  if (!hasGaragePlan(booking, attendance)) {
    prompts.push({
      id: 'garage-plan',
      severity: 'optional',
      title: 'Check garage plan',
      description: 'You do not have a garage or pending garage share request for this event.',
      href: dayHref,
      actionLabel: 'Open day plan',
    });
  }

  if (!hasSharedPlanNotes(sharedPlan)) {
    prompts.push({
      id: 'shared-plan',
      severity: 'optional',
      title: 'Add shared logistics',
      description: 'No shared planning note is saved for meeting points or paddock details.',
      href: dayHref,
      actionLabel: 'Open day plan',
    });
  }

  if (!hasDinnerPlan(sharedPlan)) {
    prompts.push({
      id: 'dinner-plan',
      severity: 'optional',
      title: 'Add dinner plan',
      description: 'No shared dinner venue, time, headcount, or notes are saved yet.',
      href: dayHref,
      actionLabel: 'Open day plan',
    });
  }

  if (costSummary.groups.length === 0) {
    prompts.push({
      id: 'cost-groups',
      severity: 'optional',
      title: 'Review shared costs',
      description: 'No cost groups are visible to you for this event yet.',
      href: dayHref,
      actionLabel: 'Open day plan',
    });
  }

  return prompts;
}

async function findAvailableDay(dayId: string): Promise<AvailableDay | null> {
  const [snapshot, manualDays] = await Promise.all([getAvailableDaysSnapshot(), listManualDays()]);

  return [...(snapshot?.days ?? []), ...manualDays].find((day) => day.dayId === dayId) ?? null;
}

export async function loadEventBriefing(
  bookingId: string,
  user: Pick<User, 'id'>,
): Promise<EventBriefingData> {
  const booking = await bookingStore.getByUser(user.id, bookingId);

  if (!booking || booking.status === 'cancelled') {
    throw new Response('Briefing not found', { status: 404 });
  }

  const [availableDay, attendance, sharedPlan, latestNotifications] = await Promise.all([
    findAvailableDay(booking.dayId),
    listAttendanceByDay(booking.dayId, undefined, undefined, user.id),
    getSharedDayPlan(booking.dayId),
    listDayNotificationsForDay(booking.dayId, user.id, { limit: 5 }),
  ]);
  const costSummary = await loadEventCostSummary(booking.dayId, user.id, attendance);

  return {
    booking,
    day: toEventBriefingDay(booking, availableDay),
    attendance,
    sharedPlan,
    costSummary,
    latestUpdates: latestNotifications.map(toLatestUpdate),
    readinessPrompts: buildReadinessPrompts({
      booking,
      attendance,
      sharedPlan,
      costSummary,
    }),
  };
}
