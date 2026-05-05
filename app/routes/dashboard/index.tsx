import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  hasArrangedAccommodation,
  hasBookedAccommodation,
  needsAccommodationPlan,
} from '~/lib/bookings/accommodation';
import { loadUpcomingAvailableDaysOverview } from '~/lib/days/dashboard-feed.server';
import type { AvailableDay, DayAttendanceSummary } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import {
  listAttendanceByDay,
  listMyBookings,
} from '~/lib/db/services/booking.server';
import {
  type DayAttendanceOverview,
  dayAttendanceSummaryStore,
} from '~/lib/db/services/day-attendance-summary.server';
import { listGarageShareRequestsForUser } from '~/lib/db/services/garage-sharing.server';
import { DashboardIndexPage } from '~/pages/dashboard';
import type { Route } from './+types/index';

interface OverviewGroupDay {
  day: AvailableDay;
  attendeeCount: number;
  accommodationNames: string[];
  garageOpenSpaceCount: number;
}

interface LoaderData {
  firstName: string;
  availableDaysCount: number;
  daysThisMonth: number;
  activeBookingsCount: number;
  accommodationPlanCount: number;
  maybeBookingsCount: number;
  tripsMissingStayCount: number;
  missingBookingReferenceCount: number;
  missingHotelReferenceCount: number;
  pendingGarageRequestsCount: number;
  nextDays: AvailableDay[];
  upcomingBookings: BookingRecord[];
  nextTripAttendance: DayAttendanceSummary | null;
  groupDays: OverviewGroupDay[];
}

function emptyAttendanceOverview(): DayAttendanceOverview {
  return {
    attendeeCount: 0,
    accommodationNames: [],
    garageOwnerCount: 0,
    garageOpenSpaceCount: 0,
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [availableDays, bookings, garageShareRequests] = await Promise.all([
    loadUpcomingAvailableDaysOverview(),
    listMyBookings(user.id),
    listGarageShareRequestsForUser(user.id),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  const activeBookings = bookings.filter(
    (booking) => booking.status !== 'cancelled' && booking.date >= today,
  );
  const maybeBookingsCount = activeBookings.filter(
    (booking) => booking.status === 'maybe',
  ).length;
  const tripsMissingStayCount = activeBookings.filter(
    needsAccommodationPlan,
  ).length;
  const missingBookingReferenceCount = activeBookings.filter(
    (booking) => !booking.bookingReference?.trim(),
  ).length;
  const missingHotelReferenceCount = activeBookings.filter(
    (booking) =>
      hasBookedAccommodation(booking) &&
      !booking.accommodationReference?.trim(),
  ).length;
  const accommodationPlanCount = activeBookings.filter(
    hasArrangedAccommodation,
  ).length;
  const nextDays = availableDays.days.slice(0, 5);
  const upcomingBookings = activeBookings.slice(0, 5);
  const nextBooking = upcomingBookings[0] ?? null;
  const nextLiveDay = nextDays[0] ?? null;
  const nextBookingDay = nextBooking
    ? (availableDays.days.find((day) => day.dayId === nextBooking.dayId) ??
      null)
    : null;
  const focusDay = nextBooking ? nextBookingDay : nextLiveDay;
  const focusDayId = nextBooking?.dayId ?? focusDay?.dayId ?? null;
  const nextTripAttendance = focusDayId
    ? await listAttendanceByDay(focusDayId, undefined, undefined, user.id)
    : null;
  const activeBookingDayIds = new Set(
    activeBookings.map((booking) => booking.dayId),
  );
  const groupDayCandidates = availableDays.days.slice(0, 40);
  const groupDaySummaries = await dayAttendanceSummaryStore.getByDayIds(
    groupDayCandidates.map((day) => day.dayId),
  );
  const groupDays = groupDayCandidates
    .map((day) => {
      const summary =
        groupDaySummaries.get(day.dayId) ?? emptyAttendanceOverview();
      return {
        day,
        attendeeCount: summary.attendeeCount,
        accommodationNames: summary.accommodationNames,
        garageOpenSpaceCount: summary.garageOpenSpaceCount ?? 0,
      };
    })
    .filter(
      (day) => day.attendeeCount > 0 && !activeBookingDayIds.has(day.day.dayId),
    )
    .slice(0, 4);
  const pendingGarageRequestsCount = garageShareRequests.filter(
    (request) => request.isIncoming && request.status === 'pending',
  ).length;

  return Response.json(
    {
      firstName: user.name.split(' ')[0] ?? user.name,
      availableDaysCount: availableDays.days.length,
      daysThisMonth: availableDays.days.filter((day) =>
        day.date.startsWith(monthPrefix),
      ).length,
      activeBookingsCount: activeBookings.length,
      accommodationPlanCount,
      maybeBookingsCount,
      tripsMissingStayCount,
      missingBookingReferenceCount,
      missingHotelReferenceCount,
      pendingGarageRequestsCount,
      nextDays,
      upcomingBookings,
      nextTripAttendance,
      groupDays,
    } satisfies LoaderData,
    { headers },
  );
}

export default function DashboardIndexRoute() {
  return (
    <DashboardIndexPage {...(useLoaderData<typeof loader>() as LoaderData)} />
  );
}
