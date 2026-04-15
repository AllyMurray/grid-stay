import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import type { AvailableDay } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { DashboardIndexPage } from '~/pages/dashboard';
import type { Route } from './+types/index';

interface LoaderData {
  firstName: string;
  availableDaysCount: number;
  daysThisMonth: number;
  activeBookingsCount: number;
  sharedStayCount: number;
  nextDays: AvailableDay[];
  upcomingBookings: BookingRecord[];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [snapshot, bookings] = await Promise.all([
    getAvailableDaysSnapshot(),
    listMyBookings(user.id),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  const activeBookings = bookings.filter(
    (booking) => booking.status !== 'cancelled' && booking.date >= today,
  );
  const sharedStayCount = new Set(
    activeBookings
      .map((booking) => booking.accommodationName?.trim())
      .filter((name): name is string => Boolean(name)),
  ).size;

  return Response.json(
    {
      firstName: user.name.split(' ')[0] ?? user.name,
      availableDaysCount: snapshot?.days.length ?? 0,
      daysThisMonth:
        snapshot?.days.filter((day) => day.date.startsWith(monthPrefix))
          .length ?? 0,
      activeBookingsCount: activeBookings.length,
      sharedStayCount,
      nextDays: snapshot?.days.slice(0, 5) ?? [],
      upcomingBookings: activeBookings.slice(0, 5),
    } satisfies LoaderData,
    { headers },
  );
}

export default function DashboardIndexRoute() {
  return (
    <DashboardIndexPage {...(useLoaderData<typeof loader>() as LoaderData)} />
  );
}
